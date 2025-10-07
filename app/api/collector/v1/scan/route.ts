import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import crypto from 'crypto';

// Import the main collector function
const execAsync = promisify(exec);

export async function POST(request: NextRequest) {
  try {
    const startTime = Date.now();
    
    // Generate scan ID
    const scanId = crypto.randomUUID();
    
    // Import and run the main collector (avoiding circular imports)
    const { runCollector } = await import('../../scan/route');
    const result = await runCollector();
    
    // Add versioned metadata
    const versionedResult = {
      ...result,
      schema_version: "2.0" as const,
      collector_version: "2.0.0",
      scan_id: scanId,
    };
    
    return NextResponse.json(versionedResult);
  } catch (error) {
    console.error('V1 Collector scan failed:', error);
    return NextResponse.json(
      { 
        error: 'Failed to run collector scan',
        schema_version: "2.0",
        collector_version: "2.0.0",
        scan_id: crypto.randomUUID(),
        timestamp: Date.now()
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const scanId = url.searchParams.get('scan_id');
    
    // Try to read existing inventory file
    const inventoryPath = path.join(process.cwd(), 'mcp_inventory.json');
    const data = await fs.readFile(inventoryPath, 'utf-8');
    const inventory = JSON.parse(data);
    
    // Filter by scan_id if provided
    if (scanId && inventory.scan_id !== scanId) {
      return NextResponse.json(
        { 
          error: 'Scan ID not found',
          schema_version: "2.0",
          collector_version: "2.0.0"
        },
        { status: 404 }
      );
    }
    
    return NextResponse.json(inventory);
  } catch (error) {
    return NextResponse.json(
      { 
        error: 'No inventory data available',
        schema_version: "2.0",
        collector_version: "2.0.0"
      },
      { status: 404 }
    );
  }
}
