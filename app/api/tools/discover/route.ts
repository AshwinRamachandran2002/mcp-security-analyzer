import { NextRequest, NextResponse } from 'next/server';
import { EnterpriseAggregator } from '@/lib/enterprise-aggregator';
import fs from 'fs/promises';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { URL } from 'url';

const execAsync = promisify(exec);

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const serverName = searchParams.get('server');
  
  if (!serverName) {
    return NextResponse.json({ error: 'Server name required' }, { status: 400 });
  }
  
  try {
    // Get server configuration from enterprise data
    const serverConfig = await getServerConfig(serverName);
    if (!serverConfig) {
      return NextResponse.json({ error: 'Server not found' }, { status: 404 });
    }
    
    // Try to discover tools for this server
    const tools = await discoverServerTools(serverConfig);
    
    // Save discovered tools to data file
    if (tools && Object.keys(tools).length > 0) {
      await saveServerTools(serverName, tools);
    }
    
    // Calculate actual tool count
    let actualToolCount = 0;
    if (tools) {
      Object.values(tools).forEach((serverTools: any) => {
        if (typeof serverTools === 'object') {
          actualToolCount += Object.keys(serverTools).length;
        }
      });
    }

    // Determine discovery method
    let discoveryMethod = 'failed';
    if (tools) {
      // Check if tools came from VS Code extraction
      const firstServerKey = Object.keys(tools)[0];
      if (firstServerKey && firstServerKey.includes('vscode_extracted')) {
        discoveryMethod = 'vscode_extraction';
      } else {
        discoveryMethod = 'live_introspection';
      }
    }

    return NextResponse.json({
      server: serverName,
      config: serverConfig,
      tools: tools || {},
      tool_count: actualToolCount,
      discovery_method: discoveryMethod,
      discovery_status: tools ? 'success' : 'failed',
      failure_reason: tools ? null : 'Real MCP introspection and VS Code extraction both failed'
    });
    
  } catch (error) {
    console.error(`Tool discovery failed for ${serverName}:`, error);
    return NextResponse.json(
      { error: 'Tool discovery failed', server: serverName },
      { status: 500 }
    );
  }
}

async function getServerConfig(serverName: string) {
  try {
    const aggregator = new EnterpriseAggregator();
    const inventory = await aggregator.getEnterpriseInventory();
    
    if (!inventory) return null;
    
    // Find server configuration across all endpoints
    for (const endpoint of inventory.endpoints) {
      const scan = await aggregator.getLatestEndpointScan(endpoint.endpoint_id);
      if (!scan) continue;
      
      for (const config of scan.configs) {
        for (const server of config.servers) {
          if (server.name === serverName) {
            return {
              ...server,
              endpoint_id: endpoint.endpoint_id,
              hostname: endpoint.hostname,
              config_path: config.path
            };
          }
        }
      }
    }
    
    return null;
  } catch (error) {
    console.error('Failed to get server config:', error);
    return null;
  }
}

async function discoverServerTools(serverConfig: any): Promise<any> {
  // Method 1: Try MCP introspection for HTTP servers
  if (serverConfig.transport === 'http' && serverConfig.url) {
    const httpTools = await discoverHttpTools(serverConfig.url, serverConfig.name);
    if (httpTools) return httpTools;
    
    console.log(`❌ HTTP introspection failed for ${serverConfig.name} - likely needs authentication`);
  }
  
  // Method 2: Try stdio server introspection
  if (serverConfig.transport === 'stdio' && serverConfig.command) {
    const stdioTools = await discoverStdioTools(serverConfig);
    if (stdioTools) return stdioTools;
    
    console.log(`❌ STDIO introspection failed for ${serverConfig.name} - server may be unavailable`);
  }
  
  // No fallback to pattern inference - only real discovery
  console.log(`🚫 Tool discovery failed for ${serverConfig.name} - no real introspection available`);
  return null;
}

async function discoverHttpTools(url: string, serverName: string): Promise<any> {
  try {
    // Try to call MCP HTTP endpoint with list_tools
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/list',
        params: {}
      }),
      signal: AbortSignal.timeout(5000) // 5 second timeout
    });
    
    if (response.ok) {
      const data = await response.json();
      if (data.result && data.result.tools) {
        return convertMcpToolsToFormat(data.result.tools, 'http', serverName);
      }
    }
  } catch (error) {
    console.log(`HTTP tool discovery failed for ${url}:`, error);
  }
  
  // If HTTP fails, try VS Code extraction for authenticated servers
  if (url.includes('github') || url.includes('copilot')) {
    console.log(`🔍 Attempting VS Code tool extraction for ${serverName}`);
    return await extractVSCodeTools(serverName, url);
  }
  
  return null;
}

