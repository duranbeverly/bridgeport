// Bridgeport console script. Generated default build.
// Paste into the DevTools Console on a Jira page (context: "top"). Read-only: it never changes anything in Jira.
(async () => {
  const CFG = {"jql":"issuetype = Test ORDER BY key ASC","sep":" | ","csv":true,"columns":[{"label":"Test Key","source":"key"},{"label":"Test Title","source":"summary"},{"label":"Description","source":"description"},{"label":"Criticality","source":"custom:Criticality"},{"label":"Date Added","source":"created"}]};
  if (/getxray|xray\.cloud|xpand/i.test(location.hostname)) { console.error('Bridgeport: this console is pointed at the Xray frame. At the top-left of the Console, switch the context dropdown to "top", then paste again.'); return; }
  const input = prompt('Bridgeport: which tests? Type a JQL search, OR paste a list of test keys (e.g. from an Xray folder: ABC-1 ABC-2 ...)', CFG.jql); if (!input) return;
  const keyList = /^[\s,;]*[A-Z][A-Z0-9_]+-\d+([\s,;]+[A-Z][A-Z0-9_]+-\d+)*[\s,;]*$/.test(input) ? Array.from(new Set(input.match(/[A-Z][A-Z0-9_]+-\d+/g))) : null;
  const batches = keyList ? Array.from({ length: Math.ceil(keyList.length / 100) }, (_, b) => 'key in (' + keyList.slice(b * 100, b * 100 + 100).join(',') + ') ORDER BY key ASC') : [input];
  if (keyList) console.log('Bridgeport: ' + keyList.length + ' test keys pasted. Fetching them in ' + batches.length + ' batch(es).');
  const base = location.origin + ((window.AJS && AJS.contextPath && AJS.contextPath()) || '');
  const enc = encodeURIComponent, sleep = ms => new Promise(r => setTimeout(r, ms));
  const get = async u => { const r = await fetch(base + u, { credentials: 'same-origin', headers: { Accept: 'application/json' } }); if (!r.ok) { let m = ''; try { m = ((await r.json()).errorMessages || []).join(' '); } catch (e) {} const x = new Error('Jira said ' + r.status + ' ' + m); x.status = r.status; throw x; } return r.json(); };
  const toText = n => { if (!n) return ''; if (typeof n === 'string') return n; if (n.type === 'text') return n.text || ''; if (n.type === 'hardBreak') return '\n'; const s = (n.content || []).map(toText).join(''); return /^(paragraph|heading|listItem|codeBlock|blockquote|tableRow)$/.test(n.type) ? s + '\n' : s; };
  const val = v => v == null ? '' : Array.isArray(v) ? v.map(val).join(', ') : typeof v === 'object' ? (v.type === 'doc' ? toText(v) : (v.value || v.name || v.displayName || '')) : String(v);
  const clean = s => s.replace(/\{(code|noformat|quote|panel|color)(:[^}]*)?\}/gi, '').replace(/^h[1-6]\.\s*/gim, '').replace(/\{\{([^}]+)\}\}/g, '$1').replace(/\[([^|\]]+)\|([^\]]+)\]/g, '$1 ($2)').replace(/(^|\s)\*([^*\n]+)\*/g, '$1$2').replace(/^\s*[#*-]+\s+/gm, '• ');
  const oneLine = s => clean(s || '').replace(/\r\n?/g, '\n').split('\n').map(x => x.replace(/[\t ]+/g, ' ').trim()).filter(Boolean).join(CFG.sep);
  let fieldList = []; try { fieldList = await get('/rest/api/2/field'); } catch (e) {}
  const find = name => fieldList.find(f => f.name.trim().toLowerCase() === name.toLowerCase()) || fieldList.find(f => f.name.toLowerCase().includes(name.toLowerCase())) || null;
  const cols = CFG.columns.map(c => { if (!c.source.startsWith('custom:')) return Object.assign({}, c, { id: c.source }); const f = find(c.source.slice(7)); if (f) console.log('Bridgeport: "' + c.label + '" is field "' + f.name + '" (' + f.id + ')'); else console.warn('Bridgeport: no field named "' + c.source.slice(7) + '", so "' + c.label + '" will be empty.'); return Object.assign({}, c, { id: f ? f.id : null }); });
  const fields = Array.from(new Set(cols.filter(c => c.id && c.id !== 'key').map(c => c.id))).join(',') || 'summary';
  const cell = (i, c) => { if (c.id === 'key') return i.key; if (!c.id) return ''; const v = i.fields[c.id]; if (c.id === 'created' || c.id === 'updated') return (v || '').slice(0, 10); return oneLine(val(v)); };
  const rows = []; const add = i => rows.push(cols.map(c => cell(i, c)));
  console.log('%cBridgeport: reading tests…', 'font-weight:bold');
  const progress = total => console.log('  ' + rows.length + ' / ' + (keyList ? keyList.length : total == null ? '…' : total));
  let useV3 = false; const missing = [];
  const runJql = async q => {
    if (!useV3) { try { let start = 0, total = Infinity; while (start < total) { const d = await get('/rest/api/2/search?jql=' + enc(q) + '&startAt=' + start + '&maxResults=100&fields=' + fields); total = d.total; d.issues.forEach(add); start += d.issues.length; progress(total); if (!d.issues.length) break; await sleep(150); } return; } catch (e) { if (e.status !== 404 && e.status !== 410) throw e; useV3 = true; } }
    let tok = ''; do { const d = await get('/rest/api/3/search/jql?jql=' + enc(q) + '&maxResults=100&fields=' + fields + (tok ? '&nextPageToken=' + enc(tok) : '')); d.issues.forEach(add); tok = d.nextPageToken || ''; progress(null); await sleep(150); } while (tok);
  };
  try {
    for (const q of batches) {
      try { await runJql(q); }
      catch (e) { if (!keyList || e.status !== 400) throw e; for (const k of q.match(/[A-Z][A-Z0-9_]+-\d+/g)) { try { await runJql('key = ' + k); } catch (e2) { missing.push(k); } } }
    }
  } catch (e) { console.error('Bridgeport stopped: ' + e.message); return; }
  if (missing.length) console.warn(missing.length + ' pasted key(s) were not found, or you do not have access: ' + missing.slice(0, 20).join(', ') + (missing.length > 20 ? ', …' : ''));
  const seen = new Set(), out = rows.filter(r => !seen.has(r[0]) && seen.add(r[0]));
  const head = cols.map(c => c.label);
  const q = (v, sep) => { let s = String(v).replace(/\t/g, ' '); if (/^[=+\-@]/.test(s)) s = "'" + s; return /["\n\r]/.test(s) || s.includes(sep) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  const tsv = [head].concat(out).map(r => r.map(v => q(v, '\t')).join('\t')).join('\r\n');
  const csv = '\uFEFF' + [head].concat(out).map(r => r.map(v => q(v, ',')).join(',')).join('\r\n');
  let copied = false; try { if (typeof copy === 'function') { copy(tsv); copied = true; } } catch (e) {} if (!copied) { try { await navigator.clipboard.writeText(tsv); copied = true; } catch (e) {} }
  if (CFG.csv) { try { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' })); a.download = 'tests-' + new Date().toISOString().slice(0, 10) + '.csv'; document.body.appendChild(a); a.click(); a.remove(); } catch (e) {} }
  window.bridgeport = { rows: out, tsv: tsv, csv: csv };
  console.log('%cBridgeport: done. ' + out.length + ' tests.', 'font-weight:bold;color:green');
  console.log(copied ? '→ Copied. In Excel, click cell A1 and press Ctrl+V.' : '→ Clipboard was blocked. Type  copy(bridgeport.tsv)  and press Enter, then paste into Excel.');
  cols.forEach((c, j) => { if (!c.id) return; const empty = out.filter(r => !r[j]).length; if (empty) console.warn(empty + ' test(s) have no ' + c.label + '.'); });
  console.table(out.slice(0, 10).map(r => Object.fromEntries(head.map((h, j) => [h, String(r[j]).slice(0, 80)]))));
})();
