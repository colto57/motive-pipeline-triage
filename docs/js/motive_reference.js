/**
 * Motive Partners venture mandate + portfolio-calibrated scoring profile.
 * Venture portfolio analytics derived from motivepartners.com/portfolio (Venture filter, n=41).
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
  checkSizeUsd: { min: 1_000_000, max: 10_000_000, label: "$1–10M lead/co-lead" },
  currentYear: 2026,
};

/**
 * Observed venture portfolio mix (41 investments, 2021–2026).
 * Used to calibrate sector priority weights — not a hard allocation target.
 */
const MOTIVE_PORTFOLIO_ANALYTICS = {
  source: "motivepartners.com/portfolio · Venture strategy",
  sampleSize: 41,
  sectorMix: {
    wealth_asset_management: 0.34,
    banking_payments: 0.32,
    ai_data_analytics: 0.15,
    capital_markets: 0.1,
    insurance: 0.07,
    business_services: 0.02,
  },
  geographyMix: {
    united_states: 0.44,
    europe: 0.56,
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
    portfolioWeight: 0.15,
    patterns: [
      /\bai\b|analytics|data platform|automation|agent|llm|machine learning|fraud|compliance monitoring|financial infrastructure/i,
    ],
  },
  {
    key: "capital_markets",
    label: "Capital markets",
    portfolioWeight: 0.1,
    patterns: [
      /capital market|trading|custody|syndication|derivatives|securities|defi|digital asset|tokenized|settlement/i,
    ],
  },
  {
    key: "insurance",
    label: "Insurance",
    portfolioWeight: 0.07,
    patterns: [/insurance|insurtech|underwriting|claims|parametric|actuar/i],
  },
  {
    key: "business_services",
    label: "Fintech business services",
    portfolioWeight: 0.02,
    patterns: [
      /regtech|compliance reporting|legal technology|workflow automation|bsa|aml|sar|exam preparation/i,
    ],
  },
];

/** Hard-filter: sectors clearly outside Motive venture fintech focus */
const NON_FINTECH_SECTORS = [
  { pattern: /hr technology|human resources|workforce planning|headcount|compensation benchmarking/i, label: "HR Technology" },
  { pattern: /proptech|commercial real estate buildings|access control|energy management|tenant experience/i, label: "PropTech / CRE operations" },
  { pattern: /logistics|supply chain|courier|last-mile|delivery times/i, label: "Logistics / supply chain" },
  { pattern: /healthcare technology|patient records|EMR systems|care coordination|hospital pilots/i, label: "Healthcare IT (non-financial)" },
  { pattern: /climate|carbon accounting|ESG reporting|CSRD|SEC climate disclosure/i, label: "Climate / ESG (standalone, non-core)" },
  { pattern: /real estate investment analysis|lease abstraction|asset management reporting for institutional real estate/i, label: "Real estate tech (non-wealth)" },
];

const COMPANY_AGE_BY_STAGE = {
  "pre-seed": { idealMin: 0, idealMax: 2, acceptableMax: 3, label: "0–2 years" },
  seed: { idealMin: 1, idealMax: 4, acceptableMax: 6, label: "1–4 years" },
  "series a": { idealMin: 2, idealMax: 5, acceptableMax: 7, label: "2–5 years" },
};

