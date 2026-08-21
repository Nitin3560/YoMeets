const { readFileSync, writeFileSync } = require("node:fs");
const { join } = require("node:path");

const observerPath = join(__dirname, "../dist/observer.js");
const source = readFileSync(observerPath, "utf8");

writeFileSync(observerPath, source.replace(/\nexport \{\};\n?$/, "\n"));
