const fs = require("fs");
const path = require("path");

const targetFile = path.join(
  __dirname,
  "..",
  "node_modules",
  "@mediapipe",
  "tasks-vision",
  "vision_bundle_mjs.js.map",
);

const placeholder = {
  version: 3,
  file: "vision_bundle_mjs.js",
  sources: [],
  sourcesContent: [],
  names: [],
  mappings: "",
};

function ensureFile(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(placeholder), "utf8");
  return true;
}

try {
  const created = ensureFile(targetFile);
  if (created) {
    process.stdout.write(`Created placeholder source map at ${targetFile}\n`);
  }
} catch (error) {
  process.stderr.write(`Failed to ensure MediaPipe source map: ${error.message}\n`);
  process.exitCode = 1;
}