async function discoverStdioTools(serverConfig: any): Promise<any> {
  try {
    // Try to spawn the server and query it
    const command = `${serverConfig.command} ${(serverConfig.args || []).join(' ')}`;
    
    // Create a simple MCP client to query tools
    const mcpQuery = JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/list',
      params: {}
    });
    
    console.log(`🔍 Attempting stdio discovery for ${serverConfig.name}: ${command}`);
    
    // Try to run the server (macOS compatible)
    const { stdout, stderr } = await execAsync(`echo '${mcpQuery}' | ${command}`, {
      timeout: 30000, // Increased timeout for npm installs
      maxBuffer: 1024 * 1024 // 1MB buffer
    });
    
    console.log(`📡 Raw stdout for ${serverConfig.name}:`, stdout?.substring(0, 200) + '...');
    
    if (stdout) {
      // The MCP server outputs status messages on stderr and JSON on stdout
      // We need to find the JSON response in the output
      const lines = stdout.split('\n');
      
      for (const line of lines) {
        try {
          const trimmed = line.trim();
          if (trimmed.startsWith('{') && trimmed.includes('"result"')) {
            const response = JSON.parse(trimmed);
            if (response.result && response.result.tools) {
              console.log(`✅ Found ${response.result.tools.length} tools for ${serverConfig.name}`);
              return convertMcpToolsToFormat(response.result.tools, 'stdio', serverConfig.name);
            }
          }
        } catch (parseError) {
          // Skip non-JSON lines
          continue;
        }
      }
    }
    
    console.log(`⚠️  No valid MCP response found for ${serverConfig.name}`);
  } catch (error) {
    console.log(`❌ Stdio tool discovery failed for ${serverConfig.name}:`, error);
  }
  
  return null;
}

// Pattern inference removed - only real introspection allowed

async function resolveWorkspaceFolder(wsStorageDir: string): Promise<string | null> {
  const path = require('path');
  const fs = require('fs').promises;
  
  try {
    const names = ["workspace.json", "workspace", "workspace.json.bak"];
    for (const name of names) {
      const filePath = path.join(wsStorageDir, name);
      try {
        const content = await fs.readFile(filePath, 'utf-8');
        const obj = JSON.parse(content);
        const uri = obj.folder || obj.resource || obj.workspace || obj.configuration?.path;
        if (typeof uri === 'string' && uri.startsWith('file://')) {
          const url = new URL(uri);
          return decodeURIComponent(url.pathname);
        }
      } catch (e) {
        continue;
      }
    }
  } catch (e) {
    // ignore
  }
  return null;
}

async function loadServersFromMcpJson(workspaceFolder: string): Promise<any> {
  const path = require('path');
  const fs = require('fs').promises;
  
  try {
    const mcpJsonPath = path.join(workspaceFolder, '.vscode', 'mcp.json');
    const content = await fs.readFile(mcpJsonPath, 'utf-8');
    const data = JSON.parse(content);
    const servers = data.mcp?.servers || data.servers || {};
    return servers;
  } catch (e) {
    return {};
  }
}

async function listToolsHttp(url: string, bearer?: string): Promise<any[]> {
  const MCP_VERSION = "2024-11-05";
  const headers: any = {
    "MCP-Protocol-Version": MCP_VERSION,
    "Accept": "application/json",
    "Content-Type": "application/json"
  };
  if (bearer) {
    headers["Authorization"] = `Bearer ${bearer}`;
  }

  try {
    // initialize
    const initResponse = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: { capabilities: {} }
      }),
      signal: AbortSignal.timeout(15000)
    });
    
    if (!initResponse.ok) throw new Error(`Init failed: ${initResponse.status}`);
    
    // tools/list
    const toolsResponse = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 2,
        method: "tools/list",
        params: {}
      }),
      signal: AbortSignal.timeout(15000)
    });
    
    if (!toolsResponse.ok) throw new Error(`Tools list failed: ${toolsResponse.status}`);
    
    const resp = await toolsResponse.json();
    return resp.result?.tools || [];
  } catch (e) {
    return [];
  }
}

