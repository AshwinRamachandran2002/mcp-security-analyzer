/**
 * Script to generate attack vectors offline
 * Run with: npx tsx scripts/generate-attack-vectors.ts
 */

import fs from 'fs/promises';
import path from 'path';
import { generateAttackVectors, getAttackVectorStats } from '../lib/attack-vector-generator';

const DECISIONS_FILE = path.join(process.cwd(), 'data', 'analysis', 'tool_decisions.json');
const ATTACK_VECTORS_FILE = path.join(process.cwd(), 'data', 'analysis', 'attack_vectors.json');

async function main() {
  console.log('=== Attack Vector Generation Script ===\n');

  try {
    // Load tool decisions
    console.log('Loading tool decisions...');
    const decisionsContent = await fs.readFile(DECISIONS_FILE, 'utf-8');
    const decisionsData = JSON.parse(decisionsContent);

    // Transform decisions into array format for generator
    const tools: any[] = [];
    Object.entries(decisionsData.decisions || {}).forEach(([key, decision]: [string, any]) => {
      // Key format: "endpoint_id|server_name|tool_name"
      const [endpointId, serverName, toolName] = key.split('|');

      tools.push({
        endpointId,
        serverName,
        toolName,
        endpoint: decision.endpoint || endpointId,
        description: decision.description || '',
        isActive: decision.isActive,
        canReadPrivate: decision.canReadPrivate,
        canReadPublic: decision.canReadPublic,
        canWritePublic: decision.canWritePublic
      });
    });

    console.log(`Loaded ${tools.length} tools\n`);

    // Generate attack vectors
    console.log('Generating attack vectors...');
    const startTime = Date.now();
    const vectors = generateAttackVectors(tools);
    const endTime = Date.now();

    console.log(`\nGeneration complete in ${((endTime - startTime) / 1000).toFixed(2)}s`);
    console.log(`Total vectors: ${vectors.length}\n`);

    // Calculate stats
    const stats = getAttackVectorStats(vectors);
    console.log('Statistics:');
    console.log(`  - Critical: ${stats.bySeverity.critical}`);
    console.log(`  - High: ${stats.bySeverity.high}`);
    console.log(`  - Medium: ${stats.bySeverity.medium}`);
    console.log(`  - Low: ${stats.bySeverity.low}`);
    console.log();

    // Load existing closed vectors if any
    let closedVectors: Record<string, any> = {};
    try {
      const attackVectorsContent = await fs.readFile(ATTACK_VECTORS_FILE, 'utf-8');
      const attackVectorsData = JSON.parse(attackVectorsContent);
      closedVectors = attackVectorsData.closedVectors || {};
      console.log(`Preserving ${Object.keys(closedVectors).length} closed vectors`);
    } catch (error) {
      console.log('No existing closed vectors found');
    }

    // Save to file
    console.log('\nSaving to file...');
    const outputData = {
      version: '1.0',
      generatedAt: new Date().toISOString(),
      vectors: vectors,
      closedVectors: closedVectors
    };

    await fs.writeFile(ATTACK_VECTORS_FILE, JSON.stringify(outputData, null, 2), 'utf-8');
    console.log(`✓ Saved ${vectors.length} attack vectors to ${ATTACK_VECTORS_FILE}`);
    console.log('\nDone!');
  } catch (error) {
    console.error('Error generating attack vectors:', error);
    process.exit(1);
  }
}

main();
