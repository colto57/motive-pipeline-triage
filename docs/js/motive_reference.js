/**
 * Motive Partners venture mandate + reference corpus for thesis similarity.
 * Venture portfolio names/subsectors sourced from motivepartners.com/portfolio (Venture filter).
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
  coreSectors: [
    "payments",
    "banking",
    "lending",
    "insurance",
    "wealth",
    "asset management",
    "capital markets",
    "financial infrastructure",
    "fintech",
    "embedded finance",
    "open banking",
    "regtech",
    "compliance",
    "underwriting",
    "treasury",
    "reconciliation",
    "financial data",
    "ai",
    "analytics",
  ],
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
  { name: "Alphastream", subsector: "AI data analytics capital markets workflow automation" },
  { name: "AMP", subsector: "wealth asset management digital investing" },
  { name: "Anchorage Digital", subsector: "capital markets digital assets custody institutional" },
  { name: "Artifact AI", subsector: "AI data analytics financial services automation" },
  { name: "Asseta AI", subsector: "wealth asset management AI advisor workflows" },
  { name: "Aufinity Group", subsector: "banking payments europe SME financial services" },
  { name: "Bunch", subsector: "wealth asset management private markets investing platform" },
  { name: "Constrafor", subsector: "banking payments construction finance payments" },
  { name: "Credix", subsector: "banking payments receivables financing europe" },
  { name: "DoorFeed", subsector: "wealth asset management real estate investing platform" },
  { name: "Finperks", subsector: "banking payments employee benefits financial wellness" },
  { name: "Flanks", subsector: "wealth asset management portfolio data aggregation" },
  { name: "Getquin", subsector: "wealth asset management social investing community" },
  { name: "Hero", subsector: "banking payments SME neobank europe" },
  { name: "Korr", subsector: "insurance underwriting automation AI" },
  { name: "LawX", subsector: "business services legal workflow automation financial institutions" },
  { name: "Luca", subsector: "banking payments SMB accounting payments europe" },
  { name: "Monnai", subsector: "AI data analytics identity verification fintech onboarding" },
  { name: "Navro", subsector: "banking payments cross border treasury FX" },
  { name: "Nelly", subsector: "banking payments healthcare patient financing" },
  { name: "Novata", subsector: "wealth asset management private markets ESG data" },
  { name: "Obin AI", subsector: "AI data analytics financial research automation" },
  { name: "Parto", subsector: "banking payments B2B payments europe" },
  { name: "Penzilla", subsector: "insurance embedded insurance distribution" },
  { name: "Pliant", subsector: "banking payments corporate cards spend management" },
  { name: "Pluto", subsector: "banking payments payroll earned wage access" },
  { name: "Steward", subsector: "wealth asset management family office reporting" },
  { name: "Swapglobal", subsector: "capital markets FX derivatives trading infrastructure" },
  { name: "Synthera AI", subsector: "AI data analytics financial compliance monitoring" },
  { name: "Threatfabric", subsector: "AI data analytics fraud detection financial crime" },
  { name: "Titanbay", subsector: "wealth asset management alternative investments platform" },
  { name: "Triver", subsector: "banking payments invoice financing SMB europe" },
  { name: "Valstro", subsector: "capital markets trading workflow automation" },
  { name: "Versana", subsector: "capital markets loan syndication data platform" },
  { name: "Warren", subsector: "wealth asset management portfolio reporting europe" },
  { name: "Xaver", subsector: "wealth asset management insurance distribution platform" },
  { name: "Zocks", subsector: "wealth asset management advisor CRM automation AI" },
];

function buildReferenceCorpus() {
  const portfolioDocs = MOTIVE_VENTURE_PORTFOLIO.map(
    (c) => `${c.name} ${c.subsector} venture investment fintech US Europe`
  );
  return [...MOTIVE_THESIS_STATEMENTS, ...portfolioDocs];
}

window.MotiveReference = {
  MOTIVE_MANDATE,
  MOTIVE_THESIS_STATEMENTS,
  MOTIVE_VENTURE_PORTFOLIO,
  buildReferenceCorpus,
};
