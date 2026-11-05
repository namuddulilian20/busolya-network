#!/usr/bin/env node
'use strict';

/*
 * What is actually live on Render, compared with the branch on GitHub.
 *
 *   $env:RENDER_API_KEY = 'rnd_...'      # Windows PowerShell
 *   export RENDER_API_KEY=rnd_...        # bash
 *   node scripts/deploy-status.js
 *
 * The key is read from the environment and never written to disk.
 * Create one at Render -> Account Settings -> API Keys (read access is enough).
 *
 * Exit code 0 when every service is live on the tip of the branch,
 * 1 when any service is behind, still building, or failed.
 */

const { execSync } = require('child_process');

const SERVICES = [
  'busolya-api',
  'bataka-agro-expo',
  'busolya-agro-farmers',
  'abataka-mutindo-sacco'
];

const key = process.env.RENDER_API_KEY;
if (!key) {
  console.error('RENDER_API_KEY is not set. See the comment at the top of this file.');
  process.exit(1);
}

const headers = { Authorization: 'Bearer ' + key, Accept: 'application/json' };

async function api(path) {
  const res = await fetch('https://api.render.com/v1' + path, { headers });
  if (!res.ok) throw new Error(path + ' -> HTTP ' + res.status + ' ' + (await res.text()).slice(0, 120));
  return res.json();
}

function branchTip() {
  try {
    execSync('git fetch --quiet origin', { stdio: 'ignore' });
    return execSync('git rev-parse --short origin/main', { encoding: 'utf8' }).trim();
  } catch (_) {
    return null;
  }
}

(async () => {
  const tip = branchTip();
  const services = (await api('/services?limit=100')).map((x) => x.service);
  const rows = [];
  let stale = 0;

  for (const name of SERVICES) {
    const svc = services.find((s) => s.name === name);
    if (!svc) { rows.push({ service: name, status: 'not found', commit: '-', trigger: '-', verdict: 'MISSING' }); stale++; continue; }

    const deploys = (await api(`/services/${svc.id}/deploys?limit=1`)).map((x) => x.deploy);
    const d = deploys[0];
    if (!d) { rows.push({ service: name, status: 'never deployed', commit: '-', trigger: '-', verdict: 'MISSING' }); stale++; continue; }

    const commit = (d.commit && d.commit.id ? d.commit.id : '').slice(0, 7);
    const verdict = d.status !== 'live' ? d.status.toUpperCase()
                  : (tip && commit !== tip) ? 'BEHIND' : 'OK';
    if (verdict !== 'OK') stale++;
    rows.push({
      service: name,
      status: d.status,
      commit: commit || '-',
      trigger: d.trigger || '-',
      verdict
    });
  }

  console.log('branch origin/main: ' + (tip || 'unknown'));
  console.table(rows);
  if (stale) {
    console.log('\n' + stale + ' service(s) not on the latest commit. Redeploy from the Render dashboard, or POST /v1/services/{id}/deploys.');
  }
  process.exit(stale ? 1 : 0);
})().catch((err) => {
  console.error('deploy-status: ' + err.message);
  process.exit(2);
});
