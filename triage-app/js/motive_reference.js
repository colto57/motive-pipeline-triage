/**
 * Motive Partners venture mandate + portfolio-calibrated scoring profile.
 * Venture portfolio analytics derived from motivepartners.com/portfolio (Venture filter).
 * As of June 2026: 41 total Venture entries on site; 38 in similarity corpus (3 realized exits excluded).
 */
const MOTIVE_MANDATE = {
  stages: ["pre-seed", "seed", "series a"],
  geographies: {
    us: ["united states", "us", "u.s.", "usa"],
    europe: [
      "uk",
      "united kingdom",
      "england",
      "scotland",
      "wales",
      "germany",
      "france",
      "netherlands",
      "belgium",
      "switzerland",
      "spain",
      "italy",
      "ireland",
      "sweden",
      "denmark",
      "norway",
      "finland",
      "austria",
      "portugal",
      "europe",
      "eu",
    ],
  },
  checkSizeUsd: { min: 1000000, max: 10000000, label: "$1-10M lead/co-lead" },
  currentYear: 2026,
};

/**
 * Observed venture portfolio mix (38 companies in similarity corpus, June 2026).
 * Source: motivepartners.com/portfolio · Venture strategy filter.
 * Total Venture on site = 41 (includes 4 realized); corpus excludes 3 realized (Corastone, Februar, Vitera).
 */
const MOTIVE_PORTFOLIO_ANALYTICS = {
  source: "motivepartners.com/portfolio · Venture strategy",
  sampleSize: 38,
  totalVentureOnSite: 41,
  activeVentureOnSite: 37,
  realizedVentureExcluded: ["Corastone", "Februar", "Vitera"],
  realizedVentureOnSite: ["AMP", "Corastone", "Februar", "Vitera"],
  sectorMix: {
    wealth_asset_management: 0.34,
    banking_payments: 0.32,
    ai_data_analytics: 0.16,
    capital_markets: 0.11,
    insurance: 0.05,
    business_services: 0.03,
  },
  geographyMix: {
    united_states: 0.42,
    europe: 0.58,
  },
  hubCities: [
    "new york",
    "nyc",
    "berlin",
    "london",
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
  ],
  investmentThemes: [
    "verticalized AI in financial workflows",
    "embedded finance and banking infrastructure APIs",
    "wealth / advisor workflow automation",
    "compliance, fraud, and financial data foundations",
  ],
};

const MOTIVE_SECTOR_TAXONOMY = [
  {
    key: "wealth_asset_management",
    label: "Wealth & asset management",
    portfolioWeight: 0.34,
    patterns: [
      /wealth|asset management|advisor|portfolio|investing|robo|family office|private markets|AUM/i,
    ],
  },
  {
    key: "banking_payments",
    label: "Banking & payments",
    portfolioWeight: 0.32,
    patterns: [
      /payment|banking|treasury|fx|cross-border|lending|open banking|embedded finance|invoice|payables|receivable|remittance|core banking|neobank/i,
    ],
  },
  {
    key: "ai_data_analytics",
    label: "AI, data & analytics",
    portfolioWeight: 0.16,
    patterns: [
      /\bai\b|analytics|data platform|automation|agent|llm|machine learning|fraud|compliance monitoring|financial infrastructure/i,
    ],
  },
  {
    key: "capital_markets",
    label: "Capital markets",
    portfolioWeight: 0.11,
    patterns: [
      /capital market|trading|custody|syndication|derivatives|securities|defi|digital asset|tokenized|settlement/i,
    ],
  },
  {
    key: "insurance",
    label: "Insurance",
    portfolioWeight: 0.05,
    patterns: [/insurance|insurtech|underwriting|claims|parametric|actuar/i],
  },
  {
    key: "business_services",
    label: "Fintech business services",
    portfolioWeight: 0.03,
    patterns: [
      /regtech|compliance reporting|legal technology|workflow automation|bsa|aml|sar|exam preparation/i,
    ],
  },
];

/** Adjacent tech sectors — kept in pipeline but deprioritized vs core fintech */
const ADJACENT_SECTORS = [
  { pattern: /hr technology|human resources|workforce planning|headcount|compensation benchmarking/i, label: "HR Technology" },
  { pattern: /proptech|commercial real estate buildings|access control|energy management|tenant experience/i, label: "PropTech / CRE operations" },
  { pattern: /logistics|supply chain|courier|last-mile|delivery times/i, label: "Logistics / supply chain" },
  { pattern: /healthcare technology|patient records|EMR systems|care coordination|hospital pilots/i, label: "Healthcare IT (non-financial)" },
  { pattern: /climate|carbon accounting|ESG reporting|CSRD|SEC climate disclosure/i, label: "Climate / ESG (standalone, non-core)" },
  { pattern: /real estate investment analysis|lease abstraction|asset management reporting for institutional real estate/i, label: "Real estate tech (non-wealth)" },
];

