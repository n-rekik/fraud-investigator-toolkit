<p align="center">
  <img src="assets/img/wordmark.png" alt="GreenRocks.ai" width="320">
</p>

<h1 align="center">Fraud Investigator Toolkit</h1>

<p align="center">
  Free, open-source fraud tests for investigators, auditors and Certified Fraud Examiners.<br>
  Runs in your browser. <strong>Your data never leaves your computer.</strong>
</p>

<p align="center">
  <a href="https://n-rekik.github.io/fraud-investigator-toolkit/"><strong>Open the toolkit →</strong></a>
  &nbsp;·&nbsp; <a href="guides/">Prompt guides</a>
  &nbsp;·&nbsp; <a href="CONTRIBUTING.md">Add a test</a>
</p>

---

## What it does

Load a CSV or Excel file, match your columns, and get a ranked list of red flags in seconds. No coding and no installation. Download the results as Excel or CSV, or print them as a PDF report.

| Test | What it catches | Data you need |
|---|---|---|
| **Duplicate payments** | Invoices paid twice, including near-duplicates such as `INV-4471` / `INV4471`, swapped digits, and the same vendor set up twice | Paid invoices |
| **Vendor–employee match** | Vendors that share a bank account, address, phone, email or surname with an employee | Vendor and employee master files |
| **Journal entry testing** | Signs of management override: off-hours and period-end postings, round amounts, odd descriptions, rare users, suspense accounts, quick reversals | Journal entry lines |
| **Benford's Law** | Sets of amounts that look invented, and spikes just under approval limits | Any list of amounts |

Every test comes with fake sample data, so you can see how it works before you use your own files.

The [prompt guides](guides/) cover twelve projects in total, including the eight that do not have a built-in tool yet: expense claims, speak-up line, interview planning, case chronology, shell company checks, case dashboard, contract red flags and report drafting.

## Your data stays on your computer

- The page reads your file inside your browser. Nothing is uploaded: there is no server, no account and no tracking.
- The page loads nothing from other websites. Its security policy blocks any connection to another site.
- You can check this yourself: open the toolkit, wait a few seconds, switch off your internet connection, and run a test on your own file. It still works.

Even so, follow your organisation's rules on where case data may be opened.

## How to use it

1. Open **[the toolkit](https://n-rekik.github.io/fraud-investigator-toolkit/)** and choose a test.
2. Click **Use sample data** to try it, or load your own CSV or Excel file.
3. Check the column matching. The toolkit guesses from your column names.
4. Optionally adjust the settings, such as your approval limit or working hours.
5. Click **Run test**, then download or print the results.

## Results are leads, not findings

A flag means "look at this". Every result needs source documents and professional judgement before it becomes a finding, and no person should be named as a suspect on the strength of a data test. Each test page explains its method, its limits and the checks to run.

## For contributors

The toolkit is plain HTML, CSS and JavaScript with no build step. Each test is one file in [`assets/js/analytics/`](assets/js/analytics/) that follows a simple contract, so adding a test does not touch the rest of the app.

- [How to add a test](docs/adding-a-test.md), with a [ready-to-copy template](docs/new-test-template.js)
- [Contributing guidelines](CONTRIBUTING.md)
- Run the automated checks: `node --test` (Node 20 or later)
- Run the page locally: `python3 -m http.server` in this folder, then open http://localhost:8000

```
index.html                 the page
assets/js/app.js           file loading, column matching, results and exports
assets/js/core/data.js     shared helpers: amounts, dates, name matching
assets/js/analytics/       one file per test, listed in index.js
sample-data/               fake data with planted red flags
guides/                    the twelve prompt guides
tests/                     automated checks that run on every change
```

## Licence

MIT. Free to use, change and share, including at work, as long as the copyright notice stays. See [LICENSE](LICENSE). Bundled libraries: [PapaParse](https://www.papaparse.com/) and [ExcelJS](https://github.com/exceljs/exceljs), both MIT.

---

Built by **[GreenRocks.ai](https://greenrocks.ai)**, a knowledge platform for internal auditors and fraud examiners. Questions or ideas: nidhal@greenrocks.ai
