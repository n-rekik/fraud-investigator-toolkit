# 02. Duplicate payment detector

Finds invoices that were paid twice, including the ones a simple exact-match test misses: typing differences such as INV-4471 and INV4471, or Acme Ltd and ACME Limited.

**Built-in tool:** this test runs in the toolkit. [Open it](https://n-rekik.github.io/fraud-investigator-toolkit/#duplicate-payments), load your file and map your columns; your data stays on your computer. The prompt below lets you run it in an AI assistant instead.

## What you need

A paid-invoices file with vendor number, vendor name, invoice number, invoice date, amount and payment date.

## Prompt to copy

Replace the parts in [SQUARE BRACKETS] with your own details.

```text
You are helping a fraud examiner test for duplicate payments. The attached file lists paid invoices for [PERIOD].
Columns: [LIST YOUR COLUMN NAMES].

Find possible duplicates using these tests:
1. Same vendor, same invoice number, same amount.
2. Same vendor, same amount, invoice numbers that differ only by spaces, dashes, leading zeros or swapped digits.
3. Same amount and same invoice date, with vendor names that are similar but not identical.
4. Same vendor, same amount, invoice dates within [14] days of each other.

For each pair, show both lines side by side, the test that caught it and a match score from 0 to 100.
Sort by score, then by amount. Give me the total amount at risk per test.
Exclude pairs where one line is a credit note or reversal, and tell me how many you excluded.
```

## Check before you trust it

- Recurring payments such as rent or subscriptions appear as false matches. The toolkit lists them separately under "Recurring amounts".
- Confirm each real duplicate against the invoice images and the bank statement before you ask for a refund.
- Check whether the second payment was already reversed or recovered.

## How the built-in tool works

Only invoices with the same amount (to the cent) are compared. Invoice numbers are normalised (upper case, no spaces or punctuation, no leading zeros) and vendor names lose legal suffixes (Ltd, BV, GmbH…). Test 2 accepts one changed character, two swapped neighbouring characters, or one number contained in the other. Test 3 compares vendor names with an edit-distance similarity (default 85%). Each pair is reported once, under its strongest test. When a vendor bills the same amount three or more times, near-identical invoice numbers are only flagged if the dates are also close, so monthly invoices such as RENT-01 and RENT-02 are not reported as duplicates.

## Before you upload anything

- **Check permission first.** Case data is confidential. Only use an AI tool your organisation has approved for that data.
- **Remove what you do not need.** Delete or mask names, bank details and ID numbers when the test works without them.
- **Practise on sample data.** Build and test on a fake or old file first.

---
[All guides](README.md) · [Toolkit](https://n-rekik.github.io/fraud-investigator-toolkit/)