const SCORING_WEIGHTS = {
  thesisSimilarity: 0.22,
  portfolioSectorFit: 0.24,
  traction: 0.18,
  founderSignal: 0.14,
  geographyAffinity: 0.08,
  companyAgeFit: 0.08,
  stageFit: 0.06,
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
  { name: "Alphastream", subsector: "AI data analytics capital markets workflow automation", location: "New York City NY United States", sectorKey: "ai_data_analytics" },
  { name: "AMP", subsector: "wealth asset management digital investing", location: "Boulder CO United States", sectorKey: "wealth_asset_management" },
  { name: "Anchorage Digital", subsector: "capital markets digital assets custody institutional", location: "San Francisco CA United States", sectorKey: "capital_markets" },
  { name: "Artifact AI", subsector: "AI data analytics financial services automation", location: "New York City NY United States", sectorKey: "ai_data_analytics" },
  { name: "Asseta AI", subsector: "wealth asset management AI advisor workflows", location: "New York City NY United States", sectorKey: "wealth_asset_management" },
  { name: "Aufinity Group", subsector: "banking payments europe SME financial services", location: "Cologne Germany", sectorKey: "banking_payments" },
  { name: "Bunch", subsector: "wealth asset management private markets investing platform", location: "Berlin Germany", sectorKey: "wealth_asset_management" },
  { name: "Constrafor", subsector: "banking payments construction finance payments", location: "New York City NY United States", sectorKey: "banking_payments" },
  { name: "Credix", subsector: "banking payments receivables financing europe", location: "Antwerp Belgium", sectorKey: "banking_payments" },
  { name: "DoorFeed", subsector: "wealth asset management real estate investing platform", location: "London United Kingdom", sectorKey: "wealth_asset_management" },
  { name: "Finperks", subsector: "banking payments employee benefits financial wellness", location: "Berlin Germany", sectorKey: "banking_payments" },
  { name: "Flanks", subsector: "wealth asset management portfolio data aggregation", location: "Barcelona Spain", sectorKey: "wealth_asset_management" },
  { name: "Getquin", subsector: "wealth asset management social investing community", location: "Berlin Germany", sectorKey: "wealth_asset_management" },
  { name: "Hero", subsector: "banking payments SME neobank europe", location: "Paris France", sectorKey: "banking_payments" },
  { name: "Korr", subsector: "insurance underwriting automation AI", location: "New York City NY United States", sectorKey: "insurance" },
  { name: "LawX", subsector: "business services legal workflow automation financial institutions", location: "Berlin Germany", sectorKey: "business_services" },
  { name: "Luca", subsector: "banking payments SMB accounting payments europe", location: "Berlin Germany", sectorKey: "banking_payments" },
  { name: "Monnai", subsector: "AI data analytics identity verification fintech onboarding", location: "Los Angeles CA United States", sectorKey: "ai_data_analytics" },
  { name: "Navro", subsector: "banking payments cross border treasury FX", location: "London United Kingdom", sectorKey: "banking_payments" },
  { name: "Nelly", subsector: "banking payments healthcare patient financing", location: "Berlin Germany", sectorKey: "banking_payments" },
  { name: "Novata", subsector: "wealth asset management private markets ESG data", location: "New York City NY United States", sectorKey: "wealth_asset_management" },
  { name: "Obin AI", subsector: "AI data analytics financial research automation", location: "New York City NY United States", sectorKey: "ai_data_analytics" },
  { name: "Parto", subsector: "banking payments B2B payments europe", location: "Hamburg Germany", sectorKey: "banking_payments" },
  { name: "Penzilla", subsector: "insurance embedded insurance distribution", location: "Munich Germany", sectorKey: "insurance" },
  { name: "Pliant", subsector: "banking payments corporate cards spend management", location: "Berlin Germany", sectorKey: "banking_payments" },
  { name: "Pluto", subsector: "banking payments payroll earned wage access", location: "New York City NY United States", sectorKey: "banking_payments" },
  { name: "Steward", subsector: "wealth asset management family office reporting", location: "New York City NY United States", sectorKey: "wealth_asset_management" },
  { name: "Swapglobal", subsector: "capital markets FX derivatives trading infrastructure", location: "Miami FL United States", sectorKey: "capital_markets" },
  { name: "Synthera AI", subsector: "AI data analytics financial compliance monitoring", location: "London United Kingdom", sectorKey: "ai_data_analytics" },
  { name: "Threatfabric", subsector: "AI data analytics fraud detection financial crime", location: "Amsterdam Netherlands", sectorKey: "ai_data_analytics" },
  { name: "Titanbay", subsector: "wealth asset management alternative investments platform", location: "London United Kingdom", sectorKey: "wealth_asset_management" },
  { name: "Triver", subsector: "banking payments invoice financing SMB europe", location: "London United Kingdom", sectorKey: "banking_payments" },
  { name: "Valstro", subsector: "capital markets trading workflow automation", location: "New York City NY United States", sectorKey: "capital_markets" },
  { name: "Versana", subsector: "capital markets loan syndication data platform", location: "New York City NY United States", sectorKey: "capital_markets" },
  { name: "Warren", subsector: "wealth asset management portfolio reporting europe", location: "Ghent Belgium", sectorKey: "wealth_asset_management" },
  { name: "Xaver", subsector: "wealth asset management insurance distribution platform", location: "Cologne Germany", sectorKey: "wealth_asset_management" },
  { name: "Zocks", subsector: "wealth asset management advisor CRM automation AI", location: "San Francisco CA United States", sectorKey: "wealth_asset_management" },
];

function buildReferenceCorpus() {
  const portfolioDocs = MOTIVE_VENTURE_PORTFOLIO.map(
    (c) => `${c.name} ${c.subsector} ${c.location} venture investment fintech US Europe`
  );
  return [...MOTIVE_THESIS_STATEMENTS, ...portfolioDocs];
}

function classifyCompanySector(row) {
  const text = `${row.sector} ${row.pitch_summary} ${row.founder_background}`.toLowerCase();
  const matches = [];

  for (const sector of MOTIVE_SECTOR_TAXONOMY) {
    if (sector.patterns.some((pattern) => pattern.test(text))) {
      matches.push(sector);
    }
  }

  for (const off of NON_FINTECH_SECTORS) {
    if (off.pattern.test(text)) {
      return { isFintech: false, offThesis: off.label, matches: [] };
    }
  }

  if (matches.length === 0) {
    return { isFintech: false, offThesis: "Unclassified / weak fintech signal", matches: [] };
  }

  return { isFintech: true, offThesis: null, matches };
}

window.MotiveReference = {
  MOTIVE_MANDATE,
  MOTIVE_PORTFOLIO_ANALYTICS,
  MOTIVE_SECTOR_TAXONOMY,
  NON_FINTECH_SECTORS,
  COMPANY_AGE_BY_STAGE,
  SCORING_WEIGHTS,
  MOTIVE_THESIS_STATEMENTS,
  MOTIVE_VENTURE_PORTFOLIO,
  buildReferenceCorpus,
  classifyCompanySector,
};
