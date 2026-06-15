(function () {
  "use strict";

  function showFatalError(message) {
    const banner = document.getElementById("statusBanner");
    if (banner) {
      banner.textContent = message;
      banner.classList.remove("hidden");
      banner.classList.add("error");
    } else {
      console.error(message);
    }
  }

  function initApp() {
    if (!window.TriageEngine) {
      showFatalError("App failed to load (triage engine missing). Please hard-refresh the page.");
      return;
    }

    const { triageCompanies, parseCsv, analyzeCsv, CSV_FIELD_DEFINITIONS, CSV_REQUIRED_FIELDS } =
      window.TriageEngine;

    const uploadZone = document.getElementById("uploadZone");
    const csvInput = document.getElementById("csvInput");
    const uploadBtn = document.getElementById("uploadBtn");
    const demoBtn = document.getElementById("demoBtn");
    const exportBtn = document.getElementById("exportBtn");
    const statusBanner = document.getElementById("statusBanner");
    const mappingSection = document.getElementById("mappingSection");
    const mappingForm = document.getElementById("mappingForm");
    const applyMappingBtn = document.getElementById("applyMappingBtn");

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

    if (!uploadZone || !csvInput || !uploadBtn || !demoBtn || !statusBanner) {
      showFatalError("Upload UI failed to initialize. Please hard-refresh the page.");
      return;
    }

    let latestResults = null;
    let pendingCsvText = null;
    let pendingFileName = null;

    const COMPONENT_LABELS = {
      thesisSimilarity: "Thesis similarity",
      portfolioSectorFit: "Portfolio sector fit",
      traction: "Traction",
      founderSignal: "Founder signal",
      geographyAffinity: "Geography fit",
      companyAgeFit: "Company age fit",
      stageFit: "Stage fit",
      checkSizeFit: "Check size fit",
      capitalEfficiency: "Capital efficiency",
      infrastructureMoat: "Infrastructure moat",
      verticalAiFit: "Vertical AI fit",
    };

    function setStatus(message, type = "info") {
      if (!statusBanner) return;
      statusBanner.textContent = message;
      statusBanner.classList.remove("hidden", "error", "success");
      if (type === "error") statusBanner.classList.add("error");
      if (type === "success") statusBanner.classList.add("success");
    }

    function openFilePicker() {
      csvInput.click();
    }

    uploadBtn.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      openFilePicker();
    });

    uploadZone.addEventListener("click", (event) => {
      if (event.target.closest("button, input, a")) return;
      openFilePicker();
    });

    csvInput.addEventListener("change", (event) => {
      const file = event.target.files?.[0];
      if (file) {
        handleFile(file).finally(() => {
          event.target.value = "";
        });
      }
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
      event.preventDefault();
      event.stopPropagation();
      if (!window.SAMPLE_INBOUND_CSV) {
        setStatus("Sample data unavailable.", "error");
        return;
      }
      runTriage(window.SAMPLE_INBOUND_CSV, "Loaded sample pipeline (25 companies).");
    });

    exportBtn?.addEventListener("click", () => {
      if (!latestResults) return;
      downloadText(buildExportCsv(latestResults), "motive_pipeline_triage_output.csv");
    });

    applyMappingBtn?.addEventListener("click", () => {
      if (!pendingCsvText) {
        setStatus("No CSV loaded for mapping.", "error");
        return;
      }
      const customMapping = collectMappingSelections();
      const missing = CSV_REQUIRED_FIELDS.filter((field) => !customMapping[field]);
      if (missing.length) {
        setStatus(
          `Please map all required fields: ${missing.map((f) => CSV_FIELD_DEFINITIONS[f].label).join(", ")}.`,
          "error"
        );
        return;
      }
      hideMappingUI();
      runTriage(pendingCsvText, pendingFileName ? `Processed ${pendingFileName} successfully.` : "", customMapping);
    });

    async function handleFile(file) {
      setStatus(`Reading ${file.name}…`, "info");

      if (!isCsvFile(file)) {
        setStatus("Please upload a .csv file.", "error");
        return;
      }

      try {
        const text = await file.text();
        if (!text.trim()) {
          setStatus("That file is empty.", "error");
          return;
        }
        runTriage(text, null, null, file.name);
      } catch (error) {
        setStatus(`Could not read file: ${error.message}`, "error");
      }
    }

    function isCsvFile(file) {
      const name = file.name.toLowerCase();
      return (
        name.endsWith(".csv") ||
        !file.type ||
        file.type === "text/csv" ||
        file.type === "text/plain" ||
        file.type === "application/vnd.ms-excel" ||
        file.type === "application/csv"
      );
    }

    function hideMappingUI() {
      mappingSection?.classList.add("hidden");
      if (mappingForm) mappingForm.innerHTML = "";
    }

    function showMappingUI(analysis) {
      if (!mappingSection || !mappingForm) return;
      mappingForm.innerHTML = "";
      const headers = analysis.rawHeaders || analysis.foundHeaders || [];
      const options = ['<option value="">— Select column —</option>']
        .concat(headers.map((h) => `<option value="${escapeHtml(h)}">${escapeHtml(h)}</option>`))
        .join("");

      for (const field of CSV_REQUIRED_FIELDS) {
        const def = CSV_FIELD_DEFINITIONS[field];
        const suggested = analysis.error?.suggestedMapping?.[field] || "";
        const row = document.createElement("div");
        row.className = "mapping-row";
        row.innerHTML = `
          <label for="map-${field}">${escapeHtml(def.label)}</label>
          <select id="map-${field}" data-field="${field}">${options}</select>
        `;
        mappingForm.appendChild(row);
        const select = row.querySelector("select");
        if (suggested && headers.includes(suggested)) select.value = suggested;
      }

      mappingSection.classList.remove("hidden");
    }

    function collectMappingSelections() {
      const mapping = {};
      mappingForm?.querySelectorAll("select[data-field]").forEach((select) => {
        if (select.value) mapping[select.dataset.field] = select.value;
      });
      return mapping;
    }

    function runTriage(csvText, successMessage = "", customMapping = null, fileName = null) {
      pendingCsvText = csvText;
      pendingFileName = fileName;

      const analysis = analyzeCsv(csvText, customMapping);
      if (analysis.error) {
        if (analysis.error.needsManualMapping) {
          showMappingUI(analysis);
          setStatus(analysis.error.message, "error");
          return;
        }
        hideMappingUI();
        setStatus(analysis.error.message, "error");
        return;
      }

      hideMappingUI();
      try {
        const rows = analysis.rows;
        latestResults = triageCompanies(rows);
        renderResults(latestResults);

        const aliasNote =
          analysis.aliasMatches?.length > 0
            ? ` · auto-mapped ${analysis.aliasMatches.length} header alias(es)`
            : "";

        setStatus(
          successMessage ||
            `Loaded ${analysis.rowCount} companies${aliasNote} · ${latestResults.summary.shortlisted} in mandate · ${latestResults.summary.priorityReview} priority review.`,
          "success"
        );
      } catch (error) {
        setStatus(`Could not run triage: ${error.message}`, "error");
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
          bars.appendChild(buildBar(COMPONENT_LABELS[key] || key, value));
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
        "check_size_fit",
        "capital_efficiency",
        "infrastructure_moat",
        "vertical_ai_fit",
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
            row.componentScores.checkSizeFit,
            row.componentScores.capitalEfficiency,
            row.componentScores.infrastructureMoat,
            row.componentScores.verticalAiFit,
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
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initApp);
  } else {
    initApp();
  }
})();
