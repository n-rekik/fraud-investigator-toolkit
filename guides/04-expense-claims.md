# 04. Expense claim scanner

Ranks expense claims and claimants by risk. It looks for claims split to stay under an approval limit, weekend and holiday spending, round amounts and the same receipt claimed twice.

**Status:** prompt guide. This project runs in an AI assistant today; a built-in tool may follow. [Contributions welcome](../CONTRIBUTING.md).

## What you need

An expense export with employee, date, category, merchant, amount, approver and description. Know your approval limits and receipt threshold.

## Prompt to copy

Replace the parts in [SQUARE BRACKETS] with your own details.

```text
You are helping a fraud examiner review expense claims for [PERIOD].
Columns: [LIST]. The approval limit is [AMOUNT]. Receipts are required above [AMOUNT]. The country is [COUNTRY].

Run these tests and show the results of each in its own table:
1. Split claims: same employee, same merchant or category, within 3 days, each below the limit but together above it.
2. Just-under amounts: claims within 5% below the approval limit or the receipt threshold.
3. Weekend and public holiday claims, excluding travel categories.
4. Round amounts (multiples of 50 or 100) outside per-diem categories.
5. Possible duplicates: same employee, same amount, same merchant, within 30 days.
6. Employees who approve each other's claims.

Then give me a top-10 list of employees by number of flags and by flagged amount, compared with the average for their department.
```

## Check before you trust it

- Check the public holiday list used for your country.
- Compare people with similar jobs. A sales representative travels more than an accountant.
- Pull the receipts for the top flags before you speak to anyone.

## Before you upload anything

- **Check permission first.** Case data is confidential. Only use an AI tool your organisation has approved for that data.
- **Remove what you do not need.** Delete or mask names, bank details and ID numbers when the test works without them.
- **Practise on sample data.** Build and test on a fake or old file first.

---
[All guides](README.md) · [Toolkit](https://n-rekik.github.io/fraud-investigator-toolkit/)
