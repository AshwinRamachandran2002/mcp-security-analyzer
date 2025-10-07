"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Breadcrumbs } from "@/components/parts/breadcrumbs";
import { Header } from "@/components/parts/header";
import { PageWrapper } from "@/components/parts/page-wrapper";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  ArrowLeft, 
  Database, 
  Shield, 
  AlertTriangle, 
  Info, 
  ChevronRight, 
  RefreshCw,
  Activity,
  CheckCircle,
  XCircle,
  Eye,
  Loader2
} from "lucide-react";
import Link from "next/link";

interface ServerTool {
  name: string;
  description: string;
  arguments: Record<string, any>;
  discovered?: boolean;
  listA?: { belongs: boolean; reasoning: string };
  listB?: { belongs: boolean; reasoning: string };
  listC?: { belongs: boolean; reasoning: string };
}

interface ServerData {
  name: string;
  transport: string;
  command?: string;
  args?: string[];
  url?: string;
  status: string;
  endpoint_count: number;
  has_auth: boolean;
  risk_level: string;
  function_count: number;
  last_updated: string;
  endpoints: Array<{
    endpoint_id: string;
    hostname: string;
    config_path: string;
    status: string;
  }>;
}

interface ToolDiscoveryData {
  server: string;
  config: any;
  tools: Record<string, Record<string, ServerTool>>;
  tool_count: number;
  discovery_method: string;
  discovery_status?: string;
  failure_reason?: string;
}