const COMPANY_AGE_BY_STAGE = {
  "pre-seed": { idealMin: 0, idealMax: 2, acceptableMax: 3, label: "0-2 years" },
  seed: { idealMin: 1, idealMax: 4, acceptableMax: 6, label: "1-4 years" },
  "series a": { idealMin: 2, idealMax: 5, acceptableMax: 7, label: "2-5 years" },
};

const SCORING_WEIGHTS = {
  thesisSimilarity: 0.16,
  portfolioSectorFit: 0.17,
  traction: 0.08,
  founderSignal: 0.03,
  geographyAffinity: 0.05,
  companyAgeFit: 0.06,
  checkSizeFit: 0.06,
  capitalEfficiency: 0.06,
  infrastructureMoat: 0.06,
  verticalAiFit: 0.05,
  portfolioStageAffinity: 0.05,
  founderExecutionIndex: 0.08,
  tractionVelocityIndex: 0.05,
  portfolioGapScore: 0.04,
};

/** Monthly ARR velocity benchmarks ($/mo) derived from portfolio stage patterns + venture norms */
const TRACTION_VELOCITY_BENCHMARKS = {
  "pre-seed": { p25: 2500, p50: 9000, p75: 22000, label: "Pre-Seed" },
  seed: { p25: 14000, p50: 28000, p75: 55000, label: "Seed" },
  "series a": { p25: 45000, p50: 100000, p75: 200000, label: "Series A" },
};

const MOTIVE_THESIS_STATEMENTS = [
  "Motive Partners venture invests pre-seed through Series A in fintech across the US and Europe with one to ten million dollar checks.",
  "We back verticalized AI embedded finance and platform infrastructure across banking payments wealth insurance and capital markets.",
  "We invest in payment technologies that replace legacy pipelines to make transactions faster safer and cheaper.",
  "We back wealth and asset management technology that democratizes investing with data and AI driven distribution.",
  "We invest in insurance software that modernizes underwriting distribution and claims with precision analytics.",
  "We invest in financial infrastructure APIs open banking compliance reconciliation and core banking modernization.",
  "We look for founders with deep financial services operator experience building mission critical infrastructure.",
];

