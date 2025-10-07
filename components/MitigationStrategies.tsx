"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Shield, Lock, Eye, AlertTriangle, CheckCircle } from "lucide-react";

interface MitigationStrategiesProps {
  listACount: number;
  listBCount: number;
  listCCount: number;
  totalCombinations: number;
}

export function MitigationStrategies({
  listACount,
  listBCount,
  listCCount,
  totalCombinations
}: MitigationStrategiesProps) {
  const mitigationStrategies = [
    {
      category: "External Data Source Protection",
      icon: <Eye className="h-5 w-5 text-blue-500" />,
      priority: "HIGH",
      strategies: [
        "Implement strict input validation and sanitization for all external data sources",
        "Use allowlists for approved external URLs and data sources",
        "Deploy content security policies to prevent data injection attacks",
        "Monitor and log all external data access patterns for anomaly detection"
      ],
      applicableVectors: listACount * listBCount * listCCount,
      riskReduction: "65%"
    },
    {
      category: "Private Data Access Controls",
      icon: <Lock className="h-5 w-5 text-orange-500" />,
      priority: "CRITICAL",
      strategies: [
        "Enforce least-privilege access principles for all sensitive data operations",
        "Implement multi-factor authentication for private data access",
        "Use role-based access control (RBAC) with regular permission audits",
        "Deploy zero-trust architecture with continuous verification"
      ],
      applicableVectors: listACount * listBCount * listCCount,
      riskReduction: "80%"
    },
    {
      category: "Data Exfiltration Prevention",
      icon: <Shield className="h-5 w-5 text-green-500" />,
      priority: "HIGH",
      strategies: [
        "Implement data loss prevention (DLP) controls on all external communications",
        "Use network segmentation to isolate sensitive data processing",
        "Deploy egress filtering and monitoring for suspicious data transfers",
        "Establish data classification and handling policies with automated enforcement"
      ],
      applicableVectors: listACount * listBCount * listCCount,
      riskReduction: "70%"
    },
    {
      category: "Function Chaining Prevention",
      icon: <AlertTriangle className="h-5 w-5 text-red-500" />,
      priority: "CRITICAL",
      strategies: [
        "Implement function call rate limiting and throttling mechanisms",
        "Use context isolation between different function execution environments",
        "Deploy behavioral analysis to detect unusual function chaining patterns",
        "Establish break-glass procedures for emergency function access control"
      ],
      applicableVectors: totalCombinations,
      riskReduction: "85%"
    }
  ];

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'CRITICAL': return 'destructive';
      case 'HIGH': return 'default';
      case 'MEDIUM': return 'secondary';
      default: return 'outline';
    }
  };

  const calculateOverallRiskReduction = () => {
    const reductions = [65, 80, 70, 85];
    const average = reductions.reduce((sum, val) => sum + val, 0) / reductions.length;
    return Math.round(average);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center">
            <Shield className="mr-2 h-5 w-5 text-blue-500" />
            Attack Vector Mitigation Strategies
          </CardTitle>
          <div className="flex items-center space-x-2">
            <Badge variant="outline" className="text-green-600 border-green-300">
              <CheckCircle className="h-3 w-3 mr-1" />
              {calculateOverallRiskReduction()}% Risk Reduction
            </Badge>
            <Badge variant="outline">
              {totalCombinations} Attack Vectors
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {mitigationStrategies.map((strategy, index) => (
            <Card key={index} className="border-l-4 border-l-blue-500">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    {strategy.icon}
                    <CardTitle className="text-base ml-2">{strategy.category}</CardTitle>
                  </div>
                  <Badge variant={getPriorityColor(strategy.priority)}>
                    {strategy.priority}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Applicable to:</span>
                  <span className="font-medium">{strategy.applicableVectors.toLocaleString()} vectors</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Risk Reduction:</span>
                  <span className="font-medium text-green-600">{strategy.riskReduction}</span>
                </div>
                <div className="space-y-2">
                  {strategy.strategies.map((item, itemIndex) => (
                    <div key={itemIndex} className="flex items-start space-x-2">
                      <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                      <span className="text-sm text-muted-foreground">{item}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Implementation Priority */}
        <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
          <h4 className="font-semibold text-blue-800 mb-2 flex items-center">
            <AlertTriangle className="h-4 w-4 mr-2" />
            Recommended Implementation Order
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-sm">
            <div className="flex items-center">
              <div className="w-6 h-6 bg-red-500 rounded-full flex items-center justify-center text-white font-bold text-xs mr-2">
                1
              </div>
              <span className="text-blue-700">Private Data Access Controls</span>
            </div>
            <div className="flex items-center">
              <div className="w-6 h-6 bg-orange-500 rounded-full flex items-center justify-center text-white font-bold text-xs mr-2">
                2
              </div>
              <span className="text-blue-700">Function Chaining Prevention</span>
            </div>
            <div className="flex items-center">
              <div className="w-6 h-6 bg-yellow-500 rounded-full flex items-center justify-center text-white font-bold text-xs mr-2">
                3
              </div>
              <span className="text-blue-700">Data Exfiltration Prevention</span>
            </div>
            <div className="flex items-center">
              <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center text-white font-bold text-xs mr-2">
                4
              </div>
              <span className="text-blue-700">External Source Protection</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}