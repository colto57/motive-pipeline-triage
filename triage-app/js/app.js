const { triageCompanies, parseCsv } = window.TriageEngine;

const uploadZone = document.getElementById("uploadZone");
const csvInput = document.getElementById("csvInput");
const demoBtn = document.getElementById("demoBtn");
const exportBtn = document.getElementById("exportBtn");
const statusBanner = document.getElementById("statusBanner");

const statsSection = document.getElementById("statsSection");
const resultsSection = document.getElementById("resultsSection");
const filteredSection = document.getElementById("filteredSection");

const statTotal = document.getElementById("statTotal");
const statShortlist = document.getElementById("statShortlist");
const statFiltered = document.getElementById("statFiltered");
const statPriority = document.getElementById("statPriority");

const shortlistCards = document.getElementById("shortlistCards");
const filteredCards = document.getElementById("filteredCards");
const cardTemplate = document.getElementById("companyCardTemplate");

let latestResults = null;

const COMPONENT_LABELS = {
  thesisSimilarity: "Thesis similarity",
  portfolioSectorFit: "Portfolio sector fit",
  traction: "Traction",
  founderSignal: "Founder signal",
  geographyAffinity: "Geography fit",
  companyAgeFit: "Company age fit",
  stageFit: "Stage fit",
};

uploadZone.addEventListener("click", (event) => {
  if (event.target.closest("label, button, input")) return;
  csvInput.click();
});

csvInput.addEventListener("change", (event) => {
  const file = event.target.files?.[0];
  if (file) handleFile(file);
  event.target.value = "";
});

uploadZone.addEventListener("dragover", (event) => {
  event.preventDefault();
  uploadZone.classList.add("dragover");
});

uploadZone.addEventListener("dragleave", () => uploadZone.classList.remove("dragover"));

uploadZone.addEventListener("drop", (event) => {
  event.preventDefault();
  uploadZone.classList.remove("dragover");
  const file = event.dataTransfer.files?.[0];
  if (file) handleFile(file);
});

demoBtn.addEventListener("click", (event) => {
  event.stopPropagation();
  runTriage(window.SAMPLE_INBOUND_CSV, "Loaded sample pipeline (25 companies).");
});

exportBtn.addEventListener("click", () => {
  if (!latestResults) return;
  const csv = buildExportCsv(latestResults);
  downloadText(csv, "motive_pipeline_triage_output.csv");
});

async function handleFile(file) {
  setStatus(`Reading ${file.name}…`, "info");

  if (!isCsvFile(file)) {
    setStatus("Please upload a .csv file.", "error");
    return;
  }

  try {
    const text = await file.text();
    runTriage(text, `Processed ${file.name} successfully.`);
  } catch (error) {
    setStatus(`Could not read file: ${error.message}`, "error");
  }
}

function isCsvFile(file) {
  const name = file.name.toLowerCase();
  return name.endsWith(".csv") || file.type === "text/csv" || file.type === "text/plain" || file.type === "application/vnd.ms-excel";
}

function setStatus(message, type = "info") {
  statusBanner.textContent = message;
  statusBanner.classList.remove("hidden", "error", "success");
  if (type === "error") statusBanner.classList.add("error");
  if (type === "success") statusBanner.classList.add("success");
}

function runTriage(csvText, successMessage = "") {
  try {
    const rows = parseCsv(csvText);
    if (!rows.length) {
      setStatus("CSV loaded but no company rows were found.", "error");
      return;
    }

    latestResults = triageCompanies(rows);
    renderResults(latestResults);
    setStatus(
      successMessage ||
        `Processed ${rows.length} companies · ${latestResults.summary.shortlisted} in mandate · ${latestResults.summary.priorityReview} priority review.`,
      "success"
    );
  } catch (error) {
    setStatus(`Could not parse CSV: ${error.message}`, "error");
  }
}

function renderResults(results) {
  statsSection.classList.remove("hidden");
  resultsSection.classList.remove("hidden");
  filteredSection.classList.remove("hidden");

  statTotal.textContent = results.summary.total;
  statShortlist.textContent = results.summary.shortlisted;
  statFiltered.textContent = results.summary.filteredOut;
  statPriority.textContent = results.summary.priorityReview;

  shortlistCards.innerHTML = "";
  filteredCards.innerHTML = "";

  results.shortlisted.forEach((company, index) => {
    shortlistCards.appendChild(buildCard(company, index + 1, false));
  });

  results.filteredOut.forEach((company) => {
    filteredCards.appendChild(buildCard(company, null, true));
  });
}

