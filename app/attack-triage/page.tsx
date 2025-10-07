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
import { RefreshCw, Shield, AlertTriangle, Info, ChevronRight, X, Loader2, CheckCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import type { AttackVector } from "@/lib/attack-vector-generator";
import { generateManualSteps } from "@/lib/attack-vector-generator";

const pageData = {
  name: "Attack Vectors",
  title: "Attack Vector Analysis",
  description: "Identified attack chains across your MCP endpoints",
};

export default function AttackVectorsPage() {
  const [displayedVectors, setDisplayedVectors] = useState<AttackVector[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedVector, setSelectedVector] = useState<AttackVector | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [analyzingVector, setAnalyzingVector] = useState(false);
  const [llmAnalysis, setLlmAnalysis] = useState<string>('');
  const [closingVector, setClosingVector] = useState(false);

  // Filters
  const [severityFilter, setSeverityFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [endpointFilter, setEndpointFilter] = useState<string>("all");

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalVectors, setTotalVectors] = useState(0);
  const [pageSize] = useState(50);

  // Load current page of vectors
  const loadVectors = async () => {
    try {
      setLoading(true);

      // Build query params
      const params = new URLSearchParams({
        page: currentPage.toString(),
        pageSize: pageSize.toString(),
      });

      if (severityFilter !== 'all') {
        params.append('severity', severityFilter);
      }
      if (statusFilter !== 'all') {
        params.append('status', statusFilter);
      }
      if (endpointFilter !== 'all') {
        params.append('endpoint', endpointFilter);
      }

      const response = await fetch(`/api/attack-vectors?${params.toString()}`);
      const data = await response.json();

      if (!data.success) {
        toast.error('Failed to load attack vectors');
        return;
      }

      setDisplayedVectors(data.vectors);
      setStats(data.stats);
      setTotalVectors(data.pagination.totalVectors);
      setTotalPages(data.pagination.totalPages);
    } catch (error) {
      console.error('Error loading attack vectors:', error);
      toast.error('Failed to load attack vectors');
    } finally {
      setLoading(false);
    }
  };

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [severityFilter, statusFilter, endpointFilter]);

  // Load vectors when page or filters change
  useEffect(() => {
    loadVectors();
  }, [currentPage, severityFilter, statusFilter, endpointFilter]);

  const paginatedVectors = displayedVectors;

  // Get LLM analysis for a vector
  const analyzeVector = async (vector: AttackVector) => {
    setAnalyzingVector(true);
    setLlmAnalysis('');

    try {
      // TODO: Create API endpoint for LLM analysis
      // For now, generate a detailed description
      const analysis = `
**Attack Vector Analysis**

This attack chain represents a ${vector.severity.toLowerCase()} severity threat on endpoint **${vector.endpointName}**.

**Attack Flow:**

${vector.attackPath.map(step => `${step}`).join('\n')}

**Components:**

1. **Entry Point (List A)**: \`${vector.listA.toolName}\` from ${vector.listA.serverName}
   - Capability: Reads from external/untrusted sources
   - Risk: Attacker-controlled input can be injected into the system
   - Description: ${vector.listA.description}

2. **Privilege Escalation (List B)**: \`${vector.listB.toolName}\` from ${vector.listB.serverName}
   - Capability: Accesses private/sensitive data
   - Risk: Malicious payload from List A can trigger unauthorized data access
   - Description: ${vector.listB.description}

3. **Data Exfiltration (List C)**: \`${vector.listC.toolName}\` from ${vector.listC.serverName}
   - Capability: Writes to public/external destinations
   - Risk: Sensitive data can be sent to attacker-controlled servers
   - Description: ${vector.listC.description}

**Impact:**

This attack chain allows an attacker to:
- Inject malicious payloads through ${vector.listA.toolName}
- Leverage those payloads to access sensitive data via ${vector.listB.toolName}
- Exfiltrate that data using ${vector.listC.toolName}

**Recommendation:**

Immediately review and restrict permissions for these three tools. Apply the principle of least privilege and implement additional monitoring.
      `.trim();

      setLlmAnalysis(analysis);
    } catch (error) {
      console.error('Error analyzing vector:', error);
      toast.error('Failed to analyze attack vector');
      setLlmAnalysis('Failed to generate analysis. Please try again.');
    } finally {
      setAnalyzingVector(false);
    }
  };

  // Close an attack vector
  const closeVector = async (vector: AttackVector) => {
    setClosingVector(true);

    try {
      const response = await fetch('/api/attack-vectors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vectorId: vector.id,
          action: 'close',
          closedBy: 'admin' // TODO: Get actual user
        })
      });

      const data = await response.json();

      if (data.success) {
        toast.success('Attack vector closed successfully');
        await loadVectors(); // Reload to update status
        setIsDialogOpen(false);
      } else {
        toast.error('Failed to close attack vector');
      }
    } catch (error) {
      console.error('Error closing vector:', error);
      toast.error('Failed to close attack vector');
    } finally {
      setClosingVector(false);
    }
  };

  // Reopen an attack vector
  const reopenVector = async (vector: AttackVector) => {
    try {
      const response = await fetch('/api/attack-vectors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vectorId: vector.id,
          action: 'reopen'
        })
      });

      const data = await response.json();

      if (data.success) {
        toast.success('Attack vector reopened');
        await loadVectors();
        setIsDialogOpen(false);
      } else {
        toast.error('Failed to reopen attack vector');
      }
    } catch (error) {
      console.error('Error reopening vector:', error);
      toast.error('Failed to reopen attack vector');
    }
  };

  const handleVectorClick = (vector: AttackVector) => {
    setSelectedVector(vector);
    setIsDialogOpen(true);
    setLlmAnalysis(''); // Clear previous analysis
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'Critical': return 'bg-red-100 text-red-800 border-red-300';
      case 'High': return 'bg-orange-100 text-orange-800 border-orange-300';
      case 'Medium': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'Low': return 'bg-blue-100 text-blue-800 border-blue-300';
      default: return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const resetFilters = () => {
    setSeverityFilter("all");
    setStatusFilter("all");
    setEndpointFilter("all");
  };

  if (loading) {
    return (
      <>
        <Breadcrumbs pageName={pageData?.name} />
        <PageWrapper>
          <Header title={pageData?.title}>{pageData?.description}</Header>
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        </PageWrapper>
      </>
    );
  }

  // Get unique endpoints for filter from stats
  const uniqueEndpoints = stats?.byEndpoint ? Object.keys(stats.byEndpoint) : [];

  return (
    <>
      <Breadcrumbs pageName={pageData?.name} />
      <PageWrapper>
        <div className="flex items-center justify-between mb-4">
          <Header title={pageData?.title}>{pageData?.description}</Header>
          <Button onClick={loadVectors} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>

        <div className="space-y-6">
          {/* Statistics */}
          {stats && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-4">
                  <div className="text-2xl font-bold">{stats.total}</div>
                  <div className="text-sm text-muted-foreground">Total Attack Vectors</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="text-2xl font-bold text-red-600">{stats.bySeverity.critical + stats.bySeverity.high}</div>
                  <div className="text-sm text-muted-foreground">Critical/High Severity</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="text-2xl font-bold text-orange-600">{stats.byStatus.open}</div>
                  <div className="text-sm text-muted-foreground">Open Vectors</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="text-2xl font-bold text-green-600">{stats.byStatus.closed}</div>
                  <div className="text-sm text-muted-foreground">Closed Vectors</div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Filters */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Filter Attack Vectors</CardTitle>
              <CardDescription>
                Showing {displayedVectors.length} of {totalVectors} attack vectors (page {currentPage} of {totalPages})
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Severity</label>
                  <Select value={severityFilter} onValueChange={setSeverityFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="All" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      <SelectItem value="critical">Critical</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="low">Low</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Status</label>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="All" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      <SelectItem value="open">Open</SelectItem>
                      <SelectItem value="closed">Closed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Endpoint</label>
                  <Select value={endpointFilter} onValueChange={setEndpointFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="All" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      {uniqueEndpoints.map(endpoint => (
                        <SelectItem key={endpoint} value={endpoint}>
                          {endpoint}
                        </SelectItem>
                      ))}
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

          {/* Pagination Info */}
          {totalVectors > 0 && (
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-muted-foreground">
                    Showing {((currentPage - 1) * pageSize) + 1} - {Math.min(currentPage * pageSize, totalVectors)} of {totalVectors} vectors
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                      disabled={currentPage === 1}
                    >
                      Previous
                    </Button>
                    <div className="text-sm">
                      Page {currentPage} of {totalPages}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                      disabled={currentPage === totalPages}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Attack Vectors List */}
          <div className="space-y-4">
            {displayedVectors.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Shield className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">
                    {totalVectors === 0
                      ? "No attack vectors detected. Run Analysis first to generate attack vectors."
                      : "No attack vectors match the selected filters."}
                  </p>
                  {totalVectors > 0 && (
                    <Button variant="outline" size="sm" className="mt-4" onClick={resetFilters}>
                      Reset Filters
                    </Button>
                  )}
                </CardContent>
              </Card>
            ) : (
              paginatedVectors.map(vector => (
                <Card
                  key={vector.id}
                  className="cursor-pointer hover:border-primary transition-all"
                  onClick={() => handleVectorClick(vector)}
                >
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <AlertTriangle className={`h-5 w-5 ${
                          vector.severity === 'Critical' || vector.severity === 'High'
                            ? 'text-red-600'
                            : 'text-orange-600'
                        }`} />
                        <div>
                          <CardTitle className="text-base">
                            Attack Chain on {vector.endpointName}
                          </CardTitle>
                          <CardDescription className="text-xs mt-1">
                            {vector.description}
                          </CardDescription>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className={getSeverityColor(vector.severity)}>
                          {vector.severity}
                        </Badge>
                        {vector.status === 'closed' ? (
                          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300">
                            Closed
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-300">
                            Open
                          </Badge>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-2 text-sm">
                      <Badge variant="outline" className="bg-blue-50 border-blue-200">
                        A: {vector.listA.toolName}
                      </Badge>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      <Badge variant="outline" className="bg-orange-50 border-orange-200">
                        B: {vector.listB.toolName}
                      </Badge>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      <Badge variant="outline" className="bg-red-50 border-red-200">
                        C: {vector.listC.toolName}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </div>

        {/* Attack Vector Detail Dialog */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            {selectedVector && (
              <>
                <DialogHeader>
                  <div className="flex items-center justify-between">
                    <DialogTitle className="flex items-center gap-2">
                      <Shield className="h-5 w-5" />
                      Attack Vector Details
                    </DialogTitle>
                    <Badge className={getSeverityColor(selectedVector.severity)}>
                      {selectedVector.severity}
                    </Badge>
                  </div>
                  <DialogDescription>
                    Endpoint: {selectedVector.endpointName}
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-6 mt-4">
                  {/* Attack Path */}
                  <div>
                    <h3 className="font-semibold mb-3">Attack Chain</h3>
                    <div className="flex items-center gap-2 mb-4">
                      <Card className="flex-1 bg-blue-50 border-blue-200">
                        <CardContent className="p-3">
                          <div className="text-xs text-blue-600 font-medium mb-1">List A: External Source</div>
                          <div className="font-mono text-sm">{selectedVector.listA.toolName}</div>
                          <div className="text-xs text-muted-foreground mt-1">{selectedVector.listA.serverName}</div>
                        </CardContent>
                      </Card>
                      <ChevronRight className="h-5 w-5 text-muted-foreground" />
                      <Card className="flex-1 bg-orange-50 border-orange-200">
                        <CardContent className="p-3">
                          <div className="text-xs text-orange-600 font-medium mb-1">List B: Private Data</div>
                          <div className="font-mono text-sm">{selectedVector.listB.toolName}</div>
                          <div className="text-xs text-muted-foreground mt-1">{selectedVector.listB.serverName}</div>
                        </CardContent>
                      </Card>
                      <ChevronRight className="h-5 w-5 text-muted-foreground" />
                      <Card className="flex-1 bg-red-50 border-red-200">
                        <CardContent className="p-3">
                          <div className="text-xs text-red-600 font-medium mb-1">List C: Exfiltration</div>
                          <div className="font-mono text-sm">{selectedVector.listC.toolName}</div>
                          <div className="text-xs text-muted-foreground mt-1">{selectedVector.listC.serverName}</div>
                        </CardContent>
                      </Card>
                    </div>
                  </div>

                  {/* LLM Analysis */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-semibold">Detailed Analysis</h3>
                      <Button
                        onClick={() => analyzeVector(selectedVector)}
                        disabled={analyzingVector}
                        size="sm"
                        variant="outline"
                      >
                        {analyzingVector ? (
                          <>
                            <Loader2 className="h-3 w-3 mr-2 animate-spin" />
                            Analyzing...
                          </>
                        ) : (
                          <>
                            <Info className="h-3 w-3 mr-2" />
                            Generate Analysis
                          </>
                        )}
                      </Button>
                    </div>

                    {llmAnalysis ? (
                      <Card className="bg-muted/50">
                        <CardContent className="p-4">
                          <pre className="text-sm whitespace-pre-wrap font-sans">{llmAnalysis}</pre>
                        </CardContent>
                      </Card>
                    ) : (
                      <Card className="bg-muted/50">
                        <CardContent className="p-4 text-sm text-muted-foreground text-center">
                          Click "Generate Analysis" to get detailed security analysis from LLM
                        </CardContent>
                      </Card>
                    )}
                  </div>

                  {/* Manual Steps */}
                  <div>
                    <h3 className="font-semibold mb-3">Manual Steps to Close This Attack Vector</h3>
                    <Card>
                      <CardContent className="p-4">
                        <pre className="text-sm whitespace-pre-wrap font-sans text-muted-foreground">
                          {generateManualSteps(selectedVector).join('\n')}
                        </pre>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-3 pt-4 border-t">
                    {selectedVector.status === 'open' ? (
                      <Button
                        onClick={() => closeVector(selectedVector)}
                        disabled={closingVector}
                        className="flex items-center gap-2"
                        variant="default"
                      >
                        {closingVector ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Closing...
                          </>
                        ) : (
                          <>
                            <CheckCircle className="h-4 w-4" />
                            Close Attack Vector (Currently Disabled)
                          </>
                        )}
                      </Button>
                    ) : (
                      <div className="flex items-center gap-3">
                        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300">
                          Closed on {selectedVector.closedAt ? new Date(selectedVector.closedAt).toLocaleDateString() : 'Unknown'}
                        </Badge>
                        <Button
                          onClick={() => reopenVector(selectedVector)}
                          variant="outline"
                          size="sm"
                        >
                          Reopen Vector
                        </Button>
                      </div>
                    )}
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
