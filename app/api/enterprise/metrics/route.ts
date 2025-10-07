import { NextRequest, NextResponse } from 'next/server';
import { EnterpriseAggregator } from '@/lib/enterprise-aggregator';

export async function GET(request: NextRequest) {
  try {
    const aggregator = new EnterpriseAggregator();
    
    // Check if we have recent enterprise data (less than 5 minutes old)
    const existingInventory = await aggregator.getEnterpriseInventory();
    const now = Math.floor(Date.now() / 1000);
    
    if (existingInventory && (now - existingInventory.created_at) < 300) {
      return NextResponse.json(existingInventory);
    }
    
    // Generate fresh enterprise aggregation
    const enterpriseInventory = await aggregator.aggregateEnterpriseData();
    return NextResponse.json(enterpriseInventory);
  } catch (error) {
    console.error('Enterprise metrics failed:', error);
    return NextResponse.json(
      { error: 'Failed to get enterprise metrics' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { endpoint_id, hostname, ip_address, environment, business_unit, owner } = body;
    
    if (!endpoint_id || !hostname) {
      return NextResponse.json(
        { error: 'endpoint_id and hostname are required' },
        { status: 400 }
      );
    }
    
    const aggregator = new EnterpriseAggregator();
    await aggregator.registerEndpoint({
      endpoint_id,
      hostname,
      ip_address,
      environment: environment || 'development',
      business_unit: business_unit || 'default',
      owner: owner || 'unknown',
      registered_at: Math.floor(Date.now() / 1000),
      scan_frequency: 60, // 1 hour default
      enabled: true
    });
    
    return NextResponse.json({ success: true, message: 'Endpoint registered' });
  } catch (error) {
    console.error('Endpoint registration failed:', error);
    return NextResponse.json(
      { error: 'Failed to register endpoint' },
      { status: 500 }
    );
  }
}
