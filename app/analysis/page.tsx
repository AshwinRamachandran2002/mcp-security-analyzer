"use client";

import { useState, useEffect } from "react";
import { Breadcrumbs } from "@/components/parts/breadcrumbs";
import { Header } from "@/components/parts/header";
import { PageWrapper } from "@/components/parts/page-wrapper";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { CheckCircle, XCircle, Filter, Info, Settings, RefreshCw, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { computeDecisions, generatePlaceholderTickers, type ToolTickers, type ToolDecision } from "@/lib/analysis-logic";

const pageData = {
  name: "Analysis",
  title: "Security Analysis",
  description: "Analyze tool capabilities and data access patterns across all MCP servers",
};

interface Tool {
  name: string;
  description: string;
  inputSchema: any;
}

interface Server {
  name: string;
  tools: Tool[];
}

interface Endpoint {
  id: string;
  name: string;
  servers: Server[];
}

interface ToolAnalysis {
  endpoint: string;
  endpointId: string;
  serverName: string;
  toolName: string;
  description: string;
  // Placeholder values for Phase 1
  isActive: boolean;
  canReadPrivate: boolean;
  canReadPublic: boolean;
  canWritePublic: boolean;
  reasoning: {
    active: string;
    readPrivate: string;
    readPublic: string;
    writePublic: string;
  };
}

export default function AnalysisPage() {
  const [endpoints, setEndpoints] = useState<Endpoint[]>([]);
  const [toolAnalyses, setToolAnalyses] = useState<ToolAnalysis[]>([]);
  const [filteredTools, setFilteredTools] = useState<ToolAnalysis[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTool, setSelectedTool] = useState<ToolAnalysis | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [regeneratingAll, setRegeneratingAll] = useState(false);
  const [savedDecisions, setSavedDecisions] = useState<any>({});
  const [vscodeDisabledData, setVscodeDisabledData] = useState<any>(null);

  // Filter states
  const [activeFilter, setActiveFilter] = useState<string>("all");
  const [privateReadFilter, setPrivateReadFilter] = useState<string>("all");
  const [publicReadFilter, setPublicReadFilter] = useState<string>("all");
  const [publicWriteFilter, setPublicWriteFilter] = useState<string>("all");

  // Helper to generate decision key
  const getDecisionKey = (endpointId: string, serverName: string, toolName: string) => {
    return `${endpointId}|${serverName}|${toolName}`;
  };

  // Regenerate analysis for a single tool
  const regenerateSingleAnalysis = async (tool: ToolAnalysis) => {
    setRegenerating(true);
    try {
      // Step 1: Get read/write tickers from LLM
      const response = await fetch('/api/analysis/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          toolName: tool.toolName,
          description: tool.description,
          serverName: tool.serverName,
          endpointId: tool.endpointId
        })
      });

      const result = await response.json();

      if (result.success && result.tickers) {
        // Step 2: Compute final decisions from tickers using logic layer
        const decision = computeDecisions(result.tickers, {
          toolName: tool.toolName,
          serverName: tool.serverName,
          description: tool.description
        }, vscodeDisabledData);

        const key = getDecisionKey(tool.endpointId, tool.serverName, tool.toolName);

        // Step 3: Save to storage
        await fetch('/api/analysis/decisions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            decisions: {
              [key]: decision
            },
            merge: true
          })
        });

        // Step 4: Update local state
        const updatedTool = {
          ...tool,
          ...decision
        };
        setSelectedTool(updatedTool);
        setToolAnalyses(prev => prev.map(t =>
          t.endpointId === tool.endpointId &&
          t.serverName === tool.serverName &&
          t.toolName === tool.toolName ? updatedTool : t
        ));

        toast.success('Analysis regenerated successfully');
      } else {
        toast.error('Failed to regenerate analysis');
      }
    } catch (error) {
      console.error('Error regenerating analysis:', error);
      toast.error('Failed to regenerate analysis');
    } finally {
      setRegenerating(false);
    }
  };

  // Regenerate all analyses
  const regenerateAllAnalyses = async () => {
    setRegeneratingAll(true);
    let successCount = 0;
    let failCount = 0;

    try {
      toast.info(`Regenerating ${toolAnalyses.length} tool analyses...`);

      const newDecisions: any = {};

      // Process tools in batches to avoid rate limits
      const batchSize = 5;
      for (let i = 0; i < toolAnalyses.length; i += batchSize) {
        const batch = toolAnalyses.slice(i, i + batchSize);

        await Promise.all(batch.map(async (tool) => {
          try {
            // Step 1: Get read/write tickers from LLM
            const response = await fetch('/api/analysis/generate', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                toolName: tool.toolName,
                description: tool.description,
                serverName: tool.serverName,
                endpointId: tool.endpointId
              })
            });

            const result = await response.json();

            if (result.success && result.tickers) {
              // Step 2: Compute final decisions from tickers
              const decision = computeDecisions(result.tickers, {
                toolName: tool.toolName,
                serverName: tool.serverName,
                description: tool.description
              }, vscodeDisabledData);

              const key = getDecisionKey(tool.endpointId, tool.serverName, tool.toolName);
              newDecisions[key] = decision;
              successCount++;
            } else {
              failCount++;
            }
          } catch (error) {
            console.error(`Error analyzing ${tool.toolName}:`, error);
            failCount++;
          }
        }));

        // Small delay between batches
        if (i + batchSize < toolAnalyses.length) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      // Save all decisions
      await fetch('/api/analysis/decisions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          decisions: newDecisions,
          merge: true
        })
      });

      // Reload data
      await loadData();

      toast.success(`Regenerated ${successCount} analyses (${failCount} failed)`);
    } catch (error) {
      console.error('Error regenerating all analyses:', error);
      toast.error('Failed to regenerate analyses');
    } finally {
      setRegeneratingAll(false);
    }
  };

  // Load endpoints and servers from discovery
  const loadData = async () => {
    try {
      setLoading(true);

      // Load VSCode disabled tools data
      const vscodeResponse = await fetch('/api/analysis/vscode-disabled');
      const vscodeData = await vscodeResponse.json();
      if (vscodeData.success) {
        setVscodeDisabledData(vscodeData.disabledData);
      }

      // Load saved decisions
      const decisionsResponse = await fetch('/api/analysis/decisions');
      const decisionsData = await decisionsResponse.json();
      setSavedDecisions(decisionsData.decisions || {});

      // Get servers grouped by endpoint
      const serversResponse = await fetch('/api/servers?groupBy=endpoint');
      const serversData = await serversResponse.json();

      if (!serversData.endpoints) {
        console.error('No endpoints found in response');
        setLoading(false);
        return;
      }

      // Load discovered tools from JSON files
      const toolsCache: { [serverName: string]: any } = {};

      // Try to load tools for each unique server
      const uniqueServers = new Set<string>();
      serversData.endpoints.forEach((ep: any) => {
        ep.servers.forEach((server: any) => {
          uniqueServers.add(server.name);
        });
      });

      for (const serverName of uniqueServers) {
        try {
          const toolsResponse = await fetch(`/api/tools/${serverName}`);
          if (toolsResponse.ok) {
            const toolsData = await toolsResponse.json();
            toolsCache[serverName] = toolsData[serverName] || {};
          }
        } catch (err) {
          console.warn(`Could not load tools for ${serverName}:`, err);
        }
      }

      // Flatten into tool analyses
      const analyses: ToolAnalysis[] = [];

      serversData.endpoints.forEach((endpoint: any) => {
        endpoint.servers.forEach((server: any) => {
          const serverTools = toolsCache[server.name] || {};

          // Iterate through discovered tools for this server
          Object.entries(serverTools).forEach(([toolName, toolData]: [string, any]) => {
            const key = getDecisionKey(endpoint.endpoint_id, server.name, toolName);
            const savedDecision = decisionsData.decisions?.[key];

            // Use saved decision if available, otherwise compute from placeholder tickers
            if (savedDecision) {
              analyses.push({
                endpoint: endpoint.hostname,
                endpointId: endpoint.endpoint_id,
                serverName: server.name,
                toolName: toolName,
                description: toolData.description || 'No description available',
                ...savedDecision
              });
            } else {
              // Generate placeholder tickers and compute decisions
              const toolInfo = {
                toolName: toolName,
                serverName: server.name,
                description: toolData.description || 'No description available'
              };

              const placeholderTickers = generatePlaceholderTickers(toolInfo);
              const decision = computeDecisions(placeholderTickers, toolInfo, vscodeDisabledData);

              analyses.push({
                endpoint: endpoint.hostname,
                endpointId: endpoint.endpoint_id,
                serverName: server.name,
                toolName: toolName,
                description: toolData.description || 'No description available',
                ...decision
              });
            }
          });
        });
      });

      console.log(`Loaded ${analyses.length} tool analyses`);
      setToolAnalyses(analyses);
      setFilteredTools(analyses);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Apply filters whenever filter states change
  useEffect(() => {
    let filtered = [...toolAnalyses];

    if (activeFilter !== "all") {
      const isActiveValue = activeFilter === "enabled";
      filtered = filtered.filter(tool => tool.isActive === isActiveValue);
    }

    if (privateReadFilter !== "all") {
      const canReadPrivateValue = privateReadFilter === "yes";
      filtered = filtered.filter(tool => tool.canReadPrivate === canReadPrivateValue);
    }

    if (publicReadFilter !== "all") {
      const canReadPublicValue = publicReadFilter === "yes";
      filtered = filtered.filter(tool => tool.canReadPublic === canReadPublicValue);
    }

    if (publicWriteFilter !== "all") {
      const canWritePublicValue = publicWriteFilter === "yes";
      filtered = filtered.filter(tool => tool.canWritePublic === canWritePublicValue);
    }

    setFilteredTools(filtered);
  }, [activeFilter, privateReadFilter, publicReadFilter, publicWriteFilter, toolAnalyses]);

  const handleCardClick = (tool: ToolAnalysis) => {
    setSelectedTool(tool);
    setIsDialogOpen(true);
  };

  const handleToggle = (field: 'isActive' | 'canReadPrivate' | 'canReadPublic' | 'canWritePublic') => {
    if (!selectedTool) return;

    const updatedTool = {
      ...selectedTool,
      [field]: !selectedTool[field]
    };

    setSelectedTool(updatedTool);

    // Update in the analyses array
    const updatedAnalyses = toolAnalyses.map(tool =>
      tool.endpoint === updatedTool.endpoint &&
      tool.serverName === updatedTool.serverName &&
      tool.toolName === updatedTool.toolName
        ? updatedTool
        : tool
    );

    setToolAnalyses(updatedAnalyses);
  };

  const resetFilters = () => {
    setActiveFilter("all");
    setPrivateReadFilter("all");
    setPublicReadFilter("all");
    setPublicWriteFilter("all");
  };

  if (loading) {
    return (
      <>
        <Breadcrumbs pageName={pageData?.name} />
        <PageWrapper>
          <Header title={pageData?.title}>{pageData?.description}</Header>
          <div className="flex items-center justify-center h-64">
            <p className="text-muted-foreground">Loading analysis data...</p>
          </div>
        </PageWrapper>
      </>
    );
  }

  return (
    <>
      <Breadcrumbs pageName={pageData?.name} />
      <PageWrapper>
        <div className="flex items-center justify-between mb-4">
          <Header title={pageData?.title}>{pageData?.description}</Header>
          <Button
            onClick={regenerateAllAnalyses}
            disabled={regeneratingAll || toolAnalyses.length === 0}
            className="flex items-center gap-2"
          >
            {regeneratingAll ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Regenerating...
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4" />
                Regenerate All Analyses
              </>
            )}
          </Button>
        </div>

        <div className="space-y-6">
          {/* Filter Controls */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Filter className="mr-2 h-5 w-5" />
                Filter Tools
              </CardTitle>
              <CardDescription>
                Filter tools by their security capabilities and status. Showing {filteredTools.length} of {toolAnalyses.length} tools.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Active Status</label>
                  <Select value={activeFilter} onValueChange={setActiveFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="All" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      <SelectItem value="enabled">Enabled</SelectItem>
                      <SelectItem value="disabled">Disabled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Private Data Read</label>
                  <Select value={privateReadFilter} onValueChange={setPrivateReadFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="All" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      <SelectItem value="yes">Can Read</SelectItem>
                      <SelectItem value="no">Cannot Read</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Public Data Read</label>
                  <Select value={publicReadFilter} onValueChange={setPublicReadFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="All" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      <SelectItem value="yes">Can Read</SelectItem>
                      <SelectItem value="no">Cannot Read</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Public Data Write</label>
                  <Select value={publicWriteFilter} onValueChange={setPublicWriteFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="All" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      <SelectItem value="yes">Can Write</SelectItem>
                      <SelectItem value="no">Cannot Write</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="mt-4">
                <Button variant="outline" size="sm" onClick={resetFilters}>
                  Reset Filters
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Tool Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredTools.map((tool, index) => (
              <Card
                key={`${tool.endpointId}-${tool.serverName}-${tool.toolName}-${index}`}
                className="cursor-pointer hover:border-primary transition-all"
                onClick={() => handleCardClick(tool)}
              >
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center justify-between">
                    <span className="truncate">{tool.toolName}</span>
                    <Info className="h-4 w-4 text-muted-foreground flex-shrink-0 ml-2" />
                  </CardTitle>
                  <CardDescription className="text-xs space-y-1">
                    <div>Endpoint: <span className="font-medium">{tool.endpoint}</span></div>
                    <div>Server: <span className="font-medium">{tool.serverName}</span></div>
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    {tool.isActive ? (
                      <>
                        <CheckCircle className="h-4 w-4 text-green-600" />
                        <span className="text-green-700">Active</span>
                      </>
                    ) : (
                      <>
                        <XCircle className="h-4 w-4 text-red-600" />
                        <span className="text-red-700">Inactive</span>
                      </>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {tool.canReadPrivate && (
                      <Badge variant="outline" className="text-xs bg-orange-50 border-orange-200 text-orange-700">
                        Private Read
                      </Badge>
                    )}
                    {tool.canReadPublic && (
                      <Badge variant="outline" className="text-xs bg-blue-50 border-blue-200 text-blue-700">
                        Public Read
                      </Badge>
                    )}
                    {tool.canWritePublic && (
                      <Badge variant="outline" className="text-xs bg-red-50 border-red-200 text-red-700">
                        Public Write
                      </Badge>
                    )}
                  </div>

                  <p className="text-xs text-muted-foreground line-clamp-2 mt-2">
                    {tool.description}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>

          {filteredTools.length === 0 && (
            <Card>
              <CardContent className="py-12 text-center">
                <p className="text-muted-foreground">No tools match the selected filters.</p>
                <Button variant="outline" size="sm" className="mt-4" onClick={resetFilters}>
                  Reset Filters
                </Button>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Tool Detail Dialog */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
            {selectedTool && (
              <>
                <DialogHeader>
                  <div className="flex items-center justify-between">
                    <DialogTitle className="flex items-center gap-2">
                      <Settings className="h-5 w-5" />
                      {selectedTool.toolName}
                    </DialogTitle>
                    <Button
                      onClick={() => regenerateSingleAnalysis(selectedTool)}
                      disabled={regenerating}
                      size="sm"
                      className="flex items-center gap-2"
                    >
                      {regenerating ? (
                        <>
                          <Loader2 className="h-3 w-3 animate-spin" />
                          Regenerating...
                        </>
                      ) : (
                        <>
                          <RefreshCw className="h-3 w-3" />
                          Regenerate
                        </>
                      )}
                    </Button>
                  </div>
                  <DialogDescription>
                    <div className="space-y-1 mt-2">
                      <div>Endpoint: <span className="font-medium">{selectedTool.endpoint}</span></div>
                      <div>Server: <span className="font-medium">{selectedTool.serverName}</span></div>
                      <div className="mt-2 text-sm">{selectedTool.description}</div>
                    </div>
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-6 mt-4">
                  {/* Active Status */}
                  <div className="border rounded-lg p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {selectedTool.isActive ? (
                          <CheckCircle className="h-5 w-5 text-green-600" />
                        ) : (
                          <XCircle className="h-5 w-5 text-red-600" />
                        )}
                        <span className="font-medium">Active (Enabled)</span>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleToggle('isActive')}
                      >
                        Toggle
                      </Button>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {selectedTool.reasoning.active}
                    </p>
                  </div>

                  {/* Can Read Private Data */}
                  <div className="border rounded-lg p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {selectedTool.canReadPrivate ? (
                          <CheckCircle className="h-5 w-5 text-green-600" />
                        ) : (
                          <XCircle className="h-5 w-5 text-red-600" />
                        )}
                        <span className="font-medium">Can Read Private Data</span>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleToggle('canReadPrivate')}
                      >
                        Toggle
                      </Button>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {selectedTool.reasoning.readPrivate}
                    </p>
                  </div>

                  {/* Can Read Public Data */}
                  <div className="border rounded-lg p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {selectedTool.canReadPublic ? (
                          <CheckCircle className="h-5 w-5 text-green-600" />
                        ) : (
                          <XCircle className="h-5 w-5 text-red-600" />
                        )}
                        <span className="font-medium">Can Read Public Data</span>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleToggle('canReadPublic')}
                      >
                        Toggle
                      </Button>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {selectedTool.reasoning.readPublic}
                    </p>
                  </div>

                  {/* Can Write Public Data */}
                  <div className="border rounded-lg p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {selectedTool.canWritePublic ? (
                          <CheckCircle className="h-5 w-5 text-green-600" />
                        ) : (
                          <XCircle className="h-5 w-5 text-red-600" />
                        )}
                        <span className="font-medium">Can Write to Public Data</span>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleToggle('canWritePublic')}
                      >
                        Toggle
                      </Button>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {selectedTool.reasoning.writePublic}
                    </p>
                  </div>
                </div>
              </>
            )}
          </DialogContent>
        </Dialog>
      </PageWrapper>
    </>
  );
}
