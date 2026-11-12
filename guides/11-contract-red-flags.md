# 11. Contract red-flag reader

Reads a contract and lists the terms that make fraud easier or harder to detect, with the clause number for each.

**Status:** prompt guide. This project runs in an AI assistant today; a built-in tool may follow. [Contributions welcome](../CONTRIBUTING.md).

## What you need

The contract and its amendments as PDF or Word files, plus a few invoices under the contract if you have them.

## Prompt to copy

Replace the parts in [SQUARE BRACKETS] with your own details.

```text
You are helping a fraud examiner review the attached contract between [OUR COMPANY] and [VENDOR CODE].

Review it for fraud and control risks. For each point, quote the clause number and say whether it is PRESENT, MISSING or UNCLEAR:
1. Right-to-audit clause and access to records.
2. Anti-bribery, conflict of interest and gifts clauses.
3. Payment terms: advance payments, payment to a third party or to another country, changes to bank details.
4. Pricing: clear rates, caps, price escalation, cost-plus terms without supporting documents.
5. Deliverables: specific and measurable, with acceptance criteria.
6. Subcontracting without our approval.
7. Automatic renewal, exclusivity and termination penalties.
8. Who signed, and whether the amendments changed price, scope or payment terms.

Then list the 5 highest risks and the documents I should request to test each one.
If invoices are attached, compare the rates, quantities and bank details on them with the contract.
This is a risk review, not legal advice.
```

## Check before you trust it

- Open each clause the assistant quotes and read it yourself. Clause numbers are sometimes wrong.
- Check that you gave it every amendment and annex. Missing terms are often in an annex.
- Take legal questions to your legal team.

## Before you upload anything

- **Check permission first.** Case data is confidential. Only use an AI tool your organisation has approved for that data.
- **Remove what you do not need.** Delete or mask names, bank details and ID numbers when the test works without them.
- **Practise on sample data.** Build and test on a fake or old file first.

---
[All guides](README.md) · [Toolkit](https://n-rekik.github.io/fraud-investigator-toolkit/)
