# Motive Pipeline Triage — Process Memo

**Author:** Colton · **Live demo:** https://colto57.github.io/motive-pipeline-triage/

## (a) Criteria and rationale

The triage system enforces Motive Partners’ stated **venture mandate** — Pre-Seed through Series A, US/Europe only, core fintech — then ranks survivors using weights **calibrated from 41 venture investments** listed on [motivepartners.com/portfolio](https://motivepartners.com/portfolio).

### Portfolio analysis (Venture strategy, n=41)

| Signal | Observed pattern | How we use it |
|--------|------------------|---------------|
| **Sector mix** | Wealth 34%, Banking/Payments 32%, AI/Data 15%, Capital Markets 10%, Insurance 7%, Business Services 2% | Sector fit score weighted by historical portfolio share |
| **Geography** | US 44%, Europe 56% | Both pass mandate; hub cities (NYC, Berlin, London, SF, Paris, Amsterdam) get affinity bonus |
| **Company age** | Venture backs young companies at entry | Age vs. stage windows (Pre-seed 0–2 yrs, Seed 1–4 yrs, Series A 2–5 yrs ideal) |
| **Check size** | $1–10M lead/co-lead (Motive About page) | Raise amount parsed from pitch; in-range raises score higher |
| **Themes** | Verticalized AI, embedded finance, infra APIs | Thesis similarity via TF-IDF + portfolio corpus; AI keyword bonus |

### Hard filters (strict — must pass all three)

1. **Stage:** Pre-Seed, Seed, or Series A only  
2. **Geography:** US or Europe HQ (e.g. Singapore excluded)  
3. **Sector:** Core fintech only — HR Tech, PropTech/CRE ops, logistics, pure healthcare IT, standalone climate/ESG, and non-wealth RE tech are **filtered out** with explicit reasons

### Ranking signals (post-filter)

1. **Portfolio sector fit (24%)** — maps pitch to Motive’s six venture subsectors using portfolio weights  
2. **Thesis similarity (22%)** — TF-IDF cosine vs thesis statements + 37 venture portfolio references  
3. **Traction (18%)** — ARR, GMV, growth, customers, design partners, raise size vs. $1–10M check  
4. **Founder signal (14%)** — serial exits, tier-1 fintech employers, senior titles  
5. **Geography affinity (8%)** — in-mandate + hub-city bonus  
6. **Company age fit (8%)** — founding year vs. stage-typical age  
7. **Stage fit (6%)** — Seed highest within mandate  

## (b) Scoring / filtering structure

**Layer 1 — Mandate gates:** Stage · Geography · Fintech sector → excluded companies never ranked; each failure reason shown.

**Layer 2 — Weighted score (0–100):** Weights above sum to 100%, derived from portfolio analytics rather than equal weighting.

**Layer 3 — Tiers:** ≥76 Priority Review · 60–75 Standard Review · <60 Low Priority.

**Thesis similarity method:** Company document (name, sector, founders, pitch, stage, geo, founding year) tokenized; TF-IDF vectors computed; cosine similarity vs. averaged reference corpus. Closest single portfolio comp (e.g. Navro, Synthera AI, Threatfabric) shown for explainability.

## (c) AI vs. manual judgment

| Component | Automation | Manual judgment |
|-----------|------------|-----------------|
| Stage / geo / fintech gates | Rule-based | EU country list, non-fintech sector definitions |
| Portfolio sector weights | Derived from 41 investments on Motive website | Sector taxonomy keyword patterns |
| Thesis similarity | TF-IDF + cosine (deterministic) | Corpus curation from portfolio page |
| Traction / founders / age | Heuristic parsers | Weight tuning, tier-1 employer list, age-by-stage windows |
| Tier cutoffs | Score thresholds | Calibrated to ~top third Priority Review |
| Top 3 picks | Informed by tool output | Human synthesis for memo quality |

No external LLM API — reproducible NLP appropriate for a 2–3 hour prototype.

## (d) Scaling to 10× volume or a different mandate

**10× volume:** Backend worker (Python/FastAPI or Affinity webhook); cache TF-IDF reference vectors; route Priority tier to Slack; store component scores + reasons in Affinity custom fields.

**Different mandate:** Parameterize `MOTIVE_MANDATE`, `MOTIVE_SECTOR_TAXONOMY`, and `SCORING_WEIGHTS`; rebuild corpus from relevant portfolio slice. Growth fund: drop stage gate, add ARR thresholds. New geography: swap geo rules and portfolio references.

**Optional upgrade:** Sentence-transformer embeddings; LLM for pitch summarization only, keeping numeric scores rule-based.

---

**How to run:** https://colto57.github.io/motive-pipeline-triage/ → upload CSV or run demo → export ranked output.
