import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { listA, listB, listC, tapParams = {} } = body;
    
    if (!listA || !listB || !listC) {
      return NextResponse.json({
        success: false,
        error: 'Missing required function selections'
      }, { status: 400 });
    }

    // Default TAP parameters
    const {
      branchingFactor = 2,
      depth = 4,
      width = 4
    } = tapParams;

    // Path to the parent directory where tap.py is located
    const parentDir = path.resolve(process.cwd(), '..');
    const tapScriptPath = path.join(parentDir, 'tap.py');
    
    // Check if tap.py exists
    if (!fs.existsSync(tapScriptPath)) {
      return NextResponse.json({
        success: false,
        error: 'TAP script not found at expected location'
      }, { status: 500 });
    }

    return new Promise<NextResponse>((resolve) => {
      // Run TAP analysis in background
      const tapProcess = spawn('python', [
        tapScriptPath,
        '--depth', depth.toString(),
        '--branching-factor', branchingFactor.toString(), 
        '--width', width.toString(),
        '--n-streams', '1',
        '--function_a', listA.server, listA.name,
        '--function_b', listB.server, listB.name,
        '--function_c', listC.server, listC.name
      ], {
        cwd: parentDir,
        stdio: ['ignore', 'pipe', 'pipe']
      });

      let output = '';
      let errorOutput = '';

      tapProcess.stdout?.on('data', (data) => {
        output += data.toString();
      });

      tapProcess.stderr?.on('data', (data) => {
        errorOutput += data.toString();
      });

      tapProcess.on('close', (code) => {
        if (code === 0) {
          resolve(NextResponse.json({
            success: true,
            message: 'TAP analysis started successfully. Attack graph will update dynamically.',
            output: output.trim(),
            attackVector: `${listA.name} → ${listB.name} → ${listC.name}`
          }));
        } else {
          resolve(NextResponse.json({
            success: false,
            error: `TAP analysis failed with exit code ${code}`,
            details: errorOutput || output
          }, { status: 500 }));
        }
      });

      tapProcess.on('error', (error) => {
        resolve(NextResponse.json({
          success: false,
          error: 'Failed to start TAP process',
          details: error.message
        }, { status: 500 }));
      });

      // Set a timeout to prevent hanging
      setTimeout(() => {
        if (!tapProcess.killed) {
          tapProcess.kill();
          resolve(NextResponse.json({
            success: false,
            error: 'TAP analysis timed out'
          }, { status: 408 }));
        }
      }, 300000); // 5 minute timeout
    });

  } catch (error) {
    console.error('Error in generate-attacks API:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'An error occurred'
    }, { status: 500 });
  }
}