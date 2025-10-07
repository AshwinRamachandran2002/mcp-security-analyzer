/**
 * Attack Vector Generator
 *
 * Generates attack vectors by finding permutations of tools per endpoint:
 * - List A: Tools that can read public data (external/untrusted sources)
 * - List B: Tools that can read private data (sensitive internal data)
 * - List C: Tools that can write to public destinations (exfiltration)
 *
 * Each attack vector is a chain: A → B → C
 * Represents: Read external data → Access private data → Exfiltrate publicly
 */

export interface ToolInVector {
  toolName: string;
  serverName: string;
  description: string;
  endpoint: string;
  endpointId: string;
}

export interface AttackVector {
  id: string;
  endpointId: string;
  endpointName: string;

  // The three tools in the attack chain
  listA: ToolInVector;  // Reads public/external data
  listB: ToolInVector;  // Reads private data
  listC: ToolInVector;  // Writes to public destinations

  // Metadata
  severity: 'Critical' | 'High' | 'Medium' | 'Low';
  description: string;
  attackPath: string[];

  // Status
  status: 'open' | 'closed';
  closedAt?: string;
  closedBy?: string;
  manualSteps?: string[];
}

export interface ToolAnalysisData {
  endpoint: string;
  endpointId: string;
  serverName: string;
  toolName: string;
  description: string;
  isActive: boolean;
  canReadPrivate: boolean;
  canReadPublic: boolean;
  canWritePublic: boolean;
}

/**
 * Calculate severity based on the attack chain
 *
 * Severity Rules:
 * - HIGH: All 3 tools from SAME endpoint + SAME server (most direct attack)
 * - MEDIUM: All 3 tools from SAME endpoint + DIFFERENT servers (cross-server on one machine)
 * - LOW: Tools from DIFFERENT endpoints (requires lateral movement/shared context)
 */
function calculateSeverity(
  listA: ToolInVector,
  listB: ToolInVector,
  listC: ToolInVector
): 'Critical' | 'High' | 'Medium' | 'Low' {
  // Check if all from same endpoint
  const sameEndpoint =
    listA.endpointId === listB.endpointId &&
    listB.endpointId === listC.endpointId;

  if (!sameEndpoint) {
    // Cross-endpoint attack - requires lateral movement
    return 'Low';
  }

  // All on same endpoint - check if same server
  const sameServer =
    listA.serverName === listB.serverName &&
    listB.serverName === listC.serverName;

  if (sameServer) {
    // Same endpoint, same server - most direct prompt injection
    return 'High';
  } else {
    // Same endpoint, different servers - requires cross-server coordination
    return 'Medium';
  }
}

/**
 * Generate attack vectors from tool analysis data
 */
export function generateAttackVectors(tools: ToolAnalysisData[]): AttackVector[] {
  console.log(`[generateAttackVectors] Starting with ${tools.length} tools`);
  const attackVectors: AttackVector[] = [];

  // Group tools by endpoint
  const toolsByEndpoint = new Map<string, ToolAnalysisData[]>();

  tools.forEach(tool => {
    if (!toolsByEndpoint.has(tool.endpointId)) {
      toolsByEndpoint.set(tool.endpointId, []);
    }
    toolsByEndpoint.get(tool.endpointId)!.push(tool);
  });

  console.log(`[generateAttackVectors] Grouped into ${toolsByEndpoint.size} endpoints`);

  // Generate same-endpoint attack vectors
  toolsByEndpoint.forEach((endpointTools, endpointId) => {
    const beforeCount = attackVectors.length;
    generateVectorsForEndpoint(endpointTools, endpointId, attackVectors);
    console.log(`[generateAttackVectors] Endpoint ${endpointId}: generated ${attackVectors.length - beforeCount} same-endpoint vectors`);
  });

  // Generate cross-endpoint attack vectors
  // Only generate when endpoints are actually different to avoid explosion
  const allEndpoints = Array.from(toolsByEndpoint.entries());

  console.log(`[generateAttackVectors] Starting cross-endpoint generation with ${allEndpoints.length} endpoints`);

  // Only proceed if we have multiple endpoints
  if (allEndpoints.length > 1) {
    const beforeCrossEndpoint = attackVectors.length;
    let crossEndpointCount = 0;

    for (let i = 0; i < allEndpoints.length; i++) {
      for (let j = 0; j < allEndpoints.length; j++) {
        for (let k = 0; k < allEndpoints.length; k++) {
          // Skip if all three are the same endpoint (already handled above)
          if (i === j && j === k) continue;

          // At least one must be different
          const hasDifferentEndpoint = i !== j || j !== k || i !== k;
          if (!hasDifferentEndpoint) continue;

          const [endpointIdA, toolsA] = allEndpoints[i];
          const [endpointIdB, toolsB] = allEndpoints[j];
          const [endpointIdC, toolsC] = allEndpoints[k];

          const beforeVecCount = attackVectors.length;
          generateCrossEndpointVectors(
            toolsA, endpointIdA,
            toolsB, endpointIdB,
            toolsC, endpointIdC,
            attackVectors
          );
          const addedVecs = attackVectors.length - beforeVecCount;
          if (addedVecs > 0) {
            crossEndpointCount++;
            if (crossEndpointCount % 10 === 0) {
              console.log(`[generateAttackVectors] Generated ${crossEndpointCount} cross-endpoint combinations so far, total vectors: ${attackVectors.length}`);
            }
          }
        }
      }
    }
    console.log(`[generateAttackVectors] Cross-endpoint generation complete: ${attackVectors.length - beforeCrossEndpoint} new vectors from ${crossEndpointCount} combinations`);
  }

  console.log(`[generateAttackVectors] TOTAL: ${attackVectors.length} attack vectors generated`);
  return attackVectors;
}

