# 10. Case dashboard

Shows all your cases on one page: how many are open, how old they are, the estimated loss, what has been recovered and what is overdue.

**Status:** prompt guide. This project runs in an AI assistant today; a built-in tool may follow. [Contributions welcome](../CONTRIBUTING.md).

## What you need

A case log in Excel with one row per case: case ID, date opened, source (hotline, audit, management), allegation type, business unit, owner, status, estimated loss, amount recovered, next deadline and date closed.

## Prompt to copy

Replace the parts in [SQUARE BRACKETS] with your own details.

```text
You are helping the head of investigations. The attached file is our case log, one row per case.
Columns: [LIST].

Build a one-page dashboard as a single file I can open in a browser. Include:
1. Four headline numbers: open cases, average age of open cases in days, total estimated loss, total recovered.
2. Open cases by allegation type (bar chart).
3. Cases opened and closed per month for the last 12 months (line chart).
4. Estimated loss against amount recovered, by business unit.
5. A table of open cases sorted by next deadline, with overdue ones marked.
6. Cases by source.

Use case IDs only. Do not show names of subjects or reporters.
Then tell me how to refresh the dashboard when I update the Excel file.
```

## Check before you trust it

- Add up the headline numbers in Excel and compare them with the dashboard.
- Check who can open the file. Even without names, case data is sensitive.
- Agree the definition of "estimated loss" before you show the dashboard to the board.

## Before you upload anything

- **Check permission first.** Case data is confidential. Only use an AI tool your organisation has approved for that data.
- **Remove what you do not need.** Delete or mask names, bank details and ID numbers when the test works without them.
- **Practise on sample data.** Build and test on a fake or old file first.

---
[All guides](README.md) · [Toolkit](https://n-rekik.github.io/fraud-investigator-toolkit/)
