# 03. Vendor–employee matcher

Finds vendors that share a bank account, address, phone number or email with an employee. A match can point to a fictitious vendor or an undisclosed conflict of interest.

**Built-in tool:** this test runs in the toolkit. [Open it](https://n-rekik.github.io/fraud-investigator-toolkit/#vendor-employee), load your file and map your columns; your data stays on your computer. The prompt below lets you run it in an AI assistant instead.

## What you need

The vendor master file and the employee master file, each with name, address, phone, email and bank account. You need approval from HR and your data protection officer to use employee data.

## Prompt to copy

Replace the parts in [SQUARE BRACKETS] with your own details.

```text
You are helping a fraud examiner compare two files: a vendor master file and an employee master file.
Vendor columns: [LIST]. Employee columns: [LIST].

1. Clean both files: remove spaces and punctuation from bank accounts and phone numbers, and standardise addresses (Street/St., Road/Rd.).
2. Find matches on: bank account (exact), phone (exact), email (exact), address (close match), and vendor name against employee surname (close match).
3. For each match show the vendor, the employee, the matching field and both original values.
4. Rate each match HIGH (bank account), MEDIUM (address, phone or email) or LOW (name only).
5. For HIGH and MEDIUM matches, add the vendor creation date and who created the vendor, if the file has it.
Do not draw conclusions about any person. List facts only.
```

## Check before you trust it

- Some matches are legitimate, such as employees who are reimbursed through the vendor system. Ask finance before you escalate.
- Shared office buildings and common surnames create false matches on address and name.
- For each real match, check the conflict-of-interest register and pull the vendor's payment history.

## How the built-in tool works

Bank accounts are compared without spaces or punctuation. Phone numbers are compared on their last nine digits, so +31 6 1234 5678 matches 06-12345678. Generic emails such as info@ or accounts@ are ignored. Addresses are normalised (Road → rd, Street → st…) and compared when they share a house number and street word; a match needs 90% similarity and the same postcode when both files have one. A vendor name containing an employee's surname (four letters or more) is a LOW match.

## Before you upload anything

- **Check permission first.** Case data is confidential. Only use an AI tool your organisation has approved for that data.
- **Remove what you do not need.** Delete or mask names, bank details and ID numbers when the test works without them.
- **Practise on sample data.** Build and test on a fake or old file first.

---
[All guides](README.md) · [Toolkit](https://n-rekik.github.io/fraud-investigator-toolkit/)