async function mapToolsForWorkspace(wsStorageDir: string, cachedTools: any[], bearerLookup?: Record<string, string>): Promise<any[]> {
  console.log(`🏠 Resolving workspace folder for: ${wsStorageDir}`);
  const folder = await resolveWorkspaceFolder(wsStorageDir);
  console.log(`📁 Resolved workspace folder: ${folder || 'NOT FOUND'}`);
  
  const servers = folder ? await loadServersFromMcpJson(folder) : {};
  console.log(`⚙️  Found ${Object.keys(servers).length} servers in mcp.json:`, Object.keys(servers));
  
  // Get running processes and match to servers
  const runningProcesses = await getRunningMcpProcesses();
  console.log(`🔄 Found ${runningProcesses.length} running MCP processes`);
  const processMatches = matchProcessToServer(runningProcesses, servers);
  console.log(`🔗 Process matches:`, processMatches);
  
  // Case 1: single server → map everything to it
  if (Object.keys(servers).length === 1) {
    const serverKey = Object.keys(servers)[0];
    console.log(`✅ Single server workspace - mapping all ${cachedTools.length} tools to: ${serverKey}`);
    return cachedTools.map(t => ({ ...t, server_key: serverKey }));
  }
  
  // Case 2: multiple servers → query each and match by name
  const serverTools: Record<string, Set<string>> = {};
  for (const [serverKey, config] of Object.entries(servers)) {
    const cfg = config as any;
    const type = (cfg.type || "").toLowerCase();
    if (type === "http" && cfg.url) {
      const token = bearerLookup?.[serverKey];
      try {
        const tools = await listToolsHttp(cfg.url, token);
        serverTools[serverKey] = new Set(tools.map(t => t.name));
      } catch (e) {
        serverTools[serverKey] = new Set();
      }
    } else if (["stdio", "spawn", "process"].includes(type)) {
      // Spawn STDIO server and get tools list
      try {
        const tools = await spawnStdioServer(cfg.command, cfg.args || []);
        serverTools[serverKey] = new Set(tools.map(t => t.name));
      } catch (e) {
        serverTools[serverKey] = new Set();
      }
    }
  }
  
  // Assign each cached tool to the first server whose live list contains it
  console.log(`🎯 Multiple servers - attempting tool name matching`);
  const mapped = [];
  let assignedCount = 0;
  for (const tool of cachedTools) {
    const name = tool.name || tool.tool_name;
    let assigned = "";
    for (const [serverKey, names] of Object.entries(serverTools)) {
      if (names.size > 0 && names.has(name)) {
        assigned = serverKey;
        assignedCount++;
        console.log(`✅ Mapped tool '${name}' to server '${serverKey}'`);
        break;
      }
    }

    mapped.push({ ...tool, server_key: assigned });
  }
  console.log(`📋 Final mapping: ${assignedCount}/${cachedTools.length} tools assigned to servers`);
  return mapped;
}

async function getRunningMcpProcesses(): Promise<any[]> {
  const { exec } = require('child_process');
  const { promisify } = require('util');
  const execAsync = promisify(exec);
  
  try {
    // Get running processes on macOS
    let stdout = '';
    try {
      const result = await execAsync('ps aux | grep -E "(mcp|modelcontextprotocol)" | grep -v grep');
      stdout = result.stdout;
    } catch (grepError) {
      // grep returns exit code 1 when no matches found - this is normal
      return [];
    }
    
    const processes = [];
    
    for (const line of stdout.split('\n')) {
      if (!line.trim()) continue;
      
      const parts = line.trim().split(/\s+/);
      if (parts.length < 11) continue;
      
      const pid = parts[1];
      const command = parts.slice(10).join(' ');
      
      // Extract command and args
      const cmdParts = command.split(/\s+/);
      const baseCommand = cmdParts[0];
      const args = cmdParts.slice(1);
      
      processes.push({
        pid,
        command: baseCommand,
        args,
        fullCommand: command
      });
    }
    
    return processes;
  } catch (error) {
    console.log('Failed to get running MCP processes:', error);
    return [];
  }
}

function matchProcessToServer(processes: any[], servers: any): Record<string, string> {
  const matches: Record<string, string> = {};
  
  for (const [serverKey, config] of Object.entries(servers)) {
    const cfg = config as any;
    if (cfg.type !== 'stdio') continue;
    
    const configCommand = cfg.command;
    const configArgs = cfg.args || [];
    
    // Create command fingerprint
    let commandFingerprint = configCommand;
    if (configCommand === 'npx' && configArgs.length > 0) {
      // Extract package name for npx commands
      commandFingerprint = configArgs[0];
    }
    
    // Find matching process
    for (const process of processes) {
      let processFingerprint = process.command;
      
      // Handle npx processes
      if (process.command === 'npx' && process.args.length > 0) {
        processFingerprint = process.args[0];
      } else if (process.command.includes('node') && process.args.length > 0) {
        // Handle node processes spawned by npx
        const nodePath = process.args.find((arg: string) => arg.includes('mcp-server') || arg.includes('modelcontextprotocol'));
        if (nodePath) {
          processFingerprint = nodePath.split('/').pop() || nodePath;
        }
      }
      
      // Match fingerprints
      if (processFingerprint.includes(commandFingerprint) || commandFingerprint.includes(processFingerprint)) {
        matches[serverKey] = process.pid;
        break;
      }
    }
  }
  
  return matches;
}

