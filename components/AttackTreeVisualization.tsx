"use client";

import { useEffect, useRef, useState } from "react";
import * as d3 from "d3";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { AttackFlowDiagram } from "./AttackFlowDiagram";

interface AttackNode {
  self_id: string;
  parent_id: string;
  score: number;
  adv_prompt: string;
  target_response: string;
  improvement?: string;
}

interface ProcessedNode {
  id: string;
  parentId: string;
  score: number;
  adv_prompt: string;
  target_response: string;
  improvement: string;
  children: ProcessedNode[];
}

export function AttackTreeVisualization() {
  const svgRef = useRef<SVGSVGElement>(null);
  const [attackData, setAttackData] = useState<AttackNode[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedNode, setSelectedNode] = useState<ProcessedNode | null>(null);
  const [nodeCount, setNodeCount] = useState(0);

  const loadAttackData = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/attack-data');
      const data = await response.json();
      
      if (data.success) {
        setAttackData(data.data);
        setNodeCount(data.count);
        renderGraph(data.data);
      } else {
        console.error('Failed to load attack data:', data.error);
        toast.error('Failed to load attack data');
      }
    } catch (error) {
      console.error('Error loading attack data:', error);
      toast.error('Error loading attack data');
    } finally {
      setIsLoading(false);
    }
  };

  const renderGraph = (data: AttackNode[]) => {
    if (!svgRef.current || !data || data.length === 0) {
      // Clear SVG and show empty state
      if (svgRef.current) {
        d3.select(svgRef.current).selectAll('*').remove();
        d3.select(svgRef.current)
          .append('text')
          .attr('x', '50%')
          .attr('y', '50%')
          .attr('text-anchor', 'middle')
          .attr('fill', '#6b7280')
          .style('font-size', '14px')
          .text('No attack data available yet. Run TAP analysis to see the attack tree.');
      }
      setSelectedNode(null);
      return;
    }

    // Clear existing content
    d3.select(svgRef.current).selectAll('*').remove();
    setSelectedNode(null);

    // Set up dimensions
    const margin = { top: 60, right: 100, bottom: 60, left: 100 };
    const nodeCount = data.length;
    const width = Math.max(800, Math.min(1200, nodeCount * 80));
    const height = Math.max(400, Math.min(600, nodeCount * 60));

    // Create SVG
    const svg = d3.select(svgRef.current)
      .attr('width', width + margin.left + margin.right)
      .attr('height', height + margin.top + margin.bottom);

    const g = svg.append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // Process attack data into hierarchical structure
    const nodesMap = new Map<string, ProcessedNode>();
    const rootNodes: ProcessedNode[] = [];

    // First pass: create all nodes
    data.forEach((attack, index) => {
      if (!attack || !attack.self_id) {
        console.warn(`Skipping invalid attack at index ${index}:`, attack);
        return;
      }

      const node: ProcessedNode = {
        id: attack.self_id,
        parentId: attack.parent_id,
        score: attack.score || 0,
        adv_prompt: attack.adv_prompt || '',
        target_response: attack.target_response || '',
        improvement: attack.improvement || '',
        children: []
      };
      
      nodesMap.set(attack.self_id, node);
      
      if (!attack.parent_id || attack.parent_id === "NA") {
        rootNodes.push(node);
      }
    });

    // Second pass: build parent-child relationships
    data.forEach(attack => {
      if (attack && attack.parent_id && attack.parent_id !== "NA" && attack.self_id) {
        const parent = nodesMap.get(attack.parent_id);
        const child = nodesMap.get(attack.self_id);
        if (parent && child) {
          parent.children.push(child);
        }
      }
    });

    if (rootNodes.length === 0) {
      svg.append('text')
        .attr('x', '50%')
        .attr('y', '50%')
        .attr('text-anchor', 'middle')
        .attr('fill', '#ef4444')
        .style('font-size', '14px')
        .text('Error: No valid root nodes found in attack data');
      return;
    }

    // Create hierarchy
    let hierarchyRoot;
    if (rootNodes.length === 1) {
      hierarchyRoot = d3.hierarchy(rootNodes[0]);
    } else {
      const virtualRoot = {
        id: 'virtual-root',
        children: rootNodes,
        virtual: true
      } as any;
      hierarchyRoot = d3.hierarchy(virtualRoot);
    }

    // Create tree layout
    const treeLayout = d3.tree<ProcessedNode>()
      .size([width, height])
      .nodeSize([60, 80])
      .separation((a, b) => {
        const aSiblings = a.parent ? a.parent.children.length : 1;
        const bSiblings = b.parent ? b.parent.children.length : 1;
        const baseSeparation = a.parent === b.parent ? 0.8 : 1.2;
        return baseSeparation + Math.max(aSiblings, bSiblings) * 0.1;
      });

    // Apply layout
    const treeData = treeLayout(hierarchyRoot);
    const nodes = treeData.descendants();
    const links = treeData.links();

    // Filter out virtual root if it exists
    const visibleNodes = nodes.filter(d => d.data && !(d.data as any).virtual);
    const visibleLinks = links.filter(d => 
      d.source && d.target && 
      d.source.data && d.target.data && 
      !(d.source.data as any).virtual && !(d.target.data as any).virtual
    );

    // Adjust positions to center the tree
    if (visibleNodes.length > 0) {
      const xExtent = d3.extent(visibleNodes, d => d.x) as [number, number];
      const xOffset = (width - (xExtent[1] - xExtent[0])) / 2 - xExtent[0];
      
      visibleNodes.forEach(d => {
        d.x! += xOffset;
      });
    }

    // Add level demarkation lines
    const levels = d3.group(visibleNodes, d => d.depth);
    levels.forEach((levelNodes, depth) => {
      const y = levelNodes[0].y!;
      
      // Add horizontal dashed line
      g.append('line')
        .attr('x1', -margin.left + 10)
        .attr('y1', y - 25)
        .attr('x2', width + margin.right - 10)
        .attr('y2', y - 25)
        .attr('stroke', '#e5e7eb')
        .attr('stroke-width', 1)
        .attr('stroke-dasharray', '3,3');
      
      // Add level label
      g.append('text')
        .attr('x', -margin.left + 5)
        .attr('y', y - 30)
        .attr('fill', '#6b7280')
        .attr('font-size', '10px')
        .attr('font-weight', '500')
        .text(`Level ${depth}`);
    });

    // Draw links
    if (visibleLinks.length > 0) {
      g.selectAll('.link')
        .data(visibleLinks)
        .enter()
        .append('path')
        .attr('class', 'link')
        .attr('d', d => {
          if (d.source && d.target && 
              typeof d.source.x === 'number' && typeof d.source.y === 'number' &&
              typeof d.target.x === 'number' && typeof d.target.y === 'number') {
            return d3.linkVertical()({
              source: [d.source.x, d.source.y],
              target: [d.target.x, d.target.y]
            });
          }
          return '';
        })
        .attr('fill', 'none')
        .attr('stroke', '#6b7280')
        .attr('stroke-width', 2);
    }

    // Draw nodes
    const nodeGroups = g.selectAll('.node')
      .data(visibleNodes)
      .enter()
      .append('g')
      .attr('class', 'node')
      .attr('transform', d => `translate(${d.x},${d.y})`)
      .style('cursor', 'pointer');

    // Add circles for nodes
    nodeGroups.append('circle')
      .attr('r', 18)
      .attr('fill', d => {
        const score = d.data.score;
        if (score === 1) return '#10b981'; // green
        if (score === 2) return '#eab308'; // yellow
        if (score === 3) return '#f97316'; // orange
        if (score === 4) return '#ef4444'; // red
        if (score === 5) return '#dc2626'; // bright red
        return '#6b7280'; // default gray
      })
      .attr('stroke', '#ffffff')
      .attr('stroke-width', 1);

    // Add score text
    nodeGroups.append('text')
      .attr('dy', '0.35em')
      .attr('text-anchor', 'middle')
      .attr('fill', 'white')
      .attr('font-weight', 'bold')
      .attr('font-size', '12px')
      .text(d => d.data.score);

    // Add click interactions
    nodeGroups.on('click', function(event, d) {
      // Remove previous selection styling
      nodeGroups.selectAll('circle')
        .attr('stroke', '#ffffff')
        .attr('stroke-width', 1)
        .style('filter', null);

      // Add selection styling to current node with BLACK outline
      d3.select(this).select('circle')
        .attr('stroke', '#000000')
        .attr('stroke-width', 4)
        .style('filter', 'drop-shadow(0 0 4px #000000)');

      setSelectedNode(d.data);
    });

    // Auto-select first node with BLACK outline
    if (visibleNodes.length > 0) {
      setSelectedNode(visibleNodes[0].data);
      const firstGroup = nodeGroups.nodes()[0];
      if (firstGroup) {
        d3.select(firstGroup).select('circle')
          .attr('stroke', '#000000')
          .attr('stroke-width', 4)
          .style('filter', 'drop-shadow(0 0 4px #000000)');
      }
    }
  };

  useEffect(() => {
    loadAttackData();
  }, []);

  const getScoreColor = (score: number) => {
    if (score === 1) return 'bg-green-500';
    if (score === 2) return 'bg-yellow-500';
    if (score === 3) return 'bg-orange-500';
    if (score === 4) return 'bg-red-500';
    if (score === 5) return 'bg-red-700';
    return 'bg-gray-500';
  };

  return (
    <div className="space-y-4">
      {/* Graph Container */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center">
                TAP Attack Tree Visualization
              </CardTitle>
              <CardDescription>
                Real-time visualization of TAP attack progression. Click on nodes to see prompts and responses.
              </CardDescription>
            </div>
            <div className="flex items-center space-x-2">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={loadAttackData}
                disabled={isLoading}
              >
                <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
              <div className="text-sm text-muted-foreground">
                {nodeCount} nodes
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Legend */}
          <div className="mb-4 flex items-center space-x-4">
            <span className="text-sm font-medium">Legend:</span>
            {[1, 2, 3, 4, 5].map(score => (
              <div key={score} className="flex items-center space-x-1">
                <div className={`w-3 h-3 rounded-full ${getScoreColor(score)}`}></div>
                <span className="text-xs">Score {score}</span>
              </div>
            ))}
          </div>
          
          {/* Graph SVG */}
          <div className="w-full border rounded-lg overflow-auto" style={{ height: '500px' }}>
            <svg ref={svgRef} className="w-full h-full"></svg>
          </div>
        </CardContent>
      </Card>

      {/* Node Details Panel */}
      {selectedNode && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Node Details</CardTitle>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setSelectedNode(null)}
              >
                Clear Selection
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h4 className="font-semibold text-sm mb-2">Node ID</h4>
              <p className="text-sm text-muted-foreground font-mono">{selectedNode.id}</p>
            </div>
            
            <div>
              <h4 className="font-semibold text-sm mb-2">Score</h4>
              <div className="flex items-center space-x-2">
                <div className={`w-4 h-4 rounded-full ${getScoreColor(selectedNode.score)}`}></div>
                <span className="text-sm">{selectedNode.score}</span>
              </div>
            </div>

            <div>
              <h4 className="font-semibold text-sm mb-2">Adversarial Prompt</h4>
              <div className="p-3 bg-gray-50 rounded border text-sm">
                <pre className="whitespace-pre-wrap font-mono text-xs">
                  {selectedNode.adv_prompt || 'No adversarial prompt available'}
                </pre>
              </div>
            </div>

            <div>
              <h4 className="font-semibold text-sm mb-2">Target Response</h4>
              <div className="p-3 bg-gray-50 rounded border text-sm">
                <pre className="whitespace-pre-wrap font-mono text-xs">
                  {selectedNode.target_response || 'No target response available'}
                </pre>
              </div>
            </div>

            {selectedNode.improvement && (
              <div>
                <h4 className="font-semibold text-sm mb-2">Improvement</h4>
                <p className="text-sm text-muted-foreground">{selectedNode.improvement}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}