const MOTIVE_VENTURE_PORTFOLIO = [
  { name: "Alphastream", subsector: "AI data analytics capital markets workflow automation", location: "New York City NY United States", sectorKey: "ai_data_analytics", investmentStage: "series a" },
  { name: "AMP", subsector: "wealth asset management digital investing", location: "Boulder CO United States", sectorKey: "wealth_asset_management", investmentStage: "series a" },
  { name: "Anchorage Digital", subsector: "capital markets digital assets custody institutional", location: "San Francisco CA United States", sectorKey: "capital_markets", investmentStage: "series a" },
  { name: "Artifact AI", subsector: "AI data analytics financial services automation", location: "New York City NY United States", sectorKey: "ai_data_analytics", investmentStage: "pre-seed" },
  { name: "Asseta AI", subsector: "wealth asset management AI advisor workflows", location: "New York City NY United States", sectorKey: "wealth_asset_management", investmentStage: "pre-seed" },
  { name: "Aufinity Group", subsector: "banking payments europe SME financial services", location: "Cologne Germany", sectorKey: "banking_payments", investmentStage: "seed" },
  { name: "Bunch", subsector: "wealth asset management private markets investing platform", location: "Berlin Germany", sectorKey: "wealth_asset_management", investmentStage: "series a" },
  { name: "Constrafor", subsector: "banking payments construction finance payments", location: "New York City NY United States", sectorKey: "banking_payments", investmentStage: "seed" },
  { name: "Credix", subsector: "banking payments receivables financing europe", location: "Antwerp Belgium", sectorKey: "banking_payments", investmentStage: "seed" },
  { name: "DoorFeed", subsector: "wealth asset management real estate investing platform", location: "London United Kingdom", sectorKey: "wealth_asset_management", investmentStage: "seed" },
  { name: "Finperks", subsector: "banking payments employee benefits financial wellness", location: "Berlin Germany", sectorKey: "banking_payments", investmentStage: "pre-seed" },
  { name: "Flanks", subsector: "wealth asset management portfolio data aggregation", location: "Barcelona Spain", sectorKey: "wealth_asset_management", investmentStage: "series a" },
  { name: "Getquin", subsector: "wealth asset management social investing community", location: "Berlin Germany", sectorKey: "wealth_asset_management", investmentStage: "seed" },
  { name: "Hero", subsector: "banking payments SME neobank europe", location: "Paris France", sectorKey: "banking_payments", investmentStage: "seed" },
  { name: "Korr", subsector: "insurance underwriting automation AI", location: "New York City NY United States", sectorKey: "insurance", investmentStage: "pre-seed" },
  { name: "LawX", subsector: "business services legal workflow automation financial institutions", location: "Berlin Germany", sectorKey: "business_services", investmentStage: "pre-seed" },
  { name: "Luca", subsector: "banking payments SMB accounting payments europe", location: "Berlin Germany", sectorKey: "banking_payments", investmentStage: "seed" },
  { name: "Monnai", subsector: "AI data analytics identity verification fintech onboarding", location: "Los Angeles CA United States", sectorKey: "ai_data_analytics", investmentStage: "series a" },
  { name: "MYNE Homes", subsector: "wealth asset management real estate investing fractional ownership", location: "Berlin Germany", sectorKey: "wealth_asset_management", investmentStage: "seed" },
  { name: "Navro", subsector: "banking payments cross border treasury FX", location: "London United Kingdom", sectorKey: "banking_payments", investmentStage: "series a" },
  { name: "Nelly", subsector: "banking payments healthcare patient financing", location: "Berlin Germany", sectorKey: "banking_payments", investmentStage: "seed" },
  { name: "Novata", subsector: "wealth asset management private markets ESG data", location: "New York City NY United States", sectorKey: "wealth_asset_management", investmentStage: "series a" },
  { name: "Obin AI", subsector: "AI data analytics financial research automation", location: "New York City NY United States", sectorKey: "ai_data_analytics", investmentStage: "pre-seed" },
  { name: "Parto", subsector: "banking payments B2B payments europe", location: "Hamburg Germany", sectorKey: "banking_payments", investmentStage: "seed" },
  { name: "Penzilla", subsector: "insurance embedded insurance distribution", location: "Munich Germany", sectorKey: "insurance", investmentStage: "pre-seed" },
  { name: "Pliant", subsector: "banking payments corporate cards spend management", location: "Berlin Germany", sectorKey: "banking_payments", investmentStage: "series a" },
  { name: "Pluto", subsector: "banking payments payroll earned wage access", location: "New York City NY United States", sectorKey: "banking_payments", investmentStage: "seed" },
  { name: "Steward", subsector: "wealth asset management family office reporting", location: "New York City NY United States", sectorKey: "wealth_asset_management", investmentStage: "seed" },
  { name: "Swapglobal", subsector: "capital markets FX derivatives trading infrastructure", location: "Miami FL United States", sectorKey: "capital_markets", investmentStage: "series a" },
  { name: "Synthera AI", subsector: "AI data analytics financial compliance monitoring", location: "London United Kingdom", sectorKey: "ai_data_analytics", investmentStage: "pre-seed" },
  { name: "Threatfabric", subsector: "AI data analytics fraud detection financial crime", location: "Amsterdam Netherlands", sectorKey: "ai_data_analytics", investmentStage: "series a" },
  { name: "Titanbay", subsector: "wealth asset management alternative investments platform", location: "London United Kingdom", sectorKey: "wealth_asset_management", investmentStage: "series a" },
  { name: "Triver", subsector: "banking payments invoice financing SMB europe", location: "London United Kingdom", sectorKey: "banking_payments", investmentStage: "seed" },
  { name: "Valstro", subsector: "capital markets trading workflow automation", location: "New York City NY United States", sectorKey: "capital_markets", investmentStage: "series a" },
  { name: "Versana", subsector: "capital markets loan syndication data platform", location: "New York City NY United States", sectorKey: "capital_markets", investmentStage: "series a" },
  { name: "Warren", subsector: "wealth asset management portfolio reporting europe", location: "Ghent Belgium", sectorKey: "wealth_asset_management", investmentStage: "seed" },
  { name: "Xaver", subsector: "wealth asset management insurance distribution platform", location: "Cologne Germany", sectorKey: "wealth_asset_management", investmentStage: "seed" },
  { name: "Zocks", subsector: "wealth asset management advisor CRM automation AI", location: "San Francisco CA United States", sectorKey: "wealth_asset_management", investmentStage: "seed" },
];

