/**
 * Secret redaction utilities for MCP Collector
 * Removes sensitive information from commands, URLs, and configs
 */

export function redactSecrets(text: string): string {
  if (!text) return text;
  
  return text
    // URL query parameters with sensitive keys
    .replace(/(\?|&)[^&]*?(token|key|auth|secret|password|credential)=[^&]*/gi, '$1$2=***')
    // Authorization headers
    .replace(/Authorization:\s*[^\s]+/gi, 'Authorization: ***')
    .replace(/Bearer\s+[^\s"']+/gi, 'Bearer ***')
    // Command line arguments
    .replace(/--api-key\s+[^\s]+/gi, '--api-key ***')
    .replace(/--token\s+[^\s]+/gi, '--token ***')
    .replace(/--auth\s+[^\s]+/gi, '--auth ***')
    .replace(/--secret\s+[^\s]+/gi, '--secret ***')
    .replace(/--password\s+[^\s]+/gi, '--password ***')
    // Environment variables
    .replace(/(export\s+)?[A-Z_]*?(TOKEN|KEY|AUTH|SECRET|PASSWORD)=[^\s]*/gi, '$1$2=***')
    // GitHub tokens (specific pattern)
    .replace(/gh[ps]_[A-Za-z0-9]{36,}/g, 'gh*_***')
    // Generic base64-like tokens (longer than 20 chars, alphanumeric + some symbols)
    .replace(/[A-Za-z0-9+/]{20,}={0,2}/g, (match) => {
      if (match.length > 30) return '***';
      return match;
    });
}

export function redactConfigSecrets(config: any): any {
  if (!config || typeof config !== 'object') return config;
  
  const redacted = JSON.parse(JSON.stringify(config));
  
  function redactObject(obj: any): void {
    if (!obj || typeof obj !== 'object') return;
    
    for (const [key, value] of Object.entries(obj)) {
      const lowerKey = key.toLowerCase();
      
      // Redact sensitive keys
      if (lowerKey.includes('token') || 
          lowerKey.includes('key') || 
          lowerKey.includes('auth') || 
          lowerKey.includes('secret') || 
          lowerKey.includes('password') ||
          lowerKey.includes('credential')) {
        obj[key] = '***';
      }
      // Redact Authorization headers specifically
      else if (lowerKey === 'authorization') {
        obj[key] = '***';
      }
      // Redact URLs with query parameters
      else if (typeof value === 'string' && value.includes('?')) {
        obj[key] = redactSecrets(value);
      }
      // Recursively check nested objects
      else if (typeof value === 'object' && value !== null) {
        if (Array.isArray(value)) {
          value.forEach(item => {
            if (typeof item === 'object') redactObject(item);
          });
        } else {
          redactObject(value);
        }
      }
    }
  }
  
  redactObject(redacted);
  return redacted;
}

export function sanitizeForStorage(text: string): string {
  // Remove null bytes and control characters that could cause issues
  return text
    .replace(/\0/g, '')
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    .trim();
}

export function isLikelySecret(value: string): boolean {
  if (!value || value.length < 10) return false;
  
  // Check for common secret patterns
  const secretPatterns = [
    /^gh[ps]_[A-Za-z0-9]{36,}$/, // GitHub tokens
    /^[A-Za-z0-9+/]{40,}={0,2}$/, // Base64 tokens
    /^[A-Fa-f0-9]{32,}$/, // Hex tokens
    /^Bearer\s+/i, // Bearer tokens
    /^Basic\s+/i, // Basic auth
  ];
  
  return secretPatterns.some(pattern => pattern.test(value));
}
