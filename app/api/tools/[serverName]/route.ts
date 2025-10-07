import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

export async function GET(
  request: NextRequest,
  { params }: { params: { serverName: string } }
) {
  try {
    const serverName = params.serverName;
    const filePath = path.join(process.cwd(), 'data', 'discovered', `${serverName}_tools.json`);

    try {
      const fileContent = await fs.readFile(filePath, 'utf-8');
      const toolsData = JSON.parse(fileContent);

      return NextResponse.json(toolsData);
    } catch (error) {
      // File doesn't exist or can't be read
      return NextResponse.json({ error: `Tools not found for server: ${serverName}` }, { status: 404 });
    }
  } catch (error) {
    console.error('Error loading tools:', error);
    return NextResponse.json({ error: 'Failed to load tools' }, { status: 500 });
  }
}