/**
 * Generate attack vectors for a single endpoint
 */
function generateVectorsForEndpoint(
  endpointTools: ToolAnalysisData[],
  endpointId: string,
  attackVectors: AttackVector[]
) {
    // Categorize tools into three lists
    const listATools: ToolInVector[] = [];  // Can read public data
    const listBTools: ToolInVector[] = [];  // Can read private data
    const listCTools: ToolInVector[] = [];  // Can write public data

    endpointTools.forEach(tool => {
      const toolInVector: ToolInVector = {
        toolName: tool.toolName,
        serverName: tool.serverName,
        description: tool.description,
        endpoint: tool.endpoint,
        endpointId: tool.endpointId
      };

      // Only consider active tools
      if (!tool.isActive) {
        return;
      }

      if (tool.canReadPublic) {
        listATools.push(toolInVector);
      }
      if (tool.canReadPrivate) {
        listBTools.push(toolInVector);
      }
      if (tool.canWritePublic) {
        listCTools.push(toolInVector);
      }
    });

    // Only generate attack vectors if all three lists are non-empty
    if (listATools.length === 0 || listBTools.length === 0 || listCTools.length === 0) {
      return;
    }

    // Generate all permutations (A × B × C)
    listATools.forEach(toolA => {
      listBTools.forEach(toolB => {
        listCTools.forEach(toolC => {
          // Note: We allow same server and even same tool in different roles
          // Example: github/get_file_contents (A) → github/search_code (B) → github/create_issue (C)
          // This is a valid attack chain

          const severity = calculateSeverity(toolA, toolB, toolC);

          const attackVector: AttackVector = {
            id: `av_${endpointId}_${toolA.toolName}_${toolB.toolName}_${toolC.toolName}`,
            endpointId: endpointId,
            endpointName: endpointTools[0].endpoint,
            listA: toolA,
            listB: toolB,
            listC: toolC,
            severity,
            description: `Attack chain combining ${toolA.serverName}/${toolA.toolName} (external data ingestion), ${toolB.serverName}/${toolB.toolName} (private data access), and ${toolC.serverName}/${toolC.toolName} (data exfiltration).`,
            attackPath: [
              `1. Attacker uses ${toolA.toolName} to read from external/untrusted sources`,
              `2. Malicious payload triggers ${toolB.toolName} to access private/sensitive data`,
              `3. Data is exfiltrated via ${toolC.toolName} to publicly accessible destinations`
            ],
            status: 'open'
          };

          attackVectors.push(attackVector);
        });
      });
    });
}

/**
 * Generate cross-endpoint attack vectors
 */
