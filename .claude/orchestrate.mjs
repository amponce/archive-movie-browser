// Production-readiness audit orchestrator for archive-movie-browser.
// Shape: inventory -> read-only testers (capped fan-out) -> triage -> sequential fixer+verifier per
// cluster -> loop, up to MAX_PASSES or until the stop condition holds. Nothing here merges.
// Wire runAgent() to the harness (Agent tool / `claude -p --agent`); this file is the control flow.
import { execSync, spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const STATE = '.claude/PROD_AUDIT_STATE.md';
const MAX_PASSES = 8;
const TESTER_CONCURRENCY = 4;

// Replace with the harness call. Must return the agent's final text.
// No shell: the prompt carries surface names and cluster slugs that agents wrote into the state
// file, so it is passed as an argv entry, and the agent name is checked against a fixed list.
const AGENTS = new Set(['prod-audit-inventory', 'prod-audit-tester', 'prod-audit-triage', 'prod-audit-fixer', 'prod-audit-verifier']);
async function runAgent(name, prompt) {
  if (!AGENTS.has(name)) throw new Error(`Unknown agent: ${name}`);
  const run = spawnSync('claude', ['-p', '--agent', name, String(prompt).slice(0, 2000)], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] });
  if (run.error) throw run.error;
  return run.stdout;
}

const state = () => readFileSync(STATE, 'utf8');
const rows = (section) => (state().split(`## ${section}`)[1] || '').split('\n## ')[0].split('\n').filter(l => /^\| [A-Z]?\d*[a-z]/.test(l) || /^\| (F|C)\d+ /.test(l));
const surfacesToTest = () => rows('Surfaces').filter(l => /\| (untested|stale) \|/.test(l)).map(l => l.split('|')[1].trim());
const clustersToFix = () => rows('Clusters').filter(l => /\| fix-now \|/.test(l) && /\| pending \|/.test(l)).map(l => l.split('|')[1].trim());

function stopConditionHolds() {
  try {
    execSync(`grep -cE '^\\| F[0-9]+ .*\\| (open|rejected) \\|' ${STATE} | grep -qx 0 && grep -q 'Last full pass: clean' ${STATE}`, { stdio: 'ignore' });
    return true;
  } catch { return false; }
}

async function mapCapped(items, limit, fn) {
  const out = []; let next = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) { const i = next++; out[i] = await fn(items[i]); }
  }));
  return out;
}

for (let pass = 1; pass <= MAX_PASSES; pass++) {
  if (stopConditionHolds()) { console.log(`Stop condition holds before pass ${pass}. Done.`); process.exit(0); }
  console.log(`\n=== Pass ${pass} ===`);
  await runAgent('prod-audit-inventory', `Pass ${pass}: refresh the Surfaces table.`);
  const surfaces = surfacesToTest();
  console.log(`testing ${surfaces.length} surface(s)`);
  await mapCapped(surfaces, TESTER_CONCURRENCY, s => runAgent('prod-audit-tester', `Pass ${pass}: test the surface "${s}".`));
  await runAgent('prod-audit-triage', `Pass ${pass}: cluster the open findings.`);
  for (const cluster of clustersToFix()) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      await runAgent('prod-audit-fixer', `Pass ${pass}, attempt ${attempt}: fix cluster ${cluster}.`);
      const verdict = await runAgent('prod-audit-verifier', `Pass ${pass}: verify cluster ${cluster}.`);
      if (/verified/i.test(verdict)) break;
      if (attempt === 2) console.log(`cluster ${cluster} blocked after 2 attempts: hand off to a human`);
    }
  }
}
console.log(`Reached ${MAX_PASSES} passes. Handing off with whatever is blocked in ${STATE}.`);
