/**
 * Git context utilities for MCP Collector
 * Extracts repository information and ownership context
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import { RepoContext, UserContext } from './collector-types';

const execAsync = promisify(exec);

export async function getRepoContext(configPath: string): Promise<RepoContext | null> {
  try {
    const gitRoot = await findGitRoot(path.dirname(configPath));
    if (!gitRoot) return null;
    
    const [remoteInfo, branchInfo] = await Promise.all([
      getRemoteInfo(gitRoot),
      getBranchInfo(gitRoot)
    ]);
    
    if (!remoteInfo) return null;
    
    return {
      name: extractRepoName(remoteInfo.url),
      branch: branchInfo.branch,
      owner: extractOwner(remoteInfo.url),
      remote_url: sanitizeRemoteUrl(remoteInfo.url)
    };
  } catch (error) {
    console.error('Failed to get repo context:', error);
    return null;
  }
}

export async function getUserContext(): Promise<UserContext> {
  const context: UserContext = {
    os_user: process.env.USER || process.env.USERNAME || 'unknown'
  };
  
  // Try to get git email
  try {
    const { stdout } = await execAsync('git config --global user.email', { timeout: 5000 });
    context.git_email = stdout.trim();
  } catch {
    // Git email not available
  }
  
  // Try to get system email (macOS/Linux)
  try {
    if (process.platform === 'darwin') {
      const { stdout } = await execAsync('dscl . -read /Users/$(whoami) RealName', { timeout: 5000 });
      const match = stdout.match(/RealName:\s*(.+)/);
      if (match) {
        // This is just the real name, not email, but it's context
      }
    }
  } catch {
    // System email not available
  }
  
  return context;
}

async function findGitRoot(startPath: string): Promise<string | null> {
  let currentPath = path.resolve(startPath);
  const root = path.parse(currentPath).root;
  
  while (currentPath !== root) {
    try {
      const gitPath = path.join(currentPath, '.git');
      const stats = await fs.stat(gitPath);
      if (stats.isDirectory() || stats.isFile()) {
        return currentPath;
      }
    } catch {
      // .git not found, continue upward
    }
    
    currentPath = path.dirname(currentPath);
  }
  
  return null;
}

async function getRemoteInfo(gitRoot: string): Promise<{ url: string } | null> {
  try {
    // Try git config first
    const { stdout } = await execAsync('git config --get remote.origin.url', { 
      cwd: gitRoot,
      timeout: 5000 
    });
    return { url: stdout.trim() };
  } catch {
    // Try reading .git/config directly
    try {
      const configPath = path.join(gitRoot, '.git', 'config');
      const configContent = await fs.readFile(configPath, 'utf-8');
      const match = configContent.match(/\[remote "origin"\][\s\S]*?url\s*=\s*(.+)/);
      if (match) {
        return { url: match[1].trim() };
      }
    } catch {
      // Config file not readable
    }
  }
  
  return null;
}

async function getBranchInfo(gitRoot: string): Promise<{ branch: string }> {
  try {
    // Try git command first
    const { stdout } = await execAsync('git branch --show-current', { 
      cwd: gitRoot,
      timeout: 5000 
    });
    const branch = stdout.trim();
    if (branch) {
      return { branch };
    }
  } catch {
    // Git command failed
  }
  
  // Try reading HEAD file
  try {
    const headPath = path.join(gitRoot, '.git', 'HEAD');
    const headContent = await fs.readFile(headPath, 'utf-8');
    const match = headContent.match(/ref:\s*refs\/heads\/(.+)/);
    if (match) {
      return { branch: match[1].trim() };
    }
  } catch {
    // HEAD file not readable
  }
  
  return { branch: 'unknown' };
}

function extractRepoName(remoteUrl: string): string {
  // Handle various Git URL formats
  const patterns = [
    /github\.com[:/]([^/]+)\/([^/.]+)(?:\.git)?/, // GitHub
    /gitlab\.com[:/]([^/]+)\/([^/.]+)(?:\.git)?/, // GitLab
    /bitbucket\.org[:/]([^/]+)\/([^/.]+)(?:\.git)?/, // Bitbucket
    /[:/]([^/]+)\/([^/.]+)(?:\.git)?$/ // Generic
  ];
  
  for (const pattern of patterns) {
    const match = remoteUrl.match(pattern);
    if (match) {
      return match[2];
    }
  }
  
  // Fallback: extract from URL path
  const urlParts = remoteUrl.split('/');
  const lastPart = urlParts[urlParts.length - 1];
  return lastPart.replace(/\.git$/, '') || 'unknown';
}

function extractOwner(remoteUrl: string): string {
  // Handle various Git URL formats
  const patterns = [
    /github\.com[:/]([^/]+)\/([^/.]+)(?:\.git)?/, // GitHub
    /gitlab\.com[:/]([^/]+)\/([^/.]+)(?:\.git)?/, // GitLab
    /bitbucket\.org[:/]([^/]+)\/([^/.]+)(?:\.git)?/, // Bitbucket
    /[:/]([^/]+)\/([^/.]+)(?:\.git)?$/ // Generic
  ];
  
  for (const pattern of patterns) {
    const match = remoteUrl.match(pattern);
    if (match) {
      return match[1];
    }
  }
  
  return 'unknown';
}

function sanitizeRemoteUrl(url: string): string {
  // Remove credentials from URLs
  return url
    .replace(/https?:\/\/[^@]+@/, 'https://')
    .replace(/git@([^:]+):/, 'https://$1/');
}

export async function detectDevContainer(configPath: string): Promise<boolean> {
  try {
    const dir = path.dirname(configPath);
    const devcontainerPath = path.join(dir, '.devcontainer');
    const stats = await fs.stat(devcontainerPath);
    return stats.isDirectory();
  } catch {
    return false;
  }
}

export async function detectWSL(): Promise<boolean> {
  try {
    // Check if we're running in WSL
    if (process.platform === 'linux') {
      const releaseInfo = await fs.readFile('/proc/version', 'utf-8');
      return releaseInfo.toLowerCase().includes('microsoft') || 
             releaseInfo.toLowerCase().includes('wsl');
    }
    return false;
  } catch {
    return false;
  }
}

export async function isInContainer(): Promise<boolean> {
  try {
    // Check for container indicators
    const indicators = [
      '/.dockerenv',
      '/run/.containerenv' // Podman
    ];
    
    for (const indicator of indicators) {
      try {
        await fs.access(indicator);
        return true;
      } catch {
        continue;
      }
    }
    
    // Check cgroup for container indicators
    try {
      const cgroupContent = await fs.readFile('/proc/1/cgroup', 'utf-8');
      return cgroupContent.includes('docker') || 
             cgroupContent.includes('lxc') ||
             cgroupContent.includes('container');
    } catch {
      // Can't read cgroup
    }
    
    return false;
  } catch {
    return false;
  }
}
