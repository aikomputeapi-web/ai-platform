#!/usr/bin/env node

/**
 * Scheduled script to extract free models from OpenRouter and Nvidia NIM APIs
 */

import fs from 'fs';
import path from 'path';

const OUTPUT_DIR = process.env.OUTPUT_DIR || path.join(process.cwd(), 'data');
const INTERVAL_SECONDS = Number(process.env.INTERVAL_SECONDS) || 86400; // 24 hours
const ONCE = process.argv.includes('--once') || process.env.EXTRACT_ONCE === 'true';

async function extractOpenRouterFreeModels() {
  console.log('[Extractor] Fetching OpenRouter models catalog...');
  const res = await fetch('https://openrouter.ai/api/v1/models', {
    headers: { 'Accept': 'application/json' },
    signal: AbortSignal.timeout(20000)
  });

  if (!res.ok) {
    throw new Error(`OpenRouter API returned ${res.status}: ${res.statusText}`);
  }

  const json = await res.json();
  const models = Array.isArray(json.data) ? json.data : [];

  // Filter free models: ends with ":free", has "free" in ID/name, or zero pricing
  const freeModels = models.filter(m => {
    const isFreeId = m.id.endsWith(':free') || m.id.toLowerCase().includes('free');
    const isFreeName = m.name && m.name.toLowerCase().includes('free');
    const isZeroPrice = m.pricing && m.pricing.prompt === '0' && m.pricing.completion === '0';
    return isFreeId || isFreeName || isZeroPrice;
  });

  console.log(`[Extractor] Found ${freeModels.length} free OpenRouter models (out of ${models.length} total)`);
  return freeModels;
}

async function extractNvidiaFreeModels() {
  console.log('[Extractor] Fetching Nvidia NIM models catalog...');
  const res = await fetch('https://integrate.api.nvidia.com/v1/models', {
    headers: { 'Accept': 'application/json' },
    signal: AbortSignal.timeout(20000)
  });

  if (!res.ok) {
    throw new Error(`Nvidia API returned ${res.status}: ${res.statusText}`);
  }

  const json = await res.json();
  const models = Array.isArray(json.data) ? json.data : (json.models || []);

  // Filter: look for "free" in name/id
  let freeModels = models.filter(m => {
    const isFreeId = m.id.toLowerCase().includes('free');
    const isFreeName = m.name && m.name.toLowerCase().includes('free');
    return isFreeId || isFreeName;
  });

  // Cross-reference with models.dev zero cost if no "free" string match
  if (freeModels.length === 0) {
    console.log('[Extractor] No Nvidia models matching "free" name filter. Checking models.dev pricing...');
    try {
      const devRes = await fetch('https://models.dev/api.json', { signal: AbortSignal.timeout(15000) });
      if (devRes.ok) {
        const devData = await devRes.json();
        const nvidiaDev = devData.nvidia?.models || {};
        freeModels = models.filter(m => {
          const mId = m.id.replace(/^nvidia\//, '');
          const devModel = nvidiaDev[mId] || nvidiaDev[m.id];
          return devModel && devModel.cost && devModel.cost.input === 0;
        });
        console.log(`[Extractor] Identified ${freeModels.length} zero-cost Nvidia models via models.dev`);
      }
    } catch (err) {
      console.warn('[Extractor] models.dev pricing fetch failed:', err.message);
    }
  }

  // Fallback to all models if still empty (since build.nvidia.com is free for prototyping/dev)
  if (freeModels.length === 0) {
    console.log('[Extractor] Falling back to treating all Nvidia models as free developer endpoints');
    freeModels = models;
  }

  console.log(`[Extractor] Found ${freeModels.length} free/dev Nvidia models (out of ${models.length} total)`);
  return freeModels;
}

function saveResults(providerName, models) {
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  const filePrefix = providerName.toLowerCase();
  
  // 1. Save TXT file (one model ID per line)
  const txtPath = path.join(OUTPUT_DIR, `${filePrefix}_free_models.txt`);
  const ids = models.map(m => m.id);
  fs.writeFileSync(txtPath, ids.join('\n') + '\n', 'utf8');
  console.log(`[Extractor] Saved plain text list to: ${txtPath}`);

  // 2. Save Markdown table file
  const mdPath = path.join(OUTPUT_DIR, `${filePrefix}_free_models.md`);
  let mdContent = `# Free Models - ${providerName}\n\n`;
  mdContent += `*Last updated: ${new Date().toISOString()}*\n\n`;
  mdContent += `| Model ID | Model Name | Owned By / Context |\n`;
  mdContent += `| --- | --- | --- |\n`;
  
  models.forEach(m => {
    const name = m.name || m.id.split('/').pop() || m.id;
    const info = m.owned_by || m.context_length || 'N/A';
    mdContent += `| \`${m.id}\` | ${name} | ${info} |\n`;
  });

  fs.writeFileSync(mdPath, mdContent, 'utf8');
  console.log(`[Extractor] Saved Markdown table to: ${mdPath}`);
}

async function runOnce() {
  const start = Date.now();
  console.log(`[Extractor] Starting extraction cycle at ${new Date().toISOString()}`);

  try {
    const openrouterFree = await extractOpenRouterFreeModels();
    saveResults('OpenRouter', openrouterFree);
  } catch (error) {
    console.error('[Extractor] OpenRouter extraction failed:', error.message);
  }

  try {
    const nvidiaFree = await extractNvidiaFreeModels();
    saveResults('Nvidia', nvidiaFree);
  } catch (error) {
    console.error('[Extractor] Nvidia extraction failed:', error.message);
  }

  console.log(`[Extractor] Extraction cycle complete in ${((Date.now() - start) / 1000).toFixed(2)}s`);
}

async function loop() {
  await runOnce();
  if (!ONCE) {
    console.log(`[Extractor] Next cycle scheduled in ${INTERVAL_SECONDS} seconds (${(INTERVAL_SECONDS / 3600).toFixed(1)} hours)`);
    setTimeout(loop, INTERVAL_SECONDS * 1000);
  }
}

if (ONCE) {
  await runOnce();
} else {
  console.log(`[Extractor] Starting daemon scheduler...`);
  await loop();
  // Keep process alive
  await new Promise(() => {});
}
