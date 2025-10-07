/**
 * Fingerprinting utilities for MCP Collector
 * Creates unique identifiers for servers and processes to enable deduplication
 */

import crypto from 'crypto';
import { MCPServer, MCPProcess } from './collector-types';

export function generateServerFingerprint(server: MCPServer): string {
  const normalized = {
    transport: server.transport?.toLowerCase() || 'unknown',
    command: normalizeCommand(server.command),
    url: normalizeUrl(server.url),
    args: normalizeArgs(server.args || [])
  };
  
  const content = JSON.stringify(normalized, Object.keys(normalized).sort());
  return crypto.createHash('sha256').update(content).digest('hex').substring(0, 16);
}

export function generateProcessFingerprint(process: MCPProcess): string {
  const normalized = {
    command: normalizeCommand(extractMainCommand(process.cmd)),
    args: normalizeArgs(extractArgs(process.cmd))
  };
  
  const content = JSON.stringify(normalized, Object.keys(normalized).sort());
  return crypto.createHash('sha256').update(content).digest('hex').substring(0, 16);
}

export function normalizeCommand(cmd?: string): string {
  if (!cmd) return '';
  
  // Strip shell wrappers and extract core command
  const shellWrapperPatterns = [
    /^(bash|sh|zsh|fish)\s+(-[lc]\s+)?"?(.+?)"?$/,
    /^(powershell|pwsh)\s+(-Command\s+)?"?(.+?)"?$/,
    /^(cmd|cmd\.exe)\s+(\/c\s+)?"?(.+?)"?$/
  ];
  
  for (const pattern of shellWrapperPatterns) {
    const match = cmd.match(pattern);
    if (match) {
      cmd = match[3];
      break;
    }
  }
  
  // Normalize common variations
  return cmd
    .trim()
    .replace(/\s+/g, ' ') // Normalize whitespace
    .replace(/^(\.\/|\.\\)/, '') // Remove relative path prefixes
    .toLowerCase();
}

export function normalizeUrl(url?: string): string {
  if (!url) return '';
  
  try {
    const parsed = new URL(url);
    // Keep protocol, host, and pathname, but strip query parameters and fragments
    return `${parsed.protocol}//${parsed.host}${parsed.pathname}`.toLowerCase();
  } catch {
    // If URL parsing fails, just normalize the string
    return url.toLowerCase().split('?')[0].split('#')[0];
  }
}

export function normalizeArgs(args: string[]): string[] {
  return args
    .filter(arg => arg && arg.trim()) // Remove empty args
    .map(arg => {
      // Normalize common argument patterns
      if (arg.startsWith('--') || arg.startsWith('-')) {
        return arg.toLowerCase();
      }
      // Keep paths and values as-is but trim
      return arg.trim();
    })
    .filter(arg => !isLikelyDynamicArg(arg)); // Remove dynamic arguments
}

function isLikelyDynamicArg(arg: string): boolean {
  // Remove arguments that are likely to change between runs
  const dynamicPatterns = [
    /^\d+$/, // Pure numbers (likely ports, PIDs)
    /^\/tmp\//, // Temp paths
    /^\/var\/folders\//, // macOS temp paths
    /^[A-Fa-f0-9]{8,}$/, // Hex IDs
    /^\d{4}-\d{2}-\d{2}/, // Dates
    /^[A-Za-z0-9+/]{20,}={0,2}$/ // Base64 (likely tokens)
  ];
  
  return dynamicPatterns.some(pattern => pattern.test(arg));
}

function extractMainCommand(cmdline: string): string {
  // Extract the main command from a full command line
  const parts = cmdline.trim().split(/\s+/);
  if (parts.length === 0) return '';
  
  // Handle common execution patterns
  if (parts[0] === 'npm' && parts[1] === 'exec') {
    return parts[2] || '';
  }
  if (parts[0] === 'npx') {
    return parts[1] || '';
  }
  if (parts[0] in ['uv', 'pip', 'pipx'] && parts[1] === 'run') {
    return parts[2] || '';
  }
  if (parts[0] === 'python' || parts[0] === 'python3') {
    return parts[1] || '';
  }
  if (parts[0] === 'node') {
    return parts[1] || '';
  }
  
  return parts[0];
}

function extractArgs(cmdline: string): string[] {
  // Extract arguments from a command line, excluding the main command
  const parts = cmdline.trim().split(/\s+/);
  
  // Handle common execution patterns
  if (parts[0] === 'npm' && parts[1] === 'exec') {
    return parts.slice(3);
  }
  if (parts[0] === 'npx') {
    return parts.slice(2);
  }
  if (parts[0] in ['uv', 'pip', 'pipx'] && parts[1] === 'run') {
    return parts.slice(3);
  }
  if (parts[0] === 'python' || parts[0] === 'python3') {
    return parts.slice(2);
  }
  if (parts[0] === 'node') {
    return parts.slice(2);
  }
  
  return parts.slice(1);
}

export function deduplicateServers(servers: MCPServer[]): MCPServer[] {
  const seen = new Set<string>();
  const deduplicated: MCPServer[] = [];
  
  for (const server of servers) {
    const fingerprint = generateServerFingerprint(server);
    if (!seen.has(fingerprint)) {
      seen.add(fingerprint);
      deduplicated.push({
        ...server,
        fingerprint
      });
    }
  }
  
  return deduplicated;
}

export function deduplicateProcesses(processes: MCPProcess[]): MCPProcess[] {
  const seen = new Map<string, MCPProcess>();
  
  for (const process of processes) {
    const fingerprint = generateProcessFingerprint(process);
    const existing = seen.get(fingerprint);
    
    if (!existing) {
      seen.set(fingerprint, {
        ...process,
        fingerprint
      });
    } else {
      // Update timestamps for existing process
      existing.first_seen = Math.min(existing.first_seen, process.first_seen);
      existing.last_seen = Math.max(existing.last_seen, process.last_seen);
    }
  }
  
  return Array.from(seen.values());
}
