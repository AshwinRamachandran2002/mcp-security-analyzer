import { NextRequest, NextResponse } from 'next/server';
import { getCachedDisabledToolsData } from '@/lib/vscode-tools-reader';

// GET - Load VSCode disabled tools data
export async function GET(request: NextRequest) {
  try {
    const disabledData = await getCachedDisabledToolsData();

    if (!disabledData) {
      return NextResponse.json({
        success: false,
        error: 'Could not load VSCode workspace data',
        disabledData: null
      });
    }

    return NextResponse.json({
      success: true,
      disabledData,
      message: `Found ${disabledData.disabledToolSets.length} disabled tool sets and ${disabledData.disabledTools.length} disabled tools`
    });
  } catch (error) {
    console.error('Error loading VSCode disabled data:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to load VSCode workspace data',
      disabledData: null
    }, { status: 500 });
  }
}
