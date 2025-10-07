import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

const DECISIONS_FILE = path.join(process.cwd(), 'data', 'analysis', 'tool_decisions.json');

interface ToolTickers {
  // Basic LLM tickers
  canRead: boolean;
  canWrite: boolean;
  reasoning: {
    read: string;
    write: string;
  };
  generatedAt: string;
  generatedBy: 'llm' | 'manual' | 'placeholder';
}

interface ToolDecision {
  // Final analysis decisions (computed from tickers + logic)
  isActive: boolean;
  canReadPrivate: boolean;
  canReadPublic: boolean;
  canWritePublic: boolean;

  // Source tickers used to compute decisions
  tickers: ToolTickers;

  // Combined reasoning for final decisions
  reasoning: {
    active: string;
    readPrivate: string;
    readPublic: string;
    writePublic: string;
  };

  computedAt: string;
}

interface DecisionsData {
  version: string;
  last_updated: string | null;
  decisions: {
    [key: string]: ToolDecision; // key format: "endpoint_id|server_name|tool_name"
  };
}

// GET - Load all decisions
export async function GET(request: NextRequest) {
  try {
    const fileContent = await fs.readFile(DECISIONS_FILE, 'utf-8');
    const data: DecisionsData = JSON.parse(fileContent);

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error reading decisions file:', error);
    // Return empty decisions if file doesn't exist or is corrupted
    return NextResponse.json({
      version: '1.0',
      last_updated: null,
      decisions: {}
    });
  }
}

// POST - Save decisions
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { decisions, merge = true } = body;

    let currentData: DecisionsData;

    // Read existing data
    try {
      const fileContent = await fs.readFile(DECISIONS_FILE, 'utf-8');
      currentData = JSON.parse(fileContent);
    } catch (error) {
      // If file doesn't exist, start fresh
      currentData = {
        version: '1.0',
        last_updated: null,
        decisions: {}
      };
    }

    // Merge or replace decisions
    if (merge) {
      currentData.decisions = {
        ...currentData.decisions,
        ...decisions
      };
    } else {
      currentData.decisions = decisions;
    }

    currentData.last_updated = new Date().toISOString();

    // Write back to file
    await fs.writeFile(DECISIONS_FILE, JSON.stringify(currentData, null, 2), 'utf-8');

    return NextResponse.json({
      success: true,
      message: 'Decisions saved successfully',
      count: Object.keys(currentData.decisions).length
    });
  } catch (error) {
    console.error('Error saving decisions:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to save decisions'
    }, { status: 500 });
  }
}
