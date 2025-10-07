"use client";

import { useState, useEffect } from "react";
import { Breadcrumbs } from "@/components/parts/breadcrumbs";
import { Header } from "@/components/parts/header";
import { PageWrapper } from "@/components/parts/page-wrapper";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Zap, Shield, AlertTriangle, Info, CheckCircle, XCircle, Play, Loader2, Github, Layers, Database } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { AttackTreeVisualization } from "@/components/AttackTreeVisualization";
import { AttackFlowDiagram } from "@/components/AttackFlowDiagram";
import { generateAttackVectors, getAttackStatistics, type AttackVector } from '@/utils/attackVectorGenerator';

// Import discovered function data
import githubData from '@/data/discovered/github_tools.json';
import filesystemData from '@/data/discovered/filesystem_tools.json';

const pageData = {
  name: "Detections",
  title: "Attack Detection Generation",
  description: "Select functions to generate targeted attack prompts using TAP methodology",
};

interface FunctionData {
  name: string;
  displayName: string;
  description: string;
  server: string;
  arguments: any;
  classifications: {
    listA: any;
    listB: any;
    listC: any;
  };
}

interface FunctionSelection {
  listA: FunctionData | null;
  listB: FunctionData | null;
  listC: FunctionData | null;
}

interface AttackResult {
  id: string;
  function_name: string;
  attack_prompt: string;
  expected_behavior: string;
  risk_level: string;
  timestamp: string;
  selectedFunctions: {
    listA: FunctionData;
    listB: FunctionData;
    listC: FunctionData;
  };
}

