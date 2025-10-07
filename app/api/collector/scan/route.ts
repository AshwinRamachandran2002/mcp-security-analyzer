import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import crypto from 'crypto';
import { 
  MCPInventoryV2, 
  MCPConfig, 
  MCPProcess, 
  MCPServer,
  EnhancedMCPFinding, 
  IDE_PATTERNS,
  RISK_BOOSTERS,
  CollectorMetrics,
  UserContext
} from '@/lib/collector-types';
import { redactSecrets, redactConfigSecrets } from '@/lib/redaction';
import { 
  generateServerFingerprint, 
  generateProcessFingerprint,
  deduplicateServers,
  deduplicateProcesses 
} from '@/lib/fingerprinting';
import { getRepoContext, getUserContext, detectDevContainer, detectWSL, isInContainer } from '@/lib/git-context';

const execAsync = promisify(exec);

export async function POST(request: NextRequest) {
  try {
    // Run the collector script
    const result = await runCollector();
    
    return NextResponse.json(result);
  } catch (error) {
    console.error('Collector scan failed:', error);
    return NextResponse.json(
      { error: 'Failed to run collector scan' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    // Try to read existing inventory file
    const inventoryPath = path.join(process.cwd(), 'mcp_inventory.json');
    const data = await fs.readFile(inventoryPath, 'utf-8');
    const inventory = JSON.parse(data);
    
    return NextResponse.json(inventory);
  } catch (error) {
    return NextResponse.json(
      { error: 'No inventory data available' },
      { status: 404 }
    );
  }
}

export async function runCollector(): Promise<MCPInventoryV2> {
  const startTime = Date.now();
  const scanId = crypto.randomUUID();
  const userContext = await getUserContext();
  
  const inventory: MCPInventoryV2 = {
    schema_version: "2.0",
    collector_version: "2.0.0",
    scan_id: scanId,
    meta: {
      hostname: os.hostname(),
      os: {
        system: os.type(),
        release: os.release()
      },
      user: userContext,
      collected_at: Math.floor(Date.now() / 1000),
      scan_duration_ms: 0 // Will be updated at the end
    },
    configs: [],
    processes: {
      supported: true,
      items: []
    },
    findings: [],
    metrics: {
      coverage: {
        configs_found: 0,
        repos_with_mcp: 0,
        ide_detection_rate: 0
      },
      shadow_mcp: {
        stdio_processes: 0,
        unsanctioned_hosts: []
      },
      performance: {
        time_to_evidence_ms: 0,
        scan_duration_ms: 0
      },
      drift: {
        configs_changed: 0,
        new_findings: 0
      }
    }
  };

  // Discover configurations
  console.log('🔍 Discovering configurations...');
  const configs = await discoverConfigs();
  inventory.configs = configs;

  // Discover processes
  console.log('🔍 Discovering processes...');
  const processes = await discoverProcesses();
  inventory.processes.items = processes;

  // Generate findings
  console.log('🔍 Generating findings...');
  const findings = generateFindings(configs, processes);
  inventory.findings = findings;

  // Calculate metrics
  const endTime = Date.now();
  const scanDurationMs = endTime - startTime;
  
  inventory.meta.scan_duration_ms = scanDurationMs;
  inventory.metrics.coverage.configs_found = configs.length;
  inventory.metrics.coverage.repos_with_mcp = configs.filter(c => c.repo_context).length;
  inventory.metrics.shadow_mcp.stdio_processes = processes.length;
  inventory.metrics.shadow_mcp.unsanctioned_hosts = Array.from(new Set(
    findings
      .filter(f => f.type === 'mcp_http_config' && f.risk_boosters.includes(RISK_BOOSTERS.UNSANCTIONED_HOST))
      .map(f => f.url_host)
      .filter(Boolean)
  )) as string[];
  inventory.metrics.performance.scan_duration_ms = scanDurationMs;
  inventory.metrics.performance.time_to_evidence_ms = findings.length > 0 ? scanDurationMs : 0;

  // Save inventory to file
  const inventoryPath = path.join(process.cwd(), 'mcp_inventory.json');
  await fs.writeFile(inventoryPath, JSON.stringify(inventory, null, 2));

  // Also feed into enterprise aggregation system
  try {
    const { EnterpriseAggregator } = await import('@/lib/enterprise-aggregator');
    const aggregator = new EnterpriseAggregator();
    
    // Generate endpoint ID from hostname
    const endpointId = `endpoint_${inventory.meta.hostname.replace(/[^a-zA-Z0-9]/g, '_')}`;
    
    // Auto-register this endpoint if not already registered
    await aggregator.registerEndpoint({
      endpoint_id: endpointId,
      hostname: inventory.meta.hostname,
      environment: 'development', // Could be detected from git branch or config
      business_unit: 'security_team',
      owner: inventory.meta.user.os_user,
      registered_at: Math.floor(Date.now() / 1000),
      scan_frequency: 60,
      enabled: true
    });
    
    // Save scan data for enterprise aggregation
    await aggregator.saveEndpointScan(endpointId, inventory);
    
    console.log(`📊 Enterprise: Saved scan for endpoint ${endpointId}`);
  } catch (error) {
    console.error('Failed to feed enterprise system:', error);
    // Don't fail the scan if enterprise aggregation fails
  }

  console.log(`✅ Scan complete: ${configs.length} configs, ${processes.length} processes, ${findings.length} findings in ${scanDurationMs}ms`);
  
  return inventory;
}

async function discoverConfigs(): Promise<MCPConfig[]> {
  const configs: MCPConfig[] = [];
  const searchPaths = [
    // Current directory
    './.vscode/mcp.json',
    './mcp.json',
    './test_mcp.json',
    
    // Parent directory (for this project structure)
    '../.vscode/mcp.json',
    '../mcp.json',
    '../test_mcp.json',
    
    // JetBrains IDEs
    './.idea/mcp.json',
    '../.idea/mcp.json',
    
    // Visual Studio
    './.vs/mcp.json',
    '../.vs/mcp.json',
    
    // DevContainer
    './.devcontainer/mcp.json',
    '../.devcontainer/mcp.json',
    './.devcontainer/.vscode/mcp.json',
    '../.devcontainer/.vscode/mcp.json',
    
    // User-level configs
    path.join(os.homedir(), '.mcp.json'),
    path.join(os.homedir(), '.cursor/mcp.json'),
    path.join(os.homedir(), '.claude.json'),
    
    // Windows user paths
    ...(process.platform === 'win32' ? [
      path.join(process.env.USERPROFILE || '', '.mcp.json'),
      path.join(process.env.APPDATA || '', 'Code', 'User', 'mcp.json'),
    ] : []),
  ];

  for (const searchPath of searchPaths) {
    try {
      const fullPath = path.resolve(searchPath);
      const stats = await fs.stat(fullPath);
      const content = await fs.readFile(fullPath, 'utf-8');
      const hash = crypto.createHash('sha256').update(content).digest('hex');
      
      let mcpConfig;
      try {
        const parsed = JSON.parse(content);
        mcpConfig = parsed;
        
        // Handle different config structures
        if (parsed.mcp && parsed.mcp.servers) {
          mcpConfig = parsed.mcp;
        } else if (parsed.servers) {
          mcpConfig = parsed;
        } else if (parsed.mcpServers) {
          mcpConfig = { servers: parsed.mcpServers };
        }
      } catch (parseError) {
        continue; // Skip malformed JSON
      }

      if (mcpConfig && mcpConfig.servers) {
        const servers: MCPServer[] = [];
        
        // Handle both object and array server formats
        const serverEntries = Array.isArray(mcpConfig.servers) 
          ? mcpConfig.servers 
          : Object.entries(mcpConfig.servers);

        for (const [key, server] of serverEntries) {
          const serverName = typeof key === 'string' ? key : (server as any).name || 'unknown';
          const serverConfig = typeof server === 'object' ? server as any : {};
          
          const serverObj: MCPServer = {
            name: serverName,
            transport: serverConfig.transport || (serverConfig.command ? 'stdio' : 'http'),
            command: serverConfig.command,
            args: serverConfig.args || [],
            url: serverConfig.url || serverConfig.endpoint
          };
          
          // Generate fingerprint
          serverObj.fingerprint = generateServerFingerprint(serverObj);
          
          servers.push(serverObj);
        }

        // Deduplicate servers
        const deduplicatedServers = deduplicateServers(servers);
        
        // Get repo context
        const repoContext = await getRepoContext(fullPath);
        
        configs.push({
          path: fullPath,
          mtime: Math.floor(stats.mtime.getTime() / 1000),
          sha256: hash,
          servers: deduplicatedServers,
          repo_context: repoContext || undefined
        });
      }
    } catch (error) {
      // File doesn't exist or can't be read, continue
      continue;
    }
  }

  return configs;
}

async function discoverProcesses(): Promise<MCPProcess[]> {
  const processes: MCPProcess[] = [];
  
  // Initial scan
  const initialProcesses = await scanProcessesOnce();
  processes.push(...initialProcesses);
  
  // Short rescan window to catch ephemeral processes
  console.log('🔄 Waiting 3 seconds to catch ephemeral processes...');
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  const rescannedProcesses = await scanProcessesOnce();
  processes.push(...rescannedProcesses);
  
  // Deduplicate and return
  return deduplicateProcesses(processes);
}

async function scanProcessesOnce(): Promise<MCPProcess[]> {
  const processes: MCPProcess[] = [];
  
  try {
    // Get all processes (cross-platform approach)
    let psOutput;
    if (process.platform === 'win32') {
      const { stdout } = await execAsync('wmic process get processid,parentprocessid,name,commandline /format:csv');
      psOutput = stdout;
    } else {
      const { stdout } = await execAsync('ps -eo pid,ppid,comm,args');
      psOutput = stdout;
    }

    const lines = psOutput.split('\n').slice(1); // Skip header
    const ideProcesses = new Map();
    const allProcesses = new Map();

    // Parse processes
    for (const line of lines) {
      if (!line.trim()) continue;
      
      let pid, ppid, name, cmd;
      
      if (process.platform === 'win32') {
        const parts = line.split(',');
        if (parts.length < 4) continue;
        cmd = parts[1] || '';
        name = parts[2] || '';
        ppid = parseInt(parts[3]) || 0;
        pid = parseInt(parts[4]) || 0;
      } else {
        const parts = line.trim().split(/\s+/);
        if (parts.length < 4) continue;
        pid = parseInt(parts[0]) || 0;
        ppid = parseInt(parts[1]) || 0;
        name = parts[2] || '';
        cmd = parts.slice(3).join(' ');
      }

      if (pid === 0) continue;

      allProcesses.set(pid, { pid, ppid, name, cmd });

      // Check for MCP processes immediately (for debugging)
      const cmdLower = cmd.toLowerCase();
      if (cmdLower.includes('mcp') ||
          cmdLower.includes('mcp-server') ||
          cmdLower.includes('modelcontextprotocol')) {
        console.log(`🚀 Found MCP hint in process: ${name} (PID: ${pid}) - ${cmd}`);
      }

      // Check if this is an IDE process using enhanced patterns
      const lowerName = name.toLowerCase();
      const lowerCmd = cmd.toLowerCase();
      
      let isIDE = false;
      for (const [category, patterns] of Object.entries(IDE_PATTERNS)) {
        if (patterns.some(pattern => 
          lowerName.includes(pattern) || 
          lowerCmd.includes(pattern) ||
          lowerName.endsWith(pattern) ||
          lowerName.startsWith(pattern)
        )) {
          isIDE = true;
          break;
        }
      }
      
      if (isIDE) {
        ideProcesses.set(pid, { pid, ppid, name, cmd });
        console.log(`🎯 Found IDE process: ${name} (PID: ${pid})`);
      }
    }

    // Find MCP-related child processes
    const mcpProcesses = new Set();
    const now = Math.floor(Date.now() / 1000);

    function findChildren(parentPid: number, parentName = '') {
      for (const [pid, process] of allProcesses) {
        if (process.ppid === parentPid) {
          const cmdLower = process.cmd.toLowerCase();
          
          // Check for MCP heuristics
          if (cmdLower.includes('mcp') ||
              cmdLower.includes('mcp-server') ||
              cmdLower.includes('modelcontextprotocol') ||
              /npx.*mcp/.test(cmdLower) ||
              /uv run.*mcp/.test(cmdLower) ||
              /python.*mcp/.test(cmdLower) ||
              /node.*mcp/.test(cmdLower)) {
            
            console.log(`✅ MCP MATCH! Child of ${parentName}: ${process.cmd}`);
            
            processes.push({
              pid: process.pid,
              ppid: process.ppid,
              parent_name: parentName || process.name,
              cmd: process.cmd,
              cmd_redacted: redactSecrets(process.cmd),
              first_seen: now,
              last_seen: now
            });
          }
          
          // Recursively check children
          findChildren(pid, parentName || process.name);
        }
      }
    }

    // Check children of IDE processes
    console.log(`🔍 Found ${ideProcesses.size} IDE processes, checking children...`);
    for (const [pid, ideProcess] of ideProcesses) {
      console.log(`🎯 Checking children of ${ideProcess.name} (PID: ${pid})`);
      findChildren(pid, ideProcess.name);
    }

  } catch (error) {
    console.error('Process discovery failed:', error);
    // Return empty array but mark as supported
  }

  return processes;
}

function generateFindings(configs: MCPConfig[], processes: MCPProcess[]): EnhancedMCPFinding[] {
  const findings: EnhancedMCPFinding[] = [];
  const now = Math.floor(Date.now() / 1000);

  // Process-based findings
  for (const process of processes) {
    const riskBoosters = [];
    if (process.cmd.toLowerCase().includes('shell')) riskBoosters.push(RISK_BOOSTERS.SHELL_CAPABILITIES);
    if (process.cmd.toLowerCase().includes('fs') || process.cmd.toLowerCase().includes('filesystem')) riskBoosters.push(RISK_BOOSTERS.FILE_SYSTEM_ACCESS);
    
    findings.push({
      severity: 'high',
      type: 'mcp_stdio_process',
      evidence: [`${process.parent_name} → ${process.cmd_redacted}`],
      owner_hint: process.parent_name.includes('Code') ? 'VS Code user' : 'IDE user',
      fingerprint: process.fingerprint || generateProcessFingerprint(process),
      evidence_bundle: {
        file_path: '',
        file_hash: '',
        parent_ide: process.parent_name,
        cmdline_redacted: process.cmd_redacted,
        first_seen: process.first_seen,
        last_seen: process.last_seen
      },
      risk_boosters: riskBoosters
    });
  }

  // Config-based findings
  for (const config of configs) {
    for (const server of config.servers) {
      const riskBoosters = [];
      
      if (server.transport === 'stdio' && server.command) {
        if (server.command.includes('filesystem') || server.args?.some(arg => arg.includes('/'))) {
          riskBoosters.push(RISK_BOOSTERS.FILE_SYSTEM_ACCESS);
        }
        riskBoosters.push(RISK_BOOSTERS.STDIO_WITH_COMMAND);
        
        findings.push({
          severity: 'high',
          type: 'mcp_stdio_config',
          evidence: [`${server.command} ${server.args?.join(' ') || ''}`],
          source_file: config.path,
          fingerprint: server.fingerprint || generateServerFingerprint(server),
          evidence_bundle: {
            file_path: config.path,
            file_hash: config.sha256,
            cmdline_redacted: redactSecrets(`${server.command} ${server.args?.join(' ') || ''}`),
            first_seen: now,
            last_seen: now,
            repo_context: config.repo_context
          },
          risk_boosters: riskBoosters
        });
      } else if (server.transport === 'http' && server.url) {
        try {
          const url = new URL(server.url);
          
          // Check for authentication headers or credentials
          const configStr = JSON.stringify(server);
          if (configStr.includes('Authorization') || configStr.includes('headers') || configStr.includes('token')) {
            riskBoosters.push(RISK_BOOSTERS.HTTP_WITH_AUTH);
          }
          
          // Check if host is potentially unsanctioned (basic check)
          const trustedHosts = ['localhost', '127.0.0.1', 'api.githubcopilot.com'];
          if (!trustedHosts.some(trusted => url.hostname.includes(trusted))) {
            riskBoosters.push(RISK_BOOSTERS.UNSANCTIONED_HOST);
          }
          
          findings.push({
            severity: riskBoosters.length > 0 ? 'high' : 'med',
            type: 'mcp_http_config',
            url_host: url.hostname,
            path: url.pathname,
            source_file: config.path,
            fingerprint: server.fingerprint || generateServerFingerprint(server),
            evidence_bundle: {
              file_path: config.path,
              file_hash: config.sha256,
              cmdline_redacted: url.toString().split('?')[0], // Remove query params
              first_seen: now,
              last_seen: now,
              repo_context: config.repo_context
            },
            risk_boosters: riskBoosters
          });
        } catch (urlError) {
          // Invalid URL, skip
        }
      }
    }
  }

  return findings;
}
