// Enhanced types for v2 collector
export interface MCPServer {
  name: string;
  transport: string;
  command?: string;
  args?: string[];
  url?: string;
  fingerprint?: string;
}

export interface MCPConfig {
  path: string;
  mtime: number;
  sha256: string;
  servers: MCPServer[];
  repo_context?: RepoContext;
}

export interface MCPProcess {
  pid: number;
  ppid: number;
  parent_name: string;
  cmd: string;
  cmd_redacted: string;
  first_seen: number;
  last_seen: number;
  fingerprint?: string;
}

export interface RepoContext {
  name: string;
  branch: string;
  owner: string;
  remote_url?: string;
}

export interface UserContext {
  os_user: string;
  git_email?: string;
  idp_email?: string;
}

export interface EvidenceBundle {
  file_path: string;
  file_hash: string;
  parent_ide?: string;
  cmdline_redacted: string;
  first_seen: number;
  last_seen: number;
  repo_context?: RepoContext;
}

export interface EnhancedMCPFinding {
  severity: string;
  type: string;
  evidence?: string[];
  owner_hint?: string;
  url_host?: string;
  path?: string;
  source_file?: string;
  fingerprint: string;
  evidence_bundle: EvidenceBundle;
  risk_boosters: string[];
}

export interface CollectorMetrics {
  coverage: {
    configs_found: number;
    repos_with_mcp: number;
    ide_detection_rate: number;
  };
  shadow_mcp: {
    stdio_processes: number;
    unsanctioned_hosts: string[];
  };
  performance: {
    time_to_evidence_ms: number;
    scan_duration_ms: number;
  };
  drift: {
    configs_changed: number;
    new_findings: number;
  };
}

export interface MCPInventoryV2 {
  schema_version: "2.0";
  collector_version: string;
  scan_id: string;
  meta: {
    hostname: string;
    os: {
      system: string;
      release: string;
    };
    user: UserContext;
    collected_at: number;
    scan_duration_ms: number;
  };
  configs: MCPConfig[];
  processes: {
    supported: boolean;
    items: MCPProcess[];
  };
  findings: EnhancedMCPFinding[];
  metrics: CollectorMetrics;
}

export const IDE_PATTERNS = {
  jetbrains: ['idea', 'pycharm', 'webstorm', 'rider', 'intellij', 'clion', 'goland', 'rubymine'],
  visualstudio: ['devenv', 'msvsmon', 'servicehost'],
  vscode: ['code', 'cursor', 'code-insiders'],
  containers: ['docker', 'wsl', 'codespace', 'devcontainer'],
  other: ['claude', 'zed', 'sublime']
};

export const RISK_BOOSTERS = {
  STDIO_WITH_COMMAND: 'stdio_with_command',
  HTTP_WITH_AUTH: 'http_with_auth',
  SHELL_CAPABILITIES: 'shell_capabilities',
  FILE_SYSTEM_ACCESS: 'filesystem_access',
  NETWORK_ACCESS: 'network_access',
  UNSANCTIONED_HOST: 'unsanctioned_host'
};
