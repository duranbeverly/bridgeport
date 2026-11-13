// Bridgeport test suite. Run: node tests/run.cjs
const assert = require('assert/strict');
const core = require('./load-core.cjs')();

let passed = 0;
async function test(name, fn) {
  try { await fn(); passed++; console.log('  ok  ' + name); }
  catch (e) { console.error('  FAIL ' + name + '\n       ' + e.message); process.exitCode = 1; }
}

// ---------- Fake Jira for the console script ----------
function fakeJira({ mode = 'server', n = 250, withCriticality = true } = {}) {
  const issues = Array.from({ length: n }, (_, i) => ({
    key: 'QA-' + (i + 1),
    fields: {
      summary: 'Test ' + (i + 1) + ', "quoted"',
      description: mode === 'cloud'
        ? { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Step one' }] }, { type: 'paragraph', content: [{ type: 'text', text: 'Expected: ok' }] }] }
        : '# Step one\n# Step *two*\nExpected: ok',
      created: '2026-03-0' + (1 + (i % 9)) + 'T10:00:00.000-0500',
      ...(withCriticality ? { customfield_10050: i === 3 ? null : { value: 'P' + (i % 4) } } : {}),
    },
  }));
  // A look-alike field is listed first to prove the exact name wins.
  const fieldList = withCriticality ? [{ id: 'customfield_99999', name: 'Bug Criticality' }, { id: 'customfield_10050', name: 'Criticality' }] : [{ id: 'customfield_20000', name: 'Story Points' }];
  let calls = 0;
  const fetch = async u => {
    calls++;
    const url = new URL(u);
    const ok = body => ({ ok: true, status: 200, json: async () => body });
    if (url.pathname.endsWith('/rest/api/2/field')) return ok(fieldList);
    // Like Jira: "key in (...)" / "key = X" select those issues, and an unknown key is a 400 error.
    const jql = url.searchParams.get('jql') || '';
    let pool = issues;
    const keyQuery = jql.match(/^key (?:in \(([^)]*)\)|= (\S+))/);
    if (keyQuery) {
      const wanted = (keyQuery[1] || keyQuery[2]).split(',').map(s => s.trim());
      const unknown = wanted.find(k => !issues.some(i => i.key === k));
      if (unknown) return { ok: false, status: 400, json: async () => ({ errorMessages: [`An issue with key '${unknown}' does not exist for field 'key'.`] }) };
      pool = issues.filter(i => wanted.includes(i.key));
    }
    if (url.pathname.endsWith('/rest/api/2/search')) {
      if (mode === 'cloud') return { ok: false, status: 410, json: async () => ({ errorMessages: ['gone'] }) };
      const s = +url.searchParams.get('startAt');
      return ok({ total: pool.length, issues: pool.slice(s, s + 100) });
    }
    if (url.pathname.endsWith('/rest/api/3/search/jql')) {
      const t = +(url.searchParams.get('nextPageToken') || 0);
      return ok({ issues: pool.slice(t, t + 100), nextPageToken: t + 100 < pool.length ? String(t + 100) : undefined });
    }
    return { ok: false, status: 404, json: async () => ({}) };
  };
  return { fetch, calls: () => calls };
}

async function runScript(script, { host = 'acme.atlassian.net', jira, input = 'project = QA' }) {
  let clip = null, downloaded = null; const logs = [];
  const g = {
    prompt: () => input,
    location: { origin: 'https://' + host, hostname: host },
    AJS: undefined,
    fetch: jira.fetch,
    copy: t => { clip = t; },
    navigator: {},
    document: { createElement: () => ({ click() { downloaded = this.download; }, remove() {} }), body: { appendChild() {} } },
    URL: { createObjectURL: () => 'blob:x' },
    Blob: class { constructor(p) { this.p = p; } },
    setTimeout: f => f(),
    console: { log: (...a) => logs.push(a.join(' ')), warn: (...a) => logs.push('WARN ' + a.join(' ')), error: (...a) => logs.push('ERR ' + a.join(' ')), table() {} },
  };
  g.window = g;
  const body = script.replace(/^\/\/.*$/gm, '').trim().replace(/;\s*$/, '');
  await new Function(...Object.keys(g), 'return ' + body)(...Object.values(g));
  return { clip, downloaded, logs, rows: clip ? clip.split('\r\n').map(l => l.split('\t')) : null };
}

