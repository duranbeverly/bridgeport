// Loads the shared core <script id="core"> from index.html so it can be tested in Node.
const fs = require('fs');
const path = require('path');

module.exports = function loadCore() {
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const start = html.indexOf('<script id="core">');
  const body = html.slice(html.indexOf('>', start) + 1, html.indexOf('</script>', start));
  const mod = { exports: {} };
  new Function('module', body)(mod);
  return mod.exports;
};
