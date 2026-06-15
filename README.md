# Motive Partners — Pipeline Triage Automation

Case study deliverable: a working, explainable triage prototype + written memos.

## Live demo

**https://colto57.github.io/motive-pipeline-triage/**

(Click **Run demo on sample data** — no upload needed for the review.)

## Quick start (local)

1. Open **`docs/index.html`** in Chrome or Edge, or use the live link above.
2. Click **Run demo on sample data** to triage the provided 25-company CSV instantly.
3. Or **upload** `Case Study_Inbound Pipeline.csv` manually.
4. Click **Export ranked CSV** for reproducible output.

## What's included

| Path | Description |
|------|-------------|
| `docs/` | Web app deployed to GitHub Pages |
| `triage-app/` | Same app (local dev copy) |
| `deliverables/Process_Memo.md` | 1-page process memo |
| `deliverables/Top_3_Investment_Summaries.md` | Three investment summaries |
| `Case Study_Inbound Pipeline.csv` | Provided inbound data |

## How the tool works

1. **Mandate gates** — filters out non Pre-Seed–Series A and non US/Europe companies with explicit reasons.
2. **Thesis similarity** — TF-IDF cosine similarity vs. Motive venture thesis + 37 venture portfolio references.
3. **Multi-factor ranking** — sector fit, traction parsing, founder heuristics, stage fit — each with human-readable reasons.
4. **Tiers** — Priority Review / Standard Review / Low Priority.

## Submission checklist

- [ ] Share live demo link with Maria
- [ ] Attach exported ranked CSV
- [ ] Include `deliverables/Process_Memo.md`
- [ ] Include `deliverables/Top_3_Investment_Summaries.md`