async function spawnStdioServer(command: string, args: string[] = []): Promise<any[]> {
  const { spawn } = require('child_process');
  
  try {
    return new Promise((resolve, reject) => {
      const child = spawn(command, args, {
        stdio: ['pipe', 'pipe', 'pipe']
      });
      
      let stdout = '';
      let stderr = '';
      
      child.stdout.on('data', (data: Buffer) => {
        stdout += data.toString();
      });
      
      child.stderr.on('data', (data: Buffer) => {
        stderr += data.toString();
      });
      
      // Send MCP initialize message
      const initMessage = JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: { capabilities: {} }
      }) + '\n';
      
      // Send tools/list message
      const toolsMessage = JSON.stringify({
        jsonrpc: "2.0",
        id: 2,
        method: "tools/list",
        params: {}
      }) + '\n';
      
      child.stdin.write(initMessage);
      child.stdin.write(toolsMessage);
      child.stdin.end();
      
      child.on('close', (code) => {
        try {
          // Parse JSON responses from stdout
          const lines = stdout.split('\n');
          for (const line of lines) {
            if (line.trim() && line.includes('"result"') && line.includes('"tools"')) {
              const response = JSON.parse(line.trim());
              if (response.result?.tools) {
                resolve(response.result.tools);
                return;
              }
            }
          }
          resolve([]);
        } catch (e) {
          console.log('Failed to parse STDIO server response:', e);
          resolve([]);
        }
      });
      
      child.on('error', (error) => {
        console.log('STDIO server spawn error:', error);
        resolve([]);
      });
      
      // Timeout after 10 seconds
      setTimeout(() => {
        child.kill();
        resolve([]);
      }, 10000);
    });
  } catch (error) {
    console.log('Failed to spawn STDIO server:', error);
    return [];
  }
}

function convertMcpToolsToFormat(mcpTools: any[], transport: string, serverName: string): any {
  const converted: any = {};
  
  mcpTools.forEach((tool, index) => {
    converted[tool.name || `tool_${index}`] = {
      name: tool.name || `Tool ${index + 1}`,
      description: tool.description || 'No description available',
      arguments: tool.inputSchema?.properties || {},
      transport: transport,
      discovered: true,
      listA: { belongs: false, reasoning: "Auto-discovered tool, needs security analysis" },
      listB: { belongs: false, reasoning: "Auto-discovered tool, needs security analysis" },
      listC: { belongs: false, reasoning: "Auto-discovered tool, needs security analysis" }
    };
  });
  
  return { [serverName]: converted };
}

