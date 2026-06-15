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

1. **Strict mandate gates** — Pre-Seed–Series A, US/Europe, core fintech only (non-fintech filtered with reasons).
2. **Portfolio-calibrated scoring** — weights derived from 38 Motive venture portfolio companies (sector mix, geography, company age, hub cities). 41 total Venture entries on motivepartners.com/portfolio; corpus uses 38 (see Process Memo).
3. **Thesis similarity** — TF-IDF cosine vs Motive venture thesis + portfolio references.
4. **Tiers** — Priority Review / Standard Review / Low Priority with explainable component scores.

## Submission checklist

- [ ] Share live demo link with Maria
- [ ] Attach exported ranked CSV
- [ ] Include `deliverables/Process_Memo.md`
- [ ] Include `deliverables/Top_3_Investment_Summaries.md`
