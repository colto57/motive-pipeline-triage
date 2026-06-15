(function () {
  "use strict";

if (!window.MotiveReference) {
  console.error("motive_reference.js did not load before triage_engine.js");
}

const {
  MOTIVE_MANDATE,
  MOTIVE_VENTURE_PORTFOLIO,
  MOTIVE_SECTOR_TAXONOMY,
  MOTIVE_PORTFOLIO_ANALYTICS,
  COMPANY_AGE_BY_STAGE,
  SCORING_WEIGHTS,
  buildReferenceCorpus,
  classifyCompanySector,
} = window.MotiveReference || {};

const PORTFOLIO_N =
  MOTIVE_PORTFOLIO_ANALYTICS?.sampleSize ||
  (MOTIVE_VENTURE_PORTFOLIO && MOTIVE_VENTURE_PORTFOLIO.length) ||
  38;
const VENTURE_PORTFOLIO = MOTIVE_VENTURE_PORTFOLIO || [];
const SECTOR_TAXONOMY = MOTIVE_SECTOR_TAXONOMY || [];
const MANDATE_STAGES = MOTIVE_MANDATE?.stages || ["pre-seed", "seed", "series a"];
const DEFAULT_SCORING_WEIGHTS = {
  thesisSimilarity: 0.17,
  portfolioSectorFit: 0.19,
  traction: 0.13,
  founderSignal: 0.11,
  geographyAffinity: 0.06,
  companyAgeFit: 0.06,
  stageFit: 0.04,
  checkSizeFit: 0.06,
  capitalEfficiency: 0.06,
  infrastructureMoat: 0.06,
  verticalAiFit: 0.06,
};
const WEIGHTS = SCORING_WEIGHTS || DEFAULT_SCORING_WEIGHTS;
const DEFAULT_COMPANY_AGE_BY_STAGE = {
  "pre-seed": { idealMin: 0, idealMax: 2, acceptableMax: 3, label: "0-2 years" },
  seed: { idealMin: 1, idealMax: 4, acceptableMax: 6, label: "1-4 years" },
  "series a": { idealMin: 2, idealMax: 5, acceptableMax: 7, label: "2-5 years" },
};
const AGE_BY_STAGE = COMPANY_AGE_BY_STAGE || DEFAULT_COMPANY_AGE_BY_STAGE;
function defaultClassifyCompanySector() {
  return { sectorClass: "core", adjacentLabel: null, isFintech: true, offThesis: null, matches: [] };
}
const classifySector =
  typeof classifyCompanySector === "function" ? classifyCompanySector : defaultClassifyCompanySector;
const US_SHARE = Math.round((MOTIVE_PORTFOLIO_ANALYTICS?.geographyMix?.united_states || 0.42) * 100);
const EU_SHARE = Math.round((MOTIVE_PORTFOLIO_ANALYTICS?.geographyMix?.europe || 0.58) * 100);

const STOP_WORDS = new Set([
  "a", "an", "the", "and", "or", "but", "in", "on", "at", "to", "for", "of", "with",
  "by", "from", "as", "is", "was", "are", "were", "be", "been", "being", "have", "has",
  "had", "do", "does", "did", "will", "would", "could", "should", "may", "might", "that",
  "this", "these", "those", "it", "its", "they", "them", "their", "we", "our", "us",
  "into", "through", "across", "over", "under", "between", "about", "than", "then",
]);

const STAGE_ORDER = {
  "pre-seed": 0,
  seed: 1,
  "series a": 2,
  "series b": 3,
  "series c": 4,
  "series d": 5,
};

const TIER1_COMPANIES =
  /\b(stripe|jpmorgan|jp morgan|goldman sachs|visa|mastercard|paypal|square|brex|plaid|coinbase|a16z|openai|anthropic|mckinsey|bloomberg|ubs|credit suisse|worldpay|adyen|klarna|salesforce|workday|linkedin|blackstone|yardi|citadel|aws|amazon|nubank|grab|truelayer|harvey ai|kirkland|munich re|ondeck|kabbage|epic|athenahealth|fedex|flexport|prudential|palantir|nutmeg|moneybox|worldpay)\b/i;

const SERIAL_FOUNDER = /\b(serial founder|previously built and sold|sold .+ to|prior exit|second[- ]time founder)\b/i;

const SENIOR_TITLES =
  /\b(ceo|cto|coo|cfo|chief|head of|vp |vice president|director|managing partner|co-founder)\b/i;

const FINTECH_DOMAIN =
  /\b(fintech|financial services|banking|payments|wealth|insurance|capital markets|underwriting|compliance|treasury|lending|neobank|open banking|embedded finance|transaction banking|private banking|actuary|insurtech)\b/i;

const TOP_HUB_CITIES = new Set(["new york", "nyc", "london", "berlin"]);

const SECONDARY_HUB_CITIES = new Set([
  "san francisco",
  "paris",
  "amsterdam",
  "munich",
  "hamburg",
  "cologne",
  "barcelona",
  "miami",
  "los angeles",
  "boston",
  "chicago",
  "zurich",
]);

function tokenize(text) {
  return (text || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 2 && !STOP_WORDS.has(t));
}

function normalizeStage(stage) {
  return (stage || "").trim().toLowerCase();
}

function parseGeography(hq) {
  const text = (hq || "").toLowerCase();
  const isUS =
    /,\s*us\b/.test(text) ||
    /united states/.test(text) ||
    /\b(u\.s\.|usa)\b/.test(text) ||
    /,\s*(al|ak|az|ar|ca|co|ct|de|fl|ga|hi|id|il|in|ia|ks|ky|la|me|md|ma|mi|mn|ms|mo|mt|ne|nv|nh|nj|nm|ny|nc|nd|oh|ok|or|pa|ri|sc|sd|tn|tx|ut|vt|va|wa|wv|wi|wy)\b/.test(text);

  const isEurope = (MOTIVE_MANDATE?.geographies?.europe || []).some((token) => {
    if (token.length <= 2) return text.includes(`, ${token}`) || text.endsWith(` ${token}`);
    return text.includes(token);
  });

  const hubMatch = (MOTIVE_PORTFOLIO_ANALYTICS?.hubCities || []).find((city) =>
    text.includes(city)
  );

  return { text, isUS, isEurope, inMandate: isUS || isEurope, hub: hubMatch || null };
}

function buildCompanyDocument(row) {
  return [
    row.company_name,
    row.sector,
    row.founder_background,
    row.pitch_summary,
    row.stage,
    row.hq_geography,
    row.founding_year,
  ].join(" ");
}

function computeIdf(documents) {
  const df = new Map();
  for (const doc of documents) {
    const unique = new Set(tokenize(doc));
    for (const token of unique) {
      df.set(token, (df.get(token) || 0) + 1);
    }
  }
  const n = documents.length;
  const idf = new Map();
  for (const [token, count] of df.entries()) {
    idf.set(token, Math.log((1 + n) / (1 + count)) + 1);
  }
  return idf;
}

function tfidfVector(text, idf) {
  const tokens = tokenize(text);
  const tf = new Map();
  for (const token of tokens) {
    tf.set(token, (tf.get(token) || 0) + 1);
  }
  const vec = new Map();
  for (const [token, count] of tf.entries()) {
    if (idf.has(token)) {
      vec.set(token, (count / tokens.length) * idf.get(token));
    }
  }
  return vec;
}

function cosineSimilarity(a, b) {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  const keys = new Set([...a.keys(), ...b.keys()]);
  for (const key of keys) {
    const av = a.get(key) || 0;
    const bv = b.get(key) || 0;
    dot += av * bv;
    normA += av * av;
    normB += bv * bv;
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

/** Rescale raw TF-IDF cosine (typically 0.02-0.18) to an interpretable 0-100 score. */
function scaleThesisSimilarity(cosineSim) {
  const score = Math.round(25 + cosineSim * 400);
  return Math.max(0, Math.min(95, score));
}

function parseMoney(text) {
  const arrMatch = text.match(/\$([\d.]+)\s*([mbk])\s*arr/i);
  const gmvMatch = text.match(/\$([\d.]+)\s*([mbn])\+?\s*gmv/i);
  const raiseMatch = text.match(/(?:raising|raise)\s+[£€$]?([\d.]+)\s*([mbk])/i);

  const toNumber = (value, unit) => {
    const mult = { k: 1e3, m: 1e6, b: 1e9, n: 1e9 }[unit.toLowerCase()] || 1;
    return parseFloat(value) * mult;
  };

  return {
    arr: arrMatch ? toNumber(arrMatch[1], arrMatch[2]) : null,
    gmv: gmvMatch ? toNumber(gmvMatch[1], gmvMatch[2]) : null,
    raise: raiseMatch ? toNumber(raiseMatch[1], raiseMatch[2]) : null,
    preRevenue: /pre-revenue|pre revenue/i.test(text),
    growth: /(\d+)\s*%\s*(?:qoq|yoy|y\/y)/i.test(text)
      ? parseFloat(text.match(/(\d+)\s*%\s*(?:qoq|yoy|y\/y)/i)[1])
      : null,
    growthLabel: text.match(/(\d+x|\d+\s*%\s*(?:qoq|yoy|y\/y))/i)?.[0] || null,
    customers:
      text.match(
        /(\d[\d,\+]*)\s+(?:paying customers|enterprise customers|customers|clients|pilots|design partners|bank pilots|active users)/i
      )?.[0] || null,
    designPartners: /design partner|tier-1 bank|bank pilot|community bank pilot/i.test(text),
  };
}

function scorePortfolioSectorFit(row) {
  const classification = classifySector(row);
  const reasons = [];
  const { sectorClass, adjacentLabel, matches } = classification;

  if (sectorClass === "core") {
    const primary = classification.matches.sort(
      (a, b) => b.portfolioWeight - a.portfolioWeight
    )[0];

    let score = Math.round(50 + primary.portfolioWeight * 140);

    if (classification.matches.length > 1) {
      score += 8;
      reasons.push(
        `Multi-vertical fintech fit: ${classification.matches.map((m) => m.label).join(" + ")}.`
      );
    }

    reasons.unshift(
      `Maps to ${primary.label} - ${Math.round(primary.portfolioWeight * 100)}% of Motive's venture portfolio (n=${PORTFOLIO_N}).`
    );

    if (/\bai\b|agent|llm|automation/i.test(`${row.sector} ${row.pitch_summary}`)) {
      score += 6;
      reasons.push("Verticalized AI theme aligns with Motive's 2024-2026 venture investment pattern.");
    }

    return {
      score: Math.max(0, Math.min(100, score)),
      reasons,
      classification,
      primarySector: primary,
    };
  }

  if (sectorClass === "adjacent") {
    let score;
    let primarySector = null;

    if (matches.length > 0) {
      primarySector = matches.sort((a, b) => b.portfolioWeight - a.portfolioWeight)[0];
      score = Math.round(50 + primarySector.portfolioWeight * 140) - 22;
      reasons.push(
        `Partial fintech overlap (${primarySector.label}) but company is primarily in an adjacent sector.`
      );
    } else {
      score = 18;
    }

    reasons.push(
      `Adjacent sector (${adjacentLabel}) - lower Motive venture priority vs core fintech.`
    );

    return {
      score: Math.max(5, Math.min(42, score)),
      reasons,
      classification,
      primarySector,
    };
  }

  reasons.push(
    "Unclassified / weak fintech signal - lower Motive venture sector priority."
  );

  return {
    score: 28,
    reasons,
    classification,
    primarySector: null,
  };
}

function scoreGeographyAffinity(geo, hq) {
  const reasons = [];
  let score;

  if (!geo.inMandate) {
    return { score: 0, reasons: [`HQ "${hq}" is outside US/Europe mandate.`] };
  }

  const hub = geo.hub || "";
  if (TOP_HUB_CITIES.has(hub)) {
    score = hub === "berlin" || hub === "london" ? 94 : 92;
  } else if (SECONDARY_HUB_CITIES.has(hub)) {
    score = hub === "san francisco" || hub === "paris" ? 84 : 78;
  } else {
    score = geo.isUS ? 64 : 58;
  }

  if (geo.isUS) {
    score += 2;
    reasons.push(`US HQ fits Motive venture mandate (~${US_SHARE}% of venture portfolio).`);
  }
  if (geo.isEurope) {
    score += 2;
    reasons.push(`Europe HQ fits Motive venture mandate (~${EU_SHARE}% of venture portfolio).`);
  }

  if (hub) {
    const hubLabel = hub.replace(/\b\w/g, (c) => c.toUpperCase());
    const tierLabel = TOP_HUB_CITIES.has(hub) ? "top" : "secondary";
    reasons.push(`Located in ${hubLabel} - a ${tierLabel} Motive venture hub.`);
  } else {
    reasons.push(`HQ "${hq}" is in-mandate but not a top historical Motive venture hub city.`);
  }

  return { score: Math.max(0, Math.min(100, score)), reasons };
}

function scoreCompanyAge(row, stage) {
  const foundingYear = parseInt(row.founding_year, 10);
  const age = (MOTIVE_MANDATE?.currentYear || 2026) - foundingYear;
  const profile = AGE_BY_STAGE[stage] || AGE_BY_STAGE.seed;
  const reasons = [];

  if (Number.isNaN(foundingYear)) {
    return {
      score: 50,
      reasons: ["Founding year missing - cannot assess company age vs. stage."],
      age: null,
    };
  }

  let score;
  const idealCenter = (profile.idealMin + profile.idealMax) / 2;
  const halfWindow = Math.max((profile.idealMax - profile.idealMin) / 2, 0.5);

  if (age >= profile.idealMin && age <= profile.idealMax) {
    const distFromCenter = Math.abs(age - idealCenter);
    score = Math.round(95 - (distFromCenter / halfWindow) * 12);
    reasons.push(
      `Company age (${age} yrs, founded ${foundingYear}) matches Motive's typical ${stage} profile (${profile.label}).`
    );
  } else if (age < profile.idealMin) {
    score = age <= 0 ? 68 : 74;
    reasons.push(
      `Company age (${age} yrs) is young for ${stage} - acceptable but earlier than Motive's ideal ${profile.label} window.`
    );
  } else if (age <= profile.acceptableMax) {
    const yearsOver = age - profile.idealMax;
    score = Math.round(78 - yearsOver * 6);
    reasons.push(
      `Company age (${age} yrs) is acceptable for ${stage}, though slightly outside the ideal ${profile.label} window.`
    );
  } else {
    score = Math.max(45, 58 - (age - profile.acceptableMax) * 5);
    reasons.push(
      `Company age (${age} yrs) is mature for ${stage} - Motive venture typically backs younger companies at this stage.`
    );
  }

  return { score, reasons, age };
}

function scoreTraction(row) {
  const metrics = parseMoney(row.pitch_summary);
  let score = 28;
  const reasons = [];

  if (metrics.arr != null) {
    if (metrics.arr >= 10000000) {
      score += 48;
      reasons.push(
        `Strong ARR (${row.pitch_summary.match(/\$[\d.]+\s*[mbk]\s*ARR/i)?.[0] || "disclosed"}).`
      );
    } else if (metrics.arr >= 5000000) {
      score += 38;
      reasons.push(
        `Material ARR (${row.pitch_summary.match(/\$[\d.]+\s*[mbk]\s*ARR/i)?.[0] || "disclosed"}).`
      );
    } else if (metrics.arr >= 1000000) {
      score += 28;
      reasons.push(
        `Meaningful ARR (${row.pitch_summary.match(/\$[\d.]+\s*[mbk]\s*ARR/i)?.[0] || "disclosed"}).`
      );
    } else if (metrics.arr >= 500000) {
      score += 18;
      reasons.push(
        `Early credible ARR (${row.pitch_summary.match(/\$[\d.]+\s*[mbk]\s*ARR/i)?.[0] || "disclosed"}).`
      );
    } else {
      score += 6;
      reasons.push("Modest ARR - traction still forming for venture scale.");
    }
  }

  if (metrics.gmv != null && metrics.gmv >= 100000000) {
    score += 32;
    reasons.push(`Large payments volume / GMV signal.`);
  } else if (metrics.gmv != null && metrics.gmv >= 25000000) {
    score += 18;
    reasons.push(`Meaningful GMV / payments volume signal.`);
  }

  if (metrics.growth != null && metrics.growth >= 100) {
    score += 20;
    reasons.push(`Exceptional growth rate (${metrics.growthLabel}).`);
  } else if (metrics.growth != null && metrics.growth >= 50) {
    score += 12;
    reasons.push(`High growth rate (${metrics.growthLabel}).`);
  }

  if (metrics.customers) {
    score += 10;
    reasons.push(`Customer traction: ${metrics.customers}.`);
  }

  if (metrics.designPartners) {
    score += 14;
    reasons.push("Regulated-institution design partners - pattern seen in Motive infra bets.");
  }

  if (metrics.preRevenue && metrics.arr == null && !metrics.designPartners) {
    score -= 18;
    reasons.push("Pre-revenue without institutional pilots - higher bar for Motive venture prioritization.");
  }

  if (reasons.length === 0) {
    reasons.push("Limited traction in pitch - validate metrics on first call.");
  }

  return { score: Math.max(0, Math.min(100, score)), reasons, metrics };
}

function scoreFounders(row) {
  const text = row.founder_background || "";
  let score = 40;
  const reasons = [];
  let signalCount = 0;

  if (SERIAL_FOUNDER.test(text)) {
    score += 35;
    signalCount += 1;
    reasons.push("Serial founder with prior exit - recurring pattern in Motive portfolio.");
  }

  const tier1Matches = text.match(new RegExp(TIER1_COMPANIES.source, "gi")) || [];
  if (tier1Matches.length >= 2) {
    score += 32;
    signalCount += 1;
    reasons.push("Multiple tier-1 fintech / financial services operator backgrounds.");
  } else if (tier1Matches.length === 1) {
    score += 24;
    signalCount += 1;
    reasons.push("Tier-1 fintech / financial services operator background.");
  } else if (SENIOR_TITLES.test(text)) {
    score += 12;
    signalCount += 1;
    reasons.push("Senior operator titles indicate relevant domain leadership.");
  }

  if (FINTECH_DOMAIN.test(text)) {
    score += 14;
    signalCount += 1;
    reasons.push("Explicit fintech / financial services domain experience in founder background.");
  }

  if (/first[- ]time founders?/i.test(text)) {
    score = Math.min(score, 48);
    score -= 8;
    reasons.push("First-time founders - requires deeper team diligence.");
  }

  if (signalCount === 0) {
    score = 38;
    reasons.push("Limited founder signal from available text - neutral/low conviction.");
  }

  return { score: Math.max(25, Math.min(95, score)), reasons };
}

function scoreStageFit(stage) {
  const normalized = normalizeStage(stage);
  if (normalized === "seed") {
    return { score: 95, reasons: ["Seed - most common Motive venture entry point."] };
  }
  if (normalized === "series a") {
    return { score: 88, reasons: ["Series A - upper bound of Motive venture mandate."] };
  }
  if (normalized === "pre-seed") {
    return { score: 78, reasons: ["Pre-seed in mandate - typically needs stronger founder/sector fit."] };
  }
  return { score: 0, reasons: ["Stage outside venture mandate."] };
}

function scoreCheckSizeFit(row) {
  const metrics = parseMoney(row.pitch_summary);
  const checkSize = MOTIVE_MANDATE?.checkSizeUsd || { min: 1000000, max: 10000000, label: "$1-10M lead/co-lead" };
  const { min, max, label } = checkSize;
  const reasons = [];

  if (metrics.raise == null) {
    return {
      score: 55,
      reasons: ["Raise amount not disclosed in pitch - cannot confirm Motive check-size fit."],
      metrics,
    };
  }

  const raiseM = metrics.raise / 1000000;
  let score = 50;

  if (metrics.raise >= min && metrics.raise <= max) {
    score = 95;
    reasons.push(
      `Raising ~$${raiseM.toFixed(1)}M aligns with Motive's stated ${label} venture check size.`
    );
  } else if (metrics.raise < min) {
    score = 72;
    reasons.push(
      `Raising below $${min / 1e6}M - may fit Motive pre-seed/co-invest but below typical lead check.`
    );
  } else if (metrics.raise <= max * 2) {
    score = 58;
    reasons.push(
      `Raising ~$${raiseM.toFixed(0)}M exceeds Motive's $1-10M lead range - likely needs co-lead or growth routing.`
    );
  } else {
    score = 35;
    reasons.push(
      `Raise size (~$${raiseM.toFixed(0)}M) well above Motive venture mandate - route to growth/buyout team.`
    );
  }

  return { score, reasons, metrics };
}

function scoreCapitalEfficiency(row, stage) {
  const metrics = parseMoney(row.pitch_summary);
  const foundingYear = parseInt(row.founding_year, 10);
  const age = Number.isNaN(foundingYear)
    ? null
    : Math.max(1, (MOTIVE_MANDATE?.currentYear || 2026) - foundingYear);
  let score = 50;
  const reasons = [];

  const stageArrBenchmark = {
    "pre-seed": 0,
    seed: 400000,
    "series a": 2000000,
  };

  if (metrics.arr != null && age != null) {
    const arrPerYear = metrics.arr / age;
    if (arrPerYear >= 1500000) {
      score += 28;
      reasons.push(
        `Strong capital efficiency: ~$${Math.round(arrPerYear / 1000)}k ARR per year since founding (${age} yrs).`
      );
    } else if (arrPerYear >= 500000) {
      score += 18;
      reasons.push(`Solid ARR velocity (~$${Math.round(arrPerYear / 1000)}k ARR/year since founding).`);
    } else if (metrics.arr >= 100000) {
      score += 8;
      reasons.push("Early ARR relative to company age - efficiency still unproven.");
    }

    const benchmark = stageArrBenchmark[stage] ?? 400000;
    if (benchmark > 0 && metrics.arr >= benchmark) {
      score += 14;
      reasons.push(`ARR meets/exceeds typical ${stage} benchmark for Motive venture entry.`);
    } else if (benchmark > 0 && metrics.arr > 0) {
      reasons.push(`ARR below typical ${stage} benchmark - may need exceptional founder/sector fit.`);
      score -= 6;
    }
  } else if (metrics.designPartners || metrics.gmv != null) {
    score += 12;
    reasons.push("Non-ARR traction (GMV/design partners) - capital efficiency assessed qualitatively.");
  } else if (metrics.preRevenue) {
    score = 38;
    reasons.push("Pre-revenue - no capital efficiency signal yet.");
  } else {
    reasons.push("Insufficient metrics to assess capital efficiency.");
  }

  return { score: Math.max(0, Math.min(100, score)), reasons };
}

function scoreInfrastructureMoat(row) {
  const text = `${row.sector} ${row.pitch_summary} ${row.founder_background}`;
  let score = 42;
  const reasons = [];
  const hits = [];

  const moatSignals = [
    {
      pattern: /api|platform|infrastructure|embedded|middleware|orchestration|rails/i,
      label: "Platform / API infrastructure wedge",
      points: 18,
    },
    {
      pattern: /bank partner|design partner|tier-1|community bank|regulated|compliance|psd2|open banking|sponsor bank/i,
      label: "Regulated-institution or compliance integration",
      points: 22,
    },
    {
      pattern: /network effect|two-sided|marketplace|distribution partner|200\+|100\+ retail|institutional/i,
      label: "Distribution scale or network effects",
      points: 14,
    },
    {
      pattern: /core banking|payment volume|gmv|settlement|reconciliation|ledger/i,
      label: "Mission-critical financial workflow",
      points: 16,
    },
    {
      pattern: /b2b|enterprise|mid-market|smb finance|in-house|back-office/i,
      label: "B2B fintech GTM (Motive portfolio skew)",
      points: 12,
    },
  ];

  for (const signal of moatSignals) {
    if (signal.pattern.test(text)) {
      score += signal.points;
      hits.push(signal.label);
    }
  }

  if (hits.length >= 2) {
    score += 10;
    reasons.push(`Multiple infrastructure moats: ${hits.slice(0, 3).join("; ")}.`);
  } else if (hits.length === 1) {
    reasons.push(hits[0] + ".");
  } else {
    reasons.push("Limited infrastructure / platform depth signals in pitch.");
    score = 40;
  }

  if (/consumer|mobile app|retail user|b2c|millennial/i.test(text) && !/b2b|enterprise|api/i.test(text)) {
    score -= 12;
    reasons.push("B2C-oriented GTM - Motive venture portfolio skews B2B financial infrastructure.");
  }

  return { score: Math.max(0, Math.min(100, score)), reasons };
}

function scoreVerticalAiFit(row) {
  const text = `${row.sector} ${row.pitch_summary}`;
  let score = 45;
  const reasons = [];

  const aiSignal = /\bai\b|agent|llm|machine learning|automation|copilot/i.test(text);
  const financialWorkflow =
    /ap\/ar|reconciliation|underwriting|compliance|close|treasury|ledger|settlement|loan|claims|fraud|aml|bsa|contract review|wealth|advisor|payments|banking/i.test(
      text
    );
  const genericAi = /general purpose|chatbot for|ai-powered everything/i.test(text);

  if (aiSignal && financialWorkflow) {
    score = 92;
    reasons.push(
      "Vertical AI applied to specific financial workflows - core Motive 2024-2026 investment theme."
    );
  } else if (aiSignal && !financialWorkflow) {
    score = 52;
    reasons.push("AI mentioned but not clearly tied to financial workflow automation.");
  } else if (financialWorkflow && !aiSignal) {
    score = 68;
    reasons.push("Financial workflow focus without explicit AI - still on-thesis for Motive infra bets.");
  } else {
    score = 42;
    reasons.push("Weak vertical AI or financial automation signal.");
  }

  if (genericAi) {
    score -= 15;
    reasons.push("Generic AI positioning - risk of AI-washing vs. embedded financial automation.");
  }

  if (/regulatory tailwind|psd2|open banking|embedded finance|csrd|instant settlement/i.test(text)) {
    score += 8;
    reasons.push("Regulatory or market tailwind supports adoption (open banking, embedded finance, etc.).");
  }

  return { score: Math.max(0, Math.min(100, score)), reasons };
}

function findBestPortfolioMatch(companyVec, idf) {
  let best = { name: null, similarity: 0, subsector: "", sectorKey: "" };
  for (const company of VENTURE_PORTFOLIO) {
    const doc = `${company.name} ${company.subsector} ${company.location}`;
    const vec = tfidfVector(doc, idf);
    const sim = cosineSimilarity(companyVec, vec);
    if (sim > best.similarity) {
      best = {
        name: company.name,
        similarity: sim,
        subsector: company.subsector,
        sectorKey: company.sectorKey,
      };
    }
  }
  return best;
}

function roundScore(value) {
  return Math.round(value * 10) / 10;
}

function computeTiebreakerBonus(row, mandate, metrics, portfolioMatch) {
  let bonus = 0;
  if (metrics?.arr >= 10000000) bonus += 1.2;
  else if (metrics?.arr >= 5000000) bonus += 0.9;
  else if (metrics?.arr >= 1000000) bonus += 0.5;
  else if (metrics?.arr >= 500000) bonus += 0.2;

  if (metrics?.growth >= 100) bonus += 0.6;
  else if (metrics?.growth >= 50) bonus += 0.3;

  if (metrics?.designPartners) bonus += 0.4;
  if (mandate.geo?.hub) bonus += 0.3;
  if (portfolioMatch?.similarity >= 0.12) bonus += 0.5;
  else if (portfolioMatch?.similarity >= 0.08) bonus += 0.25;

  if (SERIAL_FOUNDER.test(row.founder_background || "")) bonus += 0.4;
  if (TIER1_COMPANIES.test(row.founder_background || "")) bonus += 0.3;

  return Math.min(2, bonus);
}

function applyScoreSpread(raw) {
  if (raw >= 74) return 74 + (raw - 74) * 1.4;
  if (raw >= 62) return 62 + (raw - 62) * 1.1;
  if (raw >= 48) return 48 + (raw - 48) * 0.95;
  return 48 - (48 - raw) * 0.8;
}

function compareShortlistResults(a, b) {
  const scoreDelta = b.overallScore - a.overallScore;
  if (scoreDelta !== 0) return scoreDelta;

  const tractionDelta = b.componentScores.traction - a.componentScores.traction;
  if (tractionDelta !== 0) return tractionDelta;

  const founderDelta = b.componentScores.founderSignal - a.componentScores.founderSignal;
  if (founderDelta !== 0) return founderDelta;

  const thesisDelta = b.componentScores.thesisSimilarity - a.componentScores.thesisSimilarity;
  if (thesisDelta !== 0) return thesisDelta;

  const raiseA = a.raiseAmount ?? Number.POSITIVE_INFINITY;
  const raiseB = b.raiseAmount ?? Number.POSITIVE_INFINITY;
  if (raiseA !== raiseB) return raiseA - raiseB;

  return (a.company_name || "").localeCompare(b.company_name || "");
}

function applyMandateFilters(row) {
  const stage = normalizeStage(row.stage);
  const geo = parseGeography(row.hq_geography);
  const sectorClass = classifySector(row);
  const failures = [];

  if (!MANDATE_STAGES.includes(stage)) {
    failures.push({
      code: "stage",
      message: `Stage "${row.stage}" is outside Motive venture mandate (Pre-Seed - Series A). Route to growth/buyout team.`,
    });
  }

  if (!geo.inMandate) {
    failures.push({
      code: "geography",
      message: `HQ "${row.hq_geography}" is outside US/Europe - Motive venture invests across North America and Europe only.`,
    });
  }

  return {
    passed: failures.length === 0,
    failures,
    stage,
    geo,
    sectorClass,
  };
}

const SOURCE_LINKS = {
  portfolio: { href: "https://motivepartners.com/portfolio", label: "Motive portfolio" },
  motive: { href: "https://motivepartners.com", label: "Motive Partners" },
  thesisMethod: { href: "#thesis-similarity", label: "methodology" },
  sectorMethod: { href: "#portfolio-sector-fit", label: "sector weighting" },
  mandateGates: { href: "#mandate-gates", label: "mandate gates" },
};

function mkReason(text, linkKey = null) {
  const reason = { text };
  if (linkKey && SOURCE_LINKS[linkKey]) {
    reason.href = SOURCE_LINKS[linkKey].href;
    reason.label = SOURCE_LINKS[linkKey].label;
  }
  return reason;
}

const PORTFOLIO_HREF = SOURCE_LINKS.portfolio.href;

function isPortfolioHref(href) {
  return href === PORTFOLIO_HREF;
}

/** Keep at most one Motive venture portfolio link across highlight + caution bullets. */
function enforceSinglePortfolioLink(highlights, cautions) {
  let portfolioUsed = false;

  const normalize = (reason) => {
    if (!isPortfolioHref(reason.href)) return reason;
    if (portfolioUsed) return { text: reason.text };
    portfolioUsed = true;
    return reason;
  };

  return {
    positiveReasons: highlights.map(normalize),
    cautionReasons: cautions.map(normalize),
  };
}

function companyHash(name) {
  let h = 0;
  for (let i = 0; i < (name || "").length; i++) {
    h = (h * 31 + name.charCodeAt(i)) >>> 0;
  }
  return h;
}

function pickTemplate(templates, seed) {
  return templates[seed % templates.length];
}

function sanitizeWebsiteUrl(raw) {
  if (!raw) return null;
  let url = String(raw).trim();
  if (!url) return null;
  if (!/^https?:\/\//i.test(url)) {
    url = `https://${url.replace(/^\/\//, "")}`;
  }
  try {
    const parsed = new URL(url);
    if (!["http:", "https:"].includes(parsed.protocol)) return null;
    const host = parsed.hostname.toLowerCase();
    if (/^(localhost|127\.|0\.0\.0\.0)/.test(host)) return null;
    if (/javascript:|data:|vbscript:/i.test(url)) return null;
    return parsed.href;
  } catch {
    return null;
  }
}

function extractFounderSnippet(founderBg) {
  if (!founderBg) return null;
  const tier1 = founderBg.match(new RegExp(TIER1_COMPANIES.source, "gi"));
  if (tier1?.length) return tier1.slice(0, 2).join(" and ");
  return founderBg.split(";")[0].trim().slice(0, 72);
}

function getSectorCompNames(sectorKey, excludeName) {
  return VENTURE_PORTFOLIO.filter((c) => c.sectorKey === sectorKey && c.name !== excludeName)
    .slice(0, 2)
    .map((c) => c.name)
    .join(", ");
}

function buildHighlightReasons(ctx) {
  const {
    row,
    componentScores,
    thesisScore,
    portfolioMatch,
    sectorFit,
    traction,
    founders,
    verticalAi,
    checkSize,
    mandate,
  } = ctx;
  const metrics = traction.metrics;
  const h = companyHash(row.company_name);
  const candidates = [];

  if (componentScores.traction >= 55 && metrics) {
    if (metrics.arr >= 1000000) {
      const arrLabel =
        row.pitch_summary.match(/\$[\d.]+\s*[mbk]\s*ARR/i)?.[0] ||
        `$${(metrics.arr / 1000000).toFixed(1)}M ARR`;
      const growth = metrics.growthLabel ? `, ${metrics.growthLabel}` : "";
      candidates.push({
        priority: componentScores.traction + 8,
        reason: mkReason(
          pickTemplate(
            [
              `${arrLabel}${growth} - meaningful revenue at ${row.stage} stage.`,
              `Already at ${arrLabel}${growth}, ahead of typical ${row.stage} benchmarks.`,
              `Revenue profile stands out: ${arrLabel}${growth}.`,
            ],
            h
          )
        ),
      });
    } else if (metrics.gmv >= 100000000) {
      candidates.push({
        priority: componentScores.traction + 6,
        reason: mkReason(
          `Large payments volume signal in pitch - mirrors Motive infra bets like forage-class platforms.`
        ),
      });
    } else if (metrics.designPartners) {
      candidates.push({
        priority: componentScores.traction + 5,
        reason: mkReason(
          `Signed tier-1 bank or institutional design partners - a pattern across Motive's infrastructure portfolio.`
        ),
      });
    } else if (metrics.customers) {
      candidates.push({
        priority: componentScores.traction,
        reason: mkReason(`Early customer traction: ${metrics.customers}.`),
      });
    }
  }

  if (componentScores.founderSignal >= 60) {
    const snippet = extractFounderSnippet(row.founder_background);
    if (SERIAL_FOUNDER.test(row.founder_background || "")) {
      candidates.push({
        priority: componentScores.founderSignal + 6,
        reason: mkReason(
          pickTemplate(
            [
              `Serial founder${snippet ? ` (${snippet})` : ""} - repeat operator profile Motive often backs.`,
              `${snippet || "Founding team"} brings a prior exit and domain depth worth prioritizing.`,
            ],
            h + 1
          )
        ),
      });
    } else if (TIER1_COMPANIES.test(row.founder_background || "")) {
      candidates.push({
        priority: componentScores.founderSignal + 4,
        reason: mkReason(
          `Team draws from ${snippet || "tier-1 fintech operators"} - strong credibility for a first diligence call.`
        ),
      });
    } else if (componentScores.founderSignal >= 70) {
      candidates.push({
        priority: componentScores.founderSignal,
        reason: mkReason(`Founder background shows senior financial-services operator experience.`),
      });
    }
  }

  if (sectorFit.classification.sectorClass === "core" && componentScores.portfolioSectorFit >= 55) {
    const primary = sectorFit.primarySector;
    const primaryLabel = primary?.label || row.sector;
    const weight = primary?.portfolioWeight || 0;
    const comps = primary?.sectorKey
      ? getSectorCompNames(primary.sectorKey, portfolioMatch?.name)
      : "";

    if (weight >= 0.25) {
      const pctNote = weight >= 0.3 ? ` (${Math.round(weight * 100)}% of venture portfolio)` : "";
      candidates.push({
        priority: componentScores.portfolioSectorFit + 5,
        reason: mkReason(
          pickTemplate(
            [
              `Strong fit with Motive's ${primaryLabel} portfolio${comps ? ` (${comps})` : ""}.`,
              `Sits in ${primaryLabel}${pctNote} - one of Motive's densest venture clusters.`,
              `Core ${primaryLabel} positioning${comps ? ` alongside bets like ${comps}` : ""}.`,
            ],
            h + 2
          ),
          weight >= 0.3 ? "portfolio" : "sectorMethod"
        ),
      });
    } else {
      candidates.push({
        priority: componentScores.portfolioSectorFit,
        reason: mkReason(`Core fintech positioning in ${primaryLabel}.`, "sectorMethod"),
      });
    }

    if (sectorFit.classification.matches?.length > 1) {
      candidates.push({
        priority: componentScores.portfolioSectorFit - 2,
        reason: mkReason(
          `Spans ${sectorFit.classification.matches.map((m) => m.label).join(" and ")} - multi-vertical fintech thesis.`
        ),
      });
    }
  }

  if (portfolioMatch?.similarity >= 0.08) {
    const sectorLabel =
      SECTOR_TAXONOMY.find((s) => s.key === portfolioMatch.sectorKey)?.label ||
      portfolioMatch.subsector;
    candidates.push({
      priority: 52 + portfolioMatch.similarity * 180,
      reason: mkReason(
        pickTemplate(
          [
            `Closest Motive comp: ${portfolioMatch.name} (${sectorLabel}) - similar problem space.`,
            `Reads like a ${portfolioMatch.name}-adjacent bet in ${sectorLabel}.`,
            `Portfolio analogue: ${portfolioMatch.name}, another Motive ${sectorLabel} investment.`,
          ],
          h + 3
        ),
        "portfolio"
      ),
    });
  }

  if (thesisScore >= 40) {
    candidates.push({
      priority: componentScores.thesisSimilarity * 0.75,
      reason: mkReason(
        pickTemplate(
          [
            `Pitch language aligns with Motive's venture thesis (${thesisScore}/100 similarity).`,
            `Thesis match: ${thesisScore}/100 vs ${PORTFOLIO_N} Motive venture investments.`,
            `Positioning scores ${thesisScore}/100 against Motive's investment corpus.`,
          ],
          h + 4
        ),
        "thesisMethod"
      ),
    });
  }

  if (componentScores.verticalAiFit >= 75) {
    candidates.push({
      priority: componentScores.verticalAiFit,
      reason: mkReason(
        pickTemplate(
          [
            `Vertical AI on financial workflows - a core 2024-2026 Motive venture theme.`,
            `AI-native automation for regulated financial ops fits Motive's recent investment pattern.`,
          ],
          h + 5
        )
      ),
    });
  }

  if (mandate.geo?.hub && TOP_HUB_CITIES.has(mandate.geo.hub)) {
    const hubLabel = mandate.geo.hub.replace(/\b\w/g, (c) => c.toUpperCase());
    candidates.push({
      priority: componentScores.geographyAffinity,
      reason: mkReason(`${hubLabel} HQ - a top Motive venture hub alongside NYC, London, and Berlin.`),
    });
  }

  if (componentScores.checkSizeFit >= 85 && checkSize.metrics?.raise) {
    const raiseM = checkSize.metrics.raise / 1000000;
    candidates.push({
      priority: componentScores.checkSizeFit,
      reason: mkReason(
        `Raising ~$${raiseM.toFixed(1)}M fits Motive's $1-10M lead/co-lead check size.`
      ),
    });
  }

  if (componentScores.infrastructureMoat >= 70) {
    const moatHit = infraMoatReason(ctx);
    if (moatHit) {
      candidates.push({
        priority: componentScores.infrastructureMoat - 5,
        reason: mkReason(moatHit),
      });
    }
  }

  candidates.sort((a, b) => b.priority - a.priority);

  const seen = new Set();
  const highlights = [];
  for (const candidate of candidates) {
    const key = candidate.reason.text.slice(0, 48);
    if (!seen.has(key)) {
      seen.add(key);
      highlights.push(candidate.reason);
    }
    if (highlights.length >= 5) break;
  }

  return highlights;
}

function infraMoatReason(ctx) {
  const text = `${ctx.row.sector} ${ctx.row.pitch_summary}`;
  if (/api|platform|infrastructure|embedded/i.test(text)) {
    return "Platform or API infrastructure wedge - consistent with Motive's B2B fintech portfolio.";
  }
  if (/bank partner|design partner|regulated|compliance/i.test(text)) {
    return "Regulated-institution integration path - common across Motive infrastructure bets.";
  }
  return null;
}

function buildCautionReasons(ctx) {
  const { row, sectorFit, checkSize, capitalEff, infraMoat, verticalAi, traction, ageFit, geoFit } =
    ctx;
  const cautions = [];

  if (sectorFit.classification.sectorClass === "adjacent") {
    cautions.push(
      mkReason(
        `Adjacent sector (${sectorFit.classification.adjacentLabel}) - lower priority than core fintech in Motive's venture book.`,
        "portfolio"
      )
    );
  } else if (sectorFit.classification.sectorClass === "weak") {
    cautions.push(mkReason(`Weak fintech signal - may sit outside Motive's core venture thesis.`, "portfolio"));
  }

  if (checkSize.reasons.some((r) => r.includes("not disclosed"))) {
    cautions.push(
      mkReason(`Raise size not stated in pitch - confirm fit against Motive's $1-10M mandate.`)
    );
  } else {
    const raiseFlag = checkSize.reasons.find(
      (r) => r.includes("above") || r.includes("growth") || r.includes("exceeds")
    );
    if (raiseFlag) cautions.push(mkReason(raiseFlag));
  }

  if (/first[- ]time founders?/i.test(row.founder_background || "")) {
    cautions.push(mkReason(`First-time founding team - plan deeper reference and operator diligence.`));
  }

  if (traction.metrics?.preRevenue && !traction.metrics?.designPartners && !traction.metrics?.arr) {
    cautions.push(
      mkReason(`Pre-revenue with no institutional pilots - higher conviction bar for Motive venture.`)
    );
  } else if (traction.reasons.some((r) => r.includes("Modest ARR"))) {
    cautions.push(mkReason(`Modest ARR - traction still forming for venture-scale prioritization.`));
  }

  if (verticalAi.score < 55 && /\bai\b/i.test(row.pitch_summary || "")) {
    cautions.push(
      mkReason(`AI positioning feels generic - validate depth vs. financial workflow automation.`)
    );
  }

  if (infraMoat.reasons.some((r) => r.includes("B2C"))) {
    cautions.push(
      mkReason(
        `B2C go-to-market - Motive's venture portfolio skews B2B financial infrastructure.`,
        "portfolio"
      )
    );
  }

  if (ageFit.reasons.some((r) => r.includes("mature"))) {
    cautions.push(mkReason(ageFit.reasons.find((r) => r.includes("mature"))));
  }

  if (geoFit.reasons.some((r) => r.includes("not a top"))) {
    cautions.push(
      mkReason(`HQ is in-mandate but outside Motive's densest hub cities (NYC, London, Berlin).`)
    );
  }

  if (capitalEff.reasons.some((r) => r.includes("below typical"))) {
    cautions.push(mkReason(capitalEff.reasons.find((r) => r.includes("below typical"))));
  }

  const seen = new Set();
  const unique = [];
  for (const caution of cautions) {
    const key = caution.text.slice(0, 48);
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(caution);
    }
    if (unique.length >= 3) break;
  }
  return unique;
}

function triageCompanies(rows) {
  const referenceCorpus = buildReferenceCorpus ? buildReferenceCorpus() : [];
  const allDocs = [...referenceCorpus, ...rows.map(buildCompanyDocument)];
  const idf = computeIdf(allDocs);

  const referenceVecs = referenceCorpus.map((doc) => tfidfVector(doc, idf));
  const referenceComposite = new Map();
  for (const vec of referenceVecs) {
    for (const [k, v] of vec.entries()) {
      referenceComposite.set(k, (referenceComposite.get(k) || 0) + v / referenceVecs.length);
    }
  }

  const weights = WEIGHTS;

  const results = rows.map((row) => {
    const mandate = applyMandateFilters(row);
    const companyDoc = buildCompanyDocument(row);
    const companyVec = tfidfVector(companyDoc, idf);
    const thesisSimilarity = cosineSimilarity(companyVec, referenceComposite);
    const thesisScore = scaleThesisSimilarity(thesisSimilarity);
    const portfolioMatch = findBestPortfolioMatch(companyVec, idf);

    const sectorFit = scorePortfolioSectorFit(row);
    const traction = scoreTraction(row);
    const founders = scoreFounders(row);
    const stageFit = scoreStageFit(mandate.stage);
    const geoFit = scoreGeographyAffinity(mandate.geo, row.hq_geography);
    const ageFit = scoreCompanyAge(row, mandate.stage);
    const checkSize = scoreCheckSizeFit(row);
    const capitalEff = scoreCapitalEfficiency(row, mandate.stage);
    const infraMoat = scoreInfrastructureMoat(row);
    const verticalAi = scoreVerticalAiFit(row);

    const componentScores = {
      thesisSimilarity: thesisScore,
      portfolioSectorFit: sectorFit.score,
      traction: traction.score,
      founderSignal: founders.score,
      geographyAffinity: geoFit.score,
      companyAgeFit: ageFit.score,
      stageFit: stageFit.score,
      checkSizeFit: checkSize.score,
      capitalEfficiency: capitalEff.score,
      infrastructureMoat: infraMoat.score,
      verticalAiFit: verticalAi.score,
    };

    const tractionMetrics = traction.metrics || checkSize.metrics || parseMoney(row.pitch_summary);

    const weightedRaw = mandate.passed
      ? thesisScore * weights.thesisSimilarity +
        sectorFit.score * weights.portfolioSectorFit +
        traction.score * weights.traction +
        founders.score * weights.founderSignal +
        geoFit.score * weights.geographyAffinity +
        ageFit.score * weights.companyAgeFit +
        stageFit.score * weights.stageFit +
        checkSize.score * weights.checkSizeFit +
        capitalEff.score * weights.capitalEfficiency +
        infraMoat.score * weights.infrastructureMoat +
        verticalAi.score * weights.verticalAiFit +
        computeTiebreakerBonus(row, mandate, tractionMetrics, portfolioMatch)
      : 0;

    const weightedScore = mandate.passed
      ? roundScore(Math.min(100, Math.max(0, applyScoreSpread(weightedRaw))))
      : 0;

    const reasonCtx = {
      row,
      componentScores,
      thesisScore,
      portfolioMatch,
      sectorFit,
      traction,
      founders,
      verticalAi,
      checkSize,
      capitalEff,
      infraMoat,
      ageFit,
      geoFit,
      mandate,
    };

    const rawHighlights = mandate.passed ? buildHighlightReasons(reasonCtx) : [];
    const rawCautions = mandate.passed ? buildCautionReasons(reasonCtx) : [];
    const { positiveReasons, cautionReasons } = mandate.passed
      ? enforceSinglePortfolioLink(rawHighlights, rawCautions)
      : { positiveReasons: [], cautionReasons: [] };
    const safeWebsiteUrl = sanitizeWebsiteUrl(row.website);

    let tier = "Filtered Out";
    if (mandate.passed) {
      if (weightedScore >= 76) tier = "Priority Review";
      else if (weightedScore >= 60) tier = "Standard Review";
      else tier = "Low Priority";
    }

    return {
      ...row,
      mandate,
      tier,
      overallScore: weightedScore,
      raiseAmount: tractionMetrics?.raise ?? null,
      componentScores,
      thesisSimilarity,
      portfolioMatch,
      primarySector: sectorFit.primarySector?.label || null,
      companyAge: ageFit.age,
      safeWebsiteUrl,
      positiveReasons,
      cautionReasons,
      filterReasons: mandate.failures.map((f) => f.message),
      weights,
    };
  });

  const shortlisted = results
    .filter((r) => r.mandate.passed)
    .sort(compareShortlistResults);

  const filteredOut = results
    .filter((r) => !r.mandate.passed)
    .sort((a, b) => STAGE_ORDER[a.mandate.stage] - STAGE_ORDER[b.mandate.stage]);

  return {
    summary: {
      total: results.length,
      shortlisted: shortlisted.length,
      filteredOut: filteredOut.length,
      priorityReview: shortlisted.filter((r) => r.tier === "Priority Review").length,
      scoringProfile: `Motive venture portfolio-calibrated (n=${PORTFOLIO_N} active; realized exits excluded)`,
      generatedAt: new Date().toISOString(),
    },
    shortlisted,
    filteredOut,
    all: [...shortlisted, ...filteredOut],
  };
}

function parseCsv(text, customMapping = null) {
  const parsed = analyzeCsv(text, customMapping);
  if (parsed.error) {
    const err = new Error(parsed.error.message);
    err.details = parsed.error;
    throw err;
  }
  return parsed.rows;
}

const CSV_FIELD_DEFINITIONS = {
  company_name: {
    label: "Company name",
    aliases: ["company", "name", "company name", "startup", "company_name", "firm"],
  },
  website: { label: "Website", aliases: ["url", "site", "domain", "website", "web"] },
  founding_year: {
    label: "Founding year",
    aliases: ["founding year", "year founded", "founded", "founding_year", "year", "founding"],
  },
  stage: {
    label: "Stage",
    aliases: ["funding stage", "round", "investment stage", "stage", "funding round"],
  },
  hq_geography: {
    label: "HQ geography",
    aliases: ["hq", "location", "geography", "headquarters", "country", "hq_geography", "hq location", "region"],
  },
  sector: { label: "Sector", aliases: ["industry", "vertical", "category", "sector", "subsector"] },
  founder_background: {
    label: "Founder background",
    aliases: ["founders", "founder background", "team", "founder info", "founder_background", "founder", "management"],
  },
  pitch_summary: {
    label: "Pitch summary",
    aliases: ["pitch", "summary", "description", "overview", "pitch summary", "pitch_summary", "elevator pitch", "notes"],
  },
};

const CSV_REQUIRED_FIELDS = Object.keys(CSV_FIELD_DEFINITIONS);

function stripBom(text) {
  if (!text) return "";
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

function normalizeHeaderKey(header) {
  return (header || "")
    .trim()
    .toLowerCase()
    .replace(/^\uFEFF/, "")
    .replace(/[\s_-]+/g, " ")
    .replace(/[^\w\s]/g, "")
    .trim();
}

function buildAliasLookup() {
  const lookup = new Map();
  for (const [field, def] of Object.entries(CSV_FIELD_DEFINITIONS)) {
    lookup.set(normalizeHeaderKey(field), field);
    for (const alias of def.aliases) {
      lookup.set(normalizeHeaderKey(alias), field);
    }
  }
  return lookup;
}

const CSV_ALIAS_LOOKUP = buildAliasLookup();

function resolveHeaderMapping(rawHeaders, customMapping = null) {
  const foundHeaders = rawHeaders.map((h) => h.trim()).filter(Boolean);
  const normalizedToOriginal = new Map();
  for (const header of foundHeaders) {
    const key = normalizeHeaderKey(header);
    if (!normalizedToOriginal.has(key)) normalizedToOriginal.set(key, header);
  }

  const mapping = {};
  const usedOriginalHeaders = new Set();

  if (customMapping) {
    for (const field of CSV_REQUIRED_FIELDS) {
      const chosen = customMapping[field];
      if (!chosen) continue;
      if (!foundHeaders.includes(chosen)) {
        return {
          mapping: null,
          missing: [field],
          foundHeaders,
          error: `Mapped column "${chosen}" for ${field} was not found in CSV.`,
        };
      }
      mapping[field] = chosen;
      usedOriginalHeaders.add(chosen);
    }
  } else {
    for (const [norm, original] of normalizedToOriginal.entries()) {
      const field = CSV_ALIAS_LOOKUP.get(norm);
      if (field && mapping[field] == null) {
        mapping[field] = original;
        usedOriginalHeaders.add(original);
      }
    }
  }

  const missing = CSV_REQUIRED_FIELDS.filter((field) => !mapping[field]);
  return { mapping, missing, foundHeaders, usedOriginalHeaders };
}

function analyzeCsv(text, customMapping = null) {
  const cleaned = stripBom(text || "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const lines = cleaned.split("\n").filter((line, idx) => idx === 0 || line.trim());

  if (lines.length < 2) {
    return {
      error: {
        code: "NO_DATA",
        message: "CSV must include a header row and at least one company row.",
        foundHeaders: lines[0] ? splitCsvLine(lines[0]).map((h) => h.trim()) : [],
      },
    };
  }

  const rawHeaders = splitCsvLine(lines[0]).map((h) => h.trim());
  const resolved = resolveHeaderMapping(rawHeaders, customMapping);

  if (resolved.error) {
    return {
      error: {
        code: "INVALID_MAPPING",
        message: resolved.error,
        foundHeaders: resolved.foundHeaders,
        missing: resolved.missing,
      },
    };
  }

  if (resolved.missing.length > 0) {
    return {
      error: {
        code: "MISSING_COLUMNS",
        message: buildMissingColumnsMessage(resolved.missing, resolved.foundHeaders),
        missing: resolved.missing,
        foundHeaders: resolved.foundHeaders,
        needsManualMapping: true,
        rawHeaders,
        suggestedMapping: resolved.mapping,
      },
      rawHeaders,
      foundHeaders: resolved.foundHeaders,
    };
  }

  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    const values = splitCsvLine(lines[i]);
    const row = {};
    for (const field of CSV_REQUIRED_FIELDS) {
      const headerName = resolved.mapping[field];
      const idx = rawHeaders.indexOf(headerName);
      row[field] = (values[idx] ?? "").trim();
    }
    if (Object.values(row).some((v) => v)) rows.push(row);
  }

  if (!rows.length) {
    return {
      error: {
        code: "NO_ROWS",
        message: "CSV has headers but no usable company rows.",
        foundHeaders: resolved.foundHeaders,
      },
    };
  }

  return {
    rows,
    rowCount: rows.length,
    foundHeaders: resolved.foundHeaders,
    mapping: resolved.mapping,
    aliasMatches: Object.entries(resolved.mapping).filter(
      ([field, header]) => normalizeHeaderKey(header) !== normalizeHeaderKey(field)
    ),
  };
}

function buildMissingColumnsMessage(missing, foundHeaders) {
  const missingLabels = missing.map((f) => CSV_FIELD_DEFINITIONS[f].label).join(", ");
  const found = foundHeaders.length ? foundHeaders.join(", ") : "(none detected)";
  return `Missing required columns: ${missingLabels}. Found headers: ${found}. Map columns manually or rename headers to match expected names.`;
}

function splitCsvLine(line) {
  const result = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

window.TriageEngine = {
  triageCompanies,
  parseCsv,
  analyzeCsv,
  CSV_FIELD_DEFINITIONS,
  CSV_REQUIRED_FIELDS,
};
})();