async function extractVSCodeTools(serverName: string, url: string): Promise<any> {
  try {
    const util = require('util');
    const exec = require('child_process').exec;
    const execAsync = util.promisify(exec);
    const path = require('path');
    const fs = require('fs').promises;
    
    // Run VS Code extraction script for both workspace and global storage
    const scriptPath = path.join(process.cwd(), '..', 'mcp_vscode_extract_with_server.py');
    const vscodeUserPath = `~/Library/Application Support/Code/User`;
    
    console.log(`🔍 Running VS Code extraction for ${serverName} (scanning workspace + global storage)...`);
    
    const { stdout } = await execAsync(
      `cd /Users/ashwin/Agent_Red_Team && python3 mcp_vscode_extract_with_server.py --path "${vscodeUserPath}"`,
      { timeout: 30000 }
    );
    
    console.log(`📄 VS Code extraction output: ${stdout}`);
    
    // Read the generated JSON instead of CSV for better parsing
    const jsonPath = '/Users/ashwin/Agent_Red_Team/mcp_tools_with_servers.json';
    const jsonContent = await fs.readFile(jsonPath, 'utf-8');
    const vscodeData = JSON.parse(jsonContent);
    
    // Get server config for matching
    const serverConfig = await getServerConfig(serverName);
    if (!serverConfig) {
      console.log(`❌ No server config found for ${serverName}`);
      return null;
    }
    
    console.log(`🔍 Reconstructing server mapping for: ${serverName} (generic cache found)`);
    console.log(`� Total tools in cache: ${vscodeData.tools?.length || 0}`);
    
    // Reconstruct server mapping using workspace configuration
    const extractedTools: any = {};
    const serverKey = serverName;
    extractedTools[serverKey] = {};
    
    // Map tools using workspace configuration from all workspaces
    let allMappedTools: any[] = [];
    
    // Process each workspace
    console.log(`📂 Found ${vscodeData.reports?.length || 0} workspace reports to process`);
    for (const report of vscodeData.reports || []) {
      const wsStorageDir = report.source?.replace('/state.vscdb', '') || '';
      console.log(`🔍 Processing workspace: ${wsStorageDir}`);
      if (!wsStorageDir) {
        console.log(`❌ Skipping workspace - no storage dir found`);
        continue;
      }
      
      const mappedTools = await mapToolsForWorkspace(wsStorageDir, vscodeData.tools || []);
      console.log(`📋 Workspace ${wsStorageDir} returned ${mappedTools.length} mapped tools`);
      allMappedTools = allMappedTools.concat(mappedTools);
    }
    console.log(`📊 Total mapped tools from all workspaces: ${allMappedTools.length}`);
    
    // Check if single server workspace (using first workspace for simplicity)
    const firstWsStorageDir = vscodeData.reports?.[0]?.source?.replace('/state.vscdb', '') || '';
    const workspaceFolder = await resolveWorkspaceFolder(firstWsStorageDir);
    const servers = workspaceFolder ? await loadServersFromMcpJson(workspaceFolder) : {};
    const isSingleServer = Object.keys(servers).length === 1;
    
    // Filter tools for the requested server
    const serverTools = allMappedTools.filter((tool: any) => 
      tool.server_key === serverName || (isSingleServer && allMappedTools.length > 0)
    );
    
    // Deduplicate tools by name + description + schema hash
    const seenTools = new Map<string, any>();
    let toolCount = 0;
    let skippedCount = vscodeData.tools?.length - serverTools.length || 0;
    
    for (const tool of serverTools) {
      if (!tool.tool_name) continue;
      
      console.log(`✅ Mapped tool ${tool.tool_name} to ${serverName} (workspace_config)`);
      
      let schemaObj = {};
      try {
        if (tool.tool_schema) {
          schemaObj = JSON.parse(tool.tool_schema);
        }
      } catch (e) {
        console.log(`⚠️  Failed to parse schema for ${tool.tool_name}:`, e);
      }
      
      // Create deduplication key: name + description + schema signature
      const schemaHash = tool.tool_schema ? require('crypto')
        .createHash('md5')
        .update(tool.tool_schema)
        .digest('hex')
        .substring(0, 8) : 'no-schema';
      
      const dedupKey = `${tool.tool_name}:${tool.tool_description}:${schemaHash}`;
      
      // Skip if we've already seen this exact tool
      if (seenTools.has(dedupKey)) {
        console.log(`🔄 Skipping duplicate tool: ${tool.tool_name}`);
        continue;
      }
      
      seenTools.set(dedupKey, true);
      
      // Create tool in our format
      extractedTools[serverKey][tool.tool_name] = {
        name: tool.tool_name,
        description: tool.tool_description || '',
        arguments: (schemaObj as any)?.properties || {},
        discovered: true,
        extraction_method: 'vscode_cache',
        extraction_source: url,
        listA: { belongs: true, reasoning: "External API integration" },
        listB: { belongs: true, reasoning: "May access private repository data" },
        listC: { belongs: true, reasoning: "Sends data to external service" }
      };
      toolCount++;
    }
    
    // Add server-level metadata for deduplication tracking
    if (toolCount > 0) {
      extractedTools[serverKey]['_metadata'] = {
        total_tools: toolCount,
        extraction_timestamp: Date.now(),
        sources_scanned: vscodeData.reports?.length || 0,
        deduplication_applied: true,
        server_name: serverName,
        url_hint: url
      };
    }
    
    console.log(`✅ Workspace mapping: ${toolCount} tools for ${serverName}`);
    console.log(`📊 Server filtering: ${skippedCount} tools filtered out`);  
    console.log(`🎯 Mapping strategy: Workspace configuration`);
    return extractedTools;
    
  } catch (error) {
    console.error(`❌ VS Code extraction failed for ${serverName}:`, error);
    return null;
  }
}

async function saveServerTools(serverName: string, tools: any): Promise<void> {
  try {
    const dataDir = path.join(process.cwd(), 'data', 'discovered');
    await fs.mkdir(dataDir, { recursive: true });
    
    const filePath = path.join(dataDir, `${serverName}_tools.json`);
    await fs.writeFile(filePath, JSON.stringify(tools, null, 2));
    
    console.log(`✅ Saved discovered tools for ${serverName} to ${filePath}`);
  } catch (error) {
    console.error(`Failed to save tools for ${serverName}:`, error);
  }
}
