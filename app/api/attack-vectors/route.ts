import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { generateAttackVectors, getAttackVectorStats, type AttackVector } from '@/lib/attack-vector-generator';

const DECISIONS_FILE = path.join(process.cwd(), 'data', 'analysis', 'tool_decisions.json');
const ATTACK_VECTORS_FILE = path.join(process.cwd(), 'data', 'analysis', 'attack_vectors.json');

// GET - Generate and return attack vectors
export async function GET(request: NextRequest) {
  try {
    console.log('[API /attack-vectors] Starting...');

    // Check if we have cached vectors
    let cachedVectors: AttackVector[] | null = null;
    let needsRegeneration = false;

    try {
      const attackVectorsContent = await fs.readFile(ATTACK_VECTORS_FILE, 'utf-8');
      const attackVectorsData = JSON.parse(attackVectorsContent);

      if (attackVectorsData.vectors && Array.isArray(attackVectorsData.vectors)) {
        cachedVectors = attackVectorsData.vectors;
        console.log(`[API /attack-vectors] Found ${cachedVectors.length} cached vectors`);
      }
    } catch (error) {
      console.log('[API /attack-vectors] No cached vectors found, will generate');
      needsRegeneration = true;
    }

    // Load tool decisions
    const decisionsContent = await fs.readFile(DECISIONS_FILE, 'utf-8');
    const decisionsData = JSON.parse(decisionsContent);

    // Transform decisions into array format for generator
    const tools: any[] = [];
    Object.entries(decisionsData.decisions || {}).forEach(([key, decision]: [string, any]) => {
      // Key format: "endpoint_id|server_name|tool_name"
      const [endpointId, serverName, toolName] = key.split('|');

      tools.push({
        endpointId,
        serverName,
        toolName,
        endpoint: decision.endpoint || endpointId,
        description: decision.description || '',
        isActive: decision.isActive,
        canReadPrivate: decision.canReadPrivate,
        canReadPublic: decision.canReadPublic,
        canWritePublic: decision.canWritePublic
      });
    });

    let vectors: AttackVector[];

    // Only regenerate if no cache or if requested
    if (!cachedVectors || needsRegeneration || request.nextUrl.searchParams.get('regenerate') === 'true') {
      console.log('[API /attack-vectors] Generating attack vectors...');
      vectors = generateAttackVectors(tools);

      // Cache the generated vectors
      try {
        const attackVectorsContent = await fs.readFile(ATTACK_VECTORS_FILE, 'utf-8');
        const attackVectorsData = JSON.parse(attackVectorsContent);
        attackVectorsData.vectors = vectors;
        attackVectorsData.generatedAt = new Date().toISOString();
        await fs.writeFile(ATTACK_VECTORS_FILE, JSON.stringify(attackVectorsData, null, 2), 'utf-8');
        console.log(`[API /attack-vectors] Cached ${vectors.length} vectors to file`);
      } catch (error) {
        // Create new file
        await fs.writeFile(ATTACK_VECTORS_FILE, JSON.stringify({
          version: '1.0',
          generatedAt: new Date().toISOString(),
          vectors: vectors,
          closedVectors: {}
        }, null, 2), 'utf-8');
        console.log(`[API /attack-vectors] Created new cache file with ${vectors.length} vectors`);
      }
    } else {
      console.log('[API /attack-vectors] Using cached vectors');
      vectors = cachedVectors;
    }

    const stats = getAttackVectorStats(vectors);

    // Load closed vectors status
    let closedVectors: Record<string, any> = {};
    try {
      const attackVectorsContent = await fs.readFile(ATTACK_VECTORS_FILE, 'utf-8');
      const attackVectorsData = JSON.parse(attackVectorsContent);
      closedVectors = attackVectorsData.closedVectors || {};
    } catch (error) {
      // File doesn't exist yet, that's okay
    }

    // Merge closed status into vectors
    const vectorsWithStatus = vectors.map(vector => {
      const closedInfo = closedVectors[vector.id];
      if (closedInfo) {
        return {
          ...vector,
          status: 'closed' as const,
          closedAt: closedInfo.closedAt,
          closedBy: closedInfo.closedBy
        };
      }
      return vector;
    });

    // Apply filters
    let filteredVectors = vectorsWithStatus;

    const severityFilter = request.nextUrl.searchParams.get('severity');
    const statusFilter = request.nextUrl.searchParams.get('status');
    const endpointFilter = request.nextUrl.searchParams.get('endpoint');

    if (severityFilter && severityFilter !== 'all') {
      filteredVectors = filteredVectors.filter(v => v.severity.toLowerCase() === severityFilter.toLowerCase());
    }

    if (statusFilter && statusFilter !== 'all') {
      filteredVectors = filteredVectors.filter(v => v.status === statusFilter);
    }

    if (endpointFilter && endpointFilter !== 'all') {
      filteredVectors = filteredVectors.filter(v => v.endpointName === endpointFilter);
    }

    // Pagination support
    const page = parseInt(request.nextUrl.searchParams.get('page') || '1');
    const pageSize = parseInt(request.nextUrl.searchParams.get('pageSize') || '50');
    const startIndex = (page - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    const paginatedVectors = filteredVectors.slice(startIndex, endIndex);
    const totalPages = Math.ceil(filteredVectors.length / pageSize);

    console.log(`[API /attack-vectors] Returning page ${page}/${totalPages} (${paginatedVectors.length} vectors, ${filteredVectors.length} after filters)`);

    return NextResponse.json({
      success: true,
      vectors: paginatedVectors,
      pagination: {
        page,
        pageSize,
        totalVectors: filteredVectors.length,
        totalPages,
        hasMore: page < totalPages
      },
      stats
    });
  } catch (error) {
    console.error('Error generating attack vectors:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to generate attack vectors',
      vectors: [],
      stats: {
        total: 0,
        bySeverity: { critical: 0, high: 0, medium: 0, low: 0 },
        byStatus: { open: 0, closed: 0 },
        byEndpoint: {}
      }
    });
  }
}

// POST - Close/reopen an attack vector
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { vectorId, action, closedBy } = body;

    if (!vectorId || !action) {
      return NextResponse.json({
        success: false,
        error: 'Missing vectorId or action'
      }, { status: 400 });
    }

    // Load existing closed vectors
    let attackVectorsData: any = {
      version: '1.0',
      closedVectors: {}
    };

    try {
      const content = await fs.readFile(ATTACK_VECTORS_FILE, 'utf-8');
      attackVectorsData = JSON.parse(content);
    } catch (error) {
      // File doesn't exist, will create it
    }

    // Update status
    if (action === 'close') {
      attackVectorsData.closedVectors[vectorId] = {
        closedAt: new Date().toISOString(),
        closedBy: closedBy || 'unknown'
      };
    } else if (action === 'reopen') {
      delete attackVectorsData.closedVectors[vectorId];
    } else {
      return NextResponse.json({
        success: false,
        error: 'Invalid action. Must be "close" or "reopen"'
      }, { status: 400 });
    }

    // Save back to file
    await fs.writeFile(ATTACK_VECTORS_FILE, JSON.stringify(attackVectorsData, null, 2), 'utf-8');

    return NextResponse.json({
      success: true,
      message: `Attack vector ${action}d successfully`
    });
  } catch (error) {
    console.error('Error updating attack vector:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to update attack vector'
    }, { status: 500 });
  }
}
