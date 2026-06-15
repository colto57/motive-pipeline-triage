const fs = require("fs");
const path = require("path");

const files = [
  "docs/js/motive_reference.js",
  "docs/js/triage_engine.js",
  "docs/js/app.js",
  "docs/js/sample_data.js",
];

for (const rel of files) {
  const p = path.join(__dirname, "..", rel);
  if (!fs.existsSync(p)) {
    console.log("skip", rel);
    continue;
  }
  let t = fs.readFileSync(p, "utf8");
  t = t.replace(/\u2014/g, " - ");
  t = t.replace(/\u2013/g, "-");
  t = t.replace(/ —  /g, " - ");
  t = t.replace(/ — /g, " - ");
  fs.writeFileSync(p, t, "utf8");
  console.log("fixed", rel);
}
