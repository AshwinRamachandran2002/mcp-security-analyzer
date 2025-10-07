import { Breadcrumbs } from "@/components/parts/breadcrumbs";
import { Header } from "@/components/parts/header";
import { PageWrapper } from "@/components/parts/page-wrapper";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Database, Shield, AlertTriangle, Info, ChevronRight } from "lucide-react";
import Link from "next/link";

interface ServerPageProps {
  params: {
    serverName: string;
  };
}

// Import actual function data
import githubData from '../../../data/github_functions.json';
import jiraData from '../../../data/jira_functions.json';

// Function to determine risk level based on classifications
const getRiskLevel = (func: any) => {
  if (func.listA?.belongs && func.listB?.belongs && func.listC?.belongs) return "critical";
  if ((func.listA?.belongs && func.listB?.belongs) || (func.listB?.belongs && func.listC?.belongs)) return "high";
  if (func.listA?.belongs || func.listB?.belongs || func.listC?.belongs) return "medium";
  return "low";
};

// Transform function data into our format
const transformFunctionData = (data: any, serverKey: string) => {
  const serverData = data[serverKey];
  if (!serverData) return [];
  
  return Object.entries(serverData).map(([funcName, funcData]: [string, any]) => ({
    name: funcName,
    description: funcData.description,
    risk_level: getRiskLevel(funcData),
    listA: funcData.listA?.belongs || false,
    listB: funcData.listB?.belongs || false,
    listC: funcData.listC?.belongs || false,
    arguments: funcData.arguments || {},
    classifications: {
      listA: funcData.listA,
      listB: funcData.listB,
      listC: funcData.listC
    }
  }));
};

// Real server data from module_1
const mockServers = {
  "github-remote": {
    name: "GitHub Remote",
    url: "github://repositories",
    description: "GitHub repository management and issue tracking",
    function_count: Object.keys(githubData['github-remote'] || {}).length,
    has_auth: true,
    functions: transformFunctionData(githubData, 'github-remote')
  },
  "jira-tools": {
    name: "Jira Tools",
    url: "jira://projects",
    description: "Jira project management and issue tracking", 
    function_count: Object.keys(jiraData['jira-tools'] || {}).length,
    has_auth: true,
    functions: transformFunctionData(jiraData, 'jira-tools')
  }
};

export default function ServerPage({ params }: ServerPageProps) {
  const serverData = mockServers[params.serverName as keyof typeof mockServers];
  
  if (!serverData) {
    return (
      <PageWrapper>
        <Card>
          <CardContent className="p-8 text-center">
            <AlertTriangle className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-2">Server Not Found</h3>
            <p className="text-muted-foreground mb-4">
              The server "{params.serverName}" could not be found.
            </p>
            <Button asChild variant="outline">
              <Link href="/servers">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Integrations
              </Link>
            </Button>
          </CardContent>
        </Card>
      </PageWrapper>
    );
  }

  const getRiskColor = (level: string) => {
    switch (level) {
      case 'critical': return 'destructive';
      case 'high': return 'destructive';
      case 'medium': return 'default';
      case 'low': return 'secondary';
      default: return 'outline';
    }
  };

  const getRiskIcon = (level: string) => {
    switch (level) {
      case 'critical': return AlertTriangle;
      case 'high': return AlertTriangle;
      case 'medium': return Shield;
      case 'low': return Info;
      default: return Info;
    }
  };

  return (
    <>
      <Breadcrumbs 
        pageName={serverData.name}
        breadcrumbs={[
          { name: "Home", href: "/" },
          { name: "Integrations", href: "/servers" },
          { name: serverData.name, href: `/servers/${params.serverName}` }
        ]}
      />
      <PageWrapper>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <Header title={serverData.name}>{serverData.description}</Header>
            <Button asChild variant="outline">
              <Link href="/servers">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Integrations
              </Link>
            </Button>
          </div>

          {/* Server Overview */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Server Name</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center">
                  <Database className="mr-2 h-4 w-4" />
                  <span className="text-sm">{serverData.name}</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Authentication</CardTitle>
              </CardHeader>
              <CardContent>
                <Badge variant={serverData.has_auth ? "default" : "outline"}>
                  {serverData.has_auth ? "Configured" : "Missing"}
                </Badge>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Total Functions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{serverData.function_count}</div>
              </CardContent>
            </Card>
          </div>

          {/* Functions List */}
          <Card>
            <CardHeader>
              <CardTitle>Available Functions</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {serverData.functions.map((func, index) => {
                const RiskIcon = getRiskIcon(func.risk_level);
                return (
                  <Link
                    key={func.name}
                    href={`/servers/${params.serverName}/functions/${func.name}`}
                    className={`block p-4 hover:bg-accent/50 transition-colors ${index !== serverData.functions.length - 1 ? 'border-b' : ''}`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center">
                          <span className="font-medium">{func.name}</span>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">{func.description}</p>
                        {'arguments' in func && func.arguments && Object.keys(func.arguments).length > 0 && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Arguments: {Object.keys(func.arguments).join(', ')}
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