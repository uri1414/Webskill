#!/usr/bin/env node
// Screenshot auth-gated portal pages via a running preview build.
// Prereq: build + start the app WITH the temporary preview harness enabled
// (see references/gotchas.md → "preview harness"), e.g.:
//   PORTAL_PREVIEW=1 NEXT_PUBLIC_SUPABASE_URL=https://x.supabase.co \
//   NEXT_PUBLIC_SUPABASE_ANON_KEY=x NEXT_PUBLIC_SITE_URL=https://x \
//   npx next build && ... next start -p 4310
// Then: node preview-screenshot.mjs 4310 out/ dashboard/customer dashboard/customer/billing ...
// Playwright is expected at the global node_modules (adjust require path if needed).
import { createRequire } from "module";
const require = createRequire("/opt/node22/lib/node_modules/");
const { chromium } = require("playwright");

const [port, outDir, ...routes] = process.argv.slice(2);
if (!port || !outDir || routes.length === 0) {
  console.error("usage: node preview-screenshot.mjs <port> <outDir> <route> [route...]");
  process.exit(1);
}

const EXE = process.env.PW_CHROME || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const browser = await chromium.launch({ executablePath: EXE });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
for (const r of routes) {
  const name = r.replace(/[^a-z0-9]+/gi, "-");
  await page.goto(`http://localhost:${port}/${r}`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${outDir}/${name}.png`, fullPage: true });
  console.log("shot", r);
}
await browser.close();
