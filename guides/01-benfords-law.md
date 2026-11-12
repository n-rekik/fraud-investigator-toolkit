# 01. Benford's Law analyzer

Flags sets of amounts that look invented. In many natural sets of numbers, the first digit is 1 about 30.1% of the time and 9 only about 4.6% of the time. People who make up numbers rarely follow that pattern.

**Built-in tool:** this test runs in the toolkit. [Open it](https://n-rekik.github.io/fraud-investigator-toolkit/#benford), load your file and map your columns; your data stays on your computer. The prompt below lets you run it in an AI assistant instead.

## What you need

One file of transactions with an amount column. General ledger, accounts payable or expense data all work. Use at least 1,000 rows.

## Prompt to copy

Replace the parts in [SQUARE BRACKETS] with your own details.

```text
You are helping a fraud examiner. The attached file contains [TYPE OF TRANSACTIONS] for [PERIOD].
The amount column is [COLUMN NAME].

1. Remove zero and negative amounts and tell me how many rows remain.
2. Run a first-digit and a first-two-digits Benford's Law test.
3. Show a table of expected versus actual frequency for each digit, and a chart.
4. List the digits and two-digit combinations with the largest deviation.
5. For the top 3 deviations, list the transactions behind them, grouped by [VENDOR / EMPLOYEE / ACCOUNT].
6. Explain in plain English what each deviation could mean, including innocent explanations.
```

## Check before you trust it

- Benford's Law does not fit every data set. It fails on amounts with a fixed price, a set minimum or maximum, or assigned numbers such as invoice numbers.
- A deviation is a reason to look, not proof. Approval limits often explain a spike: many amounts just under €5,000 can point to a €5,000 limit.
- Recount one digit yourself in Excel to confirm the numbers.

## How the built-in tool works

The toolkit runs a first-digit and a first-two-digits test. For each digit it computes the actual share, Benford's expected share log10(1 + 1/d) and Nigrini's z-statistic with continuity correction; z above 1.96 is significant at 5%. Overall conformity uses the mean absolute deviation (MAD) with Nigrini's thresholds: first digit 0.006 / 0.012 / 0.015, first two digits 0.0012 / 0.0018 / 0.0022. Amounts below a minimum (default 10) are left out because small amounts distort the test. Source: Mark J. Nigrini, *Benford's Law* (Wiley, 2012).

## Before you upload anything

- **Check permission first.** Case data is confidential. Only use an AI tool your organisation has approved for that data.
- **Remove what you do not need.** Delete or mask names, bank details and ID numbers when the test works without them.
- **Practise on sample data.** Build and test on a fake or old file first.

---
[All guides](README.md) · [Toolkit](https://n-rekik.github.io/fraud-investigator-toolkit/)
