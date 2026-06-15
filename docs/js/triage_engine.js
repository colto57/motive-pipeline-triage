const { MOTIVE_MANDATE, MOTIVE_VENTURE_PORTFOLIO, buildReferenceCorpus } = window.MotiveReference;

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

const OFF_THESIS_SECTORS = [
  { pattern: /hr technology|human resources|workforce planning/i, label: "HR Technology" },
  { pattern: /proptech|real estate technology|commercial real estate buildings/i, label: "PropTech / CRE ops" },
  { pattern: /logistics|supply chain|courier|last-mile/i, label: "Logistics / supply chain" },
  { pattern: /healthcare technology|patient records|EMR|care coordination/i, label: "Healthcare IT (non-financial)" },
  { pattern: /climate|ESG reporting|carbon accounting/i, label: "Climate / ESG (adjacent, not core)" },
];

const TIER1_COMPANIES =
  /\b(stripe|jpmorgan|jp morgan|goldman sachs|visa|mastercard|paypal|square|brex|plaid|coinbase|a16z|openai|anthropic|mckinsey|bloomberg|ubs|credit suisse|worldpay|adyen|klarna|salesforce|workday|linkedin|blackstone|yardi|citadel|aws|amazon|nubank|grab|trueLayer|harvey ai|kirkland|munich re|ondeck|kabbage|epic|athenahealth|fedex|flexport|prudential|palantir)\b/i;

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

  return { text, isUS, isEurope, inMandate: isUS || isEurope };
}

function buildCompanyDocument(row) {
  return [
    row.company_name,
    row.sector,
    row.founder_background,
    row.pitch_summary,
    row.stage,
    row.hq_geography,
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
    customers: text.match(/(\d[\d,\+]*)\s+(?:paying customers|enterprise customers|customers|clients|pilots|design partners|bank pilots|active users)/i)?.[0] || null,
    designPartners: /design partner|tier-1 bank|bank pilot|community bank pilot/i.test(text),
  };
}

function scoreSectorAlignment(row) {
  const text = `${row.sector} ${row.pitch_summary}`.toLowerCase();
  const hits = MOTIVE_MANDATE.coreSectors.filter((s) => text.includes(s));
  let score = Math.min(100, 35 + hits.length * 12);

  const reasons = [];
  if (hits.length >= 3) {
    reasons.push(`Strong fintech alignment: matches ${hits.slice(0, 4).join(", ")} themes from Motive's mandate.`);
  } else if (hits.length >= 1) {
    reasons.push(`Partial fintech alignment via ${hits.join(", ")}.`);
  } else {
    reasons.push("Limited direct overlap with Motive's core fintech verticals.");
    score = 25;
  }

  for (const off of OFF_THESIS_SECTORS) {
    if (off.pattern.test(`${row.sector} ${row.pitch_summary}`)) {
      score -= 18;
      reasons.push(`Sector flagged as adjacent/off-thesis (${off.label}) for Motive venture.`);
    }
  }

  return { score: Math.max(0, Math.min(100, score)), reasons };
}

function scoreTraction(row) {
  const metrics = parseMoney(row.pitch_summary);
  let score = 35;
  const reasons = [];

  if (metrics.arr != null) {
    if (metrics.arr >= 5_000_000) {
      score += 35;
      reasons.push(`Material ARR signal (${row.pitch_summary.match(/\$[\d.]+\s*[mbk]\s*ARR/i)?.[0] || "disclosed ARR"}).`);
    } else if (metrics.arr >= 500_000) {
      score += 25;
      reasons.push(`Early but credible ARR (${row.pitch_summary.match(/\$[\d.]+\s*[mbk]\s*ARR/i)?.[0] || "disclosed ARR"}).`);
    } else {
      score += 12;
      reasons.push(`Modest ARR; traction still forming.`);
    }
  }

  if (metrics.gmv != null && metrics.gmv >= 100_000_000) {
    score += 30;
    reasons.push(`Large payment volume / GMV signal (${row.pitch_summary.match(/\$[\d.]+\s*[mbn]\+?\s*GMV/i)?.[0] || "disclosed GMV"}).`);
  }

  if (metrics.growth != null && metrics.growth >= 50) {
    score += 15;
    reasons.push(`High growth rate (${metrics.growthLabel}).`);
  }

  if (metrics.customers) {
    score += 10;
    reasons.push(`Customer / user traction: ${metrics.customers}.`);
  }

  if (metrics.designPartners) {
    score += 12;
    reasons.push("Enterprise design partners or regulated-institution pilots de-risk early GTM.");
  }

  if (metrics.preRevenue && metrics.arr == null && !metrics.designPartners) {
    score -= 15;
    reasons.push("Pre-revenue with no disclosed institutional pilots — higher execution risk at this stage.");
  }

  if (reasons.length === 0) {
    reasons.push("Traction signals are limited in the pitch; would validate metrics on first call.");
  }

  return { score: Math.max(0, Math.min(100, score)), reasons, metrics };
}

function scoreFounders(row) {
  const text = row.founder_background || "";
  let score = 40;
  const reasons = [];

  if (SERIAL_FOUNDER.test(text)) {
    score += 25;
    reasons.push("Serial founder with prior exit — strong pattern for Motive venture bets.");
  }

  if (TIER1_COMPANIES.test(text)) {
    score += 22;
    reasons.push("Founders carry tier-1 fintech / financial services operator credentials.");
  } else if (SENIOR_TITLES.test(text)) {
    score += 12;
    reasons.push("Senior operator titles suggest relevant domain leadership experience.");
  }

  if (/first-time founders/i.test(text)) {
    score -= 8;
    reasons.push("First-time founders — team quality would need extra diligence.");
  }

  if (reasons.length === 0) {
    reasons.push("Founder background is plausible but not a standout signal from text alone.");
  }

  return { score: Math.max(0, Math.min(100, score)), reasons };
}

