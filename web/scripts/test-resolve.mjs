// Run every test: node --import ./scripts/test-resolve.mjs --experimental-strip-types --test "lib/**/*.test.ts"
// Lets tests import app code the way Next does, without extensions ("./gsc-insights") and with the "@/" alias.
import { registerHooks } from "node:module";
import { pathToFileURL } from "node:url";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

registerHooks({
  resolve(spec, ctx, next) {
    let s = spec.startsWith("@/") ? pathToFileURL(path.join(root, spec.slice(2))).href : spec;
    if ((s.startsWith(".") || s.startsWith("file:")) && !/\.[cm]?[jt]sx?$/.test(s) && ctx.parentURL) {
      const base = fileURLToPath(new URL(s, ctx.parentURL));
      for (const ext of [".ts", ".tsx", "/index.ts"]) if (existsSync(base + ext)) { s = pathToFileURL(base + ext).href; break; }
    }
    return next(s, ctx);
  },
});
