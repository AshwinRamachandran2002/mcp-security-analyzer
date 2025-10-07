"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import githubData from '@/data/github_functions.json';

export default function AddIssueCommentArgsPage() {
  // Get the arguments directly from the JSON data
  const functionData = githubData["github-remote"]?.["add_issue_comment"];
  
  if (!functionData || !functionData.arguments) {
    return <div>No arguments found</div>;
  }
  
  return (
    <div className="p-4 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-2">{functionData.name || "Add Issue Comment"}</h1>
        <p className="text-muted-foreground">{functionData.description}</p>
      </div>

      <Card>
        <CardHeader className="bg-muted/50">
          <CardTitle className="text-lg">Function Arguments</CardTitle>
        </CardHeader>
        <CardContent className="p-4">
          <div className="space-y-4 mt-2">
            {Object.entries(functionData.arguments).map(([argName, argData]: [string, any]) => (
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
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="mt-6 text-sm text-muted-foreground">
        <p><strong>Usage:</strong> This function allows you to add a comment to a specific issue in a GitHub repository.</p>
      </div>
    </div>
  );
}