function parsePortfolioGeography(location) {
  const text = (location || "").toLowerCase();
  if (
    /united states|,\s*us\b|usa|u\.s\./i.test(text) ||
    /,\s*(al|ak|az|ar|ca|co|ct|de|fl|ga|hi|id|il|in|ia|ks|ky|la|me|md|ma|mi|mn|ms|mo|mt|ne|nv|nh|nj|nm|ny|nc|nd|oh|ok|or|pa|ri|sc|sd|tn|tx|ut|vt|va|wa|wv|wi|wy)\b/.test(text)
  ) {
    return "united_states";
  }
  return "europe";
}

function buildPortfolioAnalytics(portfolio = MOTIVE_VENTURE_PORTFOLIO) {
  const n = portfolio.length;
  const stageCounts = { "pre-seed": 0, seed: 0, "series a": 0 };
  const sectorStage = {};
  const geoStage = { united_states: { "pre-seed": 0, seed: 0, "series a": 0 }, europe: { "pre-seed": 0, seed: 0, "series a": 0 } };

  for (const company of portfolio) {
    const stage = company.investmentStage || "seed";
    stageCounts[stage] = (stageCounts[stage] || 0) + 1;

    if (!sectorStage[company.sectorKey]) {
      sectorStage[company.sectorKey] = { "pre-seed": 0, seed: 0, "series a": 0, total: 0 };
    }
    sectorStage[company.sectorKey][stage] += 1;
    sectorStage[company.sectorKey].total += 1;

    const geo = parsePortfolioGeography(company.location);
    geoStage[geo][stage] += 1;
  }

  const stageMix = {
    "pre-seed": stageCounts["pre-seed"] / n,
    seed: stageCounts.seed / n,
    "series a": stageCounts["series a"] / n,
  };

  const underweightThreshold = 0.1;
  const underweightSectors = MOTIVE_SECTOR_TAXONOMY.filter(
    (s) => s.portfolioWeight < underweightThreshold
  ).map((s) => s.key);

  return {
    source: "motivepartners.com/portfolio · Venture strategy",
    sampleSize: n,
    stageMix,
    stageCounts,
    sectorStageMatrix: sectorStage,
    geographyStageMatrix: geoStage,
    underweightSectors,
    underweightThreshold,
  };
}

const MOTIVE_PORTFOLIO_STAGE_ANALYTICS = buildPortfolioAnalytics();

function buildReferenceCorpus() {
  const portfolioDocs = MOTIVE_VENTURE_PORTFOLIO.map(
    (c) => `${c.name} ${c.subsector} ${c.location} venture investment fintech US Europe`
  );
  return [...MOTIVE_THESIS_STATEMENTS, ...portfolioDocs];
}

function classifyCompanySector(row) {
  const text = `${row.sector} ${row.pitch_summary} ${row.founder_background}`;
  const matches = [];

  for (const sector of MOTIVE_SECTOR_TAXONOMY) {
    if (sector.patterns.some((pattern) => pattern.test(text))) {
      matches.push(sector);
    }
  }

  for (const adjacent of ADJACENT_SECTORS) {
    if (adjacent.pattern.test(text)) {
      return {
        sectorClass: "adjacent",
        adjacentLabel: adjacent.label,
        offThesis: adjacent.label,
        isFintech: false,
        matches,
      };
    }
  }

  if (matches.length === 0) {
    return {
      sectorClass: "weak",
      adjacentLabel: null,
      offThesis: "Unclassified / weak fintech signal",
      isFintech: false,
      matches: [],
    };
  }

  return {
    sectorClass: "core",
    adjacentLabel: null,
    offThesis: null,
    isFintech: true,
    matches,
  };
}

window.MotiveReference = {
  MOTIVE_MANDATE,
  MOTIVE_PORTFOLIO_ANALYTICS,
  MOTIVE_PORTFOLIO_STAGE_ANALYTICS,
  MOTIVE_SECTOR_TAXONOMY,
  ADJACENT_SECTORS,
  NON_FINTECH_SECTORS: ADJACENT_SECTORS,
  COMPANY_AGE_BY_STAGE,
  SCORING_WEIGHTS,
  TRACTION_VELOCITY_BENCHMARKS,
  MOTIVE_THESIS_STATEMENTS,
  MOTIVE_VENTURE_PORTFOLIO,
  buildReferenceCorpus,
  buildPortfolioAnalytics,
  classifyCompanySector,
};
