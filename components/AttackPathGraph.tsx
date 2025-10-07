"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, User, Database, AlertTriangle, Shield, FileText, Download, Upload, CheckCircle, XCircle } from "lucide-react";
import { AttackVector } from '@/lib/attack-vector-generator';

interface AttackPathGraphProps {
  vector: AttackVector;
}

export function AttackPathGraph({ vector }: AttackPathGraphProps) {
  const nodes = [
    {
      id: 'user-prompt',
      title: 'User Prompt',
      subtitle: 'Benign Request',
      description: 'User makes innocent request',
      icon: User,
      color: 'bg-green-50 border-green-300',
      textColor: 'text-green-800',
      status: 'safe'
    },
    {
      id: 'malicious-source',
      title: 'Malicious Source',
      subtitle: vector.malicious_edit_repo.name + ' (' + vector.malicious_edit_repo.service + ')',
      description: 'Agent fetches from compromised repo',
      icon: XCircle,
      color: 'bg-red-50 border-red-300',
      textColor: 'text-red-800',
      status: 'malicious'
    },
    {
      id: 'agent-hijack',
      title: 'Agent Hijacked',
      subtitle: 'Malicious Content Loaded',
      description: 'Agent processes malicious instructions',
      icon: AlertTriangle,
      color: 'bg-orange-50 border-orange-300',
      textColor: 'text-orange-800',
      status: 'compromised'
    },
    {
      id: 'target-action',
      title: vector.attack_type === 'data_exfiltration' ? 'Data Access' : 'System Modification',
      subtitle: vector.target_repo.name + ' (' + vector.malicious_edit_repo.service + ')',
      description: vector.attack_type === 'data_exfiltration' 
        ? 'Agent accesses sensitive data' 
        : 'Agent modifies critical system',
      icon: vector.attack_type === 'data_exfiltration' ? Download : FileText,
      color: 'bg-blue-50 border-blue-300',
      textColor: 'text-blue-800',
      status: 'target'
    }
  ];

  // Add intermediate node if it exists
  if (vector.intermediate_repo) {
    nodes.push({
      id: 'exfiltration',
      title: 'Data Exfiltration',
      subtitle: vector.intermediate_repo.name + ' (' + vector.malicious_edit_repo.service + ')',
      description: 'Data sent to external system',
      icon: Upload,
      color: 'bg-purple-50 border-purple-300',
      textColor: 'text-purple-800',
      status: 'exfiltration'
    });
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'safe': return CheckCircle;
      case 'malicious': return XCircle;
      case 'compromised': return AlertTriangle;
      default: return Shield;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <Shield className="mr-2 h-5 w-5" />
          Attack Path Graph
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* Graph Visualization */}
          <div className="flex flex-col space-y-4">
            {nodes.map((node, index) => {
              const IconComponent = node.icon;
              const StatusIcon = getStatusIcon(node.status);
              const isLastNode = index === nodes.length - 1;
              
              return (
                <div key={node.id} className="flex flex-col items-center">
                  {/* Node */}
                  <Card className={`${node.color} border-2 w-full max-w-md`}>
                    <CardContent className="p-4">
                      <div className="flex items-center space-x-3">
                        <div className="flex-shrink-0">
                          <div className="relative">
                            <IconComponent className={`h-8 w-8 ${node.textColor}`} />
                            <StatusIcon className={`h-4 w-4 absolute -top-1 -right-1 ${
                              node.status === 'safe' ? 'text-green-600' :
                              node.status === 'malicious' ? 'text-red-600' :
                              node.status === 'compromised' ? 'text-orange-600' :
                              'text-blue-600'
                            }`} />
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className={`font-semibold text-sm ${node.textColor}`}>
                            {node.title}
                          </div>
                          <div className={`text-xs ${node.textColor} opacity-80`}>
                            {node.subtitle}
                          </div>
                          <div className="text-xs text-gray-600 mt-1">
                            {node.description}
                          </div>
                        </div>
                        <Badge variant={node.status === 'safe' ? 'default' : 
                                      node.status === 'malicious' ? 'destructive' : 
                                      'secondary'}>
                          {node.status.toUpperCase()}
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                  
                  {/* Arrow to next node */}
                  {!isLastNode && (
                    <div className="flex justify-center my-2">
                      <ArrowRight className="h-6 w-6 text-gray-400 transform rotate-90" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Attack Flow Description */}
          <Card className="bg-yellow-50 border-yellow-200">
            <CardContent className="p-4">
              <div className="flex items-start space-x-3">
                <AlertTriangle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-medium text-yellow-800 mb-2">Attack Flow Analysis</h4>
                  <div className="text-sm text-yellow-700 space-y-1">
                    <p>1. <strong>Benign Start:</strong> User makes legitimate request via prompt</p>
                    <p>2. <strong>Malicious Injection:</strong> Agent fetches content from compromised {vector.malicious_edit_repo.name}</p>
                    <p>3. <strong>Agent Hijacking:</strong> Malicious instructions override normal behavior</p>
                    <p>4. <strong>Unauthorized Action:</strong> Agent performs {vector.attack_type === 'data_exfiltration' ? 'data access' : 'system modification'} on {vector.target_repo.name}</p>
                    {vector.intermediate_repo && (
                      <p>5. <strong>Data Exfiltration:</strong> Sensitive data sent to {vector.intermediate_repo.name}</p>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </CardContent>
    </Card>
  );
}