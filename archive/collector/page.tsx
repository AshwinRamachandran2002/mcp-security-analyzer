"use client";

import { useEffect, useState } from "react";
import { Breadcrumbs } from "@/components/parts/breadcrumbs";
import { Header } from "@/components/parts/header";
import { PageWrapper } from "@/components/parts/page-wrapper";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Monitor, 
  Settings, 
  Activity, 
  FileText, 
  RefreshCw,
  Clock,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Download,
  Database,
  Shield,
  Server,
  Wifi,
  Terminal
} from "lucide-react";

const pageData = {
  name: "Collector",
  title: "System Collector",
  description: "Scan and analyze your Mac system for MCP configurations, processes, and security findings.",
};

interface SystemInventory {
  schema_version: string;
  collector_version: string;
  scan_id: string;
  meta: {
    hostname: string;
    os: {
      system: string;
      release: string;
    };
    user: any;
    collected_at: number;
    scan_duration_ms: number;
  };
  configs: any[];
  processes: {
    supported: boolean;
    items: any[];
  };
  findings: any[];
  metrics: {
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
  };
}

export default function CollectorPage() {
  const [inventory, setInventory] = useState<SystemInventory | null>(null);
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'processes' | 'configs' | 'findings' | 'metrics'>('overview');
  const [lastScan, setLastScan] = useState<Date | null>(null);

  const loadInventory = async () => {
    try {
      const response = await fetch('/api/collector/inventory');
      if (response.ok) {
        const data = await response.json();
        setInventory(data);
        setLastScan(new Date(data.meta.collected_at * 1000));
      } else {
        setInventory(null);
      }
    } catch (error) {
      console.error('Failed to load inventory:', error);
      setInventory(null);
    }
  };

  const runScan = async () => {
    setScanning(true);
    try {
      const response = await fetch('/api/collector/scan', {
        method: 'POST'
      });
      
      if (response.ok) {
        const data = await response.json();
        setInventory(data);
        setLastScan(new Date());
      } else {
        console.error('Scan failed');
      }
    } catch (error) {
      console.error('Scan error:', error);
    } finally {
      setScanning(false);
    }
  };

  const exportData = async (format: string, type: string) => {
    try {
      const response = await fetch(`/api/collector/export?format=${format}&type=${type}&sanitized=true`);
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `mcp-${type}-${new Date().toISOString().split('T')[0]}.${format}`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }
    } catch (error) {
      console.error('Export failed:', error);
    }
  };

  useEffect(() => {
    loadInventory();
  }, []);

  const renderOverview = () => (
    <div className="space-y-6">
      {/* System Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6 text-center">
            <Monitor className="h-8 w-8 mx-auto mb-2 text-blue-500" />
            <div className="text-2xl font-bold">{inventory?.meta.hostname || 'Unknown'}</div>
            <div className="text-sm text-muted-foreground">Hostname</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6 text-center">
            <Settings className="h-8 w-8 mx-auto mb-2 text-green-500" />
            <div className="text-2xl font-bold">{inventory?.meta.os.system || 'Unknown'}</div>
            <div className="text-sm text-muted-foreground">Operating System</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6 text-center">
            <Activity className="h-8 w-8 mx-auto mb-2 text-purple-500" />
            <div className="text-2xl font-bold">{inventory?.processes.items.length || 0}</div>
            <div className="text-sm text-muted-foreground">MCP Processes</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6 text-center">
            <FileText className="h-8 w-8 mx-auto mb-2 text-orange-500" />
            <div className="text-2xl font-bold">{inventory?.configs.length || 0}</div>
            <div className="text-sm text-muted-foreground">Configurations</div>
          </CardContent>
        </Card>
      </div>

      {/* Metrics */}
      {inventory && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Coverage Metrics</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span>Configs Found</span>
                  <Badge variant="default">{inventory.metrics.coverage.configs_found}</Badge>
                </div>
                <div className="flex justify-between">
                  <span>Repos with MCP</span>
                  <Badge variant="secondary">{inventory.metrics.coverage.repos_with_mcp}</Badge>
                </div>
                <div className="flex justify-between">
                  <span>STDIO Processes</span>
                  <Badge variant="outline">{inventory.metrics.shadow_mcp.stdio_processes}</Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Performance</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span>Scan Duration</span>
                  <Badge variant="default">{inventory.metrics.performance.scan_duration_ms}ms</Badge>
                </div>
                <div className="flex justify-between">
                  <span>Time to Evidence</span>
                  <Badge variant="secondary">{inventory.metrics.performance.time_to_evidence_ms}ms</Badge>
                </div>
                <div className="flex justify-between">
                  <span>Unsanctioned Hosts</span>
                  <Badge variant="destructive">{inventory.metrics.shadow_mcp.unsanctioned_hosts.length}</Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );

  const renderProcesses = () => (
    <div className="space-y-4">
      {inventory?.processes.items.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center">
            <Terminal className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">No MCP Processes Found</h3>
            <p className="text-muted-foreground">No running MCP processes detected on this system.</p>
          </CardContent>
        </Card>
      ) : (
        inventory?.processes.items.map((process, index) => (
          <Card key={index}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Activity className="h-5 w-5 text-green-500" />
                  <div>
                    <div className="font-medium">{process.name || 'Unknown Process'}</div>
                    <div className="text-sm text-muted-foreground">
                      PID: {process.pid} | Command: {process.command}
                    </div>
                  </div>
                </div>
                <Badge variant="default">Running</Badge>
              </div>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );

  const renderConfigs = () => (
    <div className="space-y-4">
      {inventory?.configs.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center">
            <Settings className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">No Configurations Found</h3>
            <p className="text-muted-foreground">No MCP configuration files detected.</p>
          </CardContent>
        </Card>
      ) : (
        inventory?.configs.map((config, index) => (
          <Card key={index}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <FileText className="h-5 w-5 text-blue-500" />
                  <div>
                    <div className="font-medium">{config.path}</div>
                    <div className="text-sm text-muted-foreground">
                      {config.servers?.length || 0} servers configured
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  {config.repo_context && (
                    <Badge variant="outline">Git Repo</Badge>
                  )}
                  <Badge variant="secondary">
                    {new Date(config.modified_time * 1000).toLocaleDateString()}
                  </Badge>
                </div>
              </div>
              
              {config.servers && config.servers.length > 0 && (
                <div className="mt-3 pl-8">
                  <div className="space-y-2">
                    {config.servers.map((server: any, serverIndex: number) => (
                      <div key={serverIndex} className="flex items-center justify-between p-2 bg-muted rounded">
                        <div className="flex items-center gap-2">
                          {server.type === 'http' ? <Wifi className="h-4 w-4" /> : <Database className="h-4 w-4" />}
                          <span className="text-sm font-medium">{server.name}</span>
                        </div>
                        <Badge variant="outline" className="text-xs">
                          {server.type?.toUpperCase() || 'UNKNOWN'}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );

  const renderFindings = () => (
    <div className="space-y-4">
      {inventory?.findings.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center">
            <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">No Security Findings</h3>
            <p className="text-muted-foreground">All configurations appear secure.</p>
          </CardContent>
        </Card>
      ) : (
        inventory?.findings.map((finding, index) => (
          <Card key={index}>
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-yellow-500 mt-0.5" />
                <div className="flex-1">
                  <div className="font-medium">{finding.type}</div>
                  <div className="text-sm text-muted-foreground mt-1">
                    {finding.description || 'Security finding detected'}
                  </div>
                  {finding.risk_boosters && finding.risk_boosters.length > 0 && (
                    <div className="flex gap-1 mt-2">
                      {finding.risk_boosters.map((risk: string, riskIndex: number) => (
                        <Badge key={riskIndex} variant="destructive" className="text-xs">
                          {risk}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );

  const renderMetrics = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Coverage Details</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span>Configurations Found</span>
              <span className="font-bold">{inventory?.metrics.coverage.configs_found || 0}</span>
            </div>
            <div className="flex justify-between items-center">
              <span>Repositories with MCP</span>
              <span className="font-bold">{inventory?.metrics.coverage.repos_with_mcp || 0}</span>
            </div>
            <div className="flex justify-between items-center">
              <span>IDE Detection Rate</span>
              <span className="font-bold">{((inventory?.metrics.coverage.ide_detection_rate || 0) * 100).toFixed(1)}%</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Shadow MCP Detection</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span>STDIO Processes</span>
              <span className="font-bold">{inventory?.metrics.shadow_mcp.stdio_processes || 0}</span>
            </div>
            <div className="flex justify-between items-center">
              <span>Unsanctioned Hosts</span>
              <span className="font-bold text-red-600">{inventory?.metrics.shadow_mcp.unsanctioned_hosts.length || 0}</span>
            </div>
            {inventory?.metrics.shadow_mcp.unsanctioned_hosts.length > 0 && (
              <div className="mt-2">
                <div className="text-sm font-medium mb-1">Detected hosts:</div>
                {inventory.metrics.shadow_mcp.unsanctioned_hosts.map((host, index) => (
                  <Badge key={index} variant="destructive" className="text-xs mr-1 mb-1">
                    {host}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );

  return (
    <>
      <Breadcrumbs pageName={pageData?.name} />
      <PageWrapper>
        <div className="flex items-center justify-between">
          <Header title={pageData?.title}>{pageData?.description}</Header>
          
          <div className="flex items-center gap-4">
            {lastScan && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="h-4 w-4" />
                Last scan: {lastScan.toLocaleTimeString()}
              </div>
            )}
            <Button onClick={runScan} disabled={scanning} size="sm">
              {scanning ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Scanning...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Run Scan
                </>
              )}
            </Button>
            {inventory && (
              <Button onClick={() => exportData('json', 'inventory')} variant="outline" size="sm">
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
            )}
          </div>
        </div>
        
        <div className="space-y-6 mt-6">
          {!inventory && !scanning && (
            <Card>
              <CardContent className="p-6 text-center">
                <Shield className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2">No Scan Data Available</h3>
                <p className="text-muted-foreground mb-4">
                  Run a system scan to collect information about MCP configurations and processes.
                </p>
                <Button onClick={runScan}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Run First Scan
                </Button>
              </CardContent>
            </Card>
          )}

          {inventory && (
            <>
              {/* Tabs */}
              <div className="flex border-b border-gray-200">
                {[
                  { id: 'overview', label: 'Overview', icon: Monitor },
                  { id: 'processes', label: 'Processes', icon: Activity },
                  { id: 'configs', label: 'Configuration', icon: Settings },
                  { id: 'findings', label: 'Findings', icon: AlertTriangle },
                  { id: 'metrics', label: 'Metrics', icon: FileText },
                ].map(({ id, label, icon: Icon }) => (
                  <button
                    key={id}
                    onClick={() => setActiveTab(id as any)}
                    className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
                      activeTab === id
                        ? 'border-blue-500 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {label}
                  </button>
                ))}
              </div>

              {/* Tab Content */}
              <div className="mt-6">
                {activeTab === 'overview' && renderOverview()}
                {activeTab === 'processes' && renderProcesses()}
                {activeTab === 'configs' && renderConfigs()}
                {activeTab === 'findings' && renderFindings()}
                {activeTab === 'metrics' && renderMetrics()}
              </div>
            </>
          )}
        </div>
      </PageWrapper>
    </>
  );
}
