/**
 * Empty stub module — aliased in next.config.mjs to absorb every
 * `node:*` import the Anthropic SDK pulls in transitively via its
 * managed-agents environment-worker path. None of that code executes
 * in the browser; we just need the imports to resolve at bundle time.
 *
 * Turbopack does static export analysis even on namespace imports
 * (`import * as fs from 'node:fs'` + later `fs.readFile`), so we
 * enumerate every member the SDK reaches for. Hit any of these at
 * runtime in the browser and you'd get a no-op or undefined — but the
 * SDK's runtime entry points are gated by its own environment checks,
 * so we never reach them.
 *
 * Sources checked (run `grep -rhoE '(cp|fs|fssync|crypto|path|readline)\.\w+'`
 * against the SDK to refresh this list when the SDK updates):
 *   - tools/agent-toolset/node.mjs
 *   - tools/agent-toolset/fs-util.mjs
 *   - lib/environments/worker.mjs
 */

const noop = () => undefined
const noopAsync = async () => undefined

// fs / fssync / fs.promises
export const access = noopAsync
export const lstat = noopAsync
export const mkdir = noopAsync
export const open = noopAsync
export const readFile = noopAsync
export const readdir = noopAsync
export const readlink = noopAsync
export const realpath = noopAsync
export const rename = noopAsync
export const rm = noopAsync
export const stat = noopAsync
export const unlink = noopAsync
export const writeFile = noopAsync
export const chmod = noopAsync
export const cp = noop
export const glob = noop
export const constants = {} as Record<string, number>
export const createReadStream = noop
export const createWriteStream = noop

// path
export const join = (...parts: string[]) => parts.join("/")
export const resolve = (...parts: string[]) => parts.join("/")
export const dirname = (p: string) => p.split("/").slice(0, -1).join("/") || "/"
export const basename = (p: string) => p.split("/").pop() || ""
export const relative = (_a: string, b: string) => b
export const isAbsolute = (p: string) => typeof p === "string" && p.startsWith("/")
export const parse = (p: string) => ({ root: "/", dir: dirname(p), base: basename(p), name: basename(p), ext: "" })
export const sep = "/"
export const delimiter = ":"

// child_process
export const spawn = noop
export const execFile = noop

// crypto
export const randomUUID = () => "00000000-0000-0000-0000-000000000000"

// stream + stream/promises
export class Readable {}
export const pipeline = noopAsync

// util
export const promisify = <T>(fn: T): T => fn

// readline
export const createInterface = noop

// Default export covers `import x from '...'` and any property access
// the SDK does via `someNamespace.unknownThing`.
export default new Proxy({}, { get: () => noop })
