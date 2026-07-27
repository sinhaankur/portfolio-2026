#!/usr/bin/env node
/**
 * encode-ktx2 — re-encode a planet texture to KTX2 (GPU-compressed, Basis UASTC).
 *
 * KTX2 uploads straight to the GPU with NO CPU decode, so it kills the texture
 * decode stall AND uses ~1/4–1/6 the VRAM of a WebP/JPG — the mobile-smoothness
 * win. This wraps Khronos `toktx` (install: the KTX-Software macOS .pkg, or
 * `brew`/apt elsewhere). It reads a source image and writes a .ktx2 beside it.
 *
 * ETC1S (not UASTC) is the default for the planet surfaces. Measured on Mars 4K:
 *   WebP        1.10 MB download · 32 MB VRAM · main-thread decode stall
 *   KTX2 UASTC  8.13 MB download · 16 MB VRAM · no stall   ← download 7x WORSE
 *   KTX2 ETC1S  1.42 MB download ·  4 MB VRAM · no stall   ← the win
 * ETC1S keeps the download ~flat while cutting VRAM 8x and removing the decode
 * stall entirely — the actual mobile-smoothness goal. Pass --uastc for the
 * higher-quality (but much larger) mode on a texture where it's worth it.
 * Mipmaps baked in (--genmipmap) so distant globes stay sharp + shimmer-free.
 *
 * Usage:
 *   node scripts/encode-ktx2.mjs <input.png|jpg|webp> [output.ktx2] [--uastc]
 *   node scripts/encode-ktx2.mjs public/textures/mars-4k.webp
 *   pnpm assets:ktx2 public/textures/mars-4k.webp
 *
 * Note: toktx reads PNG/JPG (not WebP directly) — the script converts a WebP to
 * a temp PNG via `cwebp`/`dwebp` if needed.
 */

import { spawnSync } from "node:child_process"
import { existsSync, statSync } from "node:fs"
import { basename, extname } from "node:path"

const rawArgs = process.argv.slice(2)
const useUastc = rawArgs.includes("--uastc")
const positional = rawArgs.filter((a) => !a.startsWith("--"))
const [inputArg, outputArg] = positional
if (!inputArg) {
  console.error("usage: node scripts/encode-ktx2.mjs <input.(png|jpg|webp)> [output.ktx2] [--uastc]")
  process.exit(2)
}
if (!existsSync(inputArg)) { console.error(`✗ input not found: ${inputArg}`); process.exit(2) }

// toktx present?
const which = spawnSync("which", ["toktx"], { encoding: "utf8" })
if (which.status !== 0) {
  console.error(
    "✗ `toktx` not found. Install KTX-Software:\n" +
    "   macOS: download the .pkg from https://github.com/KhronosGroup/KTX-Software/releases\n" +
    "          then: sudo installer -pkg <file>.pkg -target /\n" +
    "   Linux: apt install libktx-tools   (or the release tarball)\n",
  )
  process.exit(2)
}

// toktx wants PNG/JPG. If given a WebP, decode to a temp PNG first (dwebp).
let src = inputArg
let tmp = null
if (/\.webp$/i.test(inputArg)) {
  tmp = `/tmp/${basename(inputArg, extname(inputArg))}.png`
  const dwebp = spawnSync("dwebp", [inputArg, "-o", tmp], { stdio: "inherit" })
  if (dwebp.status !== 0) { console.error("✗ dwebp failed (install webp tools: brew install webp)"); process.exit(2) }
  src = tmp
}

const out = outputArg ?? inputArg.replace(/\.(png|jpg|jpeg|webp)$/i, ".ktx2")

// Default ETC1S (small download + tiny VRAM); --uastc for the quality mode.
const args = useUastc
  ? ["--t2", "--encode", "uastc", "--uastc_quality", "2", "--zcmp", "18", "--genmipmap", "--assign_oetf", "srgb", out, src]
  : ["--t2", "--encode", "etc1s", "--clevel", "4", "--qlevel", "255", "--genmipmap", "--assign_oetf", "srgb", out, src]
console.log(`toktx ${args.join(" ")}`)
const res = spawnSync("toktx", args, { stdio: "inherit" })
if (res.status !== 0) { console.error("✗ toktx failed"); process.exit(1) }

const inMB = (statSync(inputArg).size / 1048576).toFixed(2)
const outMB = (statSync(out).size / 1048576).toFixed(2)
console.log(`\n✓ ${out}\n   ${inMB} MB (${extname(inputArg).slice(1)})  →  ${outMB} MB (ktx2, GPU-compressed, no decode)`)
if (tmp) { try { spawnSync("rm", ["-f", tmp]) } catch { /* ignore */ } }
