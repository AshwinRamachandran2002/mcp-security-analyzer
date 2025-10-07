import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

interface AnalysisRequest {
  toolName: string;
  description: string;
  serverName: string;
  endpointId: string;
  arguments?: any;
}

const ANALYSIS_PROMPT = `You are a security analyst reviewing MCP (Model Context Protocol) tools for potential security risks.

Analyze the following tool and determine its BASIC CAPABILITIES (read/write tickers):

**Tool Information:**
- Name: {{TOOL_NAME}}
- Server: {{SERVER_NAME}}
- Description: {{DESCRIPTION}}
{{ARGUMENTS}}

Your task is to provide TWO simple tickers:

1. **Can Read**: Does this tool have the capability to READ/FETCH/RETRIEVE data?
   - YES if: tool reads files, fetches data from APIs, gets information, lists items, searches, queries databases, etc.
   - NO if: tool only writes/modifies data without reading

2. **Can Write**: Does this tool have the capability to WRITE/MODIFY/SEND data?
   - YES if: tool creates files, updates records, posts data, pushes changes, sends messages, deletes items, etc.
   - NO if: tool only reads data without modifying anything

**Important Guidelines:**
- Focus ONLY on the tool's technical capabilities, not on what data it accesses
- A tool can have BOTH read and write capabilities
- Base your decision on the tool name, description, and arguments
- Be literal - if it says "get", "read", "list", "fetch" → it can read
- Be literal - if it says "create", "update", "delete", "post", "push" → it can write
- When in doubt based on the description, mark as capable

Respond with ONLY a valid JSON object (no markdown, no extra text) in this exact format:
{
  "canRead": true/false,
  "canWrite": true/false,
  "reasoning": {
    "read": "Brief explanation (1 sentence) of why this tool can/cannot read",
    "write": "Brief explanation (1 sentence) of why this tool can/cannot write"
  }
}`;

export async function POST(request: NextRequest) {
  try {
    const body: AnalysisRequest = await request.json();
    const { toolName, description, serverName, endpointId, arguments: toolArgs } = body;

    // Build arguments string if provided
    let argsString = '';
    if (toolArgs && Object.keys(toolArgs).length > 0) {
      argsString = '\n- Arguments:\n';
      for (const [argName, argData] of Object.entries(toolArgs)) {
        const arg = argData as any;
        argsString += `  - ${argName} (${arg.type || 'unknown'}): ${arg.description || 'No description'}\n`;
      }
    }

    // Build the prompt
    const prompt = ANALYSIS_PROMPT
      .replace('{{TOOL_NAME}}', toolName)
      .replace('{{SERVER_NAME}}', serverName)
      .replace('{{DESCRIPTION}}', description || 'No description provided')
      .replace('{{ARGUMENTS}}', argsString);

    // Call Claude API with retry logic
    let response;
    let attempts = 0;
    const maxAttempts = 3;

    while (attempts < maxAttempts) {
      try {
        response = await anthropic.messages.create({
          model: 'claude-3-5-sonnet-20241022',
          max_tokens: 1024,
          temperature: 0.3,
          messages: [{
            role: 'user',
            content: prompt
          }]
        });
        break;
      } catch (error: any) {
        attempts++;
        if (attempts >= maxAttempts) {
          throw error;
        }
        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, 1000 * attempts));
      }
    }

    if (!response) {
      throw new Error('Failed to get response from Claude API');
    }

    // Extract the text content
    const textContent = response.content[0];
    if (textContent.type !== 'text') {
      throw new Error('Unexpected response format from Claude API');
    }

    let analysisText = textContent.text.trim();

    // Remove markdown code blocks if present
    if (analysisText.startsWith('```json')) {
      analysisText = analysisText.replace(/```json\n?/, '').replace(/\n?```$/, '');
    } else if (analysisText.startsWith('```')) {
      analysisText = analysisText.replace(/```\n?/, '').replace(/\n?```$/, '');
    }

    // Parse the JSON response
    let analysis;
    try {
      analysis = JSON.parse(analysisText);
    } catch (parseError) {
      console.error('Failed to parse Claude response:', analysisText);
      throw new Error('Invalid JSON response from Claude API');
    }

    // Validate the response structure
    if (
      typeof analysis.canRead !== 'boolean' ||
      typeof analysis.canWrite !== 'boolean' ||
      !analysis.reasoning
    ) {
      console.error('Invalid response structure:', analysis);
      throw new Error('Response missing required fields');
    }

    // Return the basic tickers (not full decisions)
    return NextResponse.json({
      success: true,
      tickers: {
        canRead: analysis.canRead,
        canWrite: analysis.canWrite,
        reasoning: {
          read: analysis.reasoning.read || 'No reasoning provided',
          write: analysis.reasoning.write || 'No reasoning provided'
        },
        generatedAt: new Date().toISOString(),
        generatedBy: 'llm' as const
      }
    });
  } catch (error: any) {
    console.error('Error generating analysis:', error);

    // Return fallback tickers on error (conservative - no capabilities)
    return NextResponse.json({
      success: false,
      error: error.message || 'Failed to generate analysis',
      tickers: {
        canRead: false,
        canWrite: false,
        reasoning: {
          read: 'LLM analysis failed - assuming no read capability',
          write: 'LLM analysis failed - assuming no write capability'
        },
        generatedAt: new Date().toISOString(),
        generatedBy: 'placeholder' as const
      }
    }, { status: 500 });
  }
}
