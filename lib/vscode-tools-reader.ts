/**
 * VSCode Tools Reader
 *
 * Reads VSCode workspace storage SQLite databases to determine which MCP tools
 * are enabled/disabled in the user's Copilot Chat settings.
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

const execAsync = promisify(exec);

export interface DisabledToolsData {
  disabledToolSets: string[];  // e.g., ["mcp.config.wf0.filesystem"]
  disabledTools: string[];     // e.g., ["mcp_github_create_branch", ...]
}

export interface ToolEnabledStatus {
  toolName: string;
  serverName: string;
  isEnabled: boolean;
  reason: string;
}

/**
 * Find the most recent VSCode workspace by modification time
 */
async function findMostRecentWorkspace(): Promise<string | null> {
  try {
    const workspaceStoragePath = path.join(
      os.homedir(),
      'Library/Application Support/Code/User/workspaceStorage'
    );

    // Check if directory exists
    try {
      await fs.access(workspaceStoragePath);
    } catch {
      return null;
    }

    // List all workspace directories with their modification times
    const entries = await fs.readdir(workspaceStoragePath, { withFileTypes: true });

    let mostRecent: { path: string; mtime: Date } | null = null;

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;

      const workspacePath = path.join(workspaceStoragePath, entry.name);
      const stateDbPath = path.join(workspacePath, 'state.vscdb');

      // Check if state.vscdb exists
      try {
        const stats = await fs.stat(stateDbPath);
        if (!mostRecent || stats.mtime > mostRecent.mtime) {
          mostRecent = {
            path: stateDbPath,
            mtime: stats.mtime
          };
        }
      } catch {
        // Skip if state.vscdb doesn't exist
        continue;
      }
    }

    return mostRecent?.path || null;
  } catch (error) {
    console.error('Error finding VSCode workspace:', error);
    return null;
  }
}

/**
 * Query SQLite database for disabled tools
 */
async function queryDisabledTools(dbPath: string): Promise<DisabledToolsData | null> {
  try {
    // Escape the path for shell
    const escapedPath = dbPath.replace(/'/g, "'\\''");

    const { stdout } = await execAsync(
      `sqlite3 '${escapedPath}' "SELECT value FROM ItemTable WHERE key = 'chat/selectedTools';"`
    );

    if (!stdout.trim()) {
      return { disabledToolSets: [], disabledTools: [] };
    }

    const data = JSON.parse(stdout.trim());
    return {
      disabledToolSets: data.disabledToolSets || [],
      disabledTools: data.disabledTools || []
    };
  } catch (error) {
    console.error('Error querying SQLite database:', error);
    return null;
  }
}

/**
 * Check if a specific tool is enabled
 */
export function isToolEnabled(
  toolName: string,
  serverName: string,
  disabledData: DisabledToolsData
): ToolEnabledStatus {
  // Check if entire server/toolset is disabled
  // Format: mcp.config.wf0.{serverName}
  const serverDisabled = disabledData.disabledToolSets.some(toolSet =>
    toolSet.includes(serverName)
  );

  if (serverDisabled) {
    return {
      toolName,
      serverName,
      isEnabled: false,
      reason: `Entire MCP server '${serverName}' is disabled in VSCode`
    };
  }

  // Check if individual tool is disabled
  // Format: mcp_{serverName}_{toolName}
  const mcpToolName = `mcp_${serverName}_${toolName}`;
  const toolDisabled = disabledData.disabledTools.includes(mcpToolName);

  if (toolDisabled) {
    return {
      toolName,
      serverName,
      isEnabled: false,
      reason: `Tool '${toolName}' is individually disabled in VSCode`
    };
  }

  // Tool is enabled
  return {
    toolName,
    serverName,
    isEnabled: true,
    reason: 'Tool is enabled in VSCode Copilot Chat'
  };
}

/**
 * Get disabled tools data from most recent VSCode workspace
 */
export async function getDisabledToolsData(): Promise<DisabledToolsData | null> {
  try {
    const workspacePath = await findMostRecentWorkspace();

    if (!workspacePath) {
      console.warn('Could not find VSCode workspace storage');
      return null;
    }

    console.log('Reading from workspace:', workspacePath);
    const disabledData = await queryDisabledTools(workspacePath);

    if (disabledData) {
      console.log(`Found ${disabledData.disabledToolSets.length} disabled tool sets`);
      console.log(`Found ${disabledData.disabledTools.length} disabled tools`);
    }

    return disabledData;
  } catch (error) {
    console.error('Error getting disabled tools data:', error);
    return null;
  }
}

/**
 * Cache for disabled tools data (refresh every 5 minutes)
 */
let cachedDisabledData: { data: DisabledToolsData | null; timestamp: number } | null = null;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export async function getCachedDisabledToolsData(): Promise<DisabledToolsData | null> {
  const now = Date.now();

  if (cachedDisabledData && (now - cachedDisabledData.timestamp) < CACHE_DURATION) {
    return cachedDisabledData.data;
  }

  const data = await getDisabledToolsData();
  cachedDisabledData = {
    data,
    timestamp: now
  };

  return data;
}
