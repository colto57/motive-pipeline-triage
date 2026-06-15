const {
  MOTIVE_MANDATE,
  MOTIVE_VENTURE_PORTFOLIO,
  MOTIVE_SECTOR_TAXONOMY,
  COMPANY_AGE_BY_STAGE,
  SCORING_WEIGHTS,
  buildReferenceCorpus,
  classifyCompanySector,
} = window.MotiveReference;

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

const SERIAL_FOUNDER = /\b(serial founder|previously built and sold|sold .+ to)\b/i;

const SENIOR_TITLES =
  /\b(ceo|cto|coo|cfo|chief|head of|vp |vice president|director|managing partner|co-founder)\b/i;

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

  const isEurope = MOTIVE_MANDATE.geographies.europe.some((token) => {
    if (token.length <= 2) return text.includes(`, ${token}`) || text.endsWith(` ${token}`);
    return text.includes(token);
  });

  const hubMatch = window.MotiveReference.MOTIVE_PORTFOLIO_ANALYTICS.hubCities.find((city) =>
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
  const classification = classifyCompanySector(row);
  const reasons = [];

  if (!classification.isFintech) {
    return {
      score: 0,
      reasons: [`Sector outside Motive venture fintech focus (${classification.offThesis}).`],
      classification,
      primarySector: null,
    };
  }

  const primary = classification.matches.sort(
    (a, b) => b.portfolioWeight - a.portfolioWeight
  )[0];

  let score = Math.round(55 + primary.portfolioWeight * 120);

  if (classification.matches.length > 1) {
    score += 8;
    reasons.push(
      `Multi-vertical fintech fit: ${classification.matches.map((m) => m.label).join(" + ")}.`
    );
  }

  reasons.unshift(
    `Maps to ${primary.label} — ${Math.round(primary.portfolioWeight * 100)}% of Motive's venture portfolio (n=41).`
  );

  if (/\bai\b|agent|llm|automation/i.test(`${row.sector} ${row.pitch_summary}`)) {
    score += 6;
    reasons.push("Verticalized AI theme aligns with Motive's 2024–2026 venture investment pattern.");
  }

  return {
    score: Math.max(0, Math.min(100, score)),
    reasons,
    classification,
    primarySector: primary,
  };
}

function scoreGeographyAffinity(geo, hq) {
  let score = 72;
  const reasons = [];

  if (geo.isUS) {
    score += 6;
    reasons.push("US HQ fits Motive venture mandate (~44% of venture portfolio).");
  }
  if (geo.isEurope) {
    score += 6;
    reasons.push("Europe HQ fits Motive venture mandate (~56% of venture portfolio).");
  }

  if (geo.hub) {
    score += 14;
    reasons.push(
      `Located in ${geo.hub.replace(/\b\w/g, (c) => c.toUpperCase())} — a core Motive venture hub (NYC, Berlin, London, etc.).`
    );
  } else {
    reasons.push(`HQ "${hq}" is in-mandate but not a top historical Motive venture hub city.`);
  }

  return { score: Math.max(0, Math.min(100, score)), reasons };
}

function scoreCompanyAge(row, stage) {
  const foundingYear = parseInt(row.founding_year, 10);
  const age = MOTIVE_MANDATE.currentYear - foundingYear;
  const profile = COMPANY_AGE_BY_STAGE[stage] || COMPANY_AGE_BY_STAGE.seed;
  const reasons = [];

  if (Number.isNaN(foundingYear)) {
    return {
      score: 50,
      reasons: ["Founding year missing — cannot assess company age vs. stage."],
      age: null,
    };
  }

  let score = 45;
  if (age >= profile.idealMin && age <= profile.idealMax) {
    score = 92;
    reasons.push(
      `Company age (${age} yrs, founded ${foundingYear}) matches Motive's typical ${stage} profile (${profile.label}).`
    );
  } else if (age <= profile.acceptableMax) {
    score = 72;
    reasons.push(
      `Company age (${age} yrs) is acceptable for ${stage}, though slightly outside the ideal ${profile.label} window.`
    );
  } else {
    score = 48;
    reasons.push(
      `Company age (${age} yrs) is mature for ${stage} — Motive venture typically backs younger companies at this stage.`
    );
  }

  return { score, reasons, age };
}

