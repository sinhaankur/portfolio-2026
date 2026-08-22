# /img/family

Media for the private **/family** page (linked from /about, passcode-gated).

## Add your own photos / videos

1. Drop files into this folder.
   - **Images:** `.webp` / `.jpg` / `.png` — portrait 3:4 looks best in the panels.
   - **Videos:** `.mp4` (H.264) so they play inline in every browser.
2. Edit `components/family/data.ts` — add one entry per file:
   ```ts
   { id: "6", type: "image", src: "/img/family/diwali.webp", caption: "Diwali 2025" },
   { id: "7", type: "video", src: "/img/family/mum-laughing.mp4", caption: "Mum" },
   ```
   The accordion shows however many entries you list (not locked to five).
   Order top-to-bottom in the list = left-to-right in the strip.

## Change the passcode

Default is `family`. To change it, hash your new word and paste the result into
`PASSCODE_HASH` in `components/family/family-gate.tsx`:

```sh
echo -n "yourword" | shasum -a 256
```

## A note on privacy

The gate is **soft**: the site is a static export, so files here are served by URL
and the passcode check runs in the browser. It stops casual arrival and hides the
passcode word behind a hash — but it is not real access control. Don't put
anything here you'd be harmed by a stranger seeing.

The placeholder SVGs ship so the page works immediately; replace them.
