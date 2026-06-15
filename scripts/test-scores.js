const fs = require("fs");
const path = require("path");
const vm = require("vm");

function loadEngine() {
  const bundle = fs.readFileSync(path.join(__dirname, "..", "docs", "js", "engine.bundle.js"), "utf8");
  const sandbox = { window: {}, console };
  vm.createContext(sandbox);
  vm.runInContext(bundle, sandbox);
  return sandbox.window;
}

function parseSampleCsv(text) {
  const lines = text.trim().split("\n");
  const headers = lines[0].split(",");
  return lines.slice(1).map((line) => {
    const values = [];
    let cur = "";
    let inQ = false;
    for (const ch of line) {
      if (ch === '"') inQ = !inQ;
      else if (ch === "," && !inQ) {
        values.push(cur);
        cur = "";
      } else cur += ch;
    }
    values.push(cur);
    const row = {};
    headers.forEach((h, i) => {
      row[h.trim()] = (values[i] || "").trim();
    });
    return row;
  });
}

const { MotiveReference, TriageEngine } = loadEngine();
const analytics = MotiveReference.MOTIVE_PORTFOLIO_STAGE_ANALYTICS;
console.log("STAGE_MIX", JSON.stringify(analytics.stageMix, null, 2));
console.log("STAGE_COUNTS", analytics.stageCounts);

const sample = fs.readFileSync(path.join(__dirname, "..", "Case Study_Inbound Pipeline.csv"), "utf8");
const rows = parseSampleCsv(sample).filter((r) =>
  ["Along", "Koxa", "TalentOS"].includes(r.company_name)
);

const results = TriageEngine.triageCompanies(rows);
for (const r of results.shortlisted.concat(results.filteredOut)) {
  if (!["Along", "Koxa", "TalentOS"].includes(r.company_name)) continue;
  console.log("\n===", r.company_name, "===");
  console.log("Overall:", r.overallScore, r.tier);
  console.log("New factors:", {
    portfolioStageAffinity: r.componentScores.portfolioStageAffinity,
    founderExecutionIndex: r.componentScores.founderExecutionIndex,
    tractionVelocityIndex: r.componentScores.tractionVelocityIndex,
    portfolioGapScore: r.componentScores.portfolioGapScore,
  });
}
