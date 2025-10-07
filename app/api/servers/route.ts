import { NextRequest, NextResponse } from 'next/server';
import { EnterpriseAggregator } from '@/lib/enterprise-aggregator';
import fs from 'fs/promises';
import path from 'path';

export async function GET(request: NextRequest) {
  try {
    const aggregator = new EnterpriseAggregator();
    
    // Get enterprise inventory with all endpoint data
    const enterpriseInventory = await aggregator.getEnterpriseInventory();
    
    if (!enterpriseInventory) {
      return NextResponse.json({ servers: [], summary: getEmptySummary() });
    }
    
    // Aggregate all servers across all endpoints
    const serverMap = new Map();
    let totalEndpoints = 0;
    let healthyEndpoints = 0;
    
    for (const endpoint of enterpriseInventory.endpoints) {
      totalEndpoints++;
      if (endpoint.status === 'healthy') healthyEndpoints++;
      
      // Get latest scan for this endpoint
      const latestScan = await aggregator.getLatestEndpointScan(endpoint.endpoint_id);
      if (!latestScan) continue;
      
      // Process each server in the endpoint's configs
      for (const config of latestScan.configs) {
        for (const server of config.servers) {
          const serverKey = `${server.name}_${server.fingerprint}`;
          
          if (!serverMap.has(serverKey)) {
            serverMap.set(serverKey, {
              name: server.name,
              transport: server.transport,
              command: server.command,
              args: server.args,
              url: server.url,
              fingerprint: server.fingerprint,
              endpoints: [],
              total_configs: 0,
              first_seen: latestScan.meta.collected_at,
              last_seen: latestScan.meta.collected_at,
              status: 'unknown',
              has_active_processes: false,
              repo_contexts: []
            });
          }
          
          const serverData = serverMap.get(serverKey);
          
          // Update server data
          serverData.endpoints.push({
            endpoint_id: endpoint.endpoint_id,
            hostname: endpoint.hostname,
            config_path: config.path,
            status: endpoint.status
          });
          
          serverData.total_configs++;
          serverData.first_seen = Math.min(serverData.first_seen, latestScan.meta.collected_at);
          serverData.last_seen = Math.max(serverData.last_seen, latestScan.meta.collected_at);
          
          // Check if this server has active processes
          const hasActiveProcess = latestScan.processes.items.some(proc => 
            proc.cmd.includes(server.name) || 
            (server.command && proc.cmd.includes(server.command)) ||
            (server.url && proc.cmd.includes(server.url))
          );
          
          if (hasActiveProcess) {
            serverData.has_active_processes = true;
            serverData.status = 'active';
          } else if (serverData.status === 'unknown') {
            serverData.status = 'configured';
          }
          
          // Add repo context if available
          if (config.repo_context && !serverData.repo_contexts.some((r: any) => r.name === config.repo_context!.name)) {
            serverData.repo_contexts.push(config.repo_context);
          }
        }
      }
    }
    
    // Convert to array and add additional metadata
    const serversWithMetadata = [];
    for (const server of Array.from(serverMap.values())) {
      const functionCount = await getServerFunctionCount(server.name);
      const installationMethod = detectInstallationMethod(server);
      const serverClassification = classifyServer(server);
      
      serversWithMetadata.push({
        ...server,
        endpoint_count: server.endpoints.length,
        unique_hostnames: [...new Set(server.endpoints.map((e: any) => e.hostname))].length,
        has_auth: server.transport === 'http' && server.url && (
          server.url.includes('github') || 
          server.url.includes('atlassian') ||
          server.url.includes('api.')
        ),
        risk_level: calculateServerRiskLevel(server, enterpriseInventory),
        function_count: functionCount,
        last_updated: new Date(server.last_seen * 1000).toISOString(),
        installation_method: installationMethod,
        server_classification: serverClassification,
        transport_type: server.transport,
        is_remote: server.transport === 'http',
        is_local: server.transport === 'stdio'
      });
    }
    
    const servers = serversWithMetadata;
    
    // Sort by last seen (most recent first)
    servers.sort((a, b) => b.last_seen - a.last_seen);

    const summary = {
      total_servers: servers.length,
      active_servers: servers.filter(s => s.status === 'active').length,
      configured_servers: servers.filter(s => s.status === 'configured').length,
      authenticated_servers: servers.filter(s => s.has_auth).length,
      high_risk_servers: servers.filter(s => s.risk_level === 'high').length,
      total_endpoints: totalEndpoints,
      healthy_endpoints: healthyEndpoints,
      total_functions: servers.reduce((sum, s) => sum + s.function_count, 0),
      unique_transports: [...new Set(servers.map(s => s.transport))],
      stdio_servers: servers.filter(s => s.transport === 'stdio').length,
      http_servers: servers.filter(s => s.transport === 'http').length,
      npm_installed: servers.filter(s => s.installation_method === 'npm').length,
      pip_installed: servers.filter(s => s.installation_method === 'pip').length,
      docker_installed: servers.filter(s => s.installation_method === 'docker').length,
      remote_services: servers.filter(s => s.installation_method === 'remote').length,
      last_aggregation: enterpriseInventory.created_at
    };

    // Check if groupBy=endpoint is requested
    const { searchParams } = new URL(request.url);
    const groupBy = searchParams.get('groupBy');

    if (groupBy === 'endpoint') {
      // Group servers by endpoint
      const endpointMap = new Map();

      for (const server of servers) {
        for (const endpoint of server.endpoints) {
          if (!endpointMap.has(endpoint.endpoint_id)) {
            endpointMap.set(endpoint.endpoint_id, {
              endpoint_id: endpoint.endpoint_id,
              hostname: endpoint.hostname,
              status: endpoint.status,
              servers: [],
              server_count: 0,
              stdio_count: 0,
              http_count: 0
            });
          }

          const endpointData = endpointMap.get(endpoint.endpoint_id);
          endpointData.servers.push(server);
          endpointData.server_count++;
          if (server.transport === 'stdio') endpointData.stdio_count++;
          if (server.transport === 'http') endpointData.http_count++;
        }
      }

      const endpoints = Array.from(endpointMap.values());
      return NextResponse.json({ endpoints, summary });
    }

    return NextResponse.json({ servers, summary });
    
  } catch (error) {
    console.error('Dynamic servers API failed:', error);
    return NextResponse.json(
      { error: 'Failed to get server data', servers: [], summary: getEmptySummary() },
      { status: 500 }
    );
  }
}

