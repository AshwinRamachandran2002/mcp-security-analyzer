"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Breadcrumbs } from "@/components/parts/breadcrumbs";
import { Header } from "@/components/parts/header";
import { PageWrapper } from "@/components/parts/page-wrapper";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Database,
  ChevronRight,
  ExternalLink,
  Shield,
  Activity,
  CheckCircle,
  XCircle,
  Clock,
  RefreshCw,
  Wifi,
  Server,
  FileCode,
  Cpu,
  FolderOpen,
  GitBranch,
  User,
  ArrowLeft
} from "lucide-react";

interface ServerData {
  name: string;
  transport: string;
  command?: string;
  args?: string[];
  url?: string;
  status: 'active' | 'configured' | 'unknown';
  function_count: number;
  risk_level: 'high' | 'medium' | 'low';
  has_auth: boolean;
  installation_method?: string;
  server_classification?: string;
  fingerprint?: string;
}

interface MCPConfig {
  path: string;
  mtime: number;
  sha256: string;
  servers: Array<{
    name: string;
    transport: string;
    command?: string;
    args?: string[];
    url?: string;
    fingerprint: string;
  }>;
  repo_context?: {
    name: string;
    branch: string;
    owner: string;
    remote_url: string;
  };
}

interface MCPProcess {
  pid: number;
  ppid: number;
  parent_name: string;
  cmd: string;
  cmd_redacted: string;
  first_seen: number;
  last_seen: number;
  fingerprint?: string;
}

interface InventoryData {
  meta: {
    hostname: string;
    os: {
      system: string;
      release: string;
    };
    user: {
      os_user: string;
    };
    scan_duration_ms: number;
  };
  configs: MCPConfig[];
  processes: {
    items: MCPProcess[];
  };
}

