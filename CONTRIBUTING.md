# Contributing

Thank you for helping fraud investigators work faster. Contributions from investigators, auditors and developers are all welcome.

## Ways to help

- **Suggest a test.** Open an issue describing the fraud scheme, the data it needs and how you would detect it. You do not need to write code.
- **Report a problem.** Open an issue with what you did, what you expected and what happened. Never attach real case data; describe the file's columns instead, or share a fake example.
- **Improve a guide.** The guides in [`guides/`](guides/) are plain text. Corrections and better prompts are welcome.
- **Add a test.** Follow [docs/adding-a-test.md](docs/adding-a-test.md).

## Before you open a pull request

1. Run the automated checks with `node --test` (Node 20 or later). They must all pass.
2. Open the page locally (`python3 -m http.server`, then http://localhost:8000) and run your test on its sample data.
3. Keep each pull request to one test or one change.

## Data rules

- **Never commit real data.** Sample files must be invented: no real names, bank accounts, addresses or case details. Mark fake bank accounts clearly (the samples use `FAKE` inside each IBAN).
- **No network calls.** The toolkit's promise is that data never leaves the investigator's computer. Code that sends data anywhere will not be merged.
- **No new third-party libraries** without discussion first. Every library is code that investigators must trust.

## Style

- Plain JavaScript modules, no build step.
- Plain English in everything the user reads: short sentences, no jargon without an explanation.
- Results describe facts, never conclusions about a person.

By contributing you agree that your contribution is licensed under the [MIT License](LICENSE).
