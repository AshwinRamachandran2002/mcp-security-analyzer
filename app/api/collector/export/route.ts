import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { 
  exportFindingsToCSV, 
  exportInventoryToJSON, 
  exportFindingsToJSON,
  exportMetricsToCSV,
  generateExecutiveSummary,
  exportSanitizedInventory,
  EXPORT_FORMATS
} from '@/lib/export-utils';
import { MCPInventoryV2 } from '@/lib/collector-types';

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const format = url.searchParams.get('format') || 'json';
    const type = url.searchParams.get('type') || 'inventory';
    const sanitized = url.searchParams.get('sanitized') === 'true';
    
    // Read inventory file
    const inventoryPath = path.join(process.cwd(), 'mcp_inventory.json');
    const data = await fs.readFile(inventoryPath, 'utf-8');
    let inventory: MCPInventoryV2 = JSON.parse(data);
    
    // Sanitize if requested
    if (sanitized) {
      inventory = exportSanitizedInventory(inventory);
    }
    
    let content: string;
    let contentType: string;
    let filename: string;
    
    const timestamp = new Date().toISOString().split('T')[0];
    
    switch (type) {
      case 'findings':
        switch (format) {
          case EXPORT_FORMATS.CSV:
            content = exportFindingsToCSV(inventory.findings);
            contentType = 'text/csv';
            filename = `mcp-findings-${timestamp}.csv`;
            break;
          case EXPORT_FORMATS.JSON:
            content = exportFindingsToJSON(inventory.findings, true);
            contentType = 'application/json';
            filename = `mcp-findings-${timestamp}.json`;
            break;
          default:
            throw new Error('Unsupported format for findings export');
        }
        break;
        
      case 'metrics':
        switch (format) {
          case EXPORT_FORMATS.CSV:
            content = exportMetricsToCSV(inventory.metrics);
            contentType = 'text/csv';
            filename = `mcp-metrics-${timestamp}.csv`;
            break;
          case EXPORT_FORMATS.JSON:
            content = JSON.stringify(inventory.metrics, null, 2);
            contentType = 'application/json';
            filename = `mcp-metrics-${timestamp}.json`;
            break;
          default:
            throw new Error('Unsupported format for metrics export');
        }
        break;
        
      case 'summary':
        content = generateExecutiveSummary(inventory);
        contentType = 'text/markdown';
        filename = `mcp-summary-${timestamp}.md`;
        break;
        
      case 'inventory':
      default:
        switch (format) {
          case EXPORT_FORMATS.JSON:
            content = exportInventoryToJSON(inventory, true);
            contentType = 'application/json';
            filename = `mcp-inventory-${timestamp}.json`;
            break;
          default:
            throw new Error('Unsupported format for inventory export');
        }
        break;
    }
    
    return new NextResponse(content, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-cache'
      }
    });
    
  } catch (error) {
    console.error('Export failed:', error);
    return NextResponse.json(
      { error: 'Export failed', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
