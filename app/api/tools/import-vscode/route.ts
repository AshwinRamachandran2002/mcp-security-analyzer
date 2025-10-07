import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

export async function POST(request: NextRequest) {
  try {
    const csvPath = path.join(process.cwd(), 'mcp_tools_with_servers.csv');
    
    // Read the CSV file
    const csvData = await fs.readFile(csvPath, 'utf-8');
    const lines = csvData.split('\n');
    const headers = lines[0].split(',');
    
    // Parse CSV rows
    const tools = [];
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      // Simple CSV parsing (handles quoted fields)
      const values = [];
      let current = '';
      let inQuotes = false;
      
      for (let j = 0; j < line.length; j++) {
        const char = line[j];
        if (char === '"' && (j === 0 || line[j-1] === ',')) {
          inQuotes = true;
        } else if (char === '"' && (j === line.length - 1 || line[j+1] === ',')) {
          inQuotes = false;
        } else if (char === ',' && !inQuotes) {
          values.push(current.replace(/^"|"$/g, '').replace(/""/g, '"'));
          current = '';
        } else {
          current += char;
        }
      }
      values.push(current.replace(/^"|"$/g, '').replace(/""/g, '"'));
      
      if (values.length === headers.length) {
        const tool: any = {};
        headers.forEach((header, index) => {
          tool[header] = values[index] || '';
        });
        tools.push(tool);
      }
    }
    
    // Group tools by server context
    const serverGroups: Record<string, any[]> = {};
    
    for (const tool of tools) {
      // Determine server name based on tool patterns and context
      let serverName = 'unknown';
      
      // Use db_key as primary identifier
      const dbKey = tool.db_key || '';
      const serverHint = tool.server_hint || '';
      const toolName = tool.tool_name || '';
      
      // All tools appear to be GitHub-related based on the extraction
      if (dbKey === 'mcpToolCache' && (toolName.includes('repository') || 
          toolName.includes('issue') || toolName.includes('pull') || 
          toolName.includes('github') || toolName.includes('search_'))) {
        serverName = 'github-remote';
      }
      
      if (!serverGroups[serverName]) {
        serverGroups[serverName] = [];
      }
      
      // Convert to our MCP tool format
      const mcpTool = {
        name: tool.tool_name,
        description: tool.tool_description,
        arguments: tool.tool_schema ? JSON.parse(tool.tool_schema).properties || {} : {},
        discovered: true,
        extraction_method: 'vscode_cache',
        db_source: tool.db_source,
        db_key: tool.db_key,
        server_hint: tool.server_hint,
        // Add security classification placeholders
        listA: { belongs: true, reasoning: 'Extracted from authenticated VS Code session' },
        listB: { belongs: true, reasoning: 'Can access private repository data' },
        listC: { belongs: true, reasoning: 'Sends data to external GitHub API' }
      };
      
      serverGroups[serverName].push(mcpTool);
    }
    
    // Save extracted tools for each server
    const results = [];
    for (const [serverName, serverTools] of Object.entries(serverGroups)) {
      const mcpToolsFormat = {
        [`${serverName}_extracted`]: {}
      };
      
      // Convert array to object with tool names as keys
      for (const tool of serverTools) {
        mcpToolsFormat[`${serverName}_extracted`][tool.name] = tool;
      }
      
      // Save to discovered tools directory
      const outputPath = path.join(process.cwd(), 'data', 'discovered', `${serverName}_tools_extracted.json`);
      await fs.writeFile(outputPath, JSON.stringify(mcpToolsFormat, null, 2));
      
      results.push({
        server: serverName,
        tool_count: serverTools.length,
        output_file: outputPath,
        extraction_method: 'vscode_cache'
      });
    }
    
    return NextResponse.json({
      success: true,
      message: 'VS Code extracted tools imported successfully',
      results: results,
      total_tools: tools.length,
      extraction_source: 'VS Code workspaceStorage state.vscdb'
    });
    
  } catch (error) {
    console.error('Failed to import VS Code extracted tools:', error);
    return NextResponse.json(
      { error: 'Failed to import extracted tools', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
