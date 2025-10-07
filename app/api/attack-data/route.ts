import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET(request: NextRequest) {
  try {
    // Path to attack_data.json in parent directory (same level as router)
    const attackDataPath = path.resolve(process.cwd(), 'data', 'attack_data.json');
    
    if (!fs.existsSync(attackDataPath)) {
      return NextResponse.json({
        success: true,
        data: [],
        count: 0,
        message: 'No attack data file found yet'
      });
    }
    
    const content = fs.readFileSync(attackDataPath, 'utf8').trim();
    
    if (!content) {
      return NextResponse.json({
        success: true,
        data: [],
        count: 0,
        message: 'Attack data file is empty'
      });
    }
    
    // Parse JSON objects - handle different formats
    let attackData = [];
    
    // Try parsing as proper JSON array first
    if (content.startsWith('[') && content.endsWith(']')) {
      try {
        attackData = JSON.parse(content);
      } catch (error) {
        // Fall through to other parsing methods
      }
    }
    
    // If that didn't work, try wrapping in array brackets
    if (attackData.length === 0) {
      try {
        const wrappedContent = '[' + content + ']';
        attackData = JSON.parse(wrappedContent);
      } catch (error) {
        // Parse individual JSON objects line by line
        const objects = content.split('},\n{');
        
        for (let i = 0; i < objects.length; i++) {
          let objStr = objects[i];
          
          // Add back the braces that were removed by split
          if (i > 0) {
            objStr = '{' + objStr;
          }
          if (i < objects.length - 1) {
            objStr = objStr + '}';
          }
          
          try {
            objStr = objStr.trim().replace(/,$/, '');
            if (objStr) {
              const obj = JSON.parse(objStr);
              // Ensure we have the required fields
              if (obj.adv_prompt && obj.target_response && obj.score !== undefined && 
                  obj.self_id !== undefined && obj.parent_id !== undefined) {
                attackData.push(obj);
              }
            }
          } catch (parseError) {
            continue;
          }
        }
      }
    }
    
    return NextResponse.json({
      success: true,
      data: attackData,
      count: attackData.length
    });
    
  } catch (error) {
    console.error('Error in attack-data API:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'An error occurred'
    }, { status: 500 });
  }
}