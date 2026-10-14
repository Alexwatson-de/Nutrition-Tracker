# 🥗 NutriLens AI — Simple Food & Nutrition Tracker

A clean, modern, **100% client-side** web app for logging daily meals and tracking
calorie & protein intake. Built with plain **HTML, CSS, and vanilla JavaScript** —
no frameworks, no build step, no backend, no API keys.

> **Honest by design:** despite the playful name, this version performs reliable
> manual calculations from the values you enter. There is **no AI food recognition
> or AI nutrition analysis**, and the app gives **no medical or dietary advice**.

## ✨ Features

### Dashboard
- **Four stat cards** — calories today, protein today, foods logged, calories remaining — each with a target subtitle that updates live
- **Dual progress bars** for calories (green) and protein (blue), with an over-target color shift
- **Meal log grouped by meal type** (breakfast / lunch / dinner / snacks) with per-group calorie subtotals
- **Edit** ✏️ or **delete** 🗑️ any entry — every total updates instantly
- Friendly empty state with a one-click "Add your first meal" shortcut

### Add Food
- **Searchable food database** — type to filter, pick with mouse or ↑/↓ + Enter
- Built-in database of **25 common Indian foods** (roti, rice, dal, paneer, curd, milk, banana, eggs, idli, dosa, common vegetables, and more) with clearly labelled **example nutrition values per 100 g**
- **Custom food entry** for anything not in the database
- **Live calculation preview** before you save:
  `nutrition consumed = per-100 g value × quantity in grams ÷ 100`
- Full input validation — negative quantities and implausible nutrition values are rejected with clear error messages

### Daily goals & history
- Set your own **daily calorie and protein targets** (defaults of 2000 kcal / 60 g are example values only — adjust them to your plan)
- **Per-date logs**: navigate days with arrows, the Today button, or the native calendar picker; past days are preserved
- Everything persists in **browser localStorage** — refresh-safe, no account needed

### Design
- Polished light theme + full **dark mode** (🌙/☀️ toggle, saved across visits, respects your OS preference on first visit, no flash on load)
- Subtle hand-drawn **food line-art background** with soft color glows, tuned separately for day and night so content always stays readable
- **Responsive**: 4-column stats on desktop → 2 on tablet → 1 on small phones

## 📁 Project structure

```
nutrilens-ai/
├── index.html            # App markup: header, dashboard, add-food form, footer
├── style.css             # All styling: light/dark themes, layout, responsive rules
├── script.js             # All logic: food DB, calculations, storage, UI rendering
├── assets/
│   └── bg-pattern.svg    # Decorative food doodle background tile (local, no CDN)
├── LICENSE               # MIT
└── README.md             # This file
```

## 🚀 Run it locally

No installation or build step — it's a static site.

**Option 1 — just open it:** double-click `index.html`.

**Option 2 — local server** (nicer URLs, matches production behaviour):

```bash
cd nutrilens-ai
python3 -m http.server 8000
# open http://localhost:8000
```

Any static server works (`npx serve`, VS Code Live Server, etc.).

## 🌐 Deploy

The whole app is static files, so any static host works:

| Host | How |
| --- | --- |
| **Netlify** | Drag the folder onto [app.netlify.com/drop](https://app.netlify.com/drop) |
| **GitHub Pages** | Repo → Settings → Pages → deploy from `main` branch root |
| **Vercel** | `vercel` in the project folder, or import the repo |

## 🧮 How the math works

Every entry stores the food's per-100 g values plus the quantity eaten:

```
calories consumed = calories per 100 g × quantity (g) ÷ 100
protein  consumed = protein  per 100 g × quantity (g) ÷ 100
```

Example: 150 g of cooked rice at 130 kcal / 100 g → **195 kcal**.

## 💾 Data & privacy

All data lives in your browser's localStorage under three keys:

| Key | Contents |
| --- | --- |
| `nutrilens.entries` | `{ "YYYY-MM-DD": [entry, …], … }` — meals grouped by date |
| `nutrilens.goals` | `{ calories, protein }` — your daily targets |
| `nutrilens.theme` | `"light"` or `"dark"` |

Nothing ever leaves your device. No cookies, no analytics, no network requests.
Clearing site data in your browser erases the log.

## ⚠️ Disclaimer

The built-in nutrition values are **approximate examples** — check packaging or a
nutrition database for accuracy. The default targets (2000 kcal / 60 g protein)
are example values and **not suitable for everyone**. This app provides no medical
or dietary advice; consult a qualified professional for personal nutrition guidance.

## 🛠️ Tech notes

- Vanilla JS in a single IIFE, strict mode, no dependencies
- Theme switching via CSS custom properties on `<html data-theme>`; a tiny pre-paint script prevents the light-flash on load
- Accessible combobox (ARIA roles, keyboard navigation), `aria-live` toasts, labelled progress bars
- Background artwork is a local SVG on fixed, pointer-transparent pseudo-element layers — it can never block clicks or cover content

## 📄 License

[MIT](LICENSE) — use it, fork it, learn from it.