function calculateServerRiskLevel(server: any, enterpriseInventory: any): 'high' | 'medium' | 'low' {
  // Check if server appears in high-risk findings
  const serverFindings = enterpriseInventory.global_findings.by_severity.high.filter((finding: any) =>
    finding.evidence?.some((evidence: string) => 
      evidence.includes(server.name) ||
      (server.command && evidence.includes(server.command)) ||
      (server.url && evidence.includes(server.url))
    )
  );
  
  if (serverFindings.length > 0) return 'high';
  
  // Check risk factors
  let riskScore = 0;
  if (server.transport === 'stdio') riskScore += 2;
  if (server.has_active_processes) riskScore += 2;
  if (server.command && server.command.includes('filesystem')) riskScore += 1;
  if (server.endpoint_count > 1) riskScore += 1;
  if (!server.has_auth && server.transport === 'http') riskScore += 1;
  
  return riskScore >= 4 ? 'high' : riskScore >= 2 ? 'medium' : 'low';
}

async function getServerFunctionCount(serverName: string): Promise<number> {
  try {
    // First, try to get from discovered tools
    const discoveredPath = path.join(process.cwd(), 'data', 'discovered', `${serverName}_tools.json`);
    
    try {
      const discoveredData = await fs.readFile(discoveredPath, 'utf-8');
      const parsed = JSON.parse(discoveredData);
      
      // Count all tools across all server keys in the discovered file
      let totalCount = 0;
      Object.values(parsed).forEach((serverTools: any) => {
        if (typeof serverTools === 'object') {
          totalCount += Object.keys(serverTools).length;
        }
      });
      
      if (totalCount > 0) {
        console.log(`✅ Using discovered tools for ${serverName}: ${totalCount} functions`);
        return totalCount;
      }
    } catch {
      // No discovered tools file, continue to static fallback
    }
    
    // No static fallback - only real discovered tools or 0
    console.log(`❌ No discovered tools for ${serverName}, returning 0 (real introspection failed)`);
    return 0;
    
  } catch (error) {
    console.error(`Failed to get function count for ${serverName}:`, error);
    return 0;
  }
}

function detectInstallationMethod(server: any): string {
  // Check command and args to determine installation method
  if (server.transport === 'http') {
    return 'remote'; // HTTP servers are typically remote services
  }
  
  if (server.command && server.args) {
    const fullCommand = `${server.command} ${server.args.join(' ')}`;
    
    // NPX (Node Package Manager)
    if (server.command === 'npx' || fullCommand.includes('npx')) {
      return 'npm';
    }
    
    // Python/pip installations
    if (fullCommand.includes('python') || fullCommand.includes('pip') || fullCommand.includes('pipx')) {
      return 'pip';
    }
    
    // Docker installations
    if (server.command === 'docker' || fullCommand.includes('docker')) {
      return 'docker';
    }
    
    // Direct binary/executable
    if (server.command.includes('/') || server.command.includes('\\')) {
      return 'binary';
    }
    
    // Global system command
    return 'system';
  }
  
  return 'unknown';
}

function classifyServer(server: any): string {
  // Classify by transport and purpose
  if (server.transport === 'http') {
    if (server.url) {
      if (server.url.includes('github')) return 'github-remote';
      if (server.url.includes('atlassian') || server.url.includes('jira')) return 'jira-remote';
      if (server.url.includes('api.')) return 'api-service';
    }
    return 'http-service';
  }
  
  if (server.transport === 'stdio') {
    if (server.name.includes('github')) return 'github-local';
    if (server.name.includes('filesystem')) return 'filesystem-local';
    if (server.name.includes('jira')) return 'jira-local';
    if (server.name.includes('database')) return 'database-local';
    if (server.name.includes('api')) return 'api-local';
  }
  
  return 'unknown';
}

function getEmptySummary() {
  return {
    total_servers: 0,
    active_servers: 0,
    configured_servers: 0,
    authenticated_servers: 0,
    high_risk_servers: 0,
    total_endpoints: 0,
    healthy_endpoints: 0,
    total_functions: 0,
    unique_transports: [],
    last_aggregation: Math.floor(Date.now() / 1000)
  };
}
