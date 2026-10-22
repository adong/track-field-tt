#!/usr/bin/env node
/* The headless rules check, outside the browser: node tools/check.js
   node tools/check.js --fail   runs the three broken variants (frame-rate steps, a faster lane 2, measuring from the
                                take-off); each must be caught, so this prints FAILED and exits 1. */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ctx = { window: {}, console, Math, JSON, Set };
vm.createContext(ctx);
for (const f of ['js/sim.js', 'js/checks.js']) vm.runInContext(fs.readFileSync(path.join(__dirname, '..', f), 'utf8'), ctx, { filename: f });
const TF = ctx.window.TF;

const show = (rep) => {
  for (const c of rep.checks) console.log(`${c.ok ? 'ok  ' : 'FAIL'} ${c.name}: ${c.detail}`);
  console.log(rep.ok ? 'ALL OK' : 'FAILED');
};

const t0 = Date.now();
if (process.argv.includes('--fail')) {
  let caught = 0;
  for (const fail of ['fps', 'unfair', 'measure']) {
    const rep = TF.checks.run({ fail });
    console.log(`\n--- broken on purpose: ${fail}`);
    show(rep);
    if (!rep.ok) caught++;
  }
  console.log(`\n${caught}/3 broken variants caught (${Date.now() - t0} ms)`);
  process.exit(caught === 3 ? 1 : 0);
} else {
  const rep = TF.checks.run();
  show(rep);
  console.log(`(${Date.now() - t0} ms)`);
  process.exit(rep.ok ? 0 : 1);
}
