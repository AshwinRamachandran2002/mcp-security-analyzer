"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, User, Database, Upload, Download, Shield, AlertTriangle, Github, Layers } from "lucide-react";

interface FunctionData {
  name: string;
  server: string;
  source?: string[];
  sink?: string[];
}

interface AttackFlowProps {
  userPrompt: string;
  listA: FunctionData;
  listB: FunctionData;
  listC: FunctionData;
  attackVector: string;
}

export function AttackFlowDiagram({ userPrompt, listA, listB, listC, attackVector }: AttackFlowProps) {
  const getServerIcon = (server: string) => {
    switch (server) {
      case 'github-remote': return <Github className="h-5 w-5" />;
      case 'jira-tools': return <Layers className="h-5 w-5" />;
      default: return <Database className="h-5 w-5" />;
    }
  };

  const getServerColor = (server: string) => {
    switch (server) {
      case 'github-remote': return 'border-blue-300 bg-blue-50';
      case 'jira-tools': return 'border-orange-300 bg-orange-50';
      default: return 'border-gray-300 bg-gray-50';
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center">
          <Shield className="mr-2 h-5 w-5" />
          Attack Vector Flow
        </CardTitle>
        <CardDescription>
          Visual representation of the attack chain: {attackVector}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          
          {/* Sources Row - 4 column grid */}
          <div className="grid grid-cols-4 gap-6 justify-items-center">
            {/* Column 1: Empty for User Prompt */}
            <div></div>
            
            {/* Column 2: List A Sources */}
            <div className="flex flex-col items-center space-y-2">
              {listA.source && listA.source.length > 0 && (
                <>
                  <div className="text-xs font-medium text-gray-600">SOURCES</div>
                  <div className="flex flex-wrap justify-center gap-1">
                    {listA.source.map((source, index) => (
                      <Card key={index} className="border-green-300 bg-green-50">
                        <CardContent className="p-1 text-center min-w-[60px]">
                          <Download className="h-3 w-3 text-green-600 mx-auto mb-1" />
                          <div className="text-xs font-medium text-green-800 capitalize">
                            {source.replace('_', ' ')}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Column 3: List B Sources */}
            <div className="flex flex-col items-center space-y-2">
              {listB.source && listB.source.length > 0 && (
                <>
                  <div className="text-xs font-medium text-gray-600">SOURCES</div>
                  <div className="flex flex-wrap justify-center gap-1">
                    {listB.source.map((source, index) => (
                      <Card key={index} className="border-orange-300 bg-orange-50">
                        <CardContent className="p-1 text-center min-w-[60px]">
                          <Shield className="h-3 w-3 text-orange-600 mx-auto mb-1" />
                          <div className="text-xs font-medium text-orange-800 capitalize">
                            {source.replace('_', ' ')}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Column 4: Empty for List C */}
            <div></div>
          </div>

          {/* Arrows pointing down - 4 column grid */}
          <div className="grid grid-cols-4 gap-6 justify-items-center">
            <div></div>
            <div className="flex justify-center">
              {listA.source && listA.source.length > 0 && (
                <ArrowRight className="h-5 w-5 text-green-600 transform rotate-90" />
              )}
            </div>
            <div className="flex justify-center">
              {listB.source && listB.source.length > 0 && (
                <ArrowRight className="h-5 w-5 text-orange-600 transform rotate-90" />
              )}
            </div>
            <div></div>
          </div>

          {/* Main Function Row - 7 column grid with custom sizing */}
          <div className="grid gap-3 justify-items-center items-center" style={{gridTemplateColumns: '1fr auto 1fr auto 1fr auto 1fr'}}>
            
            {/* Column 1: User Prompt */}
            <Card className="bg-gray-50 border-gray-300 border-2 w-full max-w-[200px]">
              <CardContent className="p-4 text-center">
                <div className="flex items-center justify-center space-x-1 mb-2">
                  <User className="h-5 w-5 text-gray-600" />
                </div>
                <div className="font-semibold text-sm text-gray-800">User Prompt</div>
                <div className="text-xs text-gray-600 mt-1">Input</div>
              </CardContent>
            </Card>

            {/* Column 2: Arrow */}
            <ArrowRight className="h-6 w-6 text-gray-400" />

            {/* Column 3: List A Function */}
            <Card className={`${getServerColor(listA.server)} border-2 w-full max-w-[200px]`}>
              <CardContent className="p-4 text-center">
                <div className="flex items-center justify-center space-x-1 mb-2">
                  {getServerIcon(listA.server)}
                  <Badge variant="outline" className="text-xs">A</Badge>
                </div>
                <div className="font-semibold text-sm text-blue-800">{listA.name}</div>
                <div className="text-xs text-blue-600 mt-1">{listA.server}</div>
              </CardContent>
            </Card>

            {/* Column 4: Arrow */}
            <ArrowRight className="h-6 w-6 text-gray-400" />

            {/* Column 5: List B Function */}
            <Card className={`${getServerColor(listB.server)} border-2 w-full max-w-[200px]`}>
              <CardContent className="p-4 text-center">
                <div className="flex items-center justify-center space-x-1 mb-2">
                  {getServerIcon(listB.server)}
                  <Badge variant="outline" className="text-xs">B</Badge>
                </div>
                <div className="font-semibold text-sm text-orange-800">{listB.name}</div>
                <div className="text-xs text-orange-600 mt-1">{listB.server}</div>
              </CardContent>
            </Card>

            {/* Column 6: Arrow */}
            <ArrowRight className="h-6 w-6 text-gray-400" />

            {/* Column 7: List C Function */}
            <Card className={`${getServerColor(listC.server)} border-2 w-full max-w-[200px]`}>
              <CardContent className="p-4 text-center">
                <div className="flex items-center justify-center space-x-1 mb-2">
                  {getServerIcon(listC.server)}
                  <Badge variant="outline" className="text-xs">C</Badge>
                </div>
                <div className="font-semibold text-sm text-green-800">{listC.name}</div>
                <div className="text-xs text-green-600 mt-1">{listC.server}</div>
              </CardContent>
            </Card>

          </div>


          {/* Arrows pointing down - 4 column grid */}
          <div className="grid grid-cols-4 gap-6 justify-items-center">
            <div></div>
            <div></div>
            <div></div>
            <div className="flex justify-center">
              {listC.sink && listC.sink.length > 0 && (
                <ArrowRight className="h-5 w-5 text-red-600 transform rotate-90" />
              )}
            </div>
          </div>

          {/* Sinks Row - 4 column grid */}
          <div className="grid grid-cols-4 gap-6 justify-items-center">
            {/* Column 1: Empty */}
            <div></div>
            
            {/* Column 2: Empty */}
            <div></div>

            {/* Column 3: Empty */}
            <div></div>

            {/* Column 4: List C Sinks */}
            <div className="flex flex-col items-center space-y-2">
              {listC.sink && listC.sink.length > 0 && (
                <>
                  <div className="text-xs font-medium text-gray-600">SINKS</div>
                  <div className="flex flex-wrap justify-center gap-1">
                    {listC.sink.map((sink, index) => (
                      <Card key={index} className="border-red-300 bg-red-50">
                        <CardContent className="p-1 text-center min-w-[60px]">
                          <Upload className="h-3 w-3 text-red-600 mx-auto mb-1" />
                          <div className="text-xs font-medium text-red-800 capitalize">
                            {sink.replace('_', ' ')}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>

        </div>
      </CardContent>
    </Card>
  );
}