export default function Page() {
  const params = useParams();
  const endpointId = params?.endpointId as string;

  const [servers, setServers] = useState<ServerData[]>([]);
  const [inventory, setInventory] = useState<InventoryData | null>(null);
  const [hostname, setHostname] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [activeTab, setActiveTab] = useState<string>("servers");

  const loadData = async () => {
    setLoading(true);
    try {
      // Load servers for this endpoint
      const serversResponse = await fetch('/api/servers?groupBy=endpoint');
      if (serversResponse.ok) {
        const data = await serversResponse.json();
        const endpoint = data.endpoints?.find((ep: any) => ep.endpoint_id === endpointId);
        if (endpoint) {
          setServers(endpoint.servers || []);
          setHostname(endpoint.hostname);
        }
      }

      // Load inventory data
      const inventoryResponse = await fetch('/api/collector/inventory');
      if (inventoryResponse.ok) {
        const invData = await inventoryResponse.json();
        setInventory(invData);
        if (!hostname) {
          setHostname(invData.meta.hostname);
        }
      }

      setLastRefresh(new Date());
    } catch (error) {
      console.error('Error loading endpoint data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 2 * 60 * 1000);
    return () => clearInterval(interval);
  }, [endpointId]);

  const getTransportIcon = (transport: string) => {
    if (transport === 'http') return <Wifi className="h-4 w-4 text-blue-500" />;
    if (transport === 'stdio') return <Database className="h-4 w-4 text-green-500" />;
    return <Database className="h-4 w-4 text-gray-500" />;
  };

  const stdioServers = servers.filter(s => s.transport === 'stdio');
  const httpServers = servers.filter(s => s.transport === 'http');

  return (
    <>
      <Breadcrumbs pageName={hostname || endpointId} />
      <PageWrapper>
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="flex items-center gap-4 mb-2">
              <Link href="/discovery">
                <Button variant="outline" size="sm">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Endpoints
                </Button>
              </Link>
            </div>
            <Header title={hostname || endpointId}>
              Endpoint inventory: servers, configs, and processes
            </Header>
          </div>

          <div className="flex items-center gap-4">
            {lastRefresh && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="h-4 w-4" />
                {lastRefresh.toLocaleTimeString()}
              </div>
            )}
            <Button onClick={loadData} disabled={loading} size="sm">
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

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="servers">
              <Server className="h-4 w-4 mr-2" />
              Servers ({servers.length})
            </TabsTrigger>
            <TabsTrigger value="configs">
              <FileCode className="h-4 w-4 mr-2" />
              Configs ({inventory?.configs.length || 0})
            </TabsTrigger>
            <TabsTrigger value="processes">
              <Cpu className="h-4 w-4 mr-2" />
              Processes ({inventory?.processes.items.length || 0})
            </TabsTrigger>
          </TabsList>

          {/* SERVERS TAB */}
          <TabsContent value="servers" className="mt-6">
            <Tabs defaultValue="stdio" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="stdio">
                  <Database className="h-4 w-4 mr-2" />
                  STDIO ({stdioServers.length})
                </TabsTrigger>
                <TabsTrigger value="http">
                  <Wifi className="h-4 w-4 mr-2" />
                  Remote ({httpServers.length})
                </TabsTrigger>
              </TabsList>

              {/* STDIO Servers */}
              <TabsContent value="stdio" className="mt-6">
                {stdioServers.length === 0 ? (
                  <Card>
                    <CardContent className="p-6 text-center text-muted-foreground">
                      No STDIO servers discovered on this endpoint
                    </CardContent>
                  </Card>
                ) : (
                  <div className="space-y-3">
                    {stdioServers.map((server, index) => (
                      <Card key={index}>
                        <CardContent className="p-4">
                          <Link
                            href={`/integrations/${server.name}/dynamic`}
                            className="block hover:bg-accent/50 transition-colors -m-4 p-4 rounded"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-2">
                                  {getTransportIcon(server.transport)}
                                  <span className="font-semibold text-lg">{server.name}</span>
                                  <Badge variant="default" className="text-xs">
                                    {server.transport.toUpperCase()}
                                  </Badge>
                                </div>
                                <div className="text-sm text-muted-foreground">
                                  {server.command && (
                                    <div className="flex items-center">
                                      <Database className="mr-1 h-3 w-3" />
                                      {server.command} {server.args?.join(' ')}
                                    </div>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center gap-4">
                                <div className="text-center">
                                  <div className="text-2xl font-bold">{server.function_count}</div>
                                  <div className="text-xs text-muted-foreground">Functions</div>
                                </div>
                                <ChevronRight className="h-5 w-5" />
                              </div>
                            </div>
                          </Link>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </TabsContent>

              {/* HTTP Servers */}
              <TabsContent value="http" className="mt-6">
                {httpServers.length === 0 ? (
                  <Card>
                    <CardContent className="p-6 text-center text-muted-foreground">
                      No HTTP servers discovered on this endpoint
                    </CardContent>
                  </Card>
                ) : (
                  <div className="space-y-3">
                    {httpServers.map((server, index) => (
                      <Card key={index}>
                        <CardContent className="p-4">
                          <Link
                            href={`/integrations/${server.name}/dynamic`}
                            className="block hover:bg-accent/50 transition-colors -m-4 p-4 rounded"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-2">
                                  {getTransportIcon(server.transport)}
                                  <span className="font-semibold text-lg">{server.name}</span>
                                  <Badge variant="secondary" className="text-xs">
                                    {server.transport.toUpperCase()}
                                  </Badge>
                                </div>
                                <div className="text-sm text-muted-foreground">
                                  {server.url && (
                                    <div className="flex items-center mb-1">
                                      <ExternalLink className="mr-1 h-3 w-3" />
                                      {server.url}
                                    </div>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center gap-4">
                                <div className="text-center">
                                  <div className="text-2xl font-bold">{server.function_count}</div>
                                  <div className="text-xs text-muted-foreground">Functions</div>
                                </div>
                                <ChevronRight className="h-5 w-5" />
                              </div>
                            </div>
                          </Link>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </TabsContent>

          {/* CONFIGS TAB */}
          <TabsContent value="configs" className="mt-6">
            <div className="space-y-4">
              <div className="flex items-center mb-4">
                <FileCode className="mr-2 h-5 w-5 text-primary" />
                <h2 className="text-xl font-semibold">MCP Configuration Files</h2>
              </div>

              {!inventory || inventory.configs.length === 0 ? (
                <Card>
                  <CardContent className="p-6 text-center">
                    <FolderOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-medium mb-2">No Configuration Files Found</h3>
                    <p className="text-muted-foreground">
                      No MCP configuration files discovered on this endpoint.
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-4">
                  {inventory.configs.map((config, index) => (
                    <Card key={index}>
                      <CardHeader>
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <CardTitle className="text-base font-mono break-all">
                              {config.path}
                            </CardTitle>
                            {config.repo_context && (
                              <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                                <div className="flex items-center gap-1">
                                  <GitBranch className="h-3 w-3" />
                                  {config.repo_context.name}
                                </div>
                                <div className="flex items-center gap-1">
                                  <User className="h-3 w-3" />
                                  {config.repo_context.owner}
                                </div>
                                <Badge variant="outline" className="text-xs">
                                  {config.repo_context.branch}
                                </Badge>
                              </div>
                            )}
                          </div>
                          <Badge variant="secondary">
                            {config.servers.length} server{config.servers.length !== 1 ? 's' : ''}
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          {config.servers.map((server, serverIndex) => (
                            <div
                              key={serverIndex}
                              className="p-3 bg-gray-50 dark:bg-gray-900 rounded border"
                            >
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                  {getTransportIcon(server.transport)}
                                  <span className="font-semibold">{server.name}</span>
                                  <Badge variant="outline" className="text-xs">
                                    {server.transport.toUpperCase()}
                                  </Badge>
                                </div>
                              </div>
                              <div className="text-xs text-muted-foreground font-mono">
                                {server.url && <div>URL: {server.url}</div>}
                                {server.command && (
                                  <div>Command: {server.command} {server.args?.join(' ')}</div>
                                )}
                                {server.fingerprint && (
                                  <div className="mt-1 opacity-60">Fingerprint: {server.fingerprint}</div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                        <div className="mt-3 pt-3 border-t text-xs text-muted-foreground">
                          <div>SHA256: {config.sha256}</div>
                          <div>Modified: {new Date(config.mtime * 1000).toLocaleString()}</div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>

          {/* PROCESSES TAB */}
          <TabsContent value="processes" className="mt-6">
            <div className="space-y-4">
              <div className="flex items-center mb-4">
                <Cpu className="mr-2 h-5 w-5 text-primary" />
                <h2 className="text-xl font-semibold">Live MCP Processes</h2>
              </div>

              {!inventory || inventory.processes.items.length === 0 ? (
                <Card>
                  <CardContent className="p-6 text-center">
                    <Activity className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-medium mb-2">No Running Processes Found</h3>
                    <p className="text-muted-foreground">
                      No active MCP server processes currently running on this endpoint.
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-3">
                  {inventory.processes.items.map((process, index) => (
                    <Card key={index}>
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <Activity className="h-4 w-4 text-green-500" />
                            <span className="font-semibold">PID {process.pid}</span>
                            <Badge variant="outline" className="text-xs">PPID {process.ppid}</Badge>
                          </div>
                          <Badge variant="secondary">{process.parent_name}</Badge>
                        </div>
                        <div className="font-mono text-sm bg-gray-50 dark:bg-gray-900 p-3 rounded break-all">
                          {process.cmd_redacted}
                        </div>
                        <div className="mt-2 text-xs text-muted-foreground space-y-1">
                          <div>First seen: {new Date(process.first_seen * 1000).toLocaleString()}</div>
                          <div>Last seen: {new Date(process.last_seen * 1000).toLocaleString()}</div>
                          {process.fingerprint && (
                            <div className="opacity-60">Fingerprint: {process.fingerprint}</div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}

              {inventory && (
                <Card className="mt-6">
                  <CardHeader>
                    <CardTitle className="text-sm">Scan Metadata</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <div className="text-muted-foreground">Hostname</div>
                        <div className="font-semibold">{inventory.meta.hostname}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">OS</div>
                        <div className="font-semibold">{inventory.meta.os.system} {inventory.meta.os.release}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">User</div>
                        <div className="font-semibold">{inventory.meta.user.os_user}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Scan Duration</div>
                        <div className="font-semibold">{inventory.meta.scan_duration_ms}ms</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </PageWrapper>
    </>
  );
}
