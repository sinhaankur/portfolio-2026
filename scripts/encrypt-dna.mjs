#!/usr/bin/env node
/**
 * encrypt-dna.mjs — derive an abstract genome summary from a MyHeritage raw
 * DNA export and ship ONLY an encrypted, non-reconstructable version of it.
 *
 * Why this shape:
 *   The raw export (~585k SNPs, rsid + genotype + position) is re-identifiable
 *   personal genomic data. We never put it in the repo or the client bundle.
 *   Instead we compute aggregate / sampled statistics that make a beautiful,
 *   honest visualization but cannot be used to reconstruct the genome or look
 *   up individual disease SNPs:
 *
 *     - per-chromosome SNP counts                  (the chromosome map)
 *     - global genotype-class distribution         (AA/AT/.. → homo/hetero)
 *     - per-chromosome heterozygosity ratio        (texture along the helix)
 *     - a fixed-size deterministic SAMPLE of base  (the helix rungs) — only the
 *       two letters + chromosome, NOT rsid or position, so a rung can't be
 *       traced back to a locus.
 *
 *   That derived JSON is then AES-256-GCM encrypted with a key derived from a
 *   password via PBKDF2-SHA256. The ciphertext + salt + iv ship as a static
 *   JSON file; nothing is readable without the password. (This is real
 *   encryption — but note the page is on a public host, so treat the password
 *   as the only thing standing between a visitor and the *derived* data.)
 *
 * Usage:
 *   node scripts/encrypt-dna.mjs <path-to-csv> [--password <pw>]
 *   (if --password is omitted, reads the DNA_PASSWORD env var, else prompts)
 *
 * Output: public/data/dna.enc.json
 */

import { readFileSync, writeFileSync, mkdirSync } from "node:fs"
import { createReadStream } from "node:fs"
import { createInterface } from "node:readline"
import { randomBytes, pbkdf2Sync, createCipheriv } from "node:crypto"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, "..")

// ---- args -------------------------------------------------------------------
const args = process.argv.slice(2)
const csvPath = args.find((a) => !a.startsWith("--"))
const pwFlagIdx = args.indexOf("--password")
let password =
  pwFlagIdx !== -1 ? args[pwFlagIdx + 1] : process.env.DNA_PASSWORD || ""

if (!csvPath) {
  console.error("Usage: node scripts/encrypt-dna.mjs <path-to-csv> [--password <pw>]")
  process.exit(1)
}

// ---- crypto params (must match the browser decrypt side) --------------------
const PBKDF2_ITERATIONS = 250_000
const KEY_LEN = 32 // AES-256
const SALT_LEN = 16
const IV_LEN = 12 // GCM standard

// ---- trait panel ------------------------------------------------------------
// rsID -> trait id. Interpretations live in lib/dna-traits.ts (client side);
// we only extract the genotype here. Keep this list in sync with that module.
const TRAIT_RSIDS = {
  rs4988235: "lactose",
  rs762551: "caffeine",
  rs671: "alcohol-flush",
  rs1229984: "alcohol-metab",
  rs9939609: "carb-weight",
  rs7903146: "blood-sugar",
  rs1726866: "bitter-taste",
  rs174547: "fatty-acids",
  rs1801133: "folate",
  rs10741657: "vitamin-d",
  rs2282679: "vitamin-d-binding",
  rs1799945: "iron",
  rs4680: "dopamine",
  rs17822931: "earwax",
}