export default function GenerateAttacksPage() {
  const [listAFunctions, setListAFunctions] = useState<FunctionData[]>([]);
  const [listBFunctions, setListBFunctions] = useState<FunctionData[]>([]);
  const [listCFunctions, setListCFunctions] = useState<FunctionData[]>([]);
  const [selectedFunctions, setSelectedFunctions] = useState<FunctionSelection>({
    listA: null,
    listB: null,
    listC: null
  });
  const [attackResults, setAttackResults] = useState<AttackResult[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedFunction, setSelectedFunction] = useState<FunctionData | null>(null);
  
  // Dynamic attack vectors based on user permissions
  const [dynamicAttackVectors, setDynamicAttackVectors] = useState<AttackVector[]>([]);
  const [attackStatistics, setAttackStatistics] = useState<any>(null);

  // Load function data on component mount
  useEffect(() => {
    const allFunctions: FunctionData[] = [];

    // Process GitHub functions
    const githubFunctions = (githubData as any)['github'] || {};
    Object.entries(githubFunctions).forEach(([funcName, funcData]: [string, any]) => {
      allFunctions.push({
        name: funcName,
        displayName: funcData.name || funcName,
        description: funcData.description || 'No description available',
        server: 'github',
        arguments: funcData.arguments || {},
        classifications: {
          listA: funcData.listA || { belongs: false, reasoning: '' },
          listB: funcData.listB || { belongs: false, reasoning: '' },
          listC: funcData.listC || { belongs: false, reasoning: '' }
        }
      });
    });

    // Process Filesystem functions
    const filesystemFunctions = (filesystemData as any)['filesystem'] || {};
    Object.entries(filesystemFunctions).forEach(([funcName, funcData]: [string, any]) => {
      allFunctions.push({
        name: funcName,
        displayName: funcData.name || funcName,
        description: funcData.description || 'No description available',
        server: 'filesystem',
        arguments: funcData.arguments || {},
        classifications: {
          listA: funcData.listA || { belongs: false, reasoning: '' },
          listB: funcData.listB || { belongs: false, reasoning: '' },
          listC: funcData.listC || { belongs: false, reasoning: '' }
        }
      });
    });

    // Categorize functions by their classifications
    const listAFuncs = allFunctions.filter(func => func.classifications.listA.belongs);
    const listBFuncs = allFunctions.filter(func => func.classifications.listB.belongs);
    const listCFuncs = allFunctions.filter(func => func.classifications.listC.belongs);

    setListAFunctions(listAFuncs);
    setListBFunctions(listBFuncs);
    setListCFunctions(listCFuncs);

    // Pre-select specific functions
    const preSelectedA = listAFuncs.find(func => func.name === 'get_issue');
    const preSelectedB = listBFuncs.find(func => func.name === 'getJiraIssue');
    const preSelectedC = listCFuncs.find(func => func.name === 'create_issue');

    if (preSelectedA || preSelectedB || preSelectedC) {
      setSelectedFunctions({
        listA: preSelectedA || null,
        listB: preSelectedB || null,
        listC: preSelectedC || null
      });

      // Scroll to pre-selected functions after a short delay to ensure DOM is ready
      setTimeout(() => {
        if (preSelectedA) {
          const elementA = document.querySelector(`[data-function-id="listA_${preSelectedA.server}_${preSelectedA.name}"]`);
          if (elementA) {
            elementA.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }
        if (preSelectedB) {
          const elementB = document.querySelector(`[data-function-id="listB_${preSelectedB.server}_${preSelectedB.name}"]`);
          if (elementB) {
            elementB.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }
        if (preSelectedC) {
          const elementC = document.querySelector(`[data-function-id="listC_${preSelectedC.server}_${preSelectedC.name}"]`);
          if (elementC) {
            elementC.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }
      }, 100);
    }

    // Load dynamic attack vectors
    try {
      const vectors = generateAttackVectors();
      const stats = getAttackStatistics();
      setDynamicAttackVectors(vectors);
      setAttackStatistics(stats);
    } catch (error) {
      console.error('Error generating attack vectors:', error);
    }
  }, []);

  const selectFunction = (func: FunctionData, listType: 'listA' | 'listB' | 'listC') => {
    setSelectedFunctions(prev => ({
      ...prev,
      [listType]: prev[listType]?.name === func.name && prev[listType]?.server === func.server ? null : func
    }));
  };

  const generateAttacks = async () => {
    const { listA, listB, listC } = selectedFunctions;
    
    if (!listA || !listB || !listC) {
      toast.error("Please select one function from each list (A, B, and C) to generate an attack vector");
      return;
    }

    setIsGenerating(true);
    
    try {
      // Call the actual TAP API
      const response = await fetch('/api/generate-attacks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          listA: { server: listA.server, name: listA.name },
          listB: { server: listB.server, name: listB.name },
          listC: { server: listC.server, name: listC.name },
          tapParams: {
            branchingFactor: 2,
            depth: 4,
            width: 4
          }
        })
      });

      const result = await response.json();
      
      if (result.success) {
        toast.success(result.message || "TAP analysis started successfully");
        
        // Create attack result entry for display
        const attackId = `attack_${listA.name}_${listB.name}_${listC.name}_${Date.now()}`;
        const attackCombination = result.attackVector || `${listA.name} → ${listB.name} → ${listC.name}`;
        
        const newAttackResult: AttackResult = {
          id: attackId,
          function_name: attackCombination,
          attack_prompt: `TAP analysis initiated for attack vector: ${attackCombination}. The system will generate targeted prompts that chain ${listA.name} (${listA.server}) to read from external sources, ${listB.name} (${listB.server}) to access private data, and ${listC.name} (${listC.server}) to exfiltrate data to external sinks.`,
          expected_behavior: `This attack vector combines: 1) ${listA.name} for reading controlled external data, 2) ${listB.name} for accessing sensitive private information, 3) ${listC.name} for sending data to external destinations. The TAP system will generate progressively sophisticated attack prompts.`,
          risk_level: 'HIGH',
          timestamp: new Date().toISOString(),
          selectedFunctions: {
            listA: listA,
            listB: listB,
            listC: listC
          }
        };

        setAttackResults(prev => [newAttackResult, ...prev]);
        
        // Clear selections
        setSelectedFunctions({
          listA: null,
          listB: null,
          listC: null
        });
        
        // Show success message with additional info
        if (result.output) {
          console.log("TAP output:", result.output);
        }
        
      } else {
        toast.error(result.error || "Failed to start TAP analysis");
        console.error("TAP API error:", result);
      }
      
    } catch (error) {
      console.error("Error calling TAP API:", error);
      toast.error("Failed to generate attacks. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  };

  const getRiskColor = (riskLevel: string) => {
    switch (riskLevel) {
      case 'HIGH': return 'destructive';
      case 'MEDIUM': return 'default';
      case 'LOW': return 'secondary';
      default: return 'outline';
    }
  };

  const getServerIcon = (server: string) => {
    switch (server) {
      case 'github-remote': return <Github className="h-4 w-4" />;
      case 'jira-tools': return <Layers className="h-4 w-4" />;
      case 'asana-tools': return <Database className="h-4 w-4" />;
      default: return <Database className="h-4 w-4" />;
    }
  };

  return (
    <>
      <Breadcrumbs pageName={pageData?.name} />
      <PageWrapper>
        <Header title={pageData?.title}>{pageData?.description}</Header>
        
        <div className="space-y-6">
          {/* Generation Controls */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Zap className="mr-2 h-5 w-5" />
                Attack Vector Generation
              </CardTitle>
              <CardDescription>
                Select one function from each list to create a complete attack vector chain: External Sources → Private Data → External Sinks
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="text-sm text-muted-foreground">
                    Selected: 
                    <span className="font-semibold ml-1">
                      {selectedFunctions.listA ? '1' : '0'} from List A, 
                      {selectedFunctions.listB ? ' 1' : ' 0'} from List B, 
                      {selectedFunctions.listC ? ' 1' : ' 0'} from List C
                    </span>
                  </div>
                  {(selectedFunctions.listA || selectedFunctions.listB || selectedFunctions.listC) && (
                    <div className="flex flex-wrap gap-1">
                      {selectedFunctions.listA && (
                        <Badge variant="outline" className="text-xs text-blue-600 border-blue-300">
                          A: {selectedFunctions.listA.name}
                        </Badge>
                      )}
                      {selectedFunctions.listB && (
                        <Badge variant="outline" className="text-xs text-orange-600 border-orange-300">
                          B: {selectedFunctions.listB.name}
                        </Badge>
                      )}
                      {selectedFunctions.listC && (
                        <Badge variant="outline" className="text-xs text-green-600 border-green-300">
                          C: {selectedFunctions.listC.name}
                        </Badge>
                      )}
                    </div>
                  )}
                </div>
                <Button 
                  onClick={generateAttacks}
                  disabled={!selectedFunctions.listA || !selectedFunctions.listB || !selectedFunctions.listC || isGenerating}
                  className="flex items-center"
                >
                  {isGenerating ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Play className="mr-2 h-4 w-4" />
                  )}
                  {isGenerating ? 'Generating...' : 'Generate Attack Vector'}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Three-Column Function Selection */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* List A Functions */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center text-blue-600">
                  <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center text-white font-bold text-sm mr-2">
                    A
                  </div>
                  List A: External Data Sources
                </CardTitle>
                <CardDescription className="text-xs">
                  Functions that read data from external sources controlled by external parties ({listAFunctions.length} functions)
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <div className="max-h-80 overflow-y-auto">
                  {listAFunctions.map((func) => (
                    <div
                      key={`listA_${func.server}_${func.name}`}
                      data-function-id={`listA_${func.server}_${func.name}`}
                      className={`p-3 border-b cursor-pointer transition-colors ${
                        selectedFunctions.listA?.name === func.name && selectedFunctions.listA?.server === func.server
                          ? 'bg-blue-50 border-blue-200' 
                          : 'hover:bg-accent/50'
                      }`}
                      onClick={() => selectFunction(func, 'listA')}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2">
                            {getServerIcon(func.server)}
                            <span className="font-medium text-sm">{func.name}</span>
                            {selectedFunctions.listA?.name === func.name && selectedFunctions.listA?.server === func.server && (
                              <CheckCircle className="h-4 w-4 text-blue-600" />
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{func.description}</p>
                          <Badge variant="outline" className="text-xs mt-1">{func.server}</Badge>
                        </div>
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedFunction(func);
                              }}
                            >
                              <Info className="h-3 w-3" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                            <DialogHeader>
                              <DialogTitle>{func.displayName}</DialogTitle>
                              <DialogDescription>{func.description}</DialogDescription>
                            </DialogHeader>
                            {selectedFunction && (
                              <div className="space-y-4">
                                <div className="p-3 border rounded">
                                  <div className="flex items-center">
                                    <CheckCircle className="h-4 w-4 text-green-600 mr-2" />
                                    <span className="font-medium">List A: External Data Sources</span>
                                  </div>
                                  <p className="text-sm text-muted-foreground mt-1">
                                    {selectedFunction.classifications.listA.reasoning || 'No reasoning provided'}
                                  </p>
                                </div>
                                
                                {Object.keys(selectedFunction.arguments).length > 0 && (
                                  <div>
                                    <h4 className="font-semibold mb-2">Function Arguments</h4>
                                    <div className="space-y-2">
                                      {Object.entries(selectedFunction.arguments).map(([argName, argData]: [string, any]) => (
                                        <div key={argName} className="p-2 border rounded">
                                          <div className="flex items-center justify-between">
                                            <span className="font-medium text-sm">{argName}</span>
                                            <Badge variant="outline" className="text-xs">{argData.type}</Badge>
                                          </div>
                                          <p className="text-xs text-muted-foreground">{argData.description}</p>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                          </DialogContent>
                        </Dialog>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* List B Functions */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center text-orange-600">
                  <div className="w-6 h-6 bg-orange-500 rounded-full flex items-center justify-center text-white font-bold text-sm mr-2">
                    B
                  </div>
                  List B: Private Data Access
                </CardTitle>
                <CardDescription className="text-xs">
                  Functions that access private or sensitive data ({listBFunctions.length} functions)
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <div className="max-h-80 overflow-y-auto">
                  {listBFunctions.map((func) => (
                    <div
                      key={`listB_${func.server}_${func.name}`}
                      data-function-id={`listB_${func.server}_${func.name}`}
                      className={`p-3 border-b cursor-pointer transition-colors ${
                        selectedFunctions.listB?.name === func.name && selectedFunctions.listB?.server === func.server
                          ? 'bg-orange-50 border-orange-200' 
                          : 'hover:bg-accent/50'
                      }`}
                      onClick={() => selectFunction(func, 'listB')}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2">
                            {getServerIcon(func.server)}
                            <span className="font-medium text-sm">{func.name}</span>
                            {selectedFunctions.listB?.name === func.name && selectedFunctions.listB?.server === func.server && (
                              <CheckCircle className="h-4 w-4 text-orange-600" />
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{func.description}</p>
                          <Badge variant="outline" className="text-xs mt-1">{func.server}</Badge>
                        </div>
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedFunction(func);
                              }}
                            >
                              <Info className="h-3 w-3" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                            <DialogHeader>
                              <DialogTitle>{func.displayName}</DialogTitle>
                              <DialogDescription>{func.description}</DialogDescription>
                            </DialogHeader>
                            {selectedFunction && (
                              <div className="space-y-4">
                                <div className="p-3 border rounded">
                                  <div className="flex items-center">
                                    <CheckCircle className="h-4 w-4 text-green-600 mr-2" />
                                    <span className="font-medium">List B: Private Data Access</span>
                                  </div>
                                  <p className="text-sm text-muted-foreground mt-1">
                                    {selectedFunction.classifications.listB.reasoning || 'No reasoning provided'}
                                  </p>
                                </div>
                                
                                {Object.keys(selectedFunction.arguments).length > 0 && (
                                  <div>
                                    <h4 className="font-semibold mb-2">Function Arguments</h4>
                                    <div className="space-y-2">
                                      {Object.entries(selectedFunction.arguments).map(([argName, argData]: [string, any]) => (
                                        <div key={argName} className="p-2 border rounded">
                                          <div className="flex items-center justify-between">
                                            <span className="font-medium text-sm">{argName}</span>
                                            <Badge variant="outline" className="text-xs">{argData.type}</Badge>
                                          </div>
                                          <p className="text-xs text-muted-foreground">{argData.description}</p>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                          </DialogContent>
                        </Dialog>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* List C Functions */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center text-green-600">
                  <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center text-white font-bold text-sm mr-2">
                    C
                  </div>
                  List C: External Data Sinks
                </CardTitle>
                <CardDescription className="text-xs">
                  Functions that send data to external sinks ({listCFunctions.length} functions)
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <div className="max-h-80 overflow-y-auto">
                  {listCFunctions.map((func) => (
                    <div
                      key={`listC_${func.server}_${func.name}`}
                      data-function-id={`listC_${func.server}_${func.name}`}
                      className={`p-3 border-b cursor-pointer transition-colors ${
                        selectedFunctions.listC?.name === func.name && selectedFunctions.listC?.server === func.server
                          ? 'bg-green-50 border-green-200' 
                          : 'hover:bg-accent/50'
                      }`}
                      onClick={() => selectFunction(func, 'listC')}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2">
                            {getServerIcon(func.server)}
                            <span className="font-medium text-sm">{func.name}</span>
                            {selectedFunctions.listC?.name === func.name && selectedFunctions.listC?.server === func.server && (
                              <CheckCircle className="h-4 w-4 text-green-600" />
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{func.description}</p>
                          <Badge variant="outline" className="text-xs mt-1">{func.server}</Badge>
                        </div>
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedFunction(func);
                              }}
                            >
                              <Info className="h-3 w-3" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                            <DialogHeader>
                              <DialogTitle>{func.displayName}</DialogTitle>
                              <DialogDescription>{func.description}</DialogDescription>
                            </DialogHeader>
                            {selectedFunction && (
                              <div className="space-y-4">
                                <div className="p-3 border rounded">
                                  <div className="flex items-center">
                                    <CheckCircle className="h-4 w-4 text-green-600 mr-2" />
                                    <span className="font-medium">List C: External Data Sinks</span>
                                  </div>
                                  <p className="text-sm text-muted-foreground mt-1">
                                    {selectedFunction.classifications.listC.reasoning || 'No reasoning provided'}
                                  </p>
                                </div>
                                
                                {Object.keys(selectedFunction.arguments).length > 0 && (
                                  <div>
                                    <h4 className="font-semibold mb-2">Function Arguments</h4>
                                    <div className="space-y-2">
                                      {Object.entries(selectedFunction.arguments).map(([argName, argData]: [string, any]) => (
                                        <div key={argName} className="p-2 border rounded">
                                          <div className="flex items-center justify-between">
                                            <span className="font-medium text-sm">{argName}</span>
                                            <Badge variant="outline" className="text-xs">{argData.type}</Badge>
                                          </div>
                                          <p className="text-xs text-muted-foreground">{argData.description}</p>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                          </DialogContent>
                        </Dialog>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Attack Tree Visualization */}
          <AttackTreeVisualization />

          {/* Generated Attacks */}
          {attackResults.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Shield className="mr-2 h-5 w-5" />
                  Generated Attack Prompts
                  <Badge variant="outline" className="ml-2">
                    {attackResults.length} generated
                  </Badge>
                </CardTitle>
                <CardDescription>
                  Copy these prompts to test against your Agentic Tool functions
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {attackResults.map((attack) => (
                  <div key={attack.id} className="space-y-4">
                    <Card className="border-l-4 border-l-destructive">
                      <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-base">{attack.function_name}</CardTitle>
                          <div className="flex items-center space-x-2">
                            <Badge variant={getRiskColor(attack.risk_level)}>
                              {attack.risk_level} RISK
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {new Date(attack.timestamp).toLocaleTimeString()}
                            </span>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div>
                          <h5 className="font-medium text-sm mb-1">Attack Prompt:</h5>
                          <Textarea
                            value={attack.attack_prompt}
                            readOnly
                            className="text-sm resize-none"
                            rows={3}
                          />
                        </div>
                        <div>
                          <h5 className="font-medium text-sm mb-1">Expected Behavior:</h5>
                          <p className="text-sm text-muted-foreground">{attack.expected_behavior}</p>
                        </div>
                        <div>
                          <h5 className="font-medium text-sm mb-1">Mitigation Strategies:</h5>
                          <div className="space-y-1 text-sm text-muted-foreground">
                            <p>• Implement strict input validation for {attack.selectedFunctions.listA.name} to prevent malicious external data injection</p>
                            <p>• Apply least-privilege access controls to {attack.selectedFunctions.listB.name} with multi-factor authentication requirements</p>
                            <p>• Deploy data loss prevention (DLP) monitoring on {attack.selectedFunctions.listC.name} to detect unauthorized data exfiltration</p>
                          </div>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            navigator.clipboard.writeText(attack.attack_prompt);
                            toast.success("Attack prompt copied to clipboard");
                          }}
                        >
                          Copy Prompt
                        </Button>
                      </CardContent>
                    </Card>

                    {/* Attack Flow Diagram */}
                    <AttackFlowDiagram
                      userPrompt={attack.attack_prompt}
                      listA={attack.selectedFunctions.listA}
                      listB={attack.selectedFunctions.listB}
                      listC={attack.selectedFunctions.listC}
                      attackVector={attack.function_name}
                    />
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Information Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Info className="mr-2 h-5 w-5" />
                About Attack Generation
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-3">
                This attack generation system uses the Tree of Attacks with Pruning (TAP) methodology to create targeted 
                prompts that test the security boundaries of Agentic Tool functions.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div className="p-3 bg-blue-50 rounded border border-blue-200">
                  <h4 className="font-medium text-blue-800 mb-1">List A Functions</h4>
                  <p className="text-blue-700">
                    Functions that read from external data sources. High risk for data injection attacks.
                  </p>
                </div>
                <div className="p-3 bg-orange-50 rounded border border-orange-200">
                  <h4 className="font-medium text-orange-800 mb-1">List B Functions</h4>
                  <p className="text-orange-700">
                    Functions accessing private data. High risk for privilege escalation and unauthorized access.
                  </p>
                </div>
                <div className="p-3 bg-green-50 rounded border border-green-200">
                  <h4 className="font-medium text-green-800 mb-1">List C Functions</h4>
                  <p className="text-green-700">
                    Functions that output to external sinks. High risk for data exfiltration attacks.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </PageWrapper>
    </>
  );
}