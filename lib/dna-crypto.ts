/**
 * Browser-side decryption for the DNA page.
 *
 * Mirrors scripts/encrypt-dna.mjs exactly:
 *   key = PBKDF2-SHA256(password, salt, 250_000, 32 bytes)
 *   plaintext = AES-256-GCM decrypt(ciphertext||tag, key, iv)
 *
 * The encrypted blob ships as public/data/dna.enc.json. Nothing is readable
 * without the password — this is genuine AES-GCM, not an obfuscation gate.
 */

export type EncryptedBlob = {
  v: number
  alg: "AES-GCM"
  kdf: "PBKDF2-SHA256"
  iterations: number
  salt: string // base64
  iv: string // base64
  data: string // base64 (ciphertext || 16-byte GCM tag)
}

export type DnaSummary = {
  meta: {
    source: string
    derivedAt: string
    totalSnps: number
    note: string
  }
  chromosomes: { name: string; snps: number; heterozygosity: number }[]
  genotypeClasses: {
    homozygous: number
    heterozygous: number
    noCall: number
  }
  sample: { c: string; g: string }[]
  /** Curated trait panel: marker id -> genotype. May be absent on old blobs. */
  traits?: Record<string, string>
}

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

async function deriveKey(
  password: string,
  salt: Uint8Array,
  iterations: number,
): Promise<CryptoKey> {
  const enc = new TextEncoder()
  const baseKey = await crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    "PBKDF2",
    false,
    ["deriveKey"],
  )
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations, hash: "SHA-256" },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["decrypt"],
  )
}

/**
 * Decrypt the blob with the given password.
 * Throws on a wrong password (GCM auth-tag failure) — callers should treat any
 * throw as "incorrect password".
 */
export async function decryptDna(
  blob: EncryptedBlob,
  password: string,
): Promise<DnaSummary> {
  const salt = base64ToBytes(blob.salt)
  const iv = base64ToBytes(blob.iv)
  const data = base64ToBytes(blob.data)
  const key = await deriveKey(password, salt, blob.iterations)
  const plain = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    data,
  )
  const json = new TextDecoder().decode(plain)
  return JSON.parse(json) as DnaSummary
}
