"use client";

import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// Import function data
import githubData from '@/data/github_functions.json';
import jiraData from '@/data/jira_functions.json';

interface FunctionArgsPageProps {
  params: {
    serverName: string;
    functionName: string;
  };
}

// Get function data from the appropriate source
const getFunctionData = (serverName: string, functionName: string) => {
  let data: any;
  
  switch (serverName) {
    case 'github-remote':
      data = githubData["github-remote"];
      break;
    case 'jira-tools':
      data = jiraData["jira-tools"];
      break;
    default:
      return null;
  }
  
  return data?.[functionName] || null;
};

export default function FunctionArgsPage({ params }: FunctionArgsPageProps) {
  const { serverName, functionName } = params;
  
  // Get function data
  const functionData = getFunctionData(serverName, functionName);
  
  // If function not found, return 404
  if (!functionData) {
    notFound();
  }

  const getServiceName = (serverName: string) => {
    switch (serverName) {
      case 'github-remote':
        return 'GitHub';
      case 'jira-tools':
        return 'Jira';
      default:
        return serverName;
    }
  };

  // Display function arguments with better context and design
  return (
    <div className="p-4 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-2">{functionData.name || functionName}</h1>
        <p className="text-muted-foreground">{functionData.description}</p>
      </div>

      <Card>
        <CardHeader className="bg-muted/50">
          <CardTitle className="text-lg">Function Arguments</CardTitle>
        </CardHeader>
        <CardContent className="p-4">
          <div className="space-y-4 mt-2">
            {functionData.arguments && Object.keys(functionData.arguments).length > 0 ? (
              Object.entries(functionData.arguments).map(([argName, argData]: [string, any]) => (
                <div key={argName} className="border rounded p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium">{argName}</span>
                    <Badge variant="outline">{argData.type}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{argData.description}</p>
                  {argData.enum && (
                    <div className="mt-2">
                      <p className="text-xs text-muted-foreground mb-1">Allowed values:</p>
                      <div className="flex flex-wrap gap-1">
                        {argData.enum.map((value: string) => (
                          <Badge key={value} variant="secondary" className="text-xs">
                            {value}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))
            ) : (
              <div className="text-center text-muted-foreground py-4">
                No arguments found for this function.
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="mt-6 text-sm text-muted-foreground">
        <p><strong>Service:</strong> {getServiceName(serverName)}</p>
        <p><strong>Function:</strong> {functionName}</p>
        {functionData.sink && functionData.sink.length > 0 && (
          <p className="mt-2"><strong>Required Permissions:</strong> {functionData.sink.join(', ')}</p>
        )}
      </div>
    </div>
  );
}
