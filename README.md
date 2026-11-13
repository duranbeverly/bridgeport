# Bridgeport

**Get thousands of Jira / Xray test cases, descriptions included, into one clean spreadsheet. It also works in locked-down environments where you can't install anything.**

▶ **Live demo:** https://duranbeverly.github.io/bridgeport/ (click *Load demo*; all data is fictional)

---

## The problem

A QA team needed every test case in their Jira/Xray repository in one spreadsheet, with full descriptions, to review and plan coverage. It sounds like a simple export. It wasn't:

- **The list view hides descriptions.** You have to click into each test, one at a time, across thousands of tests.
- **Exports stop at about 1,000 rows,** so large repositories come out in overlapping chunks.
- **Multi-line descriptions break spreadsheets.** One test spills across several rows.
- **The team works inside a locked-down VDI.** No installs, no outside tools, strict security.

## The approach: meet the environment where it is

Bridgeport has two paths that share the same cleanup and validation rules:

| | Open environment | Locked-down VDI |
|---|---|---|
| **Input** | Jira CSV exports (any number of capped chunks) | A **generated console script** pasted into DevTools on the Jira page |
| **How it gets data** | Files you drop in | Jira's own REST API with your existing session, 100 tests per page, no row cap |
| **Install needed** | None (static web page) | None (one script, read-only) |
| **Output** | `.xlsx` or CSV | Clipboard (paste into Excel) and CSV |

Both paths map columns, flatten multi-line descriptions to one line, remove duplicates across exports, normalize dates, and **validate before export** (missing descriptions, missing criticality, duplicate keys, text over Excel's cell limit).

## Design decisions

- **Use the API, not the screen.** Scraping the list view can't see descriptions and breaks when the UI changes. The search API returns every field.
- **Zero-install by design.** The VDI path runs with the user's existing session: no new credential, no new network path, nothing to get approved.
- **Read-only and gentle.** It only makes GET requests, with a short pause between pages, and refuses to run if pointed at an embedded app frame instead of Jira.
- **Works on Jira Cloud and Server/Data Center.** It falls back to Cloud's newer `/rest/api/3/search/jql` endpoint and converts rich-text (ADF) descriptions to plain text.
- **Spreadsheet-safe.** Real `.xlsx` output (frozen header, filters) built in the browser with no libraries, plus protection against formula injection in CSV/clipboard output.
- **Configurable.** Pick columns, including any custom field by name. The field ID is resolved at run time.

## Try it

- **Demo:** open the live link and click **Load demo**. It loads 1,240 fictional tests split across two overlapping "capped" exports and merges them into one clean sheet.
- **Locked-down mode:** choose columns, copy the script, paste it into the DevTools Console on a Jira page (context: `top`), and paste the result into Excel.
- **Offline:** download `index.html` and open it. It needs no network.

## Project layout

```
index.html               the whole app (UI + shared core), runs offline
bridgeport-console.js    default console script (generated from index.html)
scripts/build-console.cjs  regenerates bridgeport-console.js
tests/run.cjs            test suite: converter + console script against a fake Jira
```

Run the tests with Node 18+:

```
node tests/run.cjs
```

## Roadmap

- **Connected mode:** sign in to Jira Cloud and pull directly, with no export step.
- **Migrate to Linear:** field-mapping preview, dry run, and one-click rollback of everything created.
- Xray test steps (step-level rows) and Google Sheets export.

---

Built by [Beverly Duran](https://beverlyduran.com). Independent project, not affiliated with Atlassian, Xray, or Linear. All sample data is fictional.