function generateCrossEndpointVectors(
  toolsA: ToolAnalysisData[],
  endpointIdA: string,
  toolsB: ToolAnalysisData[],
  endpointIdB: string,
  toolsC: ToolAnalysisData[],
  endpointIdC: string,
  attackVectors: AttackVector[]
) {
  // Categorize tools for each endpoint
  const listATools: ToolInVector[] = [];
  const listBTools: ToolInVector[] = [];
  const listCTools: ToolInVector[] = [];

  toolsA.forEach(tool => {
    if (!tool.isActive || !tool.canReadPublic) return;
    listATools.push({
      toolName: tool.toolName,
      serverName: tool.serverName,
      description: tool.description,
      endpoint: tool.endpoint,
      endpointId: tool.endpointId
    });
  });

  toolsB.forEach(tool => {
    if (!tool.isActive || !tool.canReadPrivate) return;
    listBTools.push({
      toolName: tool.toolName,
      serverName: tool.serverName,
      description: tool.description,
      endpoint: tool.endpoint,
      endpointId: tool.endpointId
    });
  });

  toolsC.forEach(tool => {
    if (!tool.isActive || !tool.canWritePublic) return;
    listCTools.push({
      toolName: tool.toolName,
      serverName: tool.serverName,
      description: tool.description,
      endpoint: tool.endpoint,
      endpointId: tool.endpointId
    });
  });

  if (listATools.length === 0 || listBTools.length === 0 || listCTools.length === 0) {
    return;
  }

  // Generate permutations
  listATools.forEach(toolA => {
    listBTools.forEach(toolB => {
      listCTools.forEach(toolC => {
        const severity = calculateSeverity(toolA, toolB, toolC);

        const attackVector: AttackVector = {
          id: `av_${toolA.endpointId}_${toolB.endpointId}_${toolC.endpointId}_${toolA.toolName}_${toolB.toolName}_${toolC.toolName}`,
          endpointId: `${toolA.endpointId}|${toolB.endpointId}|${toolC.endpointId}`,
          endpointName: `${toolA.endpoint} → ${toolB.endpoint} → ${toolC.endpoint}`,
          listA: toolA,
          listB: toolB,
          listC: toolC,
          severity,
          description: `Cross-endpoint attack chain: ${toolA.serverName}/${toolA.toolName} (${toolA.endpoint}) → ${toolB.serverName}/${toolB.toolName} (${toolB.endpoint}) → ${toolC.serverName}/${toolC.toolName} (${toolC.endpoint})`,
          attackPath: [
            `1. On ${toolA.endpoint}: Attacker uses ${toolA.toolName} to read from external/untrusted sources`,
            `2. Context/payload propagates to ${toolB.endpoint}: Malicious prompt triggers ${toolB.toolName} to access private/sensitive data`,
            `3. On ${toolC.endpoint}: Data is exfiltrated via ${toolC.toolName} to publicly accessible destinations`
          ],
          status: 'open'
        };

        attackVectors.push(attackVector);
      });
    });
  });
}

/**
 * Get attack vector statistics
 */
export function getAttackVectorStats(vectors: AttackVector[]) {
  return {
    total: vectors.length,
    bySeverity: {
      critical: vectors.filter(v => v.severity === 'Critical').length,
      high: vectors.filter(v => v.severity === 'High').length,
      medium: vectors.filter(v => v.severity === 'Medium').length,
      low: vectors.filter(v => v.severity === 'Low').length
    },
    byStatus: {
      open: vectors.filter(v => v.status === 'open').length,
      closed: vectors.filter(v => v.status === 'closed').length
    },
    byEndpoint: vectors.reduce((acc, v) => {
      acc[v.endpointName] = (acc[v.endpointName] || 0) + 1;
      return acc;
    }, {} as Record<string, number>)
  };
}

/**
 * Generate manual steps to close an attack vector
 */
export function generateManualSteps(vector: AttackVector): string[] {
  return [
    `1. Review and restrict access to ${vector.listA.toolName} (${vector.listA.serverName})`,
    `   - Disable tool if not required`,
    `   - Implement input validation to prevent malicious payloads`,
    `   - Add monitoring/logging for this tool's usage`,
    '',
    `2. Audit ${vector.listB.toolName} (${vector.listB.serverName}) permissions`,
    `   - Apply principle of least privilege`,
    `   - Require additional authentication for sensitive data access`,
    `   - Add access control lists (ACLs)`,
    '',
    `3. Restrict ${vector.listC.toolName} (${vector.listC.serverName}) output destinations`,
    `   - Implement data loss prevention (DLP) controls`,
    `   - Whitelist allowed external destinations`,
    `   - Add egress filtering and monitoring`,
    '',
    `4. Test the entire attack chain to verify it's no longer exploitable`,
    '',
    `5. Document the changes and update security runbooks`
  ];
}
