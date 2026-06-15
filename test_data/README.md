# Alternate Inbound Pipeline Test Data

Synthetic CSV datasets for testing the [Motive Pipeline Triage app](https://colto57.github.io/motive-pipeline-triage/) against different upload formats and filter/scoring scenarios. All company names and data are fictional.

## Files

| File | Companies | Purpose |
|------|-----------|---------|
| `Alternate_Inbound_Pipeline.csv` | 23 | **Alias-header test** — column names differ from the case study CSV to exercise automatic header mapping |
| `Alternate_Inbound_Pipeline_v2.csv` | 15 | **Standard-format smoke test** — exact headers matching `Case Study_Inbound Pipeline.csv` |

## Column headers (v1 alias mix)

`Alternate_Inbound_Pipeline.csv` uses these headers (all map automatically via aliases in `triage_engine.js`):

| CSV header | Maps to engine field |
|------------|----------------------|
| Company Name | `company_name` |
| URL | `website` |
| Year Founded | `founding_year` |
| Round | `stage` |
| HQ | `hq_geography` |
| Industry | `sector` |
| Founders | `founder_background` |
| Elevator Pitch | `pitch_summary` |

No manual column mapping should be required for v1. If the app prompts for mapping, check that alias support loaded correctly.

## Expected filter outcomes

Hard filters are **stage** (Pre-Seed – Series A) and **geography** (US/Europe) only. Adjacent sectors (HR Tech, PropTech, logistics, healthcare IT, climate/ESG, non-wealth RE) remain in the shortlist with lower scores and caution flags.

### `Case Study_Inbound Pipeline.csv` (25 rows)

| Outcome | Approx. count | Examples |
|---------|---------------|----------|
| **Pass hard filters (shortlisted)** | **18** | Along, Koxa, Titan, Paypercut, Zaro, … |
| Filtered — stage (Series B/C/D) | 6 | NovaPay, WealthArc, ClearLend, ShieldInsure, forage, OpenFinance Co |
| Filtered — geography (non US/EU) | 1 | PayTomo |
| **Deprioritized — adjacent sector (in shortlist)** | **6** | TalentOS, Verdant Analytics, Cohesion, MedSync, ClearRoute, Obsydian |

**Shortlist summary:** ~18 shortlisted · ~7 filtered out (stage + geo only)

### `Alternate_Inbound_Pipeline.csv` (23 rows)

| Outcome | Approx. count | Examples |
|---------|---------------|----------|
| **Pass hard filters** | **13** | FinRail AI, PayBridge, RegForge, VaultSpring, ClearLedger, InsureFlow, CoinRail, TalentForge, BuildOS, RouteSwift, MedBridge, GreenLedger, PropIQ |
| Filtered — stage (Series B/C) | 6 | LendScale, SettlePoint, CoverPath, NovaChain, WealthPeak, PayRiver |
| Filtered — geography (non US/EU) | 4 | AsiaPay Hub, LatAm Remit, MumbaiFin, CairoPay |
| **Deprioritized — adjacent sector (in shortlist)** | **6** | TalentForge, BuildOS, RouteSwift, MedBridge, GreenLedger, PropIQ |

**Shortlist summary:** ~13 pass · ~10 filtered out

**Tier spread (among passers):** core fintech leaders (PayBridge, FinRail AI, RegForge) in Priority/Standard Review; adjacent-sector companies typically in Low Priority (&lt;60).

### `Alternate_Inbound_Pipeline_v2.csv` (15 rows)

| Outcome | Approx. count |
|---------|---------------|
| Pass hard filters | 13 |
| Filtered — stage | 1 (LendGrid, Series B) |
| Filtered — geography | 1 (PayNova, Singapore) |
| **Deprioritized — adjacent sector (in shortlist)** | 4 (PeopleStack, CargoLink, PropCore, HealthSync) |

**Shortlist summary:** ~13 pass · ~2 filtered out

## Highest-ranked passers (v1)

These three should score near the top of the shortlist:

1. **PayBridge** — Serial founder (sold RemitFlow to Worldpay), London hub, Series A payments/banking API, $6.2M ARR, strong infrastructure moat signals.
2. **FinRail AI** — Ex-Stripe + ex-JPMorgan, NYC hub, Seed-stage AI banking infrastructure with community bank design partners.
3. **RegForge** — Ex-Goldman + ex-Plaid, Berlin hub, regtech/compliance AI with tier-1 bank pilots and credible early ARR.

Lower-priority passers (still on-mandate): **ClearLedger** and **InsureFlow** (pre-revenue), **VaultSpring** (modest ARR). Adjacent-sector examples (**TalentForge**, **BuildOS**) should appear in the shortlist with caution flags, typically Low Priority tier.

## How to test

1. Open https://colto57.github.io/motive-pipeline-triage/
2. Upload `Alternate_Inbound_Pipeline.csv` first.
3. Confirm all 8 columns auto-map without manual intervention.
4. Verify ~13 shortlisted and ~10 filtered; check stage/geo breakdown in filtered list (no sector-only filtered rows).
5. Confirm **TalentForge** (HR Tech) appears in shortlist with adjacent-sector caution, not in filtered-out.
6. Confirm PayBridge, FinRail AI, and RegForge appear in Priority or top Standard Review.
7. Upload `Alternate_Inbound_Pipeline_v2.csv` as a regression check — standard headers should ingest immediately with ~13 pass / ~2 filtered.

## Scenario coverage

- **Stages:** Pre-Seed, Seed, Series A (pass); Series B/C (filtered)
- **Geographies:** US, UK, Germany, Switzerland (pass); Singapore, Brazil, India, Egypt (filtered)
- **Fintech subsectors:** payments, banking infra, regtech, insurtech, wealthtech, lending, capital markets/crypto
- **Adjacent sectors:** HR Tech, PropTech, logistics, healthcare IT, climate/ESG, non-wealth RE (shortlisted, deprioritized)
- **Traction spread:** pre-revenue → ~$500K ARR → $5M+ ARR
- **Founder spread:** serial exits, tier-1 operators (Stripe, JPMorgan, Goldman, Plaid), first-time founders
- **Check sizes:** $1.2M pre-seed through $15M Series A raises (within Motive's $1–10M lead range where disclosed)
