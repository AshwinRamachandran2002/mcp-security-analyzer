"use client";

import { useState, Fragment, useRef, useEffect } from "react";
import * as d3 from "d3";
import { 
  Card, 
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription 
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  User, 
  UserCog, 
  Shield, 
  Database, 
  LucideProps,
  Code,
  Briefcase,
  PenTool,
  Eye,
  EyeOff
} from "lucide-react";
import Link from "next/link";

// Import the static data
import userPermissions from '../data/user_permissions.json';
import rolePermissions from '../data/role_permissions.json';

// For graph visualization
interface Node {
  id: string;
  name: string;
  type: 'user' | 'role' | 'permission' | 'repository';
  x?: number;
  y?: number;
}

interface Link {
  source: string;
  target: string;
  type: 'user-role' | 'role-repository' | 'repository-permission';
}

// Helper function to get role icon
const getRoleIcon = (role: string): React.ComponentType<LucideProps> => {
  switch (role) {
    case "Engineering": return Code;
    case "Sales": return Briefcase;
    case "Marketing": return PenTool;
    case "Product": return Database;
    case "Admin": return UserCog;
    default: return User;
  }
};

// Helper function to get permission color
const getPermissionColor = (permission: string): string => {
  switch (permission) {
    case "Read": return "#3b82f6"; // blue
    case "Write": return "#f59e0b"; // amber
    case "ReadWrite": return "#8b5cf6"; // purple
    case "Admin": return "#ef4444"; // red
    default: return "#6b7280"; // gray
  }
};

// Helper function to get role color
const getRoleColor = (role: string): string => {
  switch (role) {
    case "Engineering": return "#10b981"; // emerald
    case "Sales": return "#6366f1"; // indigo
    case "Marketing": return "#ec4899"; // pink
    case "Product": return "#8b5cf6"; // purple
    case "Admin": return "#f97316"; // orange
    default: return "#6b7280"; // gray
  }
};

