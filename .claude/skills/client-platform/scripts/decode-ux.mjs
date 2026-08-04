#!/usr/bin/env node
// Decode a designer UX bundle to plain HTML.
// Designer handoffs are often a "Bundled Page" whose real template is a
// JSON-encoded string starting with "<!DOCTYPE. This finds and decodes it.
// Usage: node decode-ux.mjs <bundle.html> [out.html]
import fs from "node:fs";

const inPath = process.argv[2];
if (!inPath) {
  console.error("usage: node decode-ux.mjs <bundle.html> [out.html]");
  process.exit(1);
}
const raw = fs.readFileSync(inPath, "utf8");

// Find the JSON-encoded string that starts with "<!DOCTYPE (with escaped or plain quote).
let idx = raw.indexOf('"<!DOCTYPE');
if (idx < 0) idx = raw.indexOf('\\"<!DOCTYPE');
if (idx < 0) {
  // Maybe it's already plain HTML.
  if (raw.includes("<!DOCTYPE")) {
    process.stdout.write(raw);
    process.exit(0);
  }
  console.error("Could not find a JSON-encoded <!DOCTYPE template.");
  process.exit(1);
}

// raw_decode equivalent: parse the JSON string starting at idx.
let decoded;
try {
  // Walk to the matching closing quote by letting JSON.parse consume it.
  // Try progressively longer slices until JSON.parse succeeds on a leading string.
  const tail = raw.slice(idx);
  // Fast path: the value is a single JSON string; find its end.
  let i = 1, out = "";
  for (; i < tail.length; i++) {
    const c = tail[i];
    if (c === "\\") { out += JSON.parse('"' + tail.slice(i, i + 2) + '"'); i++; continue; }
    if (c === '"') break;
    out += c;
  }
  decoded = out;
} catch (e) {
  console.error("decode failed:", e.message);
  process.exit(1);
}

const outPath = process.argv[3];
if (outPath) { fs.writeFileSync(outPath, decoded); console.error("wrote", outPath, decoded.length, "chars"); }
else process.stdout.write(decoded);

// Tip: screens are tagged data-screen-label="..."; the JS data models are in the
// <script> near the bottom. grep -o 'data-screen-label="[^"]*"' to list screens.
