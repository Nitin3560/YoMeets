const { readFileSync, writeFileSync } = require("node:fs");
const { join } = require("node:path");

for (const fileName of ["observer.js", "executor.js"]) {
  const filePath = join(__dirname, "../dist", fileName);
  const source = readFileSync(filePath, "utf8");

  writeFileSync(filePath, source.replace(/\nexport \{\};\n?$/, "\n"));
}
