# Keeping Dr. Randhir Sinha's archive up to date

Two audiences, two halves. **Part A** is written for Dad — he can do it from his
laptop with Gemini, no coding. **Part B** is for Ankur — how to take what Dad
sends and get it onto the live site (`/dr-randhir-sinha`).

The rule of the archive: **the science is Dad's; the website is just a faithful
record of it.** Anyone can add a paper — Dad researches with Gemini, sends it
over, Ankur uploads it.

---

## Part A — For Dad (works from any laptop, with Gemini)

You don't need GitHub, code, or anything technical. You just need to send the
paper details in a clear, consistent shape. Ankur pastes them onto the website.

### What to send for each paper

Copy this template into Gemini or an email, fill one block **per paper**:

```
AUTHORS:   Mukherjee S., Sahni N. K. and Sinha R. K.
YEAR:      1999
TITLE:     Characterisation and evaluation of Indian multivoltine silkworm...
JOURNAL:   Indian Journal of Agricultural Sciences 69(5): 36–70.
LINK:      https://epubs.icar.org.in/index.php/IJAgS/article/view/26744   (if it's online — otherwise leave blank)
KIND:      research paper   (or: conference paper / popular article / book/catalogue)
```

That's all. **The LINK is optional** — only include one if the paper is actually
findable online (ICAR ePubs, ResearchGate, Google Scholar, a real journal page).
If it isn't online, just leave LINK blank; the page still lists it proudly.

### How to use Gemini to help

Gemini is your research assistant. Good things to ask it:

- *"Find where this paper of mine is indexed online and give me the exact URL:
  [paste title + authors + journal]."*  → then paste that URL into LINK, but
  **only if Gemini gives a real, working link** — open it first to be sure.
- *"Format these papers from my CV into the template below: [paste template,
  paste your list]."*  → it fills the blocks for you.
- *"Write a one-sentence plain-English summary of this paper."*  → optional, if
  you want a short description on the page.

**Important honesty rule:** if Gemini "isn't sure" a link is real, or the link
doesn't open, **leave LINK blank.** A missing link is fine. A wrong link is not
— this is a scientific record and it must stay trustworthy.

### How to send it

Email everything to **sinhaankur827@gmail.com** with the subject
"Randhir archive — new papers". Send as many blocks as you like in one email.

### For LinkedIn (Dad can do this himself, no Ankur needed)

Your LinkedIn is yours to edit directly — it's not code.

1. Log in → click your photo → **View Profile**.
2. Click **"Add profile section" → "Additional" → "Add publications."**
3. For each paper, fill Title, Publication (journal), Date, URL, Description.
   (Use the same details as the template above — Gemini can help write the
   Description.)
4. Save. It appears on your profile immediately.

You can also use **"Add featured"** to pin the ICAR / ResearchGate links to the
top of your profile so visitors see your online work first.

---

## Part B — For Ankur (publishing what Dad sends)

Everything lives in **`lib/randhir-publications.ts`**. Each paper is one line in
one of four arrays. You paste Dad's blocks in, build, and push.

### Which array

| Dad's KIND        | Array in the file       |
|-------------------|-------------------------|
| research paper    | `researchPapers`        |
| conference paper  | `conferencePapers`      |
| popular article   | `popularArticles`       |
| book / catalogue  | `booksAndCatalogues`    |

### The shape of one entry

```ts
{ year: 1999, citation: "Mukherjee S., Sahni N. K. and Sinha R. K. (1999). Characterisation and evaluation of Indian multivoltine silkworm (Bombyx mori) germplasm. Indian Journal of Agricultural Sciences 69(5): 36–70.", url: "https://epubs.icar.org.in/index.php/IJAgS/article/view/26744" },
```

- `citation` = AUTHORS (YEAR). TITLE. JOURNAL — one flowing string, ending in a
  period. This is exactly how every existing entry reads; match that style.
- `url` = optional. **Omit the `url:` key entirely** if there's no link — don't
  write `url: ""`. The page renders a `[link]` only when `url` is present.
- Entries within an array are grouped by year automatically (newest first), so
  drop the new line near others of the same year for tidiness — order within a
  year doesn't matter to the render.

### Verify a link before you paste it

The page promises links are *verifiable*. Before adding a `url`, actually open
it (or have the model fetch it) and confirm the title/authors/year match. If it
doesn't resolve or doesn't match, ship the entry **without** a url.

### Publish

```bash
pnpm build          # must end "✓ Compiled successfully" + "Generating static pages"
git add lib/randhir-publications.ts
git commit -m "Randhir archive: add <N> papers (<years>)"
git push            # origin = sinhaankur/portfolio-2026 → GitHub Pages redeploys
```

If the build fails, it's almost always a missing comma or an unescaped quote in
the citation string — check the line you just added.

### If a citation count changes a lot

`randhirStats` (top of the file) has headline totals (`researchPapers: 60`,
etc.). These come from Dad's CV summary, not a live count — only bump them if
Dad explicitly gives a new official total. Don't auto-recompute; the CV numbers
are the source of truth.
