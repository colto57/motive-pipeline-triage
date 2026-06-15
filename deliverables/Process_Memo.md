# Motive Pipeline Triage — Process Memo

**Author:** Colton · **Tool:** `triage-app/` (browser-based prototype)

## (a) Criteria and rationale

The triage system mirrors Motive Partners’ stated venture mandate: **Pre-Seed through Series A**, **US/Europe geography**, and **core fintech verticals** (payments, banking infrastructure, lending, insurance, wealth, capital markets, AI/data for financial services).

Beyond hard gates, remaining deals are ranked on five signals aligned with how a venture team actually prioritizes inbound:

1. **Thesis similarity** — semantic proximity to Motive’s public venture thesis and 37 venture portfolio companies (from motivepartners.com).
2. **Sector alignment** — keyword fit to Motive core sectors, with penalties for clearly off-thesis categories (HR, logistics, pure healthcare IT, etc.).
3. **Traction** — parsed ARR, GMV, growth rates, customer counts, and institutional design partners from pitch text.
4. **Founder signal** — serial exits, tier-1 fintech/financial services employers, senior operator titles.
5. **Stage fit** — Seed and Series A weighted highest within mandate.

## (b) Scoring / filtering structure

**Layer 1 — Hard filters (binary):** Stage ∉ {Pre-Seed, Seed, Series A} → excluded with reason. HQ outside US/Europe (e.g., Singapore) → excluded.

**Layer 2 — Weighted score (0–100):** Thesis 28%, Sector 22%, Traction 22%, Founders 18%, Stage 10%.

**Layer 3 — Tiers:** ≥78 Priority Review · 62–77 Standard Review · <62 Low Priority.

**Thesis similarity method:** Each company document (name + sector + founders + pitch) and a reference corpus (Motive thesis statements + venture portfolio entries) are tokenized. TF-IDF vectors are computed over the combined vocabulary; **cosine similarity** between the company vector and the averaged reference vector yields a 0–100 thesis score. The closest single portfolio comp (e.g., Navro, Synthera AI, Threatfabric) is surfaced as an explainability anchor.

Every output includes structured reasons: filter explanations for exclusions; positive drivers and caution flags for ranked companies.

## (c) AI vs. manual judgment

| Component | Automation | Manual judgment |
|-----------|------------|-----------------|
| Stage / geo gates | Rule-based | Stage definitions, EU country list |
| Thesis similarity | TF-IDF + cosine (deterministic NLP) | Portfolio corpus curation from Motive website |
| Sector / traction / founders | Heuristic parsers + keyword rules | Weight tuning, off-thesis sector list, tier-1 employer list |
| Final tier cutoffs | Score thresholds | Chosen to produce a manageable shortlist (~top third as Priority) |
| Top 3 investment picks | Informed by tool output | Human synthesis for memo quality and risk specificity |

No external LLM API is required — the “AI-assisted” layer is reproducible NLP (TF-IDF embeddings), which is appropriate for a 2–3 hour prototype and avoids non-deterministic outputs.

## (d) Scaling to 10× volume or a different mandate

**10× volume:** Move scoring to a backend worker (Python/FastAPI or Affinity webhook). Cache TF-IDF reference vectors; batch-process CSV/API ingest. Route Priority tier to Slack via Affinity integration (pattern Motive already uses). Store component scores + reasons in Affinity custom fields for auditability.

**Different mandate:** Parameterize `MOTIVE_MANDATE` (stages, geographies, sectors), rebuild reference corpus from the relevant portfolio slice, and re-tune weights. For a growth fund, drop stage gate, add ARR/revenue thresholds and capital efficiency metrics. For a new geography (e.g., APAC), swap geo rules and portfolio references. The explainability layer (reason strings per rule) stays unchanged.

**Optional upgrade:** Replace TF-IDF with sentence-transformer embeddings for richer semantics; add a lightweight LLM step only for pitch summarization, keeping numeric scores rule-based for consistency.

---

**How to run:** Open `triage-app/index.html` in Chrome/Edge → click **Run demo on sample data** or upload the provided CSV → export ranked output.
