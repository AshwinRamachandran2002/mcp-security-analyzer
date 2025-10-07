"use client";

import { useEffect, useRef, useState } from "react";
import * as d3 from "d3";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PieChart, Shield } from "lucide-react";
import { generateAttackVectors, getAttackStatistics } from "@/utils/attackVectorGenerator";

interface DashboardChartsProps {
  totalFunctions: number;
  githubCount: number;
  jiraCount: number;
  listACount: number;
  listBCount: number;
  listCCount: number;
  criticalCount: number;
  highCount: number;
  totalCombinations: number;
}

export function DashboardCharts({
  totalFunctions,
  githubCount,
  jiraCount,
  listACount,
  listBCount,
  listCCount,
  criticalCount,
  highCount,
  totalCombinations
}: DashboardChartsProps) {
  // Dynamic attack vector data
  const [attackVectors, setAttackVectors] = useState<any[]>([]);
  const [attackStats, setAttackStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<string>("all");
  const pieChartRef = useRef<SVGSVGElement>(null);
  const attackTypeChartRef = useRef<SVGSVGElement>(null);

  // Load dynamic attack vector data
  useEffect(() => {
    try {
      const vectors = generateAttackVectors();
      const stats = getAttackStatistics();
      setAttackVectors(vectors);
      setAttackStats(stats);
    } catch (error) {
      console.error('Error loading attack vectors:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Server Distribution Pie Chart
  useEffect(() => {
    // Small delay to ensure DOM is ready
    const timer = setTimeout(() => {
      console.log('Server chart useEffect triggered');
      console.log('pieChartRef.current:', pieChartRef.current);
      console.log('Data:', { githubCount, jiraCount, totalFunctions });
      
      if (!pieChartRef.current) {
        console.log('No pieChartRef.current available');
        return;
      }
      
      // Don't render if all values are 0
      if (githubCount === 0 && jiraCount === 0) {
        console.log('No data available for server chart');
        return;
      }

      try {
        const svg = d3.select(pieChartRef.current);
        svg.selectAll("*").remove();
        console.log('SVG selected and cleared');

        const width = 300;
        const height = 300;
        const radius = Math.min(width, height) / 2 - 40; // More padding

        const data = [
          { name: "GitHub", value: githubCount, color: "#3b82f6" },
          { name: "Jira", value: jiraCount, color: "#f59e0b" }
        ].filter(d => d.value > 0);
        
        console.log('Chart data prepared:', data);

        if (data.length === 0) {
          console.log('No valid data after filtering');
          return;
        }

        const pie = d3.pie<any>().value(d => d.value);
        const arc = d3.arc<any>().innerRadius(50).outerRadius(radius);

        // Set SVG dimensions
        svg.attr("width", width).attr("height", height);

        const g = svg
          .append("g")
          .attr("transform", `translate(${width / 2},${height / 2})`);

        console.log('SVG group created');

        // Add pie slices
        const slices = g
          .selectAll(".slice")
          .data(pie(data))
          .enter()
          .append("g")
          .attr("class", "slice");

        console.log('Pie slices created:', slices.size());

        // Add paths
        slices
          .append("path")
          .attr("d", arc)
          .attr("fill", d => d.data.color)
          .attr("stroke", "#fff")
          .attr("stroke-width", 2)
          .style("opacity", 0.9);

        // Add value labels on slices
        slices
          .append("text")
          .attr("transform", d => `translate(${arc.centroid(d)})`)
          .attr("text-anchor", "middle")
          .attr("font-size", "14px")
          .attr("font-weight", "bold")
          .attr("fill", "white")
          .text(d => d.data.value);

        // Add center text
        g.append("text")
          .attr("text-anchor", "middle")
          .attr("font-size", "24px")
          .attr("font-weight", "bold")
          .attr("dy", "-5px")
          .attr("fill", "#374151")
          .text(totalFunctions);

        g.append("text")
          .attr("text-anchor", "middle")
          .attr("font-size", "12px")
          .attr("dy", "15px")
          .attr("fill", "#6b7280")
          .text("Total Functions");

        console.log('Server pie chart rendered successfully');
        
      } catch (error) {
        console.error('Error rendering server pie chart:', error);
      }
    }, 100);

    return () => clearTimeout(timer);
  }, [githubCount, jiraCount, totalFunctions]);


  // Attack Type Distribution Chart
  useEffect(() => {
    if (!attackTypeChartRef.current || !attackVectors.length) return;

    const svg = d3.select(attackTypeChartRef.current);
    svg.selectAll("*").remove();

    const width = 300;
    const height = 300;
    const radius = Math.min(width, height) / 2 - 20;

    const exfiltrationCount = attackVectors.filter(v => v.attack_type === 'data_exfiltration').length;
    const poisoningCount = attackVectors.filter(v => v.attack_type === 'data_poisoning').length;

    const data = [
      { name: "Data Exfiltration", value: exfiltrationCount, color: "#3b82f6" },
      { name: "Data Poisoning", value: poisoningCount, color: "#ef4444" }
    ];

    const pie = d3.pie<any>().value(d => d.value);
    const arc = d3.arc<any>().innerRadius(60).outerRadius(radius);

    const g = svg
      .attr("width", width)
      .attr("height", height)
      .append("g")
      .attr("transform", `translate(${width / 2},${height / 2})`);

    // Add pie slices
    const slices = g
      .selectAll(".slice")
      .data(pie(data))
      .enter()
      .append("g")
      .attr("class", "slice");

    slices
      .append("path")
      .attr("d", arc)
      .attr("fill", d => d.data.color)
      .attr("stroke", "#fff")
      .attr("stroke-width", 2)
      .style("opacity", 0.8)
      .on("mouseover", function() {
        d3.select(this).style("opacity", 1);
      })
      .on("mouseout", function() {
        d3.select(this).style("opacity", 0.8);
      });

    // Add labels
    slices
      .append("text")
      .attr("transform", d => `translate(${arc.centroid(d)})`)
      .attr("text-anchor", "middle")
      .attr("font-size", "12px")
      .attr("font-weight", "bold")
      .attr("fill", "white")
      .text(d => d.data.value);

    // Add center text
    g.append("text")
      .attr("text-anchor", "middle")
      .attr("font-size", "20px")
      .attr("font-weight", "bold")
      .attr("dy", "-5px")
      .text(attackVectors.length);

    g.append("text")
      .attr("text-anchor", "middle")
      .attr("font-size", "12px")
      .attr("dy", "15px")
      .attr("fill", "#6b7280")
      .text("Attack Vectors");

  }, [attackVectors]);

  if (loading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {[1, 2, 3].map(i => (
          <Card key={i}>
            <CardHeader>
              <div className="flex items-center">
                <div className="w-5 h-5 bg-gray-200 rounded mr-2 animate-pulse"></div>
                <div className="w-24 h-4 bg-gray-200 rounded animate-pulse"></div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="w-full h-40 bg-gray-200 rounded animate-pulse"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
      {/* Attack Type Distribution */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Shield className="h-5 w-5 mr-2 text-blue-500" />
            Attack Types
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="all" value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-3 mb-4">
              <TabsTrigger value="all">
                All
                <Badge variant="secondary" className="ml-2">{attackVectors.length}</Badge>
              </TabsTrigger>
              <TabsTrigger value="exfiltration">
                Exfiltration
                <Badge variant="secondary" className="ml-2">{attackVectors.filter(v => v.attack_type === 'data_exfiltration').length}</Badge>
              </TabsTrigger>
              <TabsTrigger value="poisoning">
                Poisoning
                <Badge variant="secondary" className="ml-2">{attackVectors.filter(v => v.attack_type === 'data_poisoning').length}</Badge>
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="all">
              <div className="flex items-center justify-center">
                <svg ref={attackTypeChartRef}></svg>
              </div>
              <div className="flex justify-center space-x-4 mt-4">
                <div className="flex items-center">
                  <div className="w-3 h-3 bg-blue-500 rounded-full mr-2"></div>
                  <span className="text-sm">Exfiltration ({attackVectors.filter(v => v.attack_type === 'data_exfiltration').length})</span>
                </div>
                <div className="flex items-center">
                  <div className="w-3 h-3 bg-red-500 rounded-full mr-2"></div>
                  <span className="text-sm">Poisoning ({attackVectors.filter(v => v.attack_type === 'data_poisoning').length})</span>
                </div>
              </div>
            </TabsContent>
            
            <TabsContent value="exfiltration">
              <div className="p-4 border rounded-lg">
                <h3 className="text-lg font-semibold mb-2">Data Exfiltration Attacks</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Attacks that aim to extract sensitive data from the system through authorized API endpoints.
                </p>
                <div className="flex items-center justify-between">
                  <div className="text-3xl font-bold text-blue-500">
                    {attackVectors.filter(v => v.attack_type === 'data_exfiltration').length}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {Math.round((attackVectors.filter(v => v.attack_type === 'data_exfiltration').length / attackVectors.length) * 100)}% of all attacks
                  </div>
                </div>
              </div>
            </TabsContent>
            
            <TabsContent value="poisoning">
              <div className="p-4 border rounded-lg">
                <h3 className="text-lg font-semibold mb-2">Data Poisoning Attacks</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Attacks that aim to manipulate or corrupt data within the system through authorized API endpoints.
                </p>
                <div className="flex items-center justify-between">
                  <div className="text-3xl font-bold text-red-500">
                    {attackVectors.filter(v => v.attack_type === 'data_poisoning').length}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {Math.round((attackVectors.filter(v => v.attack_type === 'data_poisoning').length / attackVectors.length) * 100)}% of all attacks
                  </div>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Server Distribution */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <PieChart className="h-5 w-5 mr-2 text-emerald-500" />
            Server Functions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center min-h-[300px]">
            <svg ref={pieChartRef} width="300" height="300" style={{display: 'block'}}></svg>
          </div>
          <div className="flex justify-center space-x-4 mt-4">
            <div className="flex items-center">
              <div className="w-3 h-3 bg-blue-500 rounded-full mr-2"></div>
              <span className="text-sm">GitHub ({githubCount})</span>
            </div>
            <div className="flex items-center">
              <div className="w-3 h-3 bg-amber-500 rounded-full mr-2"></div>
              <span className="text-sm">Jira ({jiraCount})</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}