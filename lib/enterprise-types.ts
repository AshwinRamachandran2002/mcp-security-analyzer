/**
 * Enterprise Multi-Endpoint Data Model
 * Extends existing collector to support enterprise-wide aggregation
 */

import { MCPInventoryV2, EnhancedMCPFinding } from './collector-types';

export interface EndpointSummary {
  endpoint_id: string;
  hostname: string;
  ip_address?: string;
  last_scan: number;
  status: 'healthy' | 'compromised' | 'at_risk' | 'offline';
  config_count: number;
  server_count: number;
  process_count: number;
  high_risk_findings: number;
  critical_findings: number;
  scan_duration_ms: number;
}

export interface EnterpriseMetrics {
  total_endpoints: number;
  endpoints_under_scan: number;
  total_connected_servers: number;
  compromised_endpoints: number;
  compromise_percentage: number;
  high_risk_attack_vectors: number;
  critical_attack_vectors: number;
  last_aggregation: number;
  coverage_percentage: number;
}

export interface EnterpriseInventory {
  schema_version: "enterprise-1.0";
  aggregation_id: string;
  created_at: number;
  metrics: EnterpriseMetrics;
  endpoints: EndpointSummary[];
  global_findings: {
    by_severity: {
      critical: EnhancedMCPFinding[];
      high: EnhancedMCPFinding[];
      medium: EnhancedMCPFinding[];
      low: EnhancedMCPFinding[];
    };
    by_type: Record<string, EnhancedMCPFinding[]>;
    trending: {
      new_this_week: number;
      resolved_this_week: number;
      trend_direction: 'up' | 'down' | 'stable';
    };
  };
  unsanctioned_hosts: {
    host: string;
    endpoint_count: number;
    first_seen: number;
    risk_level: 'high' | 'medium' | 'low';
  }[];
}

export interface EndpointRegistration {
  endpoint_id: string;
  hostname: string;
  ip_address?: string;
  environment: 'production' | 'staging' | 'development' | 'testing';
  business_unit: string;
  owner: string;
  registered_at: number;
  scan_frequency: number; // minutes
  enabled: boolean;
}

// Compromise assessment logic
export function assessEndpointStatus(inventory: MCPInventoryV2): EndpointSummary['status'] {
  const criticalFindings = inventory.findings.filter(f => f.severity === 'high' && 
    f.risk_boosters.some(rb => ['stdio_with_command', 'http_with_auth', 'unsanctioned_host'].includes(rb))
  ).length;
  
  const activeProcesses = inventory.processes.items.length;
  const unsanctionedHosts = inventory.metrics.shadow_mcp.unsanctioned_hosts.length;
  
  if (criticalFindings >= 3 || activeProcesses >= 5 || unsanctionedHosts >= 2) {
    return 'compromised';
  } else if (criticalFindings >= 1 || activeProcesses >= 2 || unsanctionedHosts >= 1) {
    return 'at_risk';
  } else if (inventory.configs.length > 0) {
    return 'healthy';
  } else {
    return 'offline';
  }
}

// Risk aggregation for enterprise view
export function calculateEnterpriseRisk(endpoints: EndpointSummary[]): {
  compromise_percentage: number;
  high_risk_attack_vectors: number;
  risk_distribution: Record<EndpointSummary['status'], number>;
} {
  const statusCounts = endpoints.reduce((acc, ep) => {
    acc[ep.status] = (acc[ep.status] || 0) + 1;
    return acc;
  }, {} as Record<EndpointSummary['status'], number>);
  
  const compromisedCount = (statusCounts.compromised || 0) + (statusCounts.at_risk || 0);
  const totalCount = endpoints.length;
  
  const compromise_percentage = totalCount > 0 ? Math.round((compromisedCount / totalCount) * 100) : 0;
  
  const high_risk_attack_vectors = endpoints.reduce((sum, ep) => 
    sum + ep.high_risk_findings + ep.critical_findings, 0
  );
  
  return {
    compromise_percentage,
    high_risk_attack_vectors,
    risk_distribution: statusCounts
  };
}