export function UserPermissionsGraph() {
  const svgRef = useRef<SVGSVGElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  
  useEffect(() => {
    if (!svgRef.current) return;
    
    // Clear any existing visualizations
    d3.select(svgRef.current).selectAll("*").remove();
    
    // Prepare data for graph visualization
    const nodes: Node[] = [];
    const links: Link[] = [];
    
    // Add users as nodes
    userPermissions.users.forEach(user => {
      nodes.push({
        id: `user-${user.id}`,
        name: user.name,
        type: 'user'
      });
    });
    
    // Add unique roles as nodes
    const uniqueRoles = Array.from(new Set(Object.keys(rolePermissions.roles)));
    uniqueRoles.forEach(roleKey => {
      const role = (rolePermissions.roles as any)[roleKey];
      nodes.push({
        id: `role-${roleKey}`,
        name: role.name,
        type: 'role'
      });
    });
    
    // Add unique permissions as nodes
    const uniquePermissions = Array.from(new Set(['Read', 'Write', 'Admin']));
    uniquePermissions.forEach(permission => {
      nodes.push({
        id: `permission-${permission}`,
        name: permission,
        type: 'permission'
      });
    });
    
    // Add unique repositories as nodes
    const uniqueRepos = new Set<string>();
    Object.values(rolePermissions.roles).forEach((role: any) => {
      role.repository_permissions.forEach((perm: any) => {
        uniqueRepos.add(perm.repo_name);
      });
    });
    Array.from(uniqueRepos).forEach(repo => {
      nodes.push({
        id: `repo-${repo}`,
        name: repo,
        type: 'repository'
      });
    });
    
    // Create links between users and roles
    userPermissions.users.forEach(user => {
      user.roles.forEach(roleKey => {
        links.push({
          source: `user-${user.id}`,
          target: `role-${roleKey}`,
          type: 'user-role'
        });
      });
    });
    
    // Create links between roles and permissions, then permissions to repositories
    Object.entries(rolePermissions.roles).forEach(([roleKey, role]: [string, any]) => {
      role.repository_permissions.forEach((perm: any) => {
        // Link role to permission
        links.push({
          source: `role-${roleKey}`,
          target: `permission-${perm.access_type}`,
          type: 'role-repository'
        });
        
        // Link permission to repository
        links.push({
          source: `permission-${perm.access_type}`,
          target: `repo-${perm.repo_name}`,
          type: 'repository-permission'
        });
      });
    });
    
    // Filter nodes by type first
    const userNodes = nodes.filter(node => node.type === 'user');
    const roleNodes = nodes.filter(node => node.type === 'role');
    const permissionNodes = nodes.filter(node => node.type === 'permission');
    const repoNodes = nodes.filter(node => node.type === 'repository');
    
    // Set up dimensions with better responsive handling
    const containerWidth = svgRef.current.clientWidth;
    const containerHeight = svgRef.current.clientHeight;
    const width = Math.max(containerWidth, 1200); // Increased minimum width for better layout
    const height = Math.max(containerHeight, Math.max(userNodes.length, repoNodes.length) * 50 + 150); // Use container height
    
    // Create SVG container
    const svg = d3.select(svgRef.current)
      .attr("width", "100%")
      .attr("height", height)
      .attr("viewBox", `0 0 ${width} ${height}`)
      .attr("preserveAspectRatio", "xMidYMid meet");
      
    // Create tooltip
    const tooltip = d3.select(tooltipRef.current)
      .style("opacity", 0)
      .attr("class", "absolute bg-gray-900 text-white p-3 rounded-lg text-sm pointer-events-none z-50 shadow-lg border border-gray-700");
    
    // Define node positions in columns with better spacing for 4-column layout
    const columnPadding = 80;
    const columnWidth = (width - columnPadding * 2) / 4; // 4 equal columns
    const nodeSpacing = Math.max(40, (height - 200) / Math.max(userNodes.length, repoNodes.length)); // Dynamic spacing based on available height
    
    // Column 1: Users
    const userColumnX = columnPadding + columnWidth * 0.5;
    const userStartY = 120;
    userNodes.forEach((node, index) => {
      node.x = userColumnX;
      node.y = userStartY + (index * nodeSpacing);
    });
    
    // Column 2: Roles
    const roleColumnX = columnPadding + columnWidth * 1.5;
    const roleStartY = 120;
    roleNodes.forEach((node, index) => {
      node.x = roleColumnX;
      node.y = roleStartY + (index * nodeSpacing);
    });
    
    // Column 3: Permissions
    const permissionColumnX = columnPadding + columnWidth * 2.5;
    const permissionStartY = 120;
    permissionNodes.forEach((node, index) => {
      node.x = permissionColumnX;
      node.y = permissionStartY + (index * (nodeSpacing * 1.5)); // More spacing for fewer permission nodes
    });
    
    // Column 4: Repositories
    const repoColumnX = columnPadding + columnWidth * 3.5;
    const repoStartY = 120;
    repoNodes.forEach((node, index) => {
      node.x = repoColumnX;
      node.y = repoStartY + (index * (nodeSpacing * 0.85)); // Slightly tighter spacing for more repositories
    });
    
    // Draw column headers with better styling for 4-column layout
    const headerY = 60;
    const headers = [
      { text: "Users", x: userColumnX, icon: "👤" },
      { text: "Roles", x: roleColumnX, icon: "🏷️" },
      { text: "Permissions", x: permissionColumnX, icon: "🔐" },
      { text: "Repositories", x: repoColumnX, icon: "📁" }
    ];
    
    headers.forEach(header => {
      // Background for header
      svg.append("rect")
        .attr("x", header.x - 70)
        .attr("y", headerY - 25)
        .attr("width", 140)
        .attr("height", 35)
        .attr("rx", 8)
        .attr("fill", "#f8fafc")
        .attr("stroke", "#e2e8f0")
        .attr("stroke-width", 1);
      
      // Header text
      svg.append("text")
        .attr("x", header.x)
        .attr("y", headerY - 5)
        .attr("text-anchor", "middle")
        .attr("class", "font-bold text-sm fill-gray-700")
        .text(`${header.icon} ${header.text}`);
    });
    
    // Draw links as smooth curved paths
    const linkElements = svg.append("g")
      .selectAll("path")
      .data(links)
      .enter()
      .append("path")
      .attr("class", "link")
      .attr("stroke", (d) => {
        // Different colors for different link types
        if (d.type === 'user-role') return "#3b82f6"; // blue
        if (d.type === 'role-repository') return "#10b981"; // emerald
        if (d.type === 'repository-permission') return "#f59e0b"; // amber
        return "#d1d5db";
      })
      .attr("stroke-width", 1.5)
      .attr("fill", "none")
      .attr("opacity", 0.6)
      .attr("d", (d) => {
        const source = nodes.find(node => node.id === d.source);
        const target = nodes.find(node => node.id === d.target);
        if (!source || !target || !source.x || !source.y || !target.x || !target.y) return "";
        
        // Create straight lines for cleaner 4-column layout
        const sourceX = source.x + 60; // Right edge of source node
        const targetX = target.x - 60; // Left edge of target node
        
        return `M ${sourceX} ${source.y} L ${targetX} ${target.y}`;
      });
    
    
    // Draw nodes
    const nodeElements = svg.append("g")
      .selectAll("g")
      .data(nodes)
      .enter()
      .append("g")
      .attr("transform", d => `translate(${d.x || 0}, ${d.y || 0})`)
      .attr("class", "cursor-pointer")
      .on("mouseover", function(event, d) {
        // Highlight related links and nodes
        highlightRelatedNodesAndLinks(d.id);
        
        // Show tooltip
        tooltip.transition()
          .duration(200)
          .style("opacity", 1);
        
        tooltip.html(`<strong>${d.name}</strong>`)
          .style("left", (event.pageX + 10) + "px")
          .style("top", (event.pageY - 28) + "px");
      })
      .on("mouseout", function() {
        // Reset all elements to normal state
        d3.selectAll(".link")
          .attr("opacity", 0.6)
          .attr("stroke-width", 1.5)
          .style("filter", "none");
          
        d3.selectAll(".node-box")
          .attr("opacity", 1)
          .attr("stroke-width", 2)
          .style("filter", "drop-shadow(0 1px 2px rgba(0, 0, 0, 0.1))");
        
        // Hide tooltip
        tooltip.transition()
          .duration(300)
          .style("opacity", 0);
      })
      .on("click", (_, d) => {
        const newSelectedNode = selectedNode === d.id ? null : d.id;
        setSelectedNode(newSelectedNode);
        
        // Reset all nodes - remove black selection class
        d3.selectAll(".node-box")
          .classed("selected-node-black", false)
          .attr("stroke-width", 2)
          .attr("stroke", function(nodeData: any) {
            if (nodeData.type === 'user') return "#3b82f6"; // blue-500
            if (nodeData.type === 'role') return "#10b981"; // emerald-500
            if (nodeData.type === 'permission') return "#f59e0b"; // amber-500
            if (nodeData.type === 'repository') return "#64748b"; // slate-500
            return "#94a3b8"; // slate-400
          });
          
        // Apply black outline using CSS class
        if (newSelectedNode) {
          d3.selectAll(".node-box").filter(function(nodeData: any) {
            return nodeData.id === newSelectedNode;
          })
          .classed("selected-node-black", true);
        }
      });
    
    // Add improved node boxes with better styling
    nodeElements.append("rect")
      .attr("class", "node-box")
      .attr("x", -60)
      .attr("y", -18)
      .attr("width", 120)
      .attr("height", 36)
      .attr("rx", 8)
      .attr("ry", 8)
      .attr("fill", d => {
        if (d.type === 'user') return "#dbeafe"; // blue-100
        if (d.type === 'role') return "#dcfce7"; // green-100
        if (d.type === 'permission') return "#fef3c7"; // amber-100
        if (d.type === 'repository') return "#f1f5f9"; // slate-100
        return "#f8fafc"; // slate-50
      })
      .attr("stroke", d => {
        if (d.type === 'user') return "#3b82f6"; // blue-500
        if (d.type === 'role') return "#10b981"; // emerald-500
        if (d.type === 'permission') return "#f59e0b"; // amber-500
        if (d.type === 'repository') return "#64748b"; // slate-500
        return "#94a3b8"; // slate-400
      })
      .attr("stroke-width", 2)
      .style("filter", "drop-shadow(0 1px 2px rgba(0, 0, 0, 0.1))"); // subtle shadow
    
    // Add text inside the boxes with better formatting
    nodeElements.append("text")
      .attr("dy", 5)
      .attr("class", "text-sm font-semibold")
      .attr("fill", d => {
        if (d.type === 'user') return "#1e40af"; // blue-800
        if (d.type === 'role') return "#047857"; // emerald-800
        if (d.type === 'permission') return "#92400e"; // amber-800
        if (d.type === 'repository') return "#334155"; // slate-700
        return "#475569"; // slate-600
      })
      .text(d => {
        // Truncate long names
        if (d.name.length > 12) {
          return d.name.substring(0, 12) + "...";
        }
        return d.name;
      })
      .attr("text-anchor", "middle");
    
    // Function to highlight related nodes and links with improved visual feedback
    function highlightRelatedNodesAndLinks(nodeId: string) {
      // Reset all elements to dimmed state
      d3.selectAll(".link")
        .attr("opacity", 0.15)
        .attr("stroke-width", 1);
        
      d3.selectAll(".node-box")
        .attr("opacity", 0.3)
        .attr("stroke-width", 2);
      
      // Special handling for user nodes - trace through the full path
      if (nodeId.startsWith('user-')) {
        const userId = nodeId.replace('user-', '');
        const user = userPermissions.users.find(u => u.id === userId);
        
        if (user) {
          const relatedNodeIds = new Set<string>();
          const relatedLinkIds = new Set<string>();
          
          // Add the user node itself
          relatedNodeIds.add(nodeId);
          
          // For each role the user has
          user.roles.forEach(roleKey => {
            const roleNodeId = `role-${roleKey}`;
            relatedNodeIds.add(roleNodeId);
            
            // Add user-to-role link
            relatedLinkIds.add(`${nodeId}->${roleNodeId}`);
            
            // Get the role's permissions
            const role = (rolePermissions.roles as any)[roleKey];
            if (role) {
              const rolePermissions = new Set<string>();
              const roleRepositories = new Set<string>();
              
              role.repository_permissions.forEach((perm: any) => {
                const permissionNodeId = `permission-${perm.access_type}`;
                const repoNodeId = `repo-${perm.repo_name}`;
                
                rolePermissions.add(permissionNodeId);
                roleRepositories.add(repoNodeId);
                
                // Add role-to-permission link
                relatedLinkIds.add(`${roleNodeId}->${permissionNodeId}`);
                // Add permission-to-repository link
                relatedLinkIds.add(`${permissionNodeId}->${repoNodeId}`);
              });
              
              // Add all permissions and repositories for this role
              rolePermissions.forEach(id => relatedNodeIds.add(id));
              roleRepositories.forEach(id => relatedNodeIds.add(id));
            }
          });
          
          // Highlight all related nodes
          relatedNodeIds.forEach(id => {
            d3.selectAll(".node-box").filter(function(d: any) {
              return d.id === id;
            })
            .attr("opacity", id === nodeId ? 1 : 0.8)
            .attr("stroke-width", id === nodeId ? 4 : 3)
            .style("filter", id === nodeId ? "drop-shadow(0 2px 8px rgba(0, 0, 0, 0.3))" : "drop-shadow(0 1px 4px rgba(0, 0, 0, 0.2))");
          });
          
          // Highlight all related links
          d3.selectAll(".link").filter(function(d: any) {
            const linkId = `${d.source}->${d.target}`;
            return relatedLinkIds.has(linkId);
          })
          .attr("opacity", 0.9)
          .attr("stroke-width", 3)
          .style("filter", "drop-shadow(0 0 3px rgba(0, 0, 0, 0.3))");
        }
      } else {
        // For non-user nodes, use the original logic
        const relatedLinks = links.filter(link => 
          link.source === nodeId || link.target === nodeId
        );
        
        // Highlight connected links with original colors
        relatedLinks.forEach(link => {
          d3.selectAll(".link").filter(function(d: any) {
            return d.source === link.source && d.target === link.target;
          })
          .attr("opacity", 0.9)
          .attr("stroke-width", 3)
          .style("filter", "drop-shadow(0 0 3px rgba(0, 0, 0, 0.3))");
        });
        
        // Highlight the hovered node
        d3.selectAll(".node-box").filter(function(d: any) {
          return d.id === nodeId;
        })
        .attr("opacity", 1)
        .attr("stroke-width", 3)
        .style("filter", "drop-shadow(0 2px 8px rgba(0, 0, 0, 0.2))");
        
        // Highlight directly connected nodes
        const connectedNodeIds = new Set<string>();
        relatedLinks.forEach(link => {
          if (link.source === nodeId) connectedNodeIds.add(link.target);
          if (link.target === nodeId) connectedNodeIds.add(link.source);
        });
        
        connectedNodeIds.forEach(id => {
          d3.selectAll(".node-box").filter(function(d: any) {
            return d.id === id;
          })
          .attr("opacity", 0.8)
          .attr("stroke-width", 2.5);
        });
      }
    }
    
    // Apply persistent selected node styling
    if (selectedNode) {
      // Reset all nodes to default styling
      d3.selectAll(".node-box")
        .classed("selected-node-black", false)
        .attr("stroke-width", 2)
        .attr("stroke", function(nodeData: any) {
          if (nodeData.type === 'user') return "#3b82f6"; // blue-500
          if (nodeData.type === 'role') return "#10b981"; // emerald-500
          if (nodeData.type === 'permission') return "#f59e0b"; // amber-500
          if (nodeData.type === 'repository') return "#64748b"; // slate-500
          return "#94a3b8"; // slate-400
        });
        
      // Apply black outline using CSS class
      d3.selectAll(".node-box").filter(function(nodeData: any) {
        return nodeData.id === selectedNode;
      })
      .classed("selected-node-black", true);
    }
    
  }, [selectedNode]);
  
  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Resource Access Visibility</CardTitle>
        <CardDescription>
          User permissions across repositories and projects
        </CardDescription>
      </CardHeader>
      <CardContent className="relative">
        <style jsx>{`
          .selected-node-black {
            stroke: #000000 !important;
            stroke-width: 6px !important;
          }
        `}</style>
        <div ref={tooltipRef}></div>
        <div className="w-full h-[calc(100vh-300px)] min-h-[600px] border border-border rounded-lg p-4 bg-gradient-to-br from-slate-50 to-slate-100 overflow-hidden">
          <svg 
            ref={svgRef} 
            className="w-full h-full"
          ></svg>
        </div>
      </CardContent>
    </Card>
  );
}
