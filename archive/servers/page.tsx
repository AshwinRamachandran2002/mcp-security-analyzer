"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Breadcrumbs } from "@/components/parts/breadcrumbs";
import { Header } from "@/components/parts/header";
import { PageWrapper } from "@/components/parts/page-wrapper";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Database, 
  ChevronRight, 
  ExternalLink, 
  Shield, 
  AlertTriangle, 
  Activity, 
  CheckCircle, 
  XCircle, 
  Clock,
  RefreshCw,
  Wifi,
  WifiOff
} from "lucide-react";

const pageData = {
  name: "Integrations",
  title: "Connected Integrations",
  description: "Live MCP server integrations discovered across your environment.",
};

interface ServerData {
  name: string;
  transport: string;
  command?: string;
  args?: string[];
  url?: string;
  status: 'active' | 'configured' | 'unknown';
  endpoint_count: number;
  unique_hostnames: number;
  has_auth: boolean;
  risk_level: 'high' | 'medium' | 'low';
  function_count: number;
  last_updated: string;
  has_active_processes: boolean;
  installation_method?: string;
  server_classification?: string;
  transport_type?: string;
  is_remote?: boolean;
  is_local?: boolean;
  endpoints: Array<{
    endpoint_id: string;
    hostname: string;
    config_path: string;
    status: string;
  }>;
}

interface ServerSummary {
  total_servers: number;
  active_servers: number;
  configured_servers: number;
  authenticated_servers: number;
  high_risk_servers: number;
  total_endpoints: number;
  healthy_endpoints: number;
  total_functions: number;
  unique_transports: string[];
  stdio_servers?: number;
  http_servers?: number;
  npm_installed?: number;
  pip_installed?: number;
  docker_installed?: number;
  remote_services?: number;
  last_aggregation: number;
}

