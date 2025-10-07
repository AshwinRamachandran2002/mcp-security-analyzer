import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

export async function GET(request: NextRequest) {
  try {
    // Try to read existing inventory file
    const inventoryPath = path.join(process.cwd(), 'mcp_inventory.json');
    const data = await fs.readFile(inventoryPath, 'utf-8');
    const inventory = JSON.parse(data);
    
    return NextResponse.json(inventory);
  } catch (error) {
    return NextResponse.json(
      { error: 'No inventory data available' },
      { status: 404 }
    );
  }
}