function buildCard(company, rank, filtered) {
  const node = cardTemplate.content.cloneNode(true);
  const card = node.querySelector(".company-card");

  if (rank != null) {
    node.querySelector(".rank").textContent = `#${rank}`;
  } else {
    node.querySelector(".rank").textContent = "Excluded";
  }

  const tierEl = node.querySelector(".tier");
  tierEl.textContent = company.tier;
  tierEl.classList.add(
    filtered
      ? "filtered"
      : company.tier === "Priority Review"
        ? "priority"
        : company.tier === "Standard Review"
          ? "standard"
          : "low"
  );

  node.querySelector(".company-name").textContent = company.company_name;
  node.querySelector(".company-sub").textContent = `${company.stage} · ${company.sector} · ${company.hq_geography}`;

  node.querySelector(".score-value").textContent = filtered ? "—" : company.overallScore;
  node.querySelector(".score-label").textContent = filtered ? "Out of mandate" : "Overall";

  const bars = node.querySelector(".score-bars");
  if (!filtered) {
    for (const [key, value] of Object.entries(company.componentScores)) {
      bars.appendChild(buildBar(COMPONENT_LABELS[key], value));
    }
  } else {
    bars.remove();
  }

  const reasons = node.querySelector(".reasons");
  if (filtered) {
    reasons.innerHTML = `
      <h4>Filter reasons</h4>
      <ul>${company.filterReasons.map((r) => `<li>${escapeHtml(r)}</li>`).join("")}</ul>
    `;
  } else {
    const positives = company.positiveReasons.slice(0, 5);
    const cautions = company.cautionReasons.slice(0, 3);
    reasons.innerHTML = `
      <h4>Why this ranked here</h4>
      <ul>${positives.map((r) => `<li>${escapeHtml(r)}</li>`).join("")}</ul>
      ${
        cautions.length
          ? `<div class="caution"><h4>Caution flags</h4><ul>${cautions
              .map((r) => `<li>${escapeHtml(r)}</li>`)
              .join("")}</ul></div>`
          : ""
      }
    `;
  }

  return node;
}

function buildBar(label, value) {
  const row = document.createElement("div");
  row.className = "bar-row";
  row.innerHTML = `
    <span class="bar-label">${label}</span>
    <div class="bar-track"><div class="bar-fill" style="width:${value}%"></div></div>
    <span class="bar-value">${value}</span>
  `;
  return row;
}

function buildExportCsv(results) {
  const headers = [
    "rank",
    "tier",
    "overall_score",
    "company_name",
    "stage",
    "sector",
    "hq_geography",
    "founding_year",
    "thesis_similarity",
    "portfolio_sector_fit",
    "traction",
    "founder_signal",
    "geography_affinity",
    "company_age_fit",
    "stage_fit",
    "primary_sector",
    "top_reasons",
    "filter_reasons",
  ];

  const lines = [headers.join(",")];

  results.shortlisted.forEach((row, index) => {
    lines.push(
      [
        index + 1,
        row.tier,
        row.overallScore,
        csvCell(row.company_name),
        csvCell(row.stage),
        csvCell(row.sector),
        csvCell(row.hq_geography),
        csvCell(row.founding_year),
        row.componentScores.thesisSimilarity,
        row.componentScores.portfolioSectorFit,
        row.componentScores.traction,
        row.componentScores.founderSignal,
        row.componentScores.geographyAffinity,
        row.componentScores.companyAgeFit,
        row.componentScores.stageFit,
        csvCell(row.primarySector || ""),
        csvCell(row.positiveReasons.slice(0, 3).join(" | ")),
        csvCell(""),
      ].join(",")
    );
  });

  results.filteredOut.forEach((row) => {
    lines.push(
      [
        "",
        "Filtered Out",
        0,
        csvCell(row.company_name),
        csvCell(row.stage),
        csvCell(row.sector),
        csvCell(row.hq_geography),
        csvCell(row.founding_year),
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        csvCell(""),
        csvCell(""),
        csvCell(row.filterReasons.join(" | ")),
      ].join(",")
    );
  });

  return lines.join("\n");
}

function csvCell(value) {
  const text = String(value ?? "");
  if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

function downloadText(text, filename) {
  const blob = new Blob([text], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

if (window.SAMPLE_INBOUND_CSV) {
  runTriage(window.SAMPLE_INBOUND_CSV, "Loaded sample pipeline (25 companies).");
}
