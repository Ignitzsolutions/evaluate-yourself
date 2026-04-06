const fs = require("fs");
const path = require("path");

const target = path.join(
  __dirname,
  "..",
  "node_modules",
  "@mediapipe",
  "tasks-vision",
  "vision_bundle.mjs",
);

if (!fs.existsSync(target)) {
  process.exit(0);
}

const original = fs.readFileSync(target, "utf8");
const fixed = original.replace(
  /\/\/# sourceMappingURL=vision_bundle_mjs\.js\.map\s*$/,
  "//# sourceMappingURL=vision_bundle.mjs.map",
);

if (fixed !== original) {
  fs.writeFileSync(target, fixed);
  console.log("Patched @mediapipe/tasks-vision source map reference.");
}