function scoreStageFit(stage) {
  const normalized = normalizeStage(stage);
  if (normalized === "seed") return { score: 95, reasons: ["Seed stage is core Motive venture focus."] };
  if (normalized === "series a") return { score: 88, reasons: ["Series A fits the upper bound of Motive venture mandate."] };
  if (normalized === "pre-seed") return { score: 78, reasons: ["Pre-seed fits mandate; typically requires stronger founder signal to prioritize."] };
  return { score: 20, reasons: ["Stage outside venture mandate."] };
}

function findBestPortfolioMatch(companyVec, idf) {
  let best = { name: null, similarity: 0, subsector: "" };
  for (const company of MOTIVE_VENTURE_PORTFOLIO) {
    const doc = `${company.name} ${company.subsector}`;
    const vec = tfidfVector(doc, idf);
    const sim = cosineSimilarity(companyVec, vec);
    if (sim > best.similarity) {
      best = { name: company.name, similarity: sim, subsector: company.subsector };
    }
  }
  return best;
}

function applyMandateFilters(row) {
  const stage = normalizeStage(row.stage);
  const geo = parseGeography(row.hq_geography);
  const failures = [];

  if (!MOTIVE_MANDATE.stages.includes(stage)) {
    failures.push({
      code: "stage",
      message: `Stage "${row.stage}" is outside Motive venture mandate (Pre-Seed – Series A). Likely better suited for growth / buyout team.`,
    });
  }

  if (!geo.inMandate) {
    failures.push({
      code: "geography",
      message: `HQ "${row.hq_geography}" is outside US/Europe focus.`,
    });
  }

  return {
    passed: failures.length === 0,
    failures,
    stage,
    geo,
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

  const results = rows.map((row) => {
    const mandate = applyMandateFilters(row);
    const companyDoc = buildCompanyDocument(row);
    const companyVec = tfidfVector(companyDoc, idf);
    const thesisSimilarity = cosineSimilarity(companyVec, referenceComposite);
    const thesisScore = Math.round(thesisSimilarity * 100);
    const portfolioMatch = findBestPortfolioMatch(companyVec, idf);

    const sector = scoreSectorAlignment(row);
    const traction = scoreTraction(row);
    const founders = scoreFounders(row);
    const stageFit = scoreStageFit(mandate.stage);

    const weights = {
      thesis: 0.28,
      sector: 0.22,
      traction: 0.22,
      founders: 0.18,
      stage: 0.10,
    };

    const componentScores = {
      thesisSimilarity: thesisScore,
      sectorAlignment: sector.score,
      traction: traction.score,
      founderSignal: founders.score,
      stageFit: stageFit.score,
    };

    const weightedScore = mandate.passed
      ? Math.round(
          thesisScore * weights.thesis +
            sector.score * weights.sector +
            traction.score * weights.traction +
            founders.score * weights.founders +
            stageFit.score * weights.stage
        )
      : 0;

    const positiveReasons = [];
    if (mandate.passed) {
      positiveReasons.push(
        `Thesis similarity ${thesisScore}/100 vs Motive venture corpus (TF-IDF cosine vs mandate + ${MOTIVE_VENTURE_PORTFOLIO.length} portfolio references).`
      );
      if (portfolioMatch.similarity >= 0.08) {
        positiveReasons.push(
          `Closest Motive venture comp: ${portfolioMatch.name} (${portfolioMatch.subsector.split(" ").slice(0, 5).join(" ")}…).`
        );
      }
      positiveReasons.push(...sector.reasons.filter((r) => !r.includes("flagged")));
      positiveReasons.push(...traction.reasons.filter((r) => !r.includes("Pre-revenue") && !r.includes("limited")));
      positiveReasons.push(...founders.reasons.filter((r) => !r.includes("First-time") && !r.includes("plausible but")));
      positiveReasons.push(...stageFit.reasons);
    }

    const cautionReasons = [
      ...sector.reasons.filter((r) => r.includes("flagged") || r.includes("Limited") || r.includes("adjacent")),
      ...traction.reasons.filter((r) => r.includes("Pre-revenue") || r.includes("limited") || r.includes("Modest")),
      ...founders.reasons.filter((r) => r.includes("First-time")),
    ];

    let tier = "Filtered Out";
    if (mandate.passed) {
      if (weightedScore >= 78) tier = "Priority Review";
      else if (weightedScore >= 62) tier = "Standard Review";
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
      generatedAt: new Date().toISOString(),
    },
    shortlisted,
    filteredOut,
    all: [...shortlisted, ...filteredOut],
  };
}

function parseCsv(text) {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) throw new Error("CSV must include a header row and at least one company.");

  const headers = splitCsvLine(lines[0]).map((h) => h.trim());
  const required = [
    "company_name",
    "website",
    "founding_year",
    "stage",
    "hq_geography",
    "sector",
    "founder_background",
    "pitch_summary",
  ];
  for (const field of required) {
    if (!headers.includes(field)) {
      throw new Error(`Missing required column: ${field}`);
    }
  }

  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    const values = splitCsvLine(lines[i]);
    const row = {};
    headers.forEach((h, idx) => {
      row[h] = (values[idx] || "").trim();
    });
    rows.push(row);
  }
  return rows;
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

window.TriageEngine = { triageCompanies, parseCsv };
