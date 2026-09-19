# Screenshot Annotator
Upload a screenshot, mark exactly what matters with arrows, boxes, highlights, text and blur, then download the finished image in seconds.

---

## Live Demo
https://screenshot-annotator-nine.vercel.app/

---

## Features
- **Three ways to load** — drag & drop, file picker, or paste straight from the clipboard (`⌘V` / `Ctrl+V`)
- **5 annotation tools** — Arrow, Box, Highlight, Text, Blur
- **Blur that actually hides** — downsample-based blur destroys the detail underneath, so emails and API keys are unreadable
- **7 colors + 3 sizes** — strokes and text scale with the image, so 4K screenshots don't end up with hairlines
- **Select & move** — drag any annotation, double-click text to edit it, `Del` to remove it
- **Undo / redo** — full history (`⌘Z` / `⌘⇧Z`)
- **Shift to snap** — 45° arrows, perfect squares
- **Export at full resolution** — download a PNG or copy it straight to the clipboard
- **Keyboard shortcuts** — `V` `A` `R` `H` `T` `B` to switch tools
- **Demo mode** — try it with a sample screenshot, no upload needed

---

## Tech Stack
- React 19 (Vite 5)
- CSS custom properties (Apple-inspired dark UI, no framework)
- HTML Canvas 2D (no drawing library)

---

## How It Works
1. Drop, pick or paste a screenshot
2. Choose a tool and drag on the image (click to place text)
3. Adjust color and size — changes apply to the selected annotation too
4. Hit **Download** (or **Copy**) to export the annotated PNG at original resolution

> Everything is processed in your browser. Your image never leaves your machine.

---

## Shortcuts
| Key | Action |
|---|---|
| `V` / `A` / `R` / `H` / `T` / `B` | Select / Arrow / Box / Highlight / Text / Blur |
| `⌘Z` · `⌘⇧Z` | Undo · Redo |
| `Del` | Delete selected annotation |
| `⌘S` | Download PNG |
| `Shift` + drag | Snap arrow angle / square box |
| `Esc` | Deselect / cancel text |

---

## Installation
```bash
git clone https://github.com/berkinyilmaz/screenshot-annotator.git
cd screenshot-annotator
npm install
npm run dev
```

---

## Privacy
Everything runs **locally in your browser**.
No uploads, no tracking, no accounts.
# screenshot-annotator
