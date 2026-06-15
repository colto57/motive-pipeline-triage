const fs = require("fs");
const path = require("path");

function buildBundle(targetDir) {
  const motive = fs.readFileSync(path.join(targetDir, "motive_reference.js"), "utf8");
  const triage = fs.readFileSync(path.join(targetDir, "triage_engine.js"), "utf8");
  const bundle = motive + "\n" + triage;
  fs.writeFileSync(path.join(targetDir, "engine.bundle.js"), bundle, { encoding: "utf8" });
  console.log("Built", path.join(targetDir, "engine.bundle.js"));
}

buildBundle(path.join(__dirname, "..", "docs", "js"));
buildBundle(path.join(__dirname, "..", "triage-app", "js"));
