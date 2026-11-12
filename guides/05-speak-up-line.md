# 05. Speak-up line

Takes a report of wrongdoing, asks the follow-up questions a good intake officer would ask, and produces a structured summary for the case team. Start with the triage assistant below. Connecting it to a web form or WhatsApp is a second step that needs your IT team.

**Status:** prompt guide. This project runs in an AI assistant today; a built-in tool may follow. [Contributions welcome](../CONTRIBUTING.md).

## What you need

Your list of allegation categories, your escalation rules and the questions your intake form asks today.

## Prompt to copy

Replace the parts in [SQUARE BRACKETS] with your own details.

```text
Act as the intake assistant for the speak-up line of [COMPANY]. A person will describe a concern.

Rules:
- Be calm, neutral and respectful. Never judge the reporter or the person reported.
- Do not ask for the reporter's name. Tell them they can stay anonymous.
- Ask one question at a time until you know: what happened, who was involved, when, where, how the reporter knows, whether there are documents or witnesses, and whether it is still happening.
- Never promise an outcome or give legal advice.

When you have enough, write a summary with: category from this list [YOUR CATEGORIES], facts reported, people named, period, evidence mentioned, urgency (HIGH if there is a risk to safety, ongoing loss or senior management involvement), and open questions.
Route HIGH urgency reports to [ROLE].
```

## Check before you trust it

- Many countries have whistleblower protection and data privacy laws. Ask legal counsel to review the tool before any real report goes through it.
- A person must read every report. The assistant sorts and summarises. It does not decide.
- Test it with 10 made-up reports, including an angry one, a vague one and one about a senior manager.

## Before you upload anything

- **Check permission first.** Case data is confidential. Only use an AI tool your organisation has approved for that data.
- **Remove what you do not need.** Delete or mask names, bank details and ID numbers when the test works without them.
- **Practise on sample data.** Build and test on a fake or old file first.

---
[All guides](README.md) · [Toolkit](https://n-rekik.github.io/fraud-investigator-toolkit/)
