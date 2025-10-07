import Link from "next/link";
import { Header } from "@/components/parts/header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Database, ExternalLink, Lock, Unlock, Shield, AlertTriangle, User, Clock } from "lucide-react";
import { UserPermissionsGraph } from "@/components/UserPermissionsGraph";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// Import static data
import repositoryScores from '../../data/repository_scores.json';
import userPermissions from '../../data/user_permissions.json';
import rolePermissions from '../../data/role_permissions.json';

const pageData = {
  name: "Visibility",
  title: "Resource Visibility",
  description: "Repository and project visibility analysis across connected servers",
};

export default function Page() {
  // Helper functions
  const getConfidentialityColor = (score: number) => {
    if (score === 3) return "bg-red-100 text-red-800 border-red-300";
    if (score === 2) return "bg-orange-100 text-orange-800 border-orange-300";
    return "bg-green-100 text-green-800 border-green-300";
  };

  const getIntegrityColor = (score: number) => {
    if (score === 3) return "bg-purple-100 text-purple-800 border-purple-300";
    if (score === 2) return "bg-blue-100 text-blue-800 border-blue-300";
    return "bg-gray-100 text-gray-800 border-gray-300";
  };

  const getPermissionColor = (permission: string) => {
    if (permission === "Admin") return "bg-red-100 text-red-800 border-red-300";
    if (permission === "Write") return "bg-orange-100 text-orange-800 border-orange-300";
    return "bg-green-100 text-green-800 border-green-300";
  };

  const getRoleColor = (role: string) => {
    if (role === "admin") return "bg-red-100 text-red-800 border-red-300";
    if (role === "senior_engineering") return "bg-purple-100 text-purple-800 border-purple-300";
    if (role === "executive") return "bg-blue-100 text-blue-800 border-blue-300";
    return "bg-gray-100 text-gray-800 border-gray-300";
  };

  const getUserRepositoryAccess = (user: any) => {
    const accessList: any[] = [];
    user.roles.forEach((roleKey: string) => {
      const role = (rolePermissions.roles as any)[roleKey];
      if (role) {
        role.repository_permissions.forEach((perm: any) => {
          accessList.push({
            repo_name: perm.repo_name,
            service: perm.service,
            access_type: perm.access_type,
            role: role.name
          });
        });
      }
    });
    return accessList;
  };

  const getRepositoryData = (serviceName: string) => {
    const serviceData = (repositoryScores as any)[serviceName];
    if (!serviceData) return { public: [], private: [] };
    
    const publicRepos = serviceData.public_repos || serviceData.public_projects || serviceData.public_workspaces || [];
    const privateRepos = serviceData.private_repos || serviceData.private_projects || serviceData.private_workspaces || [];
    
    return { public: publicRepos, private: privateRepos };
  };

  const getLanguageColor = (language: string) => {
    const colors: { [key: string]: string } = {
      "TypeScript": "bg-blue-100 text-blue-800",
      "JavaScript": "bg-yellow-100 text-yellow-800",
      "Python": "bg-green-100 text-green-800",
      "Go": "bg-cyan-100 text-cyan-800",
      "Java": "bg-red-100 text-red-800",
      "MDX": "bg-purple-100 text-purple-800"
    };
    return colors[language] || "bg-gray-100 text-gray-800";
  };

  return (
    <div className="p-6 border overflow-y-scroll no-scrollbar w-full sm:max-w-[calc(100vw-272px)] rounded-lg bg-muted/50 h-full">
      <Header title={pageData?.title}>{pageData?.description}</Header>
      
      <Tabs defaultValue="visibility" className="mt-6">
        <TabsList>
          <TabsTrigger value="permissions">User Permissions</TabsTrigger>
          <TabsTrigger value="visibility">Resource Visibility</TabsTrigger>
        </TabsList>
        
        <TabsContent value="permissions" className="mt-6">
          {/* User Permissions Graph */}
          <UserPermissionsGraph />
        </TabsContent>
        
        <TabsContent value="visibility" className="mt-6">
          {/* Resource Overview */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-6 text-center">
                <div className="text-3xl font-bold mb-2">
                  3
                </div>
                <div className="text-sm text-muted-foreground">Connected Services</div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-6 text-center">
                <div className="text-3xl font-bold mb-2 text-green-600">
                  {(repositoryScores as any).summary?.total_repositories ? 
                    Object.values(repositoryScores)
                      .filter(service => typeof service === 'object' && service !== null)
                      .reduce((total: number, service: any) => {
                        const publicRepos = service.public_repos?.length || service.public_projects?.length || service.public_workspaces?.length || 0;
                        return total + publicRepos;
                      }, 0) : 7}
                </div>
                <div className="text-sm text-muted-foreground">Public Resources</div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-6 text-center">
                <div className="text-3xl font-bold mb-2 text-blue-600">
                  {(repositoryScores as any).summary?.total_repositories ? 
                    Object.values(repositoryScores)
                      .filter(service => typeof service === 'object' && service !== null)
                      .reduce((total: number, service: any) => {
                        const privateRepos = service.private_repos?.length || service.private_projects?.length || service.private_workspaces?.length || 0;
                        return total + privateRepos;
                      }, 0) : 11}
                </div>
                <div className="text-sm text-muted-foreground">Private Resources</div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6 text-center">
                <div className="text-3xl font-bold mb-2 text-red-600">
                  {(repositoryScores as any).summary?.high_confidentiality || 8}
                </div>
                <div className="text-sm text-muted-foreground">High Confidentiality</div>
              </CardContent>
            </Card>
          </div>

          {/* Security Scoring Legend */}
          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="flex items-center">
                <Shield className="mr-2 h-5 w-5" />
                Security Scoring Reference
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div className="p-3 bg-gray-50 rounded border">
                  <h4 className="font-medium mb-2">Confidentiality Scores (CVSS metric)</h4>
                  <div className="space-y-1">
                    <div className="flex items-center">
                      <Badge variant="outline" className="text-xs bg-green-100 text-green-800 border-green-300 mr-2">C:1</Badge>
                      <span>None</span>
                    </div>
                    <div className="flex items-center">
                      <Badge variant="outline" className="text-xs bg-orange-100 text-orange-800 border-orange-300 mr-2">C:2</Badge>
                      <span>Low</span>
                    </div>
                    <div className="flex items-center">
                      <Badge variant="outline" className="text-xs bg-red-100 text-red-800 border-red-300 mr-2">C:3</Badge>
                      <span>High</span>
                    </div>
                  </div>
                </div>
                
                <div className="p-3 bg-gray-50 rounded border">
                  <h4 className="font-medium mb-2">Integrity Scores (CVSS metric)</h4>
                  <div className="space-y-1">
                    <div className="flex items-center">
                      <Badge variant="outline" className="text-xs bg-gray-100 text-gray-800 border-gray-300 mr-2">I:1</Badge>
                      <span>None</span>
                    </div>
                    <div className="flex items-center">
                      <Badge variant="outline" className="text-xs bg-blue-100 text-blue-800 border-blue-300 mr-2">I:2</Badge>
                      <span>Low</span>
                    </div>
                    <div className="flex items-center">
                      <Badge variant="outline" className="text-xs bg-purple-100 text-purple-800 border-purple-300 mr-2">I:3</Badge>
                      <span>High</span>
                    </div>
                  </div>
                </div>
                
                <div className="p-3 bg-gray-50 rounded border">
                  <h4 className="font-medium mb-2">Edit Risk Indicators</h4>
                  <div className="space-y-1">
                    <div className="flex items-center">
                      <Badge variant="destructive" className="text-xs mr-2">
                        <AlertTriangle className="h-3 w-3 mr-1" />
                        Edit Risk
                      </Badge>
                      <span>Vulnerable to malicious edits</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      Resources marked with edit risk can be modified by malicious actors through attack vectors.
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Connected Services */}
          {Object.entries(repositoryScores).filter(([key]) => !['scoring_legend', 'summary'].includes(key)).map(([serviceKey, serviceData]: [string, any]) => {
            const serviceName = serviceKey === 'github-remote' ? 'GitHub Remote' : 
                              serviceKey === 'jira-tools' ? 'Jira Tools' : 
                              serviceKey === 'asana-tools' ? 'Asana Tools' : serviceKey;
            
            const publicRepos = serviceData.public_repos || serviceData.public_projects || serviceData.public_workspaces || [];
            const privateRepos = serviceData.private_repos || serviceData.private_projects || serviceData.private_workspaces || [];
            
            return (
              <Card key={serviceKey} className="mt-6">
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Database className="mr-2 h-5 w-5" />
                    {serviceName}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Public Resources */}
                    <div>
                      <div className="flex items-center mb-4">
                        <Unlock className="mr-2 h-4 w-4 text-green-600" />
                        <h4 className="font-semibold text-green-800">Public Visibility</h4>
                        <Badge variant="outline" className="ml-2 text-green-700 border-green-300">
                          {publicRepos.length} items
                        </Badge>
                      </div>
                      <div className="space-y-2">
                        {publicRepos.map((repo: any) => (
                          <div key={repo.name || repo.key} className="p-3 bg-green-50 rounded border border-green-200">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center">
                                <span className="font-medium">{repo.name}</span>
                                {repo.key && (
                                  <Badge variant="outline" className="ml-2 text-xs">
                                    {repo.key}
                                  </Badge>
                                )}
                                <ExternalLink className="ml-2 h-3 w-3 text-muted-foreground" />
                              </div>
                              <div className="flex items-center space-x-1">
                                <Badge variant="outline" className={`text-xs ${getConfidentialityColor(repo.confidentiality_score)}`}>
                                  C:{repo.confidentiality_score}
                                </Badge>
                                <Badge variant="outline" className={`text-xs ${getIntegrityColor(repo.integrity_score)}`}>
                                  I:{repo.integrity_score}
                                </Badge>
                                {repo.malicious_edit_risk && (
                                  <Badge variant="destructive" className="text-xs">
                                    <AlertTriangle className="h-3 w-3 mr-1" />
                                    Edit Risk
                                  </Badge>
                                )}
                              </div>
                            </div>
                            <p className="text-xs text-muted-foreground">{repo.description}</p>
                            <p className="text-xs text-muted-foreground mt-1">{repo.url}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Private Resources */}
                    <div>
                      <div className="flex items-center mb-4">
                        <Lock className="mr-2 h-4 w-4 text-blue-600" />
                        <h4 className="font-semibold text-blue-800">Private Visibility</h4>
                        <Badge variant="outline" className="ml-2 text-blue-700 border-blue-300">
                          {privateRepos.length} items
                        </Badge>
                      </div>
                      <div className="space-y-2">
                        {privateRepos.map((repo: any) => (
                          <div key={repo.name || repo.key} className="p-3 bg-blue-50 rounded border border-blue-200">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center">
                                <span className="font-medium">{repo.name}</span>
                                {repo.key && (
                                  <Badge variant="outline" className="ml-2 text-xs">
                                    {repo.key}
                                  </Badge>
                                )}
                                <ExternalLink className="ml-2 h-3 w-3 text-muted-foreground" />
                              </div>
                              <div className="flex items-center space-x-1">
                                <Badge variant="outline" className={`text-xs ${getConfidentialityColor(repo.confidentiality_score)}`}>
                                  C:{repo.confidentiality_score}
                                </Badge>
                                <Badge variant="outline" className={`text-xs ${getIntegrityColor(repo.integrity_score)}`}>
                                  I:{repo.integrity_score}
                                </Badge>
                                {repo.malicious_edit_risk && (
                                  <Badge variant="destructive" className="text-xs">
                                    <AlertTriangle className="h-3 w-3 mr-1" />
                                    Edit Risk
                                  </Badge>
                                )}
                              </div>
                            </div>
                            <p className="text-xs text-muted-foreground">{repo.description}</p>
                            <p className="text-xs text-muted-foreground mt-1">{repo.url}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </TabsContent>
      </Tabs>
    </div>
  );
}