function scoreTraction(row) {
  const metrics = parseMoney(row.pitch_summary);
  let score = 35;
  const reasons = [];

  if (metrics.arr != null) {
    if (metrics.arr >= 5_000_000) {
      score += 35;
      reasons.push(
        `Material ARR (${row.pitch_summary.match(/\$[\d.]+\s*[mbk]\s*ARR/i)?.[0] || "disclosed"}).`
      );
    } else if (metrics.arr >= 500_000) {
      score += 25;
      reasons.push(
        `Early credible ARR (${row.pitch_summary.match(/\$[\d.]+\s*[mbk]\s*ARR/i)?.[0] || "disclosed"}).`
      );
    } else {
      score += 12;
      reasons.push("Modest ARR — traction still forming for venture scale.");
    }
  }

  if (metrics.gmv != null && metrics.gmv >= 100_000_000) {
    score += 28;
    reasons.push(`Large payments volume / GMV signal.`);
  }

  if (metrics.growth != null && metrics.growth >= 50) {
    score += 14;
    reasons.push(`High growth rate (${metrics.growthLabel}).`);
  }

  if (metrics.customers) {
    score += 10;
    reasons.push(`Customer traction: ${metrics.customers}.`);
  }

  if (metrics.designPartners) {
    score += 12;
    reasons.push("Regulated-institution design partners — pattern seen in Motive infra bets.");
  }

  if (metrics.preRevenue && metrics.arr == null && !metrics.designPartners) {
    score -= 15;
    reasons.push("Pre-revenue without institutional pilots — higher bar for Motive venture prioritization.");
  }

  if (reasons.length === 0) {
    reasons.push("Limited traction in pitch — validate metrics on first call.");
  }

  return { score: Math.max(0, Math.min(100, score)), reasons, metrics };
}

function scoreFounders(row) {
  const text = row.founder_background || "";
  let score = 40;
  const reasons = [];

  if (SERIAL_FOUNDER.test(text)) {
    score += 25;
    reasons.push("Serial founder with prior exit — recurring pattern in Motive portfolio.");
  }

  if (TIER1_COMPANIES.test(text)) {
    score += 22;
    reasons.push("Tier-1 fintech / financial services operator background.");
  } else if (SENIOR_TITLES.test(text)) {
    score += 12;
    reasons.push("Senior operator titles indicate relevant domain leadership.");
  }

  if (/first-time founders/i.test(text)) {
    score -= 8;
    reasons.push("First-time founders — requires deeper team diligence.");
  }

  if (reasons.length === 0) {
    reasons.push("Founder signal neutral from available text.");
  }

  return { score: Math.max(0, Math.min(100, score)), reasons };
}

function scoreStageFit(stage) {
  const normalized = normalizeStage(stage);
  if (normalized === "seed") {
    return { score: 95, reasons: ["Seed — most common Motive venture entry point."] };
  }
  if (normalized === "series a") {
    return { score: 88, reasons: ["Series A — upper bound of Motive venture mandate."] };
  }
  if (normalized === "pre-seed") {
    return { score: 78, reasons: ["Pre-seed in mandate — typically needs stronger founder/sector fit."] };
  }
  return { score: 0, reasons: ["Stage outside venture mandate."] };
}

function scoreCheckSizeFit(row) {
  const metrics = parseMoney(row.pitch_summary);
  const { min, max, label } = MOTIVE_MANDATE.checkSizeUsd;
  const reasons = [];

  if (metrics.raise == null) {
    return {
      score: 55,
      reasons: ["Raise amount not disclosed in pitch — cannot confirm Motive check-size fit."],
      metrics,
    };
  }

  const raiseM = metrics.raise / 1_000_000;
  let score = 50;

  if (metrics.raise >= min && metrics.raise <= max) {
    score = 95;
    reasons.push(
      `Raising ~$${raiseM.toFixed(1)}M aligns with Motive's stated ${label} venture check size.`
    );
  } else if (metrics.raise < min) {
    score = 72;
    reasons.push(
      `Raising below $${min / 1e6}M — may fit Motive pre-seed/co-invest but below typical lead check.`
    );
  } else if (metrics.raise <= max * 2) {
    score = 58;
    reasons.push(
      `Raising ~$${raiseM.toFixed(0)}M exceeds Motive's $1–10M lead range — likely needs co-lead or growth routing.`
    );
  } else {
    score = 35;
    reasons.push(
      `Raise size (~$${raiseM.toFixed(0)}M) well above Motive venture mandate — route to growth/buyout team.`
    );
  }

  return { score, reasons, metrics };
}

function scoreCapitalEfficiency(row, stage) {
  const metrics = parseMoney(row.pitch_summary);
  const foundingYear = parseInt(row.founding_year, 10);
  const age = Number.isNaN(foundingYear)
    ? null
    : Math.max(1, MOTIVE_MANDATE.currentYear - foundingYear);
  let score = 50;
  const reasons = [];

  const stageArrBenchmark = {
    "pre-seed": 0,
    seed: 400_000,
    "series a": 2_000_000,
  };

  if (metrics.arr != null && age != null) {
    const arrPerYear = metrics.arr / age;
    if (arrPerYear >= 1_500_000) {
      score += 28;
      reasons.push(
        `Strong capital efficiency: ~$${Math.round(arrPerYear / 1000)}k ARR per year since founding (${age} yrs).`
      );
    } else if (arrPerYear >= 500_000) {
      score += 18;
      reasons.push(`Solid ARR velocity (~$${Math.round(arrPerYear / 1000)}k ARR/year since founding).`);
    } else if (metrics.arr >= 100_000) {
      score += 8;
      reasons.push("Early ARR relative to company age — efficiency still unproven.");
    }

    const benchmark = stageArrBenchmark[stage] ?? 400_000;
    if (benchmark > 0 && metrics.arr >= benchmark) {
      score += 14;
      reasons.push(`ARR meets/exceeds typical ${stage} benchmark for Motive venture entry.`);
    } else if (benchmark > 0 && metrics.arr > 0) {
      reasons.push(`ARR below typical ${stage} benchmark — may need exceptional founder/sector fit.`);
      score -= 6;
    }
  } else if (metrics.designPartners || metrics.gmv != null) {
    score += 12;
    reasons.push("Non-ARR traction (GMV/design partners) — capital efficiency assessed qualitatively.");
  } else if (metrics.preRevenue) {
    score = 38;
    reasons.push("Pre-revenue — no capital efficiency signal yet.");
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
    reasons.push("B2C-oriented GTM — Motive venture portfolio skews B2B financial infrastructure.");
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
      "Vertical AI applied to specific financial workflows — core Motive 2024–2026 investment theme."
    );
  } else if (aiSignal && !financialWorkflow) {
    score = 52;
    reasons.push("AI mentioned but not clearly tied to financial workflow automation.");
  } else if (financialWorkflow && !aiSignal) {
    score = 68;
    reasons.push("Financial workflow focus without explicit AI — still on-thesis for Motive infra bets.");
  } else {
    score = 42;
    reasons.push("Weak vertical AI or financial automation signal.");
  }

  if (genericAi) {
    score -= 15;
    reasons.push("Generic AI positioning — risk of AI-washing vs. embedded financial automation.");
  }

  if (/regulatory tailwind|psd2|open banking|embedded finance|csrd|instant settlement/i.test(text)) {
    score += 8;
    reasons.push("Regulatory or market tailwind supports adoption (open banking, embedded finance, etc.).");
  }

  return { score: Math.max(0, Math.min(100, score)), reasons };
}

function findBestPortfolioMatch(companyVec, idf) {
  let best = { name: null, similarity: 0, subsector: "", sectorKey: "" };
  for (const company of MOTIVE_VENTURE_PORTFOLIO) {
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

function applyMandateFilters(row) {
  const stage = normalizeStage(row.stage);
  const geo = parseGeography(row.hq_geography);
  const sectorClass = classifyCompanySector(row);
  const failures = [];

  if (!MOTIVE_MANDATE.stages.includes(stage)) {
    failures.push({
      code: "stage",
      message: `Stage "${row.stage}" is outside Motive venture mandate (Pre-Seed – Series A). Route to growth/buyout team.`,
    });
  }

  if (!geo.inMandate) {
    failures.push({
      code: "geography",
      message: `HQ "${row.hq_geography}" is outside US/Europe — Motive venture invests across North America and Europe only.`,
    });
  }

  if (!sectorClass.isFintech) {
    failures.push({
      code: "sector",
      message: `Sector "${row.sector}" is outside Motive venture fintech focus (${sectorClass.offThesis}).`,
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

function triageCompanies(rows) {
  const referenceCorpus = buildReferenceCorpus();
  const allDocs = [...referenceCorpus, ...rows.map(buildCompanyDocument)];
  const idf = computeIdf(allDocs);

  const referenceVecs = referenceCorpus.map((doc) => tfidfVector(doc, idf));
  const referenceComposite = new Map();
  for (const vec of referenceVecs) {
    for (const [k, v] of vec.entries()) {
      referenceComposite.set(k, (referenceComposite.get(k) || 0) + v / referenceVecs.length);
    }
  }

  const weights = SCORING_WEIGHTS;

  const results = rows.map((row) => {
    const mandate = applyMandateFilters(row);
    const companyDoc = buildCompanyDocument(row);
    const companyVec = tfidfVector(companyDoc, idf);
    const thesisSimilarity = cosineSimilarity(companyVec, referenceComposite);
    const thesisScore = Math.round(thesisSimilarity * 100);
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

    const weightedScore = mandate.passed
      ? Math.round(
          thesisScore * weights.thesisSimilarity +
            sectorFit.score * weights.portfolioSectorFit +
            traction.score * weights.traction +
            founders.score * weights.founderSignal +
            geoFit.score * weights.geographyAffinity +
            ageFit.score * weights.companyAgeFit +
            stageFit.score * weights.stageFit +
            checkSize.score * weights.checkSizeFit +
            capitalEff.score * weights.capitalEfficiency +
            infraMoat.score * weights.infrastructureMoat +
            verticalAi.score * weights.verticalAiFit
        )
      : 0;

    const positiveReasons = [];
    if (mandate.passed) {
      positiveReasons.push(
        `Thesis similarity ${thesisScore}/100 (TF-IDF cosine vs ${MOTIVE_VENTURE_PORTFOLIO.length} Motive venture investments).`
      );
      if (portfolioMatch.similarity >= 0.08) {
        const sectorLabel =
          MOTIVE_SECTOR_TAXONOMY.find((s) => s.key === portfolioMatch.sectorKey)?.label ||
          portfolioMatch.sectorKey;
        positiveReasons.push(
          `Closest portfolio comp: ${portfolioMatch.name} (${sectorLabel}).`
        );
      }
      positiveReasons.push(...sectorFit.reasons);
      positiveReasons.push(...geoFit.reasons);
      positiveReasons.push(...ageFit.reasons);
      positiveReasons.push(...checkSize.reasons.filter((r) => !r.includes("not disclosed") && !r.includes("above Motive") && !r.includes("growth")));
      positiveReasons.push(...capitalEff.reasons.filter((r) => !r.includes("below typical") && !r.includes("Pre-revenue") && !r.includes("Insufficient")));
      positiveReasons.push(...infraMoat.reasons.filter((r) => !r.includes("Limited") && !r.includes("B2C")));
      positiveReasons.push(...verticalAi.reasons.filter((r) => !r.includes("Weak") && !r.includes("AI-washing") && !r.includes("not clearly")));
      positiveReasons.push(...traction.reasons.filter((r) => !r.includes("Pre-revenue") && !r.includes("Limited")));
      positiveReasons.push(...founders.reasons.filter((r) => !r.includes("First-time") && !r.includes("neutral")));
      positiveReasons.push(...stageFit.reasons);
    }

    const cautionReasons = [
      ...checkSize.reasons.filter((r) => r.includes("not disclosed") || r.includes("above") || r.includes("growth")),
      ...capitalEff.reasons.filter((r) => r.includes("below typical") || r.includes("Pre-revenue") || r.includes("Insufficient")),
      ...infraMoat.reasons.filter((r) => r.includes("Limited") || r.includes("B2C")),
      ...verticalAi.reasons.filter((r) => r.includes("Weak") || r.includes("AI-washing") || r.includes("generic") || r.includes("not clearly")),
      ...traction.reasons.filter((r) => r.includes("Pre-revenue") || r.includes("Modest") || r.includes("Limited")),
      ...founders.reasons.filter((r) => r.includes("First-time")),
      ...ageFit.reasons.filter((r) => r.includes("mature") || r.includes("acceptable")),
      ...geoFit.reasons.filter((r) => r.includes("not a top")),
    ];

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
      componentScores,
      thesisSimilarity,
      portfolioMatch,
      primarySector: sectorFit.primarySector?.label || null,
      companyAge: ageFit.age,
      positiveReasons,
      cautionReasons,
      filterReasons: mandate.failures.map((f) => f.message),
      weights,
    };
  });

  const shortlisted = results
    .filter((r) => r.mandate.passed)
    .sort((a, b) => b.overallScore - a.overallScore || b.thesisSimilarity - a.thesisSimilarity);

  const filteredOut = results
    .filter((r) => !r.mandate.passed)
    .sort((a, b) => STAGE_ORDER[a.mandate.stage] - STAGE_ORDER[b.mandate.stage]);

  return {
    summary: {
      total: results.length,
      shortlisted: shortlisted.length,
      filteredOut: filteredOut.length,
      priorityReview: shortlisted.filter((r) => r.tier === "Priority Review").length,
      scoringProfile: "Motive venture portfolio-calibrated (n=41)",
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