export default function Page() {
  const [servers, setServers] = useState<ServerData[]>([]);
  const [summary, setSummary] = useState<ServerSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [activeTab, setActiveTab] = useState<'stdio' | 'remote'>('stdio');

  const loadServers = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/servers');
      if (response.ok) {
        const data = await response.json();
        
        // Use only real discovered function counts - no hardcoded fallbacks
        const enhancedServers = data.servers;
        
        setServers(enhancedServers || []);
        setSummary(data.summary || null);
        setLastRefresh(new Date());
      } else {
        console.error('Failed to load servers');
      }
    } catch (error) {
      console.error('Error loading servers:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadServers();
    
    // Refresh every 2 minutes
    const interval = setInterval(loadServers, 2 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
        return <Activity className="h-4 w-4 text-green-500" />;
      case 'configured':
        return <CheckCircle className="h-4 w-4 text-blue-500" />;
      default:
        return <XCircle className="h-4 w-4 text-gray-500" />;
    }
  };

  const getRiskBadge = (riskLevel: string) => {
    const variant = riskLevel === 'high' ? 'destructive' : 
                   riskLevel === 'medium' ? 'secondary' : 
                   'default';
    return (
      <Badge variant={variant} className="ml-2">
        {riskLevel.toUpperCase()} RISK
      </Badge>
    );
  };

  const getTransportIcon = (transport: string) => {
    return transport === 'http' ? <Wifi className="h-4 w-4" /> : <Database className="h-4 w-4" />;
  };

  const getInstallationBadge = (method: string) => {
    const badgeStyles = {
      npm: { variant: 'default' as const, color: 'text-green-600', label: 'NPM' },
      pip: { variant: 'secondary' as const, color: 'text-blue-600', label: 'PIP' },
      docker: { variant: 'outline' as const, color: 'text-purple-600', label: 'DOCKER' },
      binary: { variant: 'outline' as const, color: 'text-gray-600', label: 'BINARY' },
      system: { variant: 'secondary' as const, color: 'text-yellow-600', label: 'SYSTEM' },
      unknown: { variant: 'outline' as const, color: 'text-gray-400', label: 'UNKNOWN' }
    };
    
    const style = badgeStyles[method as keyof typeof badgeStyles] || badgeStyles.unknown;
    return (
      <Badge variant={style.variant} className="text-xs">
        {style.label}
      </Badge>
    );
  };

  const getClassificationBadge = (classification: string) => {
    const classStyles = {
      'github-remote': { color: 'bg-black text-white', label: 'GitHub Remote' },
      'github-local': { color: 'bg-gray-800 text-white', label: 'GitHub Local' },
      'filesystem-local': { color: 'bg-blue-600 text-white', label: 'Filesystem' },
      'jira-remote': { color: 'bg-blue-500 text-white', label: 'Jira Remote' },
      'api-service': { color: 'bg-purple-600 text-white', label: 'API Service' },
      'http-service': { color: 'bg-orange-600 text-white', label: 'HTTP Service' }
    };
    
    const style = classStyles[classification as keyof typeof classStyles];
    if (!style) return null;
    
    return (
      <span className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-medium ${style.color}`}>
        {style.label}
      </span>
    );
  };

  return (
    <>
      <Breadcrumbs pageName={pageData?.name} />
      <PageWrapper>
        <div className="flex items-center justify-between">
          <Header title={pageData?.title}>{pageData?.description}</Header>
          
          <div className="flex items-center gap-4">
            {lastRefresh && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="h-4 w-4" />
                Last updated: {lastRefresh.toLocaleTimeString()}
              </div>
            )}
            <Button onClick={loadServers} disabled={loading} size="sm">
              {loading ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Refreshing...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Refresh
                </>
              )}
            </Button>
          </div>
        </div>
        
        <div className="space-y-6 mt-6">
          
          {/* Server Statistics */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-6 text-center">
                <div className="text-3xl font-bold mb-2">
                  {loading ? (
                    <div className="w-12 h-8 bg-gray-200 rounded animate-pulse mx-auto"></div>
                  ) : (
                    summary?.total_servers || 0
                  )}
                </div>
                <div className="text-sm text-muted-foreground">Total Servers</div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-6 text-center">
                <div className="text-3xl font-bold mb-2">
                  {loading ? (
                    <div className="w-12 h-8 bg-gray-200 rounded animate-pulse mx-auto"></div>
                  ) : (
                    summary?.active_servers || 0
                  )}
                </div>
                <div className="text-sm text-muted-foreground">Active Servers</div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-6 text-center">
                <div className="text-3xl font-bold mb-2">
                  {loading ? (
                    <div className="w-12 h-8 bg-gray-200 rounded animate-pulse mx-auto"></div>
                  ) : (
                    summary?.total_functions || 0
                  )}
                </div>
                <div className="text-sm text-muted-foreground">Total Functions</div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-6 text-center">
                <div className="text-3xl font-bold mb-2">
                  {loading ? (
                    <div className="w-12 h-8 bg-gray-200 rounded animate-pulse mx-auto"></div>
                  ) : (
                    summary?.authenticated_servers || 0
                  )}
                </div>
                <div className="text-sm text-muted-foreground">Authenticated</div>
              </CardContent>
            </Card>
          </div>

          {/* Transport and Installation Statistics */}
          {summary && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Transport Types</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <Database className="h-4 w-4" />
                        <span>STDIO (Local)</span>
                      </div>
                      <Badge variant="default">{summary.stdio_servers || 0}</Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <Wifi className="h-4 w-4" />
                        <span>HTTP (Remote)</span>
                      </div>
                      <Badge variant="secondary">{summary.http_servers || 0}</Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Installation Methods</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span>NPM Packages</span>
                      <Badge variant="default">{summary.npm_installed || 0}</Badge>
                    </div>

                    <div className="flex justify-between items-center">
                      <span>Python/PIP</span>
                      <Badge variant="secondary">{summary.pip_installed || 0}</Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <span>Docker</span>
                      <Badge variant="outline">{(summary as any).docker_installed || 0}</Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
          
          {/* Connected Servers Section */}
          <div className="mt-8">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center">
                <Shield className="mr-2 h-5 w-5 text-primary" />
                <h2 className="text-xl font-semibold">Discovered MCP Servers</h2>
              </div>
              {summary && (
                <div className="text-sm text-muted-foreground">
                  Across {summary.total_endpoints} endpoints • {summary.unique_transports.join(', ')} transports
                </div>
              )}
            </div>
            <p className="text-muted-foreground text-sm mb-4">
              Live MCP servers discovered through automated scanning. Status and metrics update automatically.
            </p>

            {/* Tabs */}
            <div className="flex border-b border-gray-200 mb-6">
              <button
                onClick={() => setActiveTab('stdio')}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'stdio'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <Database className="inline-block w-4 h-4 mr-2" />
                STDIO ({servers.filter(s => s.transport === 'stdio').length})
              </button>
              <button
                onClick={() => setActiveTab('remote')}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'remote'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <Wifi className="inline-block w-4 h-4 mr-2" />
                Remote ({servers.filter(s => s.transport === 'http').length})
              </button>
            </div>
            
            {loading ? (
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-center">
                    <RefreshCw className="h-6 w-6 animate-spin mr-2" />
                    Loading servers...
                  </div>
                </CardContent>
              </Card>
            ) : servers.length === 0 ? (
              <Card>
                <CardContent className="p-6 text-center">
                  <WifiOff className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-medium mb-2">No Servers Discovered</h3>
                  <p className="text-muted-foreground mb-4">
                    No MCP servers have been discovered yet. Run the collector to scan for servers.
                  </p>
                  <Button onClick={loadServers}>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Refresh Now
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="p-0">
                  {servers.filter(server => 
                    activeTab === 'stdio' ? server.transport === 'stdio' : server.transport === 'http'
                  ).map((server, index) => (
                    <Link
                      key={`${server.name}-${index}`}
                      href={`/servers/${server.name}/dynamic`}
                      className="block p-4 flex flex-col md:flex-row md:items-center md:justify-between hover:bg-accent/50 transition-colors duration-150 border-b last:border-b-0"
                    >
                      <div className="mb-2 md:mb-0 flex-1">
                        <div className="text-xl font-semibold flex items-center flex-wrap gap-2">
                          {getTransportIcon(server.transport)}
                          <span className="ml-2">{server.name}</span>
                          {getStatusIcon(server.status)}
                          {server.installation_method && getInstallationBadge(server.installation_method)}
                          {server.risk_level !== 'low' && getRiskBadge(server.risk_level)}
                          {!server.has_auth && server.transport === 'http' && (
                            <Badge variant="outline">
                              No Auth
                            </Badge>
                          )}
                        </div>
                        <div className="text-sm text-muted-foreground mt-1 space-y-1">
                          {server.url && (
                            <div className="flex items-center">
                              <ExternalLink className="mr-1 h-3 w-3" />
                              {server.url}
                            </div>
                          )}
                          {server.command && (
                            <div className="flex items-center">
                              <Database className="mr-1 h-3 w-3" />
                              {server.command} {server.args?.join(' ')}
                            </div>
                          )}
                          <div className="flex items-center space-x-4">
                            <span>{server.endpoint_count} endpoint{server.endpoint_count !== 1 ? 's' : ''}</span>
                            <span>{server.unique_hostnames} host{server.unique_hostnames !== 1 ? 's' : ''}</span>
                            {server.has_active_processes && (
                              <span className="text-green-600">● Live processes</span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center space-x-4 md:space-x-6">
                        <div className="text-center">
                          <div className="text-2xl font-bold">{server.function_count}</div>
                          <div className="text-xs text-muted-foreground">Functions</div>
                        </div>
                        <div className="text-center">
                          <div className="text-sm font-medium">{server.status.toUpperCase()}</div>
                          <div className="text-xs text-muted-foreground">
                            {new Date(server.last_updated).toLocaleDateString()}
                          </div>
                        </div>
                        <div>
                          <ChevronRight />
                        </div>
                      </div>
                    </Link>
                  ))}
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </PageWrapper>
    </>
  );
}
