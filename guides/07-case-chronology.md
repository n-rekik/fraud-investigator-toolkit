# 07. Case chronology builder

Reads emails, contracts, invoices and notes, and returns one dated timeline of who did what and when, with a source for every line.

**Status:** prompt guide. This project runs in an AI assistant today; a built-in tool may follow. [Contributions welcome](../CONTRIBUTING.md).

## What you need

The case documents as PDF, Word, email or text files, each with a file name or exhibit number you can cite.

## Prompt to copy

Replace the parts in [SQUARE BRACKETS] with your own details.

```text
You are helping a fraud examiner build a case chronology from the attached documents.

1. Extract every dated event. For each one give: date, time if known, what happened, who was involved, the amount if any, and the source file and page.
2. Sort the events from oldest to newest in one table.
3. Use only what the documents say. If a date is unclear or inferred, mark it UNCLEAR and explain why.
4. Mark events that look out of sequence, for example a payment before an approval, or a bank detail change shortly before a payment.
5. List the time gaps longer than [30] days and the documents that seem to be missing.
6. List every person and company named, with the number of events they appear in.
Do not interpret intent. Report facts and sequence only.
```

## Check before you trust it

- Check every line you plan to use against the source document. AI tools sometimes misread dates, especially day and month order.
- Work in batches if you have many documents, then ask the assistant to merge the timelines.
- Keep the original files unchanged. The chronology is a working paper, not evidence.

## Before you upload anything

- **Check permission first.** Case data is confidential. Only use an AI tool your organisation has approved for that data.
- **Remove what you do not need.** Delete or mask names, bank details and ID numbers when the test works without them.
- **Practise on sample data.** Build and test on a fake or old file first.

---
[All guides](README.md) · [Toolkit](https://n-rekik.github.io/fraud-investigator-toolkit/)
