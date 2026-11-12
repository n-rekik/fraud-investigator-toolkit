# 09. Journal entry tester

Tests every journal entry in the ledger for the signs of management override, where a sample would test only a few.

**Built-in tool:** this test runs in the toolkit. [Open it](https://n-rekik.github.io/fraud-investigator-toolkit/#journal-entries), load your file and map your columns; your data stays on your computer. The prompt below lets you run it in an AI assistant instead.

## What you need

A journal entry export with entry number, posting date, entry date and time, user, account, amount (or debit and credit), description and whether the entry was manual or automatic.

## Prompt to copy

Replace the parts in [SQUARE BRACKETS] with your own details.

```text
You are helping a fraud examiner test journal entries for [PERIOD].
Columns: [LIST]. Normal working hours are [08:00-18:00], Monday to Friday. Period-end dates are [LIST].

First confirm the file is complete: number of entries, total debits and total credits. They must balance.

Then flag manual entries that meet any of these tests:
1. Entered outside working hours, at weekends or on public holidays.
2. Posted in the last 3 days of a period or the first 3 days of the next one.
3. Round amounts ending in 000.
4. A blank description, or words such as: adjust, correct, plug, reclass, per CFO, as instructed.
5. Posted by a user who rarely posts entries (fewer than [5] in the period), or by a senior manager.
6. Unusual account pairs, such as revenue against a balance sheet account other than receivables or cash.
7. Posted to suspense or clearing accounts.
8. Entered and later reversed in the next period.

Give each entry a score equal to the number of tests it fails. Show the top 50 by score, then by amount, and a summary by user and by account.
```

## Check before you trust it

- Agree the file totals to the trial balance before you rely on any test.
- Automated postings and scheduled batch jobs often run at night. Confirm which entries are really manual.
- For each high-score entry, get the supporting documents and the approval.

## How the built-in tool works

These are the journal entry characteristics that auditing standards point to when responding to the risk of management override (ISA 240 and PCAOB AS 2401). Lines are grouped into entries by entry number; debits and credits must net to zero in each entry. The time test uses the "entered on" time when the file has one. A reversal is a later entry, within the window (default 45 days), whose lines are the exact opposite of the original. The unusual-combination test needs your chart of accounts: tell it which prefixes are revenue and which are normal counter-accounts (for example receivables and cash).

## Before you upload anything

- **Check permission first.** Case data is confidential. Only use an AI tool your organisation has approved for that data.
- **Remove what you do not need.** Delete or mask names, bank details and ID numbers when the test works without them.
- **Practise on sample data.** Build and test on a fake or old file first.

---
[All guides](README.md) · [Toolkit](https://n-rekik.github.io/fraud-investigator-toolkit/)
