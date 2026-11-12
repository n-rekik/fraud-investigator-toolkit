# 08. Shell company checker

Scores each vendor on the signs of a shell company, so you know which ones to research first.

**Status:** prompt guide. This project runs in an AI assistant today; a built-in tool may follow. [Contributions welcome](../CONTRIBUTING.md).

## What you need

The vendor master file with creation date, address, phone, email, website, tax number and bank country, plus the payment history per vendor. The company registry checks are manual, or need an AI tool with web search.

## Prompt to copy

Replace the parts in [SQUARE BRACKETS] with your own details.

```text
You are helping a fraud examiner screen vendors for shell company indicators.
File 1 is the vendor master: [COLUMNS]. File 2 is the payment history: [COLUMNS].

Score each vendor one point for each indicator:
1. No phone number, or a mobile number only.
2. A free email domain (gmail, outlook, yahoo and similar).
3. No website.
4. No tax or registration number.
5. An address shared with another vendor, or a PO box.
6. A bank account in a different country from the address.
7. First invoice within 30 days of vendor creation.
8. Invoice numbers that are sequential, which suggests we are the only customer.
9. Most invoices just below an approval limit of [AMOUNT].
10. All invoices approved by the same person.

Show the vendors sorted by score, with the indicators hit, total paid and the person who created the vendor.
For the top 20, give me a checklist of what to verify in the company registry and online.
```

## Check before you trust it

- A high score means "research this vendor". Small, real businesses often hit several indicators.
- Verify the top vendors yourself in the official company registry: registration date, directors, registered address and activity.
- Compare the directors and addresses you find with your employee list (guide 03).

## Before you upload anything

- **Check permission first.** Case data is confidential. Only use an AI tool your organisation has approved for that data.
- **Remove what you do not need.** Delete or mask names, bank details and ID numbers when the test works without them.
- **Practise on sample data.** Build and test on a fake or old file first.

---
[All guides](README.md) · [Toolkit](https://n-rekik.github.io/fraud-investigator-toolkit/)
