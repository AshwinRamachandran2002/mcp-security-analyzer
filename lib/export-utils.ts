/**
 * Export utilities for MCP Collector
 * Provides CSV and JSON export functionality for findings and inventory
 */

import { EnhancedMCPFinding, MCPInventoryV2, CollectorMetrics } from './collector-types';

export function exportFindingsToCSV(findings: EnhancedMCPFinding[]): string {
  const headers = [
    'Severity',
    'Type',
    'Evidence',
    'Source File',
    'Host',
    'Path',
    'Owner',
    'Fingerprint',
    'Risk Boosters',
    'First Seen',
    'Last Seen'
  ];
  
  const rows = findings.map(finding => [
    finding.severity,
    finding.type.replace(/_/g, ' ').toUpperCase(),
    finding.evidence?.join('; ') || '',
    finding.source_file || '',
    finding.url_host || '',
    finding.path || '',
    finding.owner_hint || '',
    finding.fingerprint,
    finding.risk_boosters.join('; '),
    new Date(finding.evidence_bundle.first_seen * 1000).toISOString(),
    new Date(finding.evidence_bundle.last_seen * 1000).toISOString()
  ]);
  
  return [headers, ...rows]
    .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\n');
}

export function exportInventoryToJSON(inventory: MCPInventoryV2, pretty = false): string {
  return JSON.stringify(inventory, null, pretty ? 2 : 0);
}

export function exportFindingsToJSON(findings: EnhancedMCPFinding[], pretty = false): string {
  return JSON.stringify(findings, null, pretty ? 2 : 0);
}

export function exportMetricsToCSV(metrics: CollectorMetrics): string {
  const headers = ['Metric Category', 'Metric Name', 'Value'];
  const rows: string[][] = [];
  
  // Coverage metrics
  rows.push(['Coverage', 'Configs Found', metrics.coverage.configs_found.toString()]);
  rows.push(['Coverage', 'Repos with MCP', metrics.coverage.repos_with_mcp.toString()]);
  rows.push(['Coverage', 'IDE Detection Rate', `${(metrics.coverage.ide_detection_rate * 100).toFixed(1)}%`]);
  
  // Shadow MCP metrics
  rows.push(['Shadow MCP', 'Stdio Processes', metrics.shadow_mcp.stdio_processes.toString()]);
  rows.push(['Shadow MCP', 'Unsanctioned Hosts', metrics.shadow_mcp.unsanctioned_hosts.join('; ')]);
  
  // Performance metrics
  rows.push(['Performance', 'Time to Evidence (ms)', metrics.performance.time_to_evidence_ms.toString()]);
  rows.push(['Performance', 'Scan Duration (ms)', metrics.performance.scan_duration_ms.toString()]);
  
  // Drift metrics
  rows.push(['Drift', 'Configs Changed', metrics.drift.configs_changed.toString()]);
  rows.push(['Drift', 'New Findings', metrics.drift.new_findings.toString()]);
  
  return [headers, ...rows]
    .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\n');
}

