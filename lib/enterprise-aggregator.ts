/**
 * Enterprise MCP Aggregation Service
 * Aggregates multiple endpoint scans into enterprise-wide metrics
 */

import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { MCPInventoryV2 } from './collector-types';
import { 
  EnterpriseInventory, 
  EndpointSummary, 
  EnterpriseMetrics,
  EndpointRegistration,
  assessEndpointStatus,
  calculateEnterpriseRisk
} from './enterprise-types';

const ENTERPRISE_DATA_DIR = path.join(process.cwd(), 'enterprise_data');
const ENDPOINTS_FILE = path.join(ENTERPRISE_DATA_DIR, 'endpoints.json');
const ENTERPRISE_INVENTORY_FILE = path.join(ENTERPRISE_DATA_DIR, 'enterprise_inventory.json');
const ENDPOINT_SCANS_DIR = path.join(ENTERPRISE_DATA_DIR, 'endpoint_scans');

export class EnterpriseAggregator {
  
  async ensureDirectories() {
    await fs.mkdir(ENTERPRISE_DATA_DIR, { recursive: true });
    await fs.mkdir(ENDPOINT_SCANS_DIR, { recursive: true });
  }

  async registerEndpoint(registration: EndpointRegistration): Promise<void> {
    await this.ensureDirectories();
    
    let endpoints: EndpointRegistration[] = [];
    try {
      const data = await fs.readFile(ENDPOINTS_FILE, 'utf-8');
      endpoints = JSON.parse(data);
    } catch {
      // File doesn't exist yet
    }
    
    // Remove existing registration for same endpoint
    endpoints = endpoints.filter(ep => ep.endpoint_id !== registration.endpoint_id);
    endpoints.push(registration);
    
    await fs.writeFile(ENDPOINTS_FILE, JSON.stringify(endpoints, null, 2));
  }

  async saveEndpointScan(endpointId: string, inventory: MCPInventoryV2): Promise<void> {
    await this.ensureDirectories();
    
    const scanFile = path.join(ENDPOINT_SCANS_DIR, `${endpointId}_${Date.now()}.json`);
    await fs.writeFile(scanFile, JSON.stringify(inventory, null, 2));
    
    // Keep only last 10 scans per endpoint
    await this.cleanupOldScans(endpointId);
  }

  private async cleanupOldScans(endpointId: string): Promise<void> {
    try {
      const files = await fs.readdir(ENDPOINT_SCANS_DIR);
      const endpointFiles = files
        .filter(f => f.startsWith(`${endpointId}_`) && f.endsWith('.json'))
        .sort()
        .reverse(); // Most recent first
      
      // Delete files beyond the 10 most recent
      for (const file of endpointFiles.slice(10)) {
        await fs.unlink(path.join(ENDPOINT_SCANS_DIR, file));
      }
    } catch (error) {
      console.error('Failed to cleanup old scans:', error);
    }
  }

  async getLatestEndpointScan(endpointId: string): Promise<MCPInventoryV2 | null> {
    try {
      const files = await fs.readdir(ENDPOINT_SCANS_DIR);
      const endpointFiles = files
        .filter(f => f.startsWith(`${endpointId}_`) && f.endsWith('.json'))
        .sort()
        .reverse(); // Most recent first
      
      if (endpointFiles.length === 0) return null;
      
      const latestFile = path.join(ENDPOINT_SCANS_DIR, endpointFiles[0]);
      const data = await fs.readFile(latestFile, 'utf-8');
      return JSON.parse(data);
    } catch {
      return null;
    }
  }