export default function DynamicServerPage() {
  const params = useParams();
  const serverName = params.serverName as string;
  
  const [serverData, setServerData] = useState<ServerData | null>(null);
  const [toolData, setToolData] = useState<ToolDiscoveryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [toolsLoading, setToolsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadServerData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Load server basic data
      const serversResponse = await fetch('/api/servers');
      if (serversResponse.ok) {
        const serversData = await serversResponse.json();
        const server = serversData.servers.find((s: ServerData) => s.name === serverName);
        
        if (server) {
          setServerData(server);
        } else {
          setError(`Server "${serverName}" not found`);
          return;
        }
      }
      
      // Load existing tools
      await loadTools();
      
    } catch (err) {
      console.error('Failed to load server data:', err);
      setError('Failed to load server data');
    } finally {
      setLoading(false);
    }
  };

  const loadTools = async () => {
    setToolsLoading(true);
    
    try {
      // First try to load existing tools
      const toolsResponse = await fetch(`/api/tools?server=${encodeURIComponent(serverName)}`);
      if (toolsResponse.ok) {
        const tools = await toolsResponse.json();
        setToolData({
          server: serverName,
          config: {},
          tools: tools.tools,
          tool_count: tools.tool_count,
          discovery_method: tools.source
        });
      } else {
        console.error('Tool loading failed');
      }
    } catch (err) {
      console.error('Tool loading error:', err);
    } finally {
      setToolsLoading(false);
    }
  };

  const discoverTools = async () => {
    setToolsLoading(true);
    
    try {
      // Force rediscovery
      const toolsResponse = await fetch(`/api/tools/discover?server=${encodeURIComponent(serverName)}`);
      if (toolsResponse.ok) {
        const tools = await toolsResponse.json();
        setToolData(tools);
        // Refresh the tools after discovery
        setTimeout(loadTools, 1000);
      } else {
        console.error('Tool discovery failed');
      }
    } catch (err) {
      console.error('Tool discovery error:', err);
    } finally {
      setToolsLoading(false);
    }
  };

  useEffect(() => {
    if (serverName) {
      loadServerData();
    }
  }, [serverName]);

  const getRiskLevel = (tool: ServerTool) => {
    if (tool.listA?.belongs && tool.listB?.belongs && tool.listC?.belongs) return "critical";
    if ((tool.listA?.belongs && tool.listB?.belongs) || (tool.listB?.belongs && tool.listC?.belongs)) return "high";
    if (tool.listA?.belongs || tool.listB?.belongs || tool.listC?.belongs) return "medium";
    return "low";
  };

  const getRiskBadge = (riskLevel: string) => {
    const variants = {
      critical: "destructive",
      high: "destructive", 
      medium: "secondary",
      low: "default"
    } as const;
    
    return (
      <Badge variant={variants[riskLevel as keyof typeof variants] || "default"}>
        {riskLevel.toUpperCase()}
      </Badge>
    );
  };

  const getStatusIcon = (status: string) => {
    switch (status.toLowerCase()) {
      case 'active':
        return <Activity className="h-4 w-4 text-green-500" />;
      case 'configured':
        return <CheckCircle className="h-4 w-4 text-blue-500" />;
      default:
        return <XCircle className="h-4 w-4 text-gray-500" />;
    }
  };

  if (loading) {
    return (
      <>
        <Breadcrumbs pageName="Server" />
        <PageWrapper>
          <div className="flex items-center justify-center min-h-64">
            <div className="text-center">
              <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
              <p className="text-muted-foreground">Loading server data...</p>
            </div>
          </div>
        </PageWrapper>
      </>
    );
  }

  if (error || !serverData) {
    return (
      <>
        <Breadcrumbs pageName="Server" />
        <PageWrapper>
          <Card>
            <CardContent className="p-6 text-center">
              <XCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">Server Not Found</h3>
              <p className="text-muted-foreground mb-4">
                {error || `The server "${serverName}" could not be found.`}
              </p>
              <Link href="/discovery">
                <Button>
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Discovery
                </Button>
              </Link>
            </CardContent>
          </Card>
        </PageWrapper>
      </>
    );
  }

  const allTools: ServerTool[] = [];
  if (toolData?.tools) {
    Object.values(toolData.tools).forEach(serverTools => {
      Object.values(serverTools).forEach(tool => {
        allTools.push(tool);
      });
    });
  }

  return (
    <>
      <Breadcrumbs pageName={serverData.name} />
      <PageWrapper>
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center">
            <Link href="/discovery">
              <Button variant="ghost" size="sm" className="mr-4">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <Database className="h-6 w-6" />
                <h1 className="text-3xl font-bold">{serverData.name}</h1>
                {getStatusIcon(serverData.status)}
                <Badge variant="outline">{serverData.transport.toUpperCase()}</Badge>
                {serverData.risk_level !== 'low' && getRiskBadge(serverData.risk_level)}
              </div>
              <p className="text-muted-foreground mt-1">
                {serverData.transport === 'http' ? serverData.url : 
                 `${serverData.command} ${serverData.args?.join(' ') || ''}`}
              </p>
            </div>
          </div>
          
          <Button onClick={discoverTools} disabled={toolsLoading} size="sm">
            {toolsLoading ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Discovering...
              </>
            ) : (
              <>
                <Eye className="h-4 w-4 mr-2" />
                Rediscover Tools
              </>
            )}
          </Button>
        </div>

        {/* Server Info Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold">{serverData.status.toUpperCase()}</div>
              <div className="text-sm text-muted-foreground">Status</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold">{toolData?.tool_count || 0}</div>
              <div className="text-sm text-muted-foreground">Discovered Tools</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold">{serverData.endpoint_count}</div>
              <div className="text-sm text-muted-foreground">Endpoints</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold">{serverData.has_auth ? 'YES' : 'NO'}</div>
              <div className="text-sm text-muted-foreground">Authenticated</div>
            </CardContent>
          </Card>
        </div>

        {/* Discovery Status */}
        {toolData && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Info className="h-5 w-5" />
                Discovery Information
                {toolData.discovery_status === 'failed' && (
                  <Badge variant="destructive">FAILED</Badge>
                )}
                {toolData.discovery_status === 'success' && (
                  <Badge variant="default">SUCCESS</Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <div className="font-medium">Discovery Method</div>
                  <div className="text-sm text-muted-foreground">
                    {toolData.discovery_method === 'live_introspection' ? 
                      '🔍 Live MCP introspection' : 
                      toolData.discovery_method === 'vscode_extraction' ?
                        '💾 VS Code cache extraction' :
                      toolData.discovery_method === 'failed' ?
                        '❌ Discovery failed' :
                        '❓ Unknown method'
                    }
                  </div>
                  {toolData.failure_reason && (
                    <div className="text-xs text-red-600 mt-1">
                      {toolData.failure_reason}
                    </div>
                  )}
                </div>
                <div>
                  <div className="font-medium">Last Updated</div>
                  <div className="text-sm text-muted-foreground">
                    {new Date(serverData.last_updated).toLocaleString()}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Tools List */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Discovered Tools ({allTools.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {toolsLoading ? (
              <div className="text-center py-8">
                <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2" />
                <p className="text-muted-foreground">Discovering tools...</p>
              </div>
            ) : allTools.length === 0 ? (
              <div className="text-center py-8">
                <Database className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2">No Tools Discovered</h3>
                <p className="text-muted-foreground mb-4">
                  Unable to discover tools for this server. This may be because the server is not running
                  or doesn't support MCP introspection.
                </p>
                <Button onClick={discoverTools} disabled={toolsLoading}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Try Again
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {allTools.map((tool, index) => {
                  const riskLevel = getRiskLevel(tool);
                  return (
                    <Card key={index} className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <h3 className="font-semibold">{tool.name}</h3>
                            {getRiskBadge(riskLevel)}
                            {tool.discovered && (
                              <Badge variant="outline" className="text-xs">
                                AUTO-DISCOVERED
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground mb-2">
                            {tool.description}
                          </p>
                          {tool.arguments && Object.keys(tool.arguments).length > 0 && (
                            <div className="text-xs text-muted-foreground">
                              Parameters: {Object.keys(tool.arguments).join(', ')}
                            </div>
                          )}
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </div>
                      
                      {/* Security Analysis */}
                      <div className="mt-3 pt-3 border-t">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs">
                          <div className={`p-2 rounded ${tool.listA?.belongs ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
                            <div className="font-medium">List A (External Input)</div>
                            <div>{tool.listA?.belongs ? 'RISK' : 'SAFE'}</div>
                          </div>
                          <div className={`p-2 rounded ${tool.listB?.belongs ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
                            <div className="font-medium">List B (Private Data)</div>
                            <div>{tool.listB?.belongs ? 'RISK' : 'SAFE'}</div>
                          </div>
                          <div className={`p-2 rounded ${tool.listC?.belongs ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
                            <div className="font-medium">List C (External Output)</div>
                            <div>{tool.listC?.belongs ? 'RISK' : 'SAFE'}</div>
                          </div>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </PageWrapper>
    </>
  );
}
