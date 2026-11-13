// Writes bridgeport-console.js (the default console script) from the generator in index.html.
// Usage: node scripts/build-console.cjs
const fs = require('fs');
const path = require('path');
const core = require('../tests/load-core.cjs')();

const script = core.buildConsoleScript({
  jql: 'issuetype = Test ORDER BY key ASC',
  sep: ' | ',
  csv: true,
  date: 'default build',
  columns: core.SCRIPT_SOURCES.filter(c => c.on),
});
fs.writeFileSync(path.join(__dirname, '..', 'bridgeport-console.js'), script + '\n');
console.log('Wrote bridgeport-console.js (' + script.length + ' chars)');