(async () => {
  console.log('Converter');
  const demo = core.demoExports();
  const srcs = demo.map(d => core.sourceFromText(d.name, d.text));
  const opts = { sep: ' | ', clean: true, datefmt: 'iso' };
  const built = core.buildTable(srcs, opts);

  await test('demo: two capped exports (1,000 + 340 rows) merge into 1,240 unique tests', () => {
    assert.equal(srcs[0].rows.length, 1000);
    assert.equal(srcs[1].rows.length, 340);
    assert.equal(built.read, 1340);
    assert.equal(built.rows.length, 1240);
    assert.equal(built.problems.dupes, 100);
  });
  await test('columns are auto-detected from Jira export headers', () => {
    assert.deepEqual(srcs[0].mapping, { key: 0, title: 1, description: 3, criticality: 4, created: 5 });
  });
  await test('every description is on one line, wiki markup cleaned', () => {
    for (const r of built.rows) { assert.ok(!/[\r\n]/.test(r.description), r.key); assert.ok(!/\{\{|\*Preconditions/.test(r.description), r.key); }
  });
  await test('dates normalized to YYYY-MM-DD and rows sorted by key number', () => {
    for (const r of built.rows) assert.match(r.created, /^\d{4}-\d{2}-\d{2}$/);
    assert.equal(built.rows[0].key, 'DEMO-1'); assert.equal(built.rows[9].key, 'DEMO-10'); assert.equal(built.rows.at(-1).key, 'DEMO-1240');
  });
  await test('missing descriptions and criticality are reported, not dropped', () => {
    assert.ok(built.problems.noDesc.length > 0); assert.ok(built.problems.noCrit > 0);
    assert.ok(built.rows.some(r => r.description === ''));
  });
  await test('CSV parser handles quotes, commas and multi-line cells', () => {
    const rows = core.parseCSV('a,b\n"x, ""y""","line1\nline2"\n');
    assert.deepEqual(rows, [['a', 'b'], ['x, "y"', 'line1\nline2']]);
  });
  await test('CSV export guards against formula injection', () => {
    const csv = core.toCSV([{ key: 'K-1', title: '=HYPERLINK("x")', description: '-1', criticality: '', created: '' }]);
    assert.ok(csv.includes(`"'=HYPERLINK(""x"")"`)); assert.ok(csv.includes(",'-1,"));
  });
  await test('XLSX export is a valid zip with the expected parts', () => {
    const x = Buffer.from(core.toXLSX(built.rows));
    assert.equal(x.readUInt32LE(0), 0x04034b50);
    assert.equal(x.readUInt32LE(x.length - 22), 0x06054b50);
    assert.equal(x.readUInt16LE(x.length - 12), 6);
    const s = x.toString('utf8');
    for (const p of ['[Content_Types].xml', 'xl/workbook.xml', 'xl/worksheets/sheet1.xml']) assert.ok(s.includes(p), p);
    assert.ok(s.includes('<autoFilter ref="A1:E1241"/>'));
  });
  await test('JSON input (from the console tool) is accepted', () => {
    const j = core.sourceFromText('x.json', JSON.stringify({ issues: [{ key: 'QA-9', summary: 'T', description: 'a\n\nb', criticality: 'P1', created: '2026-03-04T10:00:00.000-0500' }] }));
    assert.deepEqual(core.buildTable([j], opts).rows, [{ key: 'QA-9', title: 'T', description: 'a | b', criticality: 'P1', created: '2026-03-04' }]);
  });

  console.log('Console script (against a fake Jira)');
  const script = core.buildConsoleScript({ jql: 'issuetype = Test', sep: ' | ', csv: true, columns: core.SCRIPT_SOURCES.filter(c => c.on) });
  await test('generated script is valid JavaScript', () => { new Function(script); });

  for (const mode of ['server', 'cloud']) {
    await test(`${mode}: pulls all 250 tests across pages with 5 columns`, async () => {
      const jira = fakeJira({ mode });
      const r = await runScript(script, { jira });
      assert.equal(r.rows.length, 251);
      assert.deepEqual(r.rows[0], ['Test Key', 'Test Title', 'Description', 'Criticality', 'Date Added']);
      for (const row of r.rows) assert.equal(row.length, 5);
      assert.equal(r.rows[1][0], 'QA-1');
      assert.equal(r.rows[1][3], 'P0');
      assert.equal(r.rows[1][4], '2026-03-01');
      assert.ok(!r.rows[1][2].includes('\n'));
      assert.match(r.downloaded, /^tests-\d{4}-\d{2}-\d{2}\.csv$/);
    });
  }
  await test('picks the field named exactly "Criticality" over look-alikes', async () => {
    const r = await runScript(script, { jira: fakeJira() });
    assert.ok(r.logs.some(l => l.includes('(customfield_10050)')));
  });
  await test('warns (does not fail) when Criticality is missing', async () => {
    const r = await runScript(script, { jira: fakeJira({ withCriticality: false }) });
    assert.equal(r.rows.length, 251);
    assert.ok(r.logs.some(l => l.startsWith('WARN') && l.includes('no field named "Criticality"')));
  });
  for (const mode of ['server', 'cloud']) {
    await test(`${mode}: a pasted list of keys (e.g. from an Xray folder) fetches exactly those tests`, async () => {
      const keys = Array.from({ length: 150 }, (_, i) => 'QA-' + (i * 2 + 1)); // 150 keys -> 2 batches
      const r = await runScript(script, { jira: fakeJira({ mode, n: 400 }), input: keys.join('\n') });
      assert.equal(r.rows.length, 151);
      assert.deepEqual(r.rows.slice(1).map(row => row[0]), keys);
      assert.ok(r.logs.some(l => l.includes('150 test keys pasted') && l.includes('2 batch')));
      assert.ok(r.rows.slice(1).every(row => row[2].length > 0));
    });
  }
  await test('keys that do not exist are skipped and reported, the rest still come through', async () => {
    const r = await runScript(script, { jira: fakeJira({ n: 50 }), input: 'QA-1, QA-2, QA-999, QA-3' });
    assert.deepEqual(r.rows.slice(1).map(row => row[0]), ['QA-1', 'QA-2', 'QA-3']);
    assert.ok(r.logs.some(l => l.startsWith('WARN') && l.includes('QA-999')));
  });
  await test('a normal search is not mistaken for a key list', async () => {
    const r = await runScript(script, { jira: fakeJira({ n: 120 }), input: 'project = QA AND issuetype = Test' });
    assert.equal(r.rows.length, 121);
    assert.ok(!r.logs.some(l => l.includes('keys pasted')));
  });
  await test('refuses to run inside the Xray frame, with zero requests', async () => {
    const jira = fakeJira();
    const r = await runScript(script, { jira, host: 'us.xray.cloud.getxray.app' });
    assert.equal(jira.calls(), 0); assert.equal(r.clip, null);
    assert.ok(r.logs.some(l => l.startsWith('ERR') && l.includes('"top"')));
  });

  console.log(`\n${passed} passed${process.exitCode ? ', some FAILED' : ''}`);
})();
