import { Breadcrumbs } from "@/components/parts/breadcrumbs";
import { Header } from "@/components/parts/header";
import { PageWrapper } from "@/components/parts/page-wrapper";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ChevronRight } from "lucide-react";
import Link from "next/link";

// Import function data
import githubData from '@/data/github_functions.json';

export default function GitHubRemotePage() {
  const serverName = "github-remote";
  const functionData = githubData["github-remote"] || {};
  
  return (
    <>
      <Breadcrumbs 
        pageName="GitHub Remote"
        breadcrumbs={[
          { name: "Home", href: "/" },
          { name: "Integrations", href: "/servers" },
          { name: "GitHub Remote", href: `/servers/${serverName}` }
        ]}
      />
      <PageWrapper>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <Header title="GitHub Remote">GitHub repository management and issue tracking</Header>
            <Button asChild variant="outline">
              <Link href="/servers">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Integrations
              </Link>
            </Button>
          </div>

          {/* Functions List */}
          <Card>
            <CardHeader>
              <CardTitle>Available Functions</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {Object.entries(functionData).map(([funcName, funcData]: [string, any], index, array) => {
                return (
                  <Link
                    key={funcName}
                    href={`/servers/${serverName}/functions/${funcName}`}
                    className={`block p-4 hover:bg-accent/50 transition-colors ${index !== array.length - 1 ? 'border-b' : ''}`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center">
                          <span className="font-medium">{funcName}</span>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">{funcData.description}</p>
                        {funcData.arguments && Object.keys(funcData.arguments).length > 0 && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Arguments: {Object.keys(funcData.arguments).join(', ')}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center">
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </div>
                  </Link>
                );
              })}
            </CardContent>
          </Card>
        </div>
      </PageWrapper>
    </>
  );
}
