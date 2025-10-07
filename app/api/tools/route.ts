import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const serverName = searchParams.get('server');
  
  if (!serverName) {
    return NextResponse.json({ error: 'Server name required' }, { status: 400 });
  }
  
  try {
    // First try to load from discovered tools
    const discoveredPath = path.join(process.cwd(), 'data', 'discovered', `${serverName}_tools.json`);
    
    try {
      const discoveredData = await fs.readFile(discoveredPath, 'utf-8');
      const tools = JSON.parse(discoveredData);
      
      return NextResponse.json({
        server: serverName,
        tools: tools,
        source: 'discovered',
        tool_count: Object.values(tools).reduce((sum: number, serverTools: any) => 
          sum + Object.keys(serverTools).length, 0
        )
      });
    } catch {
      // No discovered tools found - no static fallback
      console.log(`❌ No discovered tools found for ${serverName}`);
    }
    
    // If no tools found anywhere, return empty
    return NextResponse.json({
      server: serverName,
      tools: {},
      source: 'none',
      tool_count: 0
    });
    
  } catch (error) {
    console.error(`Failed to load tools for ${serverName}:`, error);
    return NextResponse.json(
      { error: 'Failed to load tools', server: serverName },
      { status: 500 }
    );
  }
}