export function generateExecutiveSummary(inventory: MCPInventoryV2): string {
  const { configs, processes, findings, metrics } = inventory;
  
  const highRiskFindings = findings.filter(f => f.severity === 'high');
  const mediumRiskFindings = findings.filter(f => f.severity === 'med' || f.severity === 'medium');
  const lowRiskFindings = findings.filter(f => f.severity === 'low');
  
  const activeProcesses = processes.items.length;
  const configuredServers = configs.reduce((sum, config) => sum + config.servers.length, 0);
  
  return `
# MCP Security Assessment Executive Summary

## Scan Overview
- **Hostname**: ${inventory.meta.hostname}
- **Scan Date**: ${new Date(inventory.meta.collected_at * 1000).toLocaleString()}
- **Scan Duration**: ${metrics.performance.scan_duration_ms}ms
- **Collector Version**: ${inventory.collector_version}

## Key Findings
- **Total Configurations**: ${configs.length} files with ${configuredServers} servers
- **Active Processes**: ${activeProcesses} MCP-related processes detected
- **Security Findings**: ${findings.length} total (${highRiskFindings.length} HIGH, ${mediumRiskFindings.length} MEDIUM, ${lowRiskFindings.length} LOW)

## Risk Assessment
${highRiskFindings.length > 0 ? `
### HIGH RISK (${highRiskFindings.length} findings)
${highRiskFindings.slice(0, 5).map(f => `- ${f.type.replace(/_/g, ' ').toUpperCase()}: ${f.evidence?.join(', ') || 'No evidence'}`).join('\n')}
${highRiskFindings.length > 5 ? `... and ${highRiskFindings.length - 5} more` : ''}
` : '### No HIGH risk findings detected'}

${mediumRiskFindings.length > 0 ? `
### MEDIUM RISK (${mediumRiskFindings.length} findings)
${mediumRiskFindings.slice(0, 3).map(f => `- ${f.type.replace(/_/g, ' ').toUpperCase()}: ${f.url_host || f.evidence?.join(', ') || 'No evidence'}`).join('\n')}
${mediumRiskFindings.length > 3 ? `... and ${mediumRiskFindings.length - 3} more` : ''}
` : ''}

## Coverage Metrics
- **Repositories with MCP**: ${metrics.coverage.repos_with_mcp}
- **IDE Detection Rate**: ${(metrics.coverage.ide_detection_rate * 100).toFixed(1)}%
- **Shadow MCP Processes**: ${metrics.shadow_mcp.stdio_processes}
- **Unsanctioned Hosts**: ${metrics.shadow_mcp.unsanctioned_hosts.length}

## Recommendations
${highRiskFindings.length > 0 ? '1. **Immediate Action Required**: Review and secure HIGH risk stdio processes and configurations' : ''}
${metrics.shadow_mcp.unsanctioned_hosts.length > 0 ? `2. **Policy Review**: ${metrics.shadow_mcp.unsanctioned_hosts.length} unsanctioned HTTP endpoints detected` : ''}
${metrics.drift.configs_changed > 0 ? `3. **Configuration Drift**: ${metrics.drift.configs_changed} configurations changed since last scan` : ''}
${activeProcesses === 0 ? '4. **No Active Processes**: MCP servers may be idle or using on-demand activation' : ''}

---
*Generated by MCP Environment Collector v${inventory.collector_version}*
`.trim();
}

export function exportSanitizedInventory(inventory: MCPInventoryV2): MCPInventoryV2 {
  // Create a copy with sensitive information removed for sharing
  const sanitized = JSON.parse(JSON.stringify(inventory));
  
  // Remove sensitive paths
  sanitized.configs.forEach((config: any) => {
    config.path = config.path.replace(/\/Users\/[^/]+/, '/Users/***');
    if (config.repo_context?.remote_url) {
      config.repo_context.remote_url = sanitizeUrl(config.repo_context.remote_url);
    }
  });
  
  // Remove sensitive command details
  sanitized.processes.items.forEach((process: any) => {
    process.cmd_redacted = process.cmd_redacted || process.cmd;
    delete process.cmd; // Remove original command
  });
  
  // Remove sensitive evidence
  sanitized.findings.forEach((finding: any) => {
    if (finding.evidence_bundle?.cmdline_redacted) {
      delete finding.evidence_bundle.cmdline;
    }
    if (finding.source_file) {
      finding.source_file = finding.source_file.replace(/\/Users\/[^/]+/, '/Users/***');
    }
  });
  
  return sanitized;
}

function sanitizeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.protocol}//${parsed.host}${parsed.pathname}`;
  } catch {
    return url.split('?')[0];
  }
}

export const EXPORT_FORMATS = {
  CSV: 'csv',
  JSON: 'json',
  SUMMARY: 'summary'
} as const;

export type ExportFormat = typeof EXPORT_FORMATS[keyof typeof EXPORT_FORMATS];
