/**
 * Analysis Logic Layer
 *
 * This module combines basic read/write tickers from LLM with additional logic
 * to determine the 4 final analysis decisions:
 * 1. isActive - from VSCode MCP config files
 * 2. canReadPrivate - from read ticker + private data source detection
 * 3. canReadPublic - from read ticker + public/external source detection
 * 4. canWritePublic - from write ticker + public destination detection
 */

export interface ToolTickers {
  canRead: boolean;
  canWrite: boolean;
  reasoning: {
    read: string;
    write: string;
  };
  generatedAt: string;
  generatedBy: 'llm' | 'manual' | 'placeholder';
}

export interface ToolDecision {
  isActive: boolean;
  canReadPrivate: boolean;
  canReadPublic: boolean;
  canWritePublic: boolean;
  tickers: ToolTickers;
  reasoning: {
    active: string;
    readPrivate: string;
    readPublic: string;
    writePublic: string;
  };
  computedAt: string;
}

interface ToolInfo {
  toolName: string;
  serverName: string;
  description: string;
  arguments?: any;
}

/**
 * Detect if tool accesses private/sensitive data sources
 *
 * Currently assumes TRUE if tool can read (conservative security approach)
 * TODO: Implement proper detection logic later
 */
function detectPrivateDataAccess(tool: ToolInfo, canRead: boolean): { access: boolean; reasoning: string } {
  if (!canRead) {
    return {
      access: false,
      reasoning: 'Tool cannot read data (no read capability)'
    };
  }

  // Conservative default: assume all read tools can access private data
  return {
    access: true,
    reasoning: 'Assuming tool can access private data (conservative security default). Proper detection logic to be implemented.'
  };
}

/**
 * Detect if tool reads from public/external/untrusted sources
 *
 * Currently assumes TRUE if tool can read (conservative security approach)
 * TODO: Implement proper detection logic later
 */
function detectPublicDataAccess(tool: ToolInfo, canRead: boolean): { access: boolean; reasoning: string } {
  if (!canRead) {
    return {
      access: false,
      reasoning: 'Tool cannot read data (no read capability)'
    };
  }

  // Conservative default: assume all read tools can access public/external sources
  return {
    access: true,
    reasoning: 'Assuming tool can read from public/external sources (conservative security default). Proper detection logic to be implemented.'
  };
}

/**
 * Detect if tool writes to public/external destinations
 *
 * Currently assumes TRUE if tool can write (conservative security approach)
 * TODO: Implement proper detection logic later
 */
function detectPublicDataWrite(tool: ToolInfo, canWrite: boolean): { write: boolean; reasoning: string } {
  if (!canWrite) {
    return {
      write: false,
      reasoning: 'Tool cannot write data (no write capability)'
    };
  }

  // Conservative default: assume all write tools can write to public destinations
  return {
    write: true,
    reasoning: 'Assuming tool can write to public/external destinations (conservative security default). Proper detection logic to be implemented.'
  };
}

/**
 * Detect if tool is actively enabled
 *
 * This will be called with disabled tools data from VSCode
 */
function detectActiveStatus(
  tool: ToolInfo,
  disabledData?: { disabledToolSets: string[]; disabledTools: string[] }
): { active: boolean; reasoning: string } {
  // If no disabled data available, assume enabled
  if (!disabledData) {
    console.log(`[detectActiveStatus] No disabled data for ${tool.serverName}/${tool.toolName} - assuming enabled`);
    return {
      active: true,
      reasoning: 'VSCode disabled tools data not available - assuming tool is enabled'
    };
  }

  // Check if entire server is disabled
  // Format in VSCode: "mcp.config.wf0.{serverName}"
  const serverDisabled = disabledData.disabledToolSets.some(toolSet =>
    toolSet.toLowerCase().includes(tool.serverName.toLowerCase())
  );

  if (serverDisabled) {
    console.log(`[detectActiveStatus] Server ${tool.serverName} is DISABLED (entire toolset)`);
    return {
      active: false,
      reasoning: `Entire MCP server '${tool.serverName}' is disabled in VSCode Copilot Chat settings`
    };
  }

  // Check if individual tool is disabled
  // Format in VSCode: "mcp_{serverName}_{toolName}"
  const mcpToolName = `mcp_${tool.serverName}_${tool.toolName}`;
  const toolDisabled = disabledData.disabledTools.some(disabledTool =>
    disabledTool.toLowerCase() === mcpToolName.toLowerCase()
  );

  console.log(`[detectActiveStatus] ${tool.serverName}/${tool.toolName} - checking ${mcpToolName} - disabled: ${toolDisabled}`);

  if (toolDisabled) {
    return {
      active: false,
      reasoning: `Tool '${tool.toolName}' is individually disabled in VSCode Copilot Chat settings`
    };
  }

  // Tool is enabled
  return {
    active: true,
    reasoning: 'Tool is enabled in VSCode Copilot Chat settings'
  };
}

/**
 * Compute final analysis decisions from tickers
 */
export function computeDecisions(
  tickers: ToolTickers,
  tool: ToolInfo,
  disabledData?: { disabledToolSets: string[]; disabledTools: string[] }
): ToolDecision {
  // Use tickers + logic to determine final decisions
  const privateData = detectPrivateDataAccess(tool, tickers.canRead);
  const publicData = detectPublicDataAccess(tool, tickers.canRead);
  const publicWrite = detectPublicDataWrite(tool, tickers.canWrite);
  const activeStatus = detectActiveStatus(tool, disabledData);

  return {
    isActive: activeStatus.active,
    canReadPrivate: privateData.access,
    canReadPublic: publicData.access,
    canWritePublic: publicWrite.write,
    tickers: tickers,
    reasoning: {
      active: activeStatus.reasoning,
      readPrivate: privateData.reasoning,
      readPublic: publicData.reasoning,
      writePublic: publicWrite.reasoning
    },
    computedAt: new Date().toISOString()
  };
}

/**
 * Generate placeholder tickers for tools not yet analyzed
 */
export function generatePlaceholderTickers(tool: ToolInfo): ToolTickers {
  // Simple keyword-based placeholder
  const toolName = tool.toolName.toLowerCase();

  const readKeywords = ['get', 'read', 'list', 'search', 'fetch', 'query', 'find'];
  const writeKeywords = ['create', 'write', 'update', 'delete', 'post', 'push', 'set', 'remove'];

  const canRead = readKeywords.some(keyword => toolName.includes(keyword));
  const canWrite = writeKeywords.some(keyword => toolName.includes(keyword));

  return {
    canRead,
    canWrite,
    reasoning: {
      read: canRead
        ? "Placeholder: Tool name suggests read capability. Click 'Regenerate' for LLM analysis."
        : "Placeholder: Tool name doesn't suggest read capability. Click 'Regenerate' for LLM analysis.",
      write: canWrite
        ? "Placeholder: Tool name suggests write capability. Click 'Regenerate' for LLM analysis."
        : "Placeholder: Tool name doesn't suggest write capability. Click 'Regenerate' for LLM analysis."
    },
    generatedAt: new Date().toISOString(),
    generatedBy: 'placeholder'
  };
}