// ---- derive abstract summary from the raw CSV -------------------------------
async function deriveSummary(path) {
  const chromOrder = [
    "1","2","3","4","5","6","7","8","9","10","11","12",
    "13","14","15","16","17","18","19","20","21","22","X","Y","MT",
  ]
  const counts = new Map() // chrom -> total snps
  const het = new Map() // chrom -> heterozygous count
  const genotypeClasses = { homozygous: 0, heterozygous: 0, noCall: 0 }
  const SAMPLE_SIZE = 1200 // helix rungs
  const sample = [] // reservoir sample of { c, g } (chrom, genotype letters)
  const traits = {} // id -> genotype (only for panel rsIDs)
  let total = 0

  const rl = createInterface({
    input: createReadStream(path),
    crlfDelay: Infinity,
  })

  for await (const line of rl) {
    if (!line || line.startsWith("#")) continue
    if (line.startsWith("RSID")) continue // header
    // "rsid","chrom","pos","RESULT"
    const m = line.split(",")
    if (m.length < 4) continue
    const rsid = m[0].replace(/"/g, "").trim()
    const chrom = m[1].replace(/"/g, "").trim()
    const geno = m[3].replace(/"/g, "").trim().toUpperCase()
    if (!chrom || !geno) continue

    // Capture panel markers (genotype only — the rsID is NOT stored in output).
    if (TRAIT_RSIDS[rsid] && /^[ACGT]{2}$/.test(geno)) {
      traits[TRAIT_RSIDS[rsid]] = geno
    }

    counts.set(chrom, (counts.get(chrom) || 0) + 1)
    total++

    const callable = geno.length === 2 && /^[ACGT]{2}$/.test(geno)
    if (!callable) {
      genotypeClasses.noCall++
    } else if (geno[0] === geno[1]) {
      genotypeClasses.homozygous++
    } else {
      genotypeClasses.heterozygous++
      het.set(chrom, (het.get(chrom) || 0) + 1)
    }

    // reservoir sampling — store only chrom + genotype letters (no rsid/pos)
    if (callable) {
      if (sample.length < SAMPLE_SIZE) {
        sample.push({ c: chrom, g: geno })
      } else {
        const j = Math.floor(Math.random() * total)
        if (j < SAMPLE_SIZE) sample[j] = { c: chrom, g: geno }
      }
    }
  }

  const chromosomes = chromOrder
    .filter((c) => counts.has(c))
    .map((c) => {
      const n = counts.get(c)
      const h = het.get(c) || 0
      return {
        name: c,
        snps: n,
        heterozygosity: n ? +(h / n).toFixed(4) : 0,
      }
    })

  return {
    meta: {
      source: "MyHeritage raw DNA (build37)",
      derivedAt: new Date().toISOString(),
      totalSnps: total,
      note:
        "Aggregate stats + a curated diet/wellness trait panel (genotype only, rsIDs stripped). Not the raw genome; cannot reconstruct loci or arbitrary SNPs.",
    },
    chromosomes,
    genotypeClasses,
    sample, // [{ c, g }] — drives the helix rungs
    traits, // id -> genotype, for the curated panel (see lib/dna-traits.ts)
  }
}

// ---- encrypt ----------------------------------------------------------------
function encrypt(plaintext, pw) {
  const salt = randomBytes(SALT_LEN)
  const iv = randomBytes(IV_LEN)
  const key = pbkdf2Sync(pw, salt, PBKDF2_ITERATIONS, KEY_LEN, "sha256")
  const cipher = createCipheriv("aes-256-gcm", key, iv)
  const ct = Buffer.concat([
    cipher.update(Buffer.from(plaintext, "utf8")),
    cipher.final(),
  ])
  const tag = cipher.getAuthTag()
  // WebCrypto AES-GCM expects ciphertext || tag concatenated.
  const combined = Buffer.concat([ct, tag])
  return {
    v: 1,
    alg: "AES-GCM",
    kdf: "PBKDF2-SHA256",
    iterations: PBKDF2_ITERATIONS,
    salt: salt.toString("base64"),
    iv: iv.toString("base64"),
    data: combined.toString("base64"),
  }
}

// ---- prompt for password if needed ------------------------------------------
async function promptPassword() {
  const rl = createInterface({ input: process.stdin, output: process.stdout })
  const q = (s) => new Promise((res) => rl.question(s, res))
  const pw = await q("Set a password for the DNA page: ")
  const pw2 = await q("Confirm password: ")
  rl.close()
  if (pw !== pw2) {
    console.error("Passwords do not match.")
    process.exit(1)
  }
  return pw
}

// ---- main -------------------------------------------------------------------
const absCsv = resolve(csvPath)
console.log(`Reading ${absCsv} …`)
const summary = await deriveSummary(absCsv)
console.log(
  `Derived: ${summary.meta.totalSnps.toLocaleString()} SNPs across ${summary.chromosomes.length} chromosomes, ${summary.sample.length} sampled rungs, ${Object.keys(summary.traits).length} trait markers.`,
)

if (!password) password = await promptPassword()
if (!password || password.length < 4) {
  console.error("Password too short.")
  process.exit(1)
}

const payload = encrypt(JSON.stringify(summary), password)
const outDir = resolve(ROOT, "public/data")
mkdirSync(outDir, { recursive: true })
const outPath = resolve(outDir, "dna.enc.json")
writeFileSync(outPath, JSON.stringify(payload))
console.log(`Wrote encrypted blob → ${outPath} (${(JSON.stringify(payload).length / 1024).toFixed(1)} KB)`)
console.log("Raw genome was NOT copied anywhere. Only the encrypted derived summary ships.")