  async aggregateEnterpriseData(): Promise<EnterpriseInventory> {
    await this.ensureDirectories();
    
    // Load registered endpoints
    let registeredEndpoints: EndpointRegistration[] = [];
    try {
      const data = await fs.readFile(ENDPOINTS_FILE, 'utf-8');
      registeredEndpoints = JSON.parse(data);
    } catch {
      // No endpoints registered yet
    }
    
    // Generate endpoint summaries
    const endpointSummaries: EndpointSummary[] = [];
    const allFindings: any[] = [];
    let totalServers = 0;
    
    for (const registration of registeredEndpoints.filter(ep => ep.enabled)) {
      const latestScan = await this.getLatestEndpointScan(registration.endpoint_id);
      
      if (latestScan) {
        const serverCount = latestScan.configs.reduce((sum, cfg) => sum + cfg.servers.length, 0);
        const highRiskFindings = latestScan.findings.filter(f => f.severity === 'high').length;
        const criticalFindings = latestScan.findings.filter(f => 
          f.severity === 'high' && 
          f.risk_boosters.some(rb => ['stdio_with_command', 'http_with_auth'].includes(rb))
        ).length;
        
        totalServers += serverCount;
        allFindings.push(...latestScan.findings);
        
        endpointSummaries.push({
          endpoint_id: registration.endpoint_id,
          hostname: latestScan.meta.hostname,
          ip_address: registration.ip_address,
          last_scan: latestScan.meta.collected_at,
          status: assessEndpointStatus(latestScan),
          config_count: latestScan.configs.length,
          server_count: serverCount,
          process_count: latestScan.processes.items.length,
          high_risk_findings: highRiskFindings,
          critical_findings: criticalFindings,
          scan_duration_ms: latestScan.meta.scan_duration_ms
        });
      } else {
        // Endpoint registered but no scan data
        endpointSummaries.push({
          endpoint_id: registration.endpoint_id,
          hostname: registration.hostname,
          ip_address: registration.ip_address,
          last_scan: 0,
          status: 'offline',
          config_count: 0,
          server_count: 0,
          process_count: 0,
          high_risk_findings: 0,
          critical_findings: 0,
          scan_duration_ms: 0
        });
      }
    }
    
    // Calculate enterprise metrics
    const riskMetrics = calculateEnterpriseRisk(endpointSummaries);
    const endpointsWithScans = endpointSummaries.filter(ep => ep.last_scan > 0).length;
    
    // Aggregate findings by severity
    const findingsBySeverity = {
      critical: allFindings.filter(f => f.severity === 'high' && 
        f.risk_boosters.some((rb: string) => ['stdio_with_command', 'http_with_auth'].includes(rb))),
      high: allFindings.filter(f => f.severity === 'high'),
      medium: allFindings.filter(f => f.severity === 'med' || f.severity === 'medium'),
      low: allFindings.filter(f => f.severity === 'low')
    };
    
    // Extract unsanctioned hosts
    const unsanctionedHostsMap = new Map<string, { count: number; first_seen: number }>();
    allFindings.forEach(finding => {
      if (finding.url_host && finding.risk_boosters.includes('unsanctioned_host')) {
        const existing = unsanctionedHostsMap.get(finding.url_host);
        if (existing) {
          existing.count++;
        } else {
          unsanctionedHostsMap.set(finding.url_host, {
            count: 1,
            first_seen: finding.evidence_bundle?.first_seen || Date.now() / 1000
          });
        }
      }
    });
    
    const unsanctionedHosts = Array.from(unsanctionedHostsMap.entries()).map(([host, data]) => ({
      host,
      endpoint_count: data.count,
      first_seen: data.first_seen,
      risk_level: data.count >= 3 ? 'high' as const : data.count >= 2 ? 'medium' as const : 'low' as const
    }));
    
    const enterpriseInventory: EnterpriseInventory = {
      schema_version: "enterprise-1.0",
      aggregation_id: crypto.randomUUID(),
      created_at: Math.floor(Date.now() / 1000),
      metrics: {
        total_endpoints: registeredEndpoints.filter(ep => ep.enabled).length,
        endpoints_under_scan: endpointsWithScans,
        total_connected_servers: totalServers,
        compromised_endpoints: riskMetrics.risk_distribution.compromised || 0,
        compromise_percentage: riskMetrics.compromise_percentage,
        high_risk_attack_vectors: riskMetrics.high_risk_attack_vectors,
        critical_attack_vectors: findingsBySeverity.critical.length,
        last_aggregation: Math.floor(Date.now() / 1000),
        coverage_percentage: registeredEndpoints.length > 0 ? 
          Math.round((endpointsWithScans / registeredEndpoints.filter(ep => ep.enabled).length) * 100) : 0
      },
      endpoints: endpointSummaries,
      global_findings: {
        by_severity: findingsBySeverity,
        by_type: this.groupFindingsByType(allFindings),
        trending: {
          new_this_week: 0, // TODO: Calculate from historical data
          resolved_this_week: 0,
          trend_direction: 'stable'
        }
      },
      unsanctioned_hosts: unsanctionedHosts
    };
    
    // Save enterprise inventory
    await fs.writeFile(ENTERPRISE_INVENTORY_FILE, JSON.stringify(enterpriseInventory, null, 2));
    
    return enterpriseInventory;
  }
  
  private groupFindingsByType(findings: any[]): Record<string, any[]> {
    const grouped: Record<string, any[]> = {};
    findings.forEach(finding => {
      if (!grouped[finding.type]) {
        grouped[finding.type] = [];
      }
      grouped[finding.type].push(finding);
    });
    return grouped;
  }

  async getEnterpriseInventory(): Promise<EnterpriseInventory | null> {
    try {
      const data = await fs.readFile(ENTERPRISE_INVENTORY_FILE, 'utf-8');
      return JSON.parse(data);
    } catch {
      return null;
    }
  }
}
