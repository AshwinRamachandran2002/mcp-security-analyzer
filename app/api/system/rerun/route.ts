import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

export async function POST(request: NextRequest) {
  try {
    const startTime = Date.now();
    console.log('🚀 Starting complete system re-run...');
    
    const results = {
      start_time: startTime,
      steps: [] as Array<{
        step: string;
        status: 'success' | 'failed' | 'skipped';
        message: string;
        duration_ms?: number;
      }>,
      summary: {
        total_duration_ms: 0,
        steps_completed: 0,
        steps_failed: 0,
        endpoints_discovered: 0,
        servers_discovered: 0,
        tools_discovered: 0,
        files_cleaned: 0
      }
    };

    // Step 1: Clean discovered tools
    const cleanStep = await cleanDiscoveredTools();
    results.steps.push(cleanStep);
    results.summary.files_cleaned = cleanStep.files_cleaned || 0;

    // Step 2: Clean enterprise data
    const enterpriseCleanStep = await cleanEnterpriseData();
    results.steps.push(enterpriseCleanStep);

    // Step 3: Run fresh collector scan
    const collectorStep = await runCollectorScan();
    results.steps.push(collectorStep);

    // Step 4: Wait for enterprise aggregation
    await new Promise(resolve => setTimeout(resolve, 2000));
    const enterpriseStep = await aggregateEnterpriseData();
    results.steps.push(enterpriseStep);
    results.summary.endpoints_discovered = enterpriseStep.endpoints_discovered || 0;
    results.summary.servers_discovered = enterpriseStep.servers_discovered || 0;

    // Step 5: Discover tools for all servers
    const toolsStep = await discoverAllServerTools();
    results.steps.push(toolsStep);
    results.summary.tools_discovered = toolsStep.tools_discovered || 0;

    // Calculate summary
    results.summary.total_duration_ms = Date.now() - startTime;
    results.summary.steps_completed = results.steps.filter(s => s.status === 'success').length;
    results.summary.steps_failed = results.steps.filter(s => s.status === 'failed').length;

    console.log(`✅ System re-run completed in ${results.summary.total_duration_ms}ms`);
    
    return NextResponse.json(results);

  } catch (error) {
    console.error('❌ System re-run failed:', error);
    return NextResponse.json(
      { error: 'System re-run failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

async function cleanDiscoveredTools() {
  const stepStart = Date.now();
  try {
    const discoveredDir = path.join(process.cwd(), 'data', 'discovered');
    let filesDeleted = 0;
    
    try {
      const files = await fs.readdir(discoveredDir);
      for (const file of files) {
        if (file.endsWith('_tools.json')) {
          await fs.unlink(path.join(discoveredDir, file));
          filesDeleted++;
        }
      }
    } catch {
      // Directory doesn't exist, which is fine
    }

    return {
      step: 'clean_discovered_tools',
      status: 'success' as const,
      message: `Cleaned ${filesDeleted} discovered tool files`,
      duration_ms: Date.now() - stepStart,
      files_cleaned: filesDeleted
    };
  } catch (error) {
    return {
      step: 'clean_discovered_tools',
      status: 'failed' as const,
      message: `Failed to clean discovered tools: ${error}`,
      duration_ms: Date.now() - stepStart
    };
  }
}

async function cleanEnterpriseData() {
  const stepStart = Date.now();
  try {
    const enterpriseDir = path.join(process.cwd(), 'enterprise_data');
    
    try {
      // Delete enterprise inventory but keep endpoints registration
      const inventoryFile = path.join(enterpriseDir, 'enterprise_inventory.json');
      await fs.unlink(inventoryFile);
      
      // Clean old scan files
      const scansDir = path.join(enterpriseDir, 'endpoint_scans');
      const scanFiles = await fs.readdir(scansDir);
      for (const file of scanFiles) {
        await fs.unlink(path.join(scansDir, file));
      }
    } catch {
      // Files don't exist, which is fine
    }

    return {
      step: 'clean_enterprise_data',
      status: 'success' as const,
      message: 'Cleaned enterprise data for fresh start',
      duration_ms: Date.now() - stepStart
    };
  } catch (error) {
    return {
      step: 'clean_enterprise_data',
      status: 'failed' as const,
      message: `Failed to clean enterprise data: ${error}`,
      duration_ms: Date.now() - stepStart
    };
  }
}

async function runCollectorScan() {
  const stepStart = Date.now();
  try {
    const response = await fetch('http://localhost:3000/api/collector/scan', {
      method: 'POST'
    });

    if (response.ok) {
      const scanData = await response.json();
      return {
        step: 'collector_scan',
        status: 'success' as const,
        message: `Collector scan completed: ${scanData.configs?.length || 0} configs, ${scanData.findings?.length || 0} findings`,
        duration_ms: Date.now() - stepStart,
        configs_found: scanData.configs?.length || 0,
        findings_found: scanData.findings?.length || 0
      };
    } else {
      throw new Error(`Collector scan failed with status ${response.status}`);
    }
  } catch (error) {
    return {
      step: 'collector_scan',
      status: 'failed' as const,
      message: `Collector scan failed: ${error}`,
      duration_ms: Date.now() - stepStart
    };
  }
}

async function aggregateEnterpriseData() {
  const stepStart = Date.now();
  try {
    const response = await fetch('http://localhost:3000/api/enterprise/metrics?fresh=true');

    if (response.ok) {
      const enterpriseData = await response.json();
      return {
        step: 'enterprise_aggregation',
        status: 'success' as const,
        message: `Enterprise data aggregated: ${enterpriseData.metrics?.total_endpoints || 0} endpoints, ${enterpriseData.metrics?.total_connected_servers || 0} servers`,
        duration_ms: Date.now() - stepStart,
        endpoints_discovered: enterpriseData.metrics?.total_endpoints || 0,
        servers_discovered: enterpriseData.metrics?.total_connected_servers || 0
      };
    } else {
      throw new Error(`Enterprise aggregation failed with status ${response.status}`);
    }
  } catch (error) {
    return {
      step: 'enterprise_aggregation',
      status: 'failed' as const,
      message: `Enterprise aggregation failed: ${error}`,
      duration_ms: Date.now() - stepStart
    };
  }
}

async function discoverAllServerTools() {
  const stepStart = Date.now();
  try {
    // Get list of all servers
    const serversResponse = await fetch('http://localhost:3000/api/servers');
    if (!serversResponse.ok) {
      throw new Error('Failed to get servers list');
    }

    const serversData = await serversResponse.json();
    const servers = serversData.servers || [];
    
    let toolsDiscovered = 0;
    const discoveryResults = [];

    // Discover tools for each server
    for (const server of servers) {
      try {
        const toolsResponse = await fetch(`http://localhost:3000/api/tools/discover?server=${encodeURIComponent(server.name)}`);
        if (toolsResponse.ok) {
          const toolsData = await toolsResponse.json();
          toolsDiscovered += toolsData.tool_count || 0;
          discoveryResults.push(`${server.name}: ${toolsData.tool_count || 0} tools`);
        }
      } catch (error) {
        discoveryResults.push(`${server.name}: failed - ${error}`);
      }
    }

    return {
      step: 'discover_server_tools',
      status: 'success' as const,
      message: `Tools discovered for ${servers.length} servers: ${discoveryResults.join(', ')}`,
      duration_ms: Date.now() - stepStart,
      tools_discovered: toolsDiscovered,
      servers_processed: servers.length
    };
  } catch (error) {
    return {
      step: 'discover_server_tools',
      status: 'failed' as const,
      message: `Tools discovery failed: ${error}`,
      duration_ms: Date.now() - stepStart
    };
  }
}
