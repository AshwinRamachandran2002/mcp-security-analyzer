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
  Server,
  ChevronRight,
  CheckCircle,
  XCircle,
  Clock,
  RefreshCw,
  WifiOff,
  Database,
  Wifi,
  FileCode,
  Cpu
} from "lucide-react";

const pageData = {
  name: "Discovery",
  title: "Endpoint Discovery",
  description: "Discovered endpoints with MCP servers, configurations, and running processes.",
};

interface EndpointSummary {
  endpoint_id: string;
  hostname: string;
  status: string;
  server_count: number;
  stdio_count: number;
  http_count: number;
  config_count: number;
  process_count: number;
  high_risk: number;
  low_risk: number;
  last_scan: string;
}

export default function Page() {
  const [endpoints, setEndpoints] = useState<EndpointSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const loadEndpoints = async () => {
    setLoading(true);
    try {
      // Get endpoints from servers API
      const serversResponse = await fetch('/api/servers?groupBy=endpoint');
      const serversData = await serversResponse.json();

      // Get inventory data for config and process counts
      const inventoryResponse = await fetch('/api/collector/inventory');
      let inventoryData = null;
      if (inventoryResponse.ok) {
        inventoryData = await inventoryResponse.json();
      }

      // Combine data
      const endpointsList: EndpointSummary[] = (serversData.endpoints || []).map((ep: any) => {
        // Calculate risk counts from servers (treat medium as high)
        const highRisk = ep.servers.filter((s: any) => s.risk_level === 'high' || s.risk_level === 'medium').length;
        const lowRisk = ep.servers.filter((s: any) => s.risk_level === 'low').length;

        return {
          endpoint_id: ep.endpoint_id,
          hostname: ep.hostname,
          status: ep.status,
          server_count: ep.server_count,
          stdio_count: ep.stdio_count,
          http_count: ep.http_count,
          config_count: inventoryData?.configs?.length || 0,
          process_count: inventoryData?.processes?.items?.length || 0,
          high_risk: highRisk,
          low_risk: lowRisk,
          last_scan: new Date().toISOString()
        };
      });

      setEndpoints(endpointsList);
      setLastRefresh(new Date());
    } catch (error) {
      console.error('Error loading endpoints:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEndpoints();
    const interval = setInterval(loadEndpoints, 2 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <>
      <Breadcrumbs pageName={pageData?.name} />
      <PageWrapper>
        <div className="flex items-center justify-between mb-6">
          <Header title={pageData?.title}>{pageData?.description}</Header>

          <div className="flex items-center gap-4">
            {lastRefresh && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="h-4 w-4" />
                Last updated: {lastRefresh.toLocaleTimeString()}
              </div>
            )}
            <Button onClick={loadEndpoints} disabled={loading} size="sm">
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

        {/* Summary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <Card>
            <CardContent className="p-6 text-center">
              <div className="text-3xl font-bold mb-2">
                {loading ? (
                  <div className="w-12 h-8 bg-gray-200 rounded animate-pulse mx-auto"></div>
                ) : (
                  endpoints.length
                )}
              </div>
              <div className="text-sm text-muted-foreground">Total Endpoints</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Risk Overview</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-2">
                  <div className="w-full h-6 bg-gray-200 rounded animate-pulse"></div>
                  <div className="w-full h-6 bg-gray-200 rounded animate-pulse"></div>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span>High Risk</span>
                    <span className="text-xl font-bold text-red-600">
                      {endpoints.filter(ep => ep.high_risk > 0).length}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Low Risk</span>
                    <span className="text-xl font-bold text-green-600">
                      {endpoints.filter(ep => ep.high_risk === 0 && ep.low_risk > 0).length}
                    </span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Endpoints List */}
        <div>
          <h2 className="text-xl font-semibold mb-4">Discovered Endpoints</h2>

          {loading ? (
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-center">
                  <RefreshCw className="h-6 w-6 animate-spin mr-2" />
                  Loading endpoints...
                </div>
              </CardContent>
            </Card>
          ) : endpoints.length === 0 ? (
            <Card>
              <CardContent className="p-6 text-center">
                <WifiOff className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2">No Endpoints Discovered</h3>
                <p className="text-muted-foreground mb-4">
                  No endpoints have been discovered yet. Run a scan to discover endpoints.
                </p>
                <Button onClick={loadEndpoints}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Refresh Now
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {endpoints.map((endpoint) => (
                <Link key={endpoint.endpoint_id} href={`/discovery/${endpoint.endpoint_id}`}>
                  <Card className="hover:bg-accent/50 transition-colors cursor-pointer">
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <Server className="h-6 w-6 text-primary flex-shrink-0" />
                          <div className="min-w-0 flex-1">
                            <CardTitle className="text-xl truncate">{endpoint.hostname}</CardTitle>
                            <p className="text-sm text-muted-foreground mt-1">
                              {endpoint.endpoint_id}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {endpoint.status === 'healthy' ? (
                            <CheckCircle className="h-6 w-6 text-green-500" />
                          ) : (
                            <XCircle className="h-6 w-6 text-red-500" />
                          )}
                          <ChevronRight className="h-5 w-5" />
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {/* Transport & Stats */}
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                          <div className="flex items-center gap-2">
                            <Server className="h-4 w-4 text-muted-foreground" />
                            <div>
                              <div className="text-lg font-bold">{endpoint.server_count}</div>
                              <div className="text-xs text-muted-foreground">Servers</div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <Database className="h-4 w-4 text-green-500" />
                            <div>
                              <div className="text-lg font-bold">{endpoint.stdio_count}</div>
                              <div className="text-xs text-muted-foreground">STDIO</div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <Wifi className="h-4 w-4 text-blue-500" />
                            <div>
                              <div className="text-lg font-bold">{endpoint.http_count}</div>
                              <div className="text-xs text-muted-foreground">Remote</div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <FileCode className="h-4 w-4 text-purple-500" />
                            <div>
                              <div className="text-lg font-bold">{endpoint.config_count}</div>
                              <div className="text-xs text-muted-foreground">Configs</div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <Cpu className="h-4 w-4 text-orange-500" />
                            <div>
                              <div className="text-lg font-bold">{endpoint.process_count}</div>
                              <div className="text-xs text-muted-foreground">Processes</div>
                            </div>
                          </div>
                        </div>

                        {/* Risk Labels */}
                        <div className="flex items-center gap-3 pt-2 border-t">
                          <span className="text-sm font-medium text-muted-foreground">Risk:</span>
                          <div className="flex items-center gap-2">
                            {endpoint.high_risk > 0 && (
                              <span className="text-xs px-2 py-1 bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300 rounded font-medium">
                                High Risk
                              </span>
                            )}
                            {endpoint.low_risk > 0 && endpoint.high_risk === 0 && (
                              <span className="text-xs px-2 py-1 bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300 rounded font-medium">
                                Low Risk
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </div>
      </PageWrapper>
    </>
  );
}
