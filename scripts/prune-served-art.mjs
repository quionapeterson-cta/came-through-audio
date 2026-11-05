// Drops the local badge copies from the build output when the app reads art from R2.
//
// public/icons is 179 MB and every deploy uploads it, though the built site asks the
// bucket for badges whenever VITE_ART_BASE is set (see src/lib/art-url.ts). Keeping it
// out of the artifact is what keeps deployments small; the folder itself stays in the
// repo, since a build without VITE_ART_BASE still serves it as the local fallback.
//
// Nitro writes public assets to .output/public for a plain build and to
// .vercel/output/static for a Vercel build, so both are pruned.
import { existsSync, rmSync } from "node:fs";
import { join } from "node:path";

const base = process.env.VITE_ART_BASE;

if (!base) {
  console.log("[art] VITE_ART_BASE is unset: keeping public/icons in the build as the local fallback.");
  process.exit(0);
}

const publicDirs = [join(".output", "public"), join(".vercel", "output", "static"), join(".vercel", "output", "public")];
const dropped = [];

for (const publicDir of publicDirs) {
  const path = join(publicDir, "icons");
  if (existsSync(path)) {
    rmSync(path, { recursive: true, force: true });
    dropped.push(path);
  }
}

console.log(
  dropped.length
    ? `[art] dropped ${dropped.join(", ")} from the build: the site reads badges from ${base}.`
    : "[art] nothing to drop.",
);
