# Improving helmsman-4b — "a subset of me"

helmsman-4b is my own small model — a 4B specialist I want to be genuinely good
at *my* world (my projects, the sky/engine I built, my craft, my voice) and reuse
across my things. Unhosted was the first use case, not the definition.

A 4B model can't be a great general assistant (that needs 70B+). It *can* be
excellent at a focused job. The job here: **know my work, answer in my voice,
run free and local.** The way to make it good is better DATA + a real training
run + honest eval — not a bigger base.

The training machinery already exists and is proven:
`~/Documents/GitHub/unhosted-core/models/distill/` (`gen_data.py` → `train.py` →
`eval.py` → `export_gguf.py` → `push_to_hub.py`, orchestrated by `pipeline.py`).
This recipe produced the current model (305 synthetic pairs, 71% on its narrow
eval). We make it *better* by feeding it a richer, truer corpus.

## The loop

```
┌─ harvest my real content ─┐   ┌─ teacher makes Q&A ─┐   ┌─ train ─┐   ┌─ eval ─┐   ┌─ publish ─┐
│ scripts/harvest-me-corpus │ → │ gen_data.py         │ → │ train.py│ → │ eval.py│ → │ push_to_hub│
│  (the "subset of me")     │   │  (grounded pairs)   │   │ QLoRA   │   │ judge  │   │  → HF      │
└───────────────────────────┘   └─────────────────────┘   └─────────┘   └────────┘   └────────────┘
```

Each real run of the site's own workers also yields (task → outcome) examples —
those fold into the corpus over time, so the model keeps improving from its own
use. That's the flywheel.

## Step 1 — harvest the corpus (done; no GPU)

From this repo:

```bash
node scripts/harvest-me-corpus.mjs --out ~/Documents/GitHub/unhosted-core/models/distill/corpus
```

Pulls ~38 documents / ~100k chars of my own first-person content (writing posts,
case studies, lab writeups, engine standards, craft docs, CLAUDE.md) into a clean
`.md` corpus. Output is gitignored (regenerable). Re-run any time the site grows.

## Step 2 — generate grounded training pairs (teacher)

In the distill repo (`cd ~/Documents/GitHub/unhosted-core/models/distill`, its
own `.venv`):

```bash
# Teacher = a STRONG model (stronger than the 4B student → better pairs).
# Best free teacher: our sky-copilot Worker (Cloudflare Workers AI, llama-3.3-70b).
python gen_data.py \
  --docs corpus/ --out data/train.jsonl --n 12 \
  --base-url https://sky-copilot.sinhaankur827-f9c.workers.dev/v1 \
  --model best
#  …or local, private, free: --base-url http://localhost:11434/v1 --model qwen2.5-coder:7b
```

~38 docs × 12 ≈ **450+ grounded pairs** from my real work. Bump `--n` for more.

## Step 3 — train (MLX / QLoRA, on this Mac, ~30 min)

```bash
python pipeline.py --data data/train.jsonl --out out/   # splits, trains, evals
# or step by step: train.py → eval.py
```

QLoRA on `Qwen/Qwen3-4B-Instruct-2507`, merged, exported to GGUF. The recipe is
pinned (`transformers<5.0`, `accelerate<1.13`) — keep its venv separate.

## Step 4 — eval honestly

`eval.py` runs a held-out split through an LLM-judge. "Better" must be MEASURED
against the current 71% baseline, not claimed. If it doesn't beat the baseline,
iterate the data (more/cleaner pairs), don't ship.

## Step 5 — publish

```bash
python push_to_hub.py   # pushes merged safetensors + GGUF + the reframed card
```

The card is reframed: helmsman-4b is **my own general model, a subset of me** —
not "a parked Unhosted specialist." Keep the honest training recipe + eval number.

## Why this is the right shape

- **Quality comes from data, and the best data is mine** — real, honest, specific.
- **Small + narrow beats big + mediocre** for "runs free on my own hardware."
- **Measured, not claimed** — the eval gate keeps it honest.
- **It compounds** — the workers feed the corpus, so each cycle is a little better.
