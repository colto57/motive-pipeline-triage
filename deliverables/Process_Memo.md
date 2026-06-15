# Motive Pipeline Triage — Process Memo



**Author:** Colton · **Live demo:** https://colto57.github.io/motive-pipeline-triage/



## (a) Criteria and rationale



The triage system enforces Motive Partners’ stated **venture mandate** — Pre-Seed through Series A, US/Europe only — then ranks all in-mandate companies using weights **calibrated from 38 Motive venture portfolio companies** listed on [motivepartners.com/portfolio](https://motivepartners.com/portfolio). Adjacent tech sectors (HR Tech, PropTech, etc.) remain in the pipeline but are **deprioritized via scoring**, not hard-filtered.



### Portfolio count methodology (June 2026)



| Count | Number | What it means |

|-------|--------|---------------|

| **Total Venture on portfolio page** | **41** | All companies tagged Strategy = Venture (Active + Realized) |

| **Similarity corpus (calibration set)** | **38** | Companies used for TF-IDF comps and sector-weight calibration |

| **Active Not Realized** | **37** | Currently active venture holdings on the page |

| **Realized venture (excluded from corpus)** | **3** | Corastone, Februar, Vitera |

| **Realized venture (in corpus)** | **1** | AMP — retained as wealth comp reference |



**Why counts differ:** The portfolio page lists **41** Venture entries. Our corpus uses **38**: the prior 37-company list plus **MYNE Homes** (wealth, Berlin — previously missing). Three realized exits (Corastone, Februar, Vitera) are excluded from the similarity corpus. Counting only **Active Not Realized** on the page yields **37**; including MYNE Homes in a manual audit gives **38** active venture names.



### Portfolio analysis (Venture strategy, n=38 corpus)



| Signal | Observed pattern | How we use it |

|--------|------------------|---------------|

| **Sector mix** | Wealth 34%, Banking/Payments 32%, AI/Data 16%, Capital Markets 11%, Insurance 5%, Business Services 3% | Sector fit score weighted by 38-company corpus share |

| **Geography** | US 42%, Europe 58% | Both pass mandate; hub cities (NYC, Berlin, London, SF, Paris, Amsterdam) get affinity bonus |

| **Company age** | Venture backs young companies at entry | Age vs. stage windows (Pre-seed 0–2 yrs, Seed 1–4 yrs, Series A 2–5 yrs ideal) |

| **Check size** | $1–10M lead/co-lead (Motive About page) | Dedicated check-size fit scorer parses raise from pitch |

| **Themes** | Verticalized AI, embedded finance, infra APIs | Thesis similarity + vertical AI fit + infrastructure moat scorers |



### Hard filters (strict — must pass both)



1. **Stage:** Pre-Seed, Seed, or Series A only  

2. **Geography:** US or Europe HQ (e.g. Singapore excluded)  



### Sector handling (soft — deprioritize, do not exclude)



Adjacent tech sectors — HR Tech, PropTech/CRE ops, logistics, pure healthcare IT, standalone climate/ESG, and non-wealth RE tech — **stay in the shortlist** with scoring penalties and caution flags (e.g. *"Adjacent sector — lower Motive venture priority vs core fintech"*). Core fintech (payments, banking infra, regtech, insurtech, etc.) scores highest on portfolio sector fit.



### Ranking signals (post-filter) — 14 components, weights sum to 100%



| Factor | Weight | Why it matters for Motive |

|--------|--------|---------------------------|

| Portfolio sector fit | 17% | Direct mirror of where Motive actually deploys venture capital |

| Thesis similarity | 16% | Semantic match to thesis + 38 portfolio comps |

| Traction | 8% | ARR, GMV, growth, customers, design partners |

| **Founder Execution Index** | **8%** | Domain tenure, operator vs. advisor, exit quality, fintech depth |

| **Check size fit** | **6%** | Motive leads $1–10M; misaligned raises waste partner time |

| **Capital efficiency** | **6%** | ARR per year since founding vs. stage benchmarks — separates hype from execution |

| **Infrastructure moat** | **6%** | API/platform depth, bank partnerships, B2B GTM — Motive backs infra, not consumer apps |

| **Vertical AI fit** | **6%** | Motive’s 2024–2026 pattern: AI embedded in financial workflows, not generic AI-washing |

| Geography affinity | 6% | Hub-city bonus aligned to portfolio geography |

| Company age fit | 6% | Stage-typical founding vintage |

| Stage fit | 4% | Seed weighted highest within mandate |



#### New factors — rationale



1. **Check size fit** — Motive publicly states $1–10M lead/co-lead checks. A company raising $55M Series B or $500K pre-seed may be in-mandate on paper but wrong for venture check deployment. Parsing raise size and scoring alignment surfaces routing decisions early.



2. **Capital efficiency** — Two companies at the same stage with identical ARR can differ sharply: one reached $2M ARR in 2 years, another in 6. ARR/company-age and stage benchmarks approximate how efficiently capital converts to revenue — a proxy for execution quality when full burn data isn’t available.



3. **Infrastructure moat** — Motive’s portfolio (Navro, Threatfabric, Pliant, Synthera AI) skews toward **B2B financial infrastructure**: APIs, regulated rails, bank design partners, mission-critical workflows. Consumer-facing or shallow SaaS without integration depth is lower priority for this mandate.



4. **Vertical AI fit** — Motive’s recent investments (Artifact AI, Obin AI, Asseta AI, Zocks) emphasize **AI automating specific financial jobs** (compliance, advisor workflows, reconciliation). Generic “AI-powered” positioning without financial workflow context scores lower as potential AI-washing.





5. **Portfolio-calibrated extensions (June 2026)** � **Portfolio Stage Affinity** (5%), **Founder Execution Index** (8%), **Traction Velocity Index** (5%), and **Portfolio Gap Score** (4%) rebalance weights to 100% using n=38 venture corpus stage mix (Seed 42%, Series A 37%, Pre-Seed 21%).
## (b) Scoring / filtering structure



**Layer 1 — Mandate gates:** Stage · Geography · Fintech sector → excluded companies never ranked; each failure reason shown.



**Layer 2 — Weighted score (0–100):** Fourteen components above.



**Layer 3 — Tiers:** ≥76 Priority Review · 60–75 Standard Review · <60 Low Priority.



**Thesis similarity method:** Company document tokenized; TF-IDF vectors; cosine similarity vs. averaged reference corpus. Raw cosine scores (typically 0.03–0.16) are rescaled to 0–100 via `25 + cosine × 400` (cap 95) so the component is comparable to other factors. Closest portfolio comp shown for explainability.



## (c) CSV upload robustness



Real inbound data arrives messy. The parser handles:



| Feature | Behavior |

|---------|----------|

| **UTF-8 BOM** | Stripped automatically |

| **Case-insensitive headers** | `"Company"`, `"COMPANY_NAME"`, `"company name"` all match |

| **Common aliases** | e.g. `Industry` → sector, `Location` → hq_geography, `Founders` → founder_background, `Description` → pitch_summary |

| **Quoted / unquoted CSV** | Standard RFC-style parsing |

| **Extra columns** | Ignored gracefully |

| **Clear errors** | Lists missing fields **and** headers found in file |

| **Column mapping UI** | If auto-match fails, user maps each required field via dropdown before triage runs |

| **Row count feedback** | Success banner shows N companies loaded + alias auto-map count |



Supported alias examples: `company`, `name`, `startup` → company_name · `url`, `domain` → website · `year founded`, `founded` → founding_year · `round`, `funding stage` → stage · `hq`, `headquarters`, `country` → hq_geography · `industry`, `vertical` → sector · `team`, `founders` → founder_background · `pitch`, `overview`, `notes` → pitch_summary.



## (d) AI vs. manual judgment



| Component | Automation | Manual judgment |

|-----------|------------|-----------------|

| Stage / geo gates | Rule-based | EU country list, stage normalization |
| Adjacent-sector deprioritization | Scoring penalty + caution flags | Sector taxonomy keyword patterns |

| Portfolio sector weights | Derived from 38-company corpus | Sector taxonomy keyword patterns |

| New economic/moat factors | Heuristic parsers | Weight tuning, Motive thesis alignment |

| Thesis similarity | TF-IDF + cosine (deterministic) | Corpus curation from portfolio page |

| CSV aliases / mapping UI | Rule-based normalization | Alias list curation |

| Top 3 picks | Informed by tool output | Human synthesis for memo quality |



No external LLM API — reproducible NLP appropriate for a 2–3 hour prototype.



## (e) Scaling to 10× volume or a different mandate



**10× volume:** Backend worker (Python/FastAPI or Affinity webhook); cache TF-IDF reference vectors; route Priority tier to Slack; store component scores + reasons in Affinity custom fields.



**Different mandate:** Parameterize `MOTIVE_MANDATE`, `MOTIVE_SECTOR_TAXONOMY`, and `SCORING_WEIGHTS`; rebuild corpus from relevant portfolio slice.



---



**How to run:** https://colto57.github.io/motive-pipeline-triage/ → upload CSV → export ranked output.


