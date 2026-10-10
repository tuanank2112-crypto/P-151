import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';
const portal = path.resolve('portal');
const evidence = path.resolve('planning/18_2026-10-10_portal-python-api/evidence/ui');
const mutations = [
  ['db-fallback', 'src/server/queries.ts', s => s + '\nimport "@/db";\n', 'runtime-graph.test.ts'],
  ['numeric-id', 'src/lib/backend-actions.ts', s => s.replace('if (typeof id', 'Number(id); if (typeof id'), 'runtime-graph.test.ts'],
  ['role-bypass', 'src/lib/backend-actions.ts', s => s.replace('if (!route.roles.includes(role))', 'if (false)'), 'backend-actions.test.ts'],
  ['complete200', 'src/app/actions/backend.ts', s => s.replace('data.ticket?.status !== "READY_FOR_REVIEW"', 'false'), 'backend-server-actions.test.ts'],
  ['photo-boundary', 'src/app/api/backend-photos/[scope]/[ticketId]/[evidenceId]/route.ts', s => s.replace('scope === "internal" && user.role === "resident"', 'false'), 'backend-photo-route.test.ts'],
];
for (const [name, relative, mutate, test] of mutations) {
  const file = path.join(portal, relative), before = fs.readFileSync(file, 'utf8');
  const changed = mutate(before); assert.notEqual(before, changed);
  try {
    fs.writeFileSync(file, changed);
    const result = spawnSync(process.execPath, [path.join(portal, 'node_modules/vitest/vitest.mjs'), 'run', '--project', 'unit', `tests/unit/${test}`], { cwd: portal, encoding: 'utf8' });
    fs.writeFileSync(path.join(evidence, `mutant-${name}.txt`), result.stdout + result.stderr + `\nEXIT=${result.status}\n`);
    assert.notEqual(result.status, 0, `${name} must fail`); assert(result.stdout.includes('failed'), `${name} must fail a test, not an infrastructure error`);
    console.log(`RED ${name} EXIT=${result.status}`);
  } finally { fs.writeFileSync(file, before); }
  assert.equal(fs.readFileSync(file, 'utf8'), before); console.log(`RESTORED ${name}`);
}
const green = spawnSync(process.execPath, [path.join(portal, 'node_modules/vitest/vitest.mjs'), 'run', '--project', 'unit'], { cwd: portal, encoding: 'utf8' });
fs.writeFileSync(path.join(evidence, 'unit-final.txt'), green.stdout + green.stderr + `\nEXIT=${green.status}\n`);
process.stdout.write(green.stdout); process.stderr.write(green.stderr); process.exitCode = green.status;
