# How to add a test

Each test is one JavaScript file. The page builds the file upload, the column matching, the settings form, the results tables, the charts and the Excel export from what that file describes. You only write the test logic.

## The steps

1. **Copy the template.** Copy [`docs/new-test-template.js`](new-test-template.js) to `assets/js/analytics/your-test-id.js`.
2. **Describe the data.** List the files the test needs (`datasets`) and the columns in each (`fields`). Give each field `aliases`: the column names people commonly use, so the page can match them automatically.
3. **Add settings.** List anything an investigator may want to change (`options`), with a sensible default.
4. **Write `run()`.** It receives the rows and the user's column matching, and returns headline numbers, notes and tables. Use the helpers in [`assets/js/core/data.js`](../assets/js/core/data.js) to read amounts, dates and names. They already handle formats like `1.234,56`, `31/12/2026` and `ACME Limited`.
5. **Register it.** Import the file in [`assets/js/analytics/index.js`](../assets/js/analytics/index.js) and add it to the list.
6. **Add sample data.** Add a fake file to `sample-data/` with red flags planted on purpose, and describe them in [`sample-data/README.md`](../sample-data/README.md). If you generate it, add the generator to `tools/make_sample_data.py`.
7. **Add a check.** In [`tests/analytics.test.mjs`](../tests/analytics.test.mjs), run your test on the sample file and confirm it finds every planted red flag. Run `node --test`.
8. **Write a guide.** Add `guides/NN-your-test.md` covering what it catches, the data, the method, its limits and the checks to run before trusting a result.

## Rules every test follows

- **Facts, not conclusions.** Describe what the data shows ("same bank account"), never what a person did ("employee is stealing").
- **Explain every flag.** Each flagged row says why it was flagged and gives the row number in the source file, so the investigator can trace it.
- **Say what you skipped.** If a column is missing or rows cannot be read, say so in `notes`. Never fail silently.
- **Name innocent explanations.** Add a note for the common false positives.
- **No network.** A test must work with the internet switched off. Never send data anywhere.
- **Pure function.** `run()` must not touch the page, so it can run in the automated checks.
- **Cite your method.** If the test follows a standard or a published method, name it in the guide.

## The result format

```js
{
  summary: [{ label, value, tone?: 'good'|'warn'|'bad', format?: 'money', hint? }],
  notes: ['plain-English caution', ...],
  sections: [{
    title, description,
    chart?: { kind: 'bars', format?: 'percent', labels: [...], series: [{ name, values: [...], tone?: 'accent'|'muted' }] },
    table?: { columns: [{ key, label, type }], rows: [...], empty? },
  }],
}
```

Column types: `text`, `date` (text that never wraps), `number`, `money`, `percent` (a value from 0 to 1), `decimal`, `flag` (shows HIGH / MEDIUM / LOW as a coloured tag). Add `wide: true` to a long text column, such as the reason a row was flagged.
