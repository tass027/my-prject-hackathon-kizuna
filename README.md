<div align="center">

<img src="public/assets/mieru-mark.svg" alt="Mieru logo" width="96">

# Mieru 見える — the Kizuna bridge

**See every home, so a whole neighbourhood never goes dark again.**

A progressive web app (PWA) built in 24 hours at the **Kizuna hackathon 🇹🇳 × 🇯🇵**.
It reads Tunisian households' electricity meters, warns them before the 200 kWh threshold, and gives STEG (the national utility) a home-by-home map so it can target instead of cutting.

`React` · `Vite` · `PWA` · `Supabase` · `Tesseract.js` · `Open-Meteo` · `PVGIS` · FR / EN / AR

### 👉 [Try the app online](https://hackaton-kizuna.vercel.app) · [STEG dashboard (demo)](https://hackaton-kizuna.vercel.app/#/steg)

</div>

---

## Contents

1. [The problem](#the-problem)
2. [Our solution](#our-solution)
3. [Features](#features)
4. [The Japanese touch](#the-japanese-touch)
5. [Quick start](#quick-start)
6. [Data modes and Supabase](#data-modes-and-supabase)
7. [Aaddad AI assistant](#aaddad-ai-assistant)
8. [Deployment](#deployment)
9. [Tests](#tests)
10. [Project structure](#project-structure)
11. [Privacy and legal framework](#privacy-and-legal-framework)
12. [Known limits and next steps](#known-limits-and-next-steps)
13. [Team](#team)

---

## The problem

Summer 2026: during the heatwave, STEG carried out rotating power cuts, district by district, across Greater Tunis.

| Figure | Source |
|---|---|
| Peak demand announced at **over 6,000 MW** on 21 July 2026 (previous record: 4,888 MW in 2024) | Webdo |
| Production capacity of about **4,630 MW**, i.e. **≈ 400 MW missing** | allAfrica |
| **2.7 million** air conditioners; AC accounts for 18% of household consumption | ANME / STEG |
| Production cost **456 millimes/kWh**, average selling price **291 millimes** | Tuniscope |
| **85%** of customers use less than 200 kWh a month | Webdo |

**The insight:** STEG sees districts, not homes. So it cuts whole districts, including households that save energy and people who are ill.

Households face a second trap: above **200 kWh a month, all of their consumption moves to the higher rate** (about +28 TND on the bill).

## Our solution

Three verbs:

- **見る See.** The household photographs its meter. Mieru shows how much is left before 200 kWh, and what the heat will cost.
- **繋ぐ Connect.** Readings flow to STEG, which gets a map of every district and every home.
- **守る Protect.** When the grid is overloaded, STEG first limits the biggest users, warns them 15 minutes ahead, and never touches homes with medical equipment.

> In our simulation of the Le Bardo district at 105% of capacity: **3 homes limited to 2 kVA instead of 65 homes cut off.**

## Features

### For households

| Feature | Description | Files |
|---|---|---|
| Create, join, demo | Create a meter, join the family's meter, or try the “Ben Salah home” demo | `src/pages/Bienvenue.jsx`, `src/lib/db.js` |
| Photo reading | Photo of the meter, index read by OCR, validation | `src/pages/Releve.jsx`, `src/lib/ocr.js` |
| “Kizuna bridge” gauge | Aaddad walks from the Sidi Bou Said door toward the 200 kWh torii | `src/components/PontGauge.jsx` |
| Forecast and extra cost | Estimated day the threshold is crossed, extra cost in dinars | `src/lib/calcul.js` |
| Monthly chart | Readings, forecast, threshold | `src/components/Graphique.jsx` |
| Heatwave alert | 3-day forecast (35 °C and above) and the extra kWh the AC will use | `src/lib/meteo.js`, `src/components/Canicule.jsx` |
| STEG notices | High-usage alert, announced power limit or cut, power restored | `src/components/AvisSteg.jsx` |
| My solar | Production, real consumption, savings for the household and for STEG (PVGIS, or average yield when offline) | `src/components/Photovoltaique.jsx`, `src/lib/pv.js` |
| Appliance simulator | What each appliance costs | `src/pages/Simulateur.jsx` |
| Kakeibo | The Japanese monthly review: pick one improvement | `src/pages/Kakeibo.jsx` |
| Kizuna | A meter shared by the family, in real time, with messages and WhatsApp invites | `src/pages/Kizuna.jsx` |
| PDF complaint | Dated, sealed photos (EXIF, SHA-256, server time) | `src/pages/Reclamation.jsx`, `src/lib/pdf.js`, `src/lib/preuve.js` |
| Accessibility | French, English, Arabic (right-to-left), read aloud by Aaddad, large text, reminder after 7 days without a reading | `src/i18n/`, `src/lib/voix.js` |

### For STEG (`#/steg`)

| Feature | Description | Files |
|---|---|---|
| Zoomable map | Tunisia → governorates → districts → homes, with the load of each district | `src/components/CarteSteg.jsx` |
| Targeted load shedding | A plan that limits before cutting, protects priority homes, and compares with cutting the whole district | `src/lib/reseau.js` (`planDelestage`) |
| Actions on a home | Alert, limit to 2 kVA, cut (with confirmation), restore | `src/pages/Steg.jsx` |
| Solar | Gain per equipped home, for the household and for STEG | `src/lib/reseau.js` (`gainsSolaire`, `syntheseSolaire`) |
| Statistics | By governorate, by kWh band, heat versus consumption, homes with sharp rises | `src/components/StegCharts.jsx`, `src/lib/steg.js` |
| Scenario | “Heatwave peak 3 pm” button to simulate summer | `src/pages/Steg.jsx` |

**Solar gain (net billing)**
- Household gain = bill without panels − bill with panels.
- STEG gain = production × 0.472 TND/kWh (average cost) − household gain.

## The Japanese touch

| | Concept | In Mieru |
|---|---|---|
| 見える化 | *Mieruka*, “making it visible” | The name and the principle of the app |
| 節電 | *Setsuden*, Japan's 2011 power-saving effort | Targeted load shedding and the neighbourhood “Setsuden challenge” |
| 家計簿 | *Kakeibo*, the family budget book | The monthly review |
| 絆 | *Kizuna*, the bond | The meter shared by the family, and the Tunisia–Japan bridge |
| 判子 | *Hanko*, the seal | The sealed photos in the complaint |

**Aaddad (عدّاد, “meter” in Arabic)** is our mascot: a meter wearing a torii hat (the 200 kWh threshold), with a Sidi Bou Said door for a belly and sakura cheeks. It has three moods: calm, worried, happy.

## Quick start

**Requirements:** Node.js 18 or later.

```bash
git clone https://github.com/iness33/hackaton_Kizuna.git
cd hackaton_Kizuna
npm install
npm run dev
```

Open the address shown (for example `http://localhost:5173`).

- **On a phone:** same Wi-Fi as the computer, then the “Network” address shown by Vite.
- **Camera:** it needs HTTPS or `localhost`. For quick HTTPS, forward port 5173 from the **PORTS** tab in VS Code with *Public* visibility. On a phone, the photo picker opens the camera anyway.
- **Demo:** the “Try the Ben Salah home demo” button creates a 3-member meter with one month of readings (168 kWh) and 3 kWp of solar panels.
- **STEG dashboard:** “STEG space (demo)” link on the welcome screen, or `#/steg`.

## Data modes and Supabase

| Mode | Condition | How it works |
|---|---|---|
| **Local** | Default, no setup | Everything runs on a single device (localStorage and IndexedDB). Kizuna stays on that device. |
| **Cloud** | `.env.local` filled in | Adds real-time Kizuna across phones, photos stored on Supabase, and data sent to the STEG dashboard. |

### Enable Supabase (about 10 minutes)

1. Create a free project on [supabase.com](https://supabase.com).
2. In **SQL Editor**, run `supabase/schema.sql` (tables, photo bucket, real-time, STEG tables `partages_steg` and `avis_steg`, view `steg_foyers`).
3. In **Project Settings → API**, copy the project URL and the `anon public` key.
4. Copy `.env.example` to `.env.local` and fill in:
   ```
   VITE_SUPABASE_URL=...
   VITE_SUPABASE_ANON_KEY=...
   ```
5. Restart `npm run dev`. Accounts created in local mode are not transferred.

> ⚠️ For the hackathon, access rules are deliberately simplified: anyone who knows a meter's ID can read and write to it.

## Aaddad AI assistant

The assistant goes through a **Supabase Edge Function** that calls OpenAI server-side. Meter readings are not sent to OpenAI and conversations are not stored. Limit: 20 messages per day per network address.

1. Run `supabase/assistant.sql` in the SQL Editor.
2. Install the Supabase CLI, then:
   ```bash
   supabase link --project-ref <project-ref>
   supabase secrets set "OPENAI_API_KEY=your-key"
   supabase functions deploy aaddad-assistant
   ```
3. Fill in `.env.local` (URL and `anon` key), then restart the app.

> 🔒 The OpenAI key must **never** go in `.env.local`, in a `VITE_*` variable or in client code.

## Deployment

The app is live on Vercel: **https://hackaton-kizuna.vercel.app** (local mode: each visitor's data stays on their own device).

Every `git push` to `main` redeploys automatically. To deploy from scratch:

```bash
npm run build
```

Then on [vercel.com](https://vercel.com): **Add New → Project**, import the repository (Vite is detected automatically). For cloud mode, add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` under **Settings → Environment Variables**. Vercel provides the HTTPS the camera needs.

## Tests

```bash
npm test
```

37 tests (Node.js `node:test`):

- **Calculations** (`calcul.test.js`): monthly cost, threshold, forecast, reading validation.
- **Weather** (`meteo.test.js`): heatwave alert and extra kWh.
- **Solar** (`pv.test.js`).
- **STEG dashboard** (`steg.test.js`): aggregation and privacy rules.
- **Grid and load shedding** (`reseau.test.js`): limit before cutting, priority homes never touched, every action announced ahead and lasting 60 minutes at most, solar gains.

## Project structure

```
hackaton_Kizuna/
├── public/assets/        # Logo, Aaddad (3 moods), Kizuna bridge, seigaiha and zellige patterns
├── src/
│   ├── pages/            # Bienvenue, Accueil, Releve, Simulateur, Kakeibo, Kizuna, Reclamation, Steg
│   ├── components/       # PontGauge, Graphique, Canicule, Photovoltaique, AvisSteg,
│   │                     # ConditionsSteg, PartageSteg, CarteSteg, StegCharts, Chrome, Icon
│   ├── lib/              # calcul, reseau, steg, pv, meteo, ocr, preuve, pdf, voix, db, store
│   │   └── tarifs.json   # Tariff grid and appliance power ratings
│   ├── i18n/             # fr.js, en.js, ar.js
│   └── styles/           # tokens.css (brand), app.css
├── supabase/             # schema.sql, assistant.sql, aaddad-assistant Edge Function
├── .env.example
├── index.html
├── package.json
└── vite.config.js        # PWA (manifest, service worker)
```

File and folder names are in French, the team's working language.

## Privacy and legal framework

- **Sharing with STEG:** a condition of use, accepted once per meter on the “Before you start” screen. Households can always see what STEG sees (Kizuna → “What STEG sees”).
- **Never sent:** members' first names, photos, Kizuna messages, kakeibo.
- **Priority homes:** a household that declares medical equipment is never limited or cut.
- **Load shedding:** always announced 15 minutes ahead, 60 minutes at most, limited to 2 kVA before any cut.
- **Intended legal basis:** an agreement between the household and STEG (Tunisian Organic Law No. 2004-63, art. 29), with prior declaration to INPDP, the data protection authority, before any real roll-out.
- **Demo data:** the 1,226 homes on the map, their positions and their loads are **simulated**. Real Mieru households are marked “Mieru household”.

## Known limits and next steps

- Check the tariff grid (`src/lib/tarifs.json`) against a real STEG bill.
- Test OCR on real meter photos and adjust the frame (`src/lib/ocr.js`, `.camera .frame` in `app.css`).
- The cloud part of the STEG dashboard has not yet been tested against a real Supabase project.
- Limiting or cutting **remotely** requires smart meters. Without them, Mieru alerts and STEG acts on the ground.
- Coming next: push notifications, Kizuna invite QR code, a one-district pilot with STEG.
- `src/lib/i18n.js` and `src/components/Courbe.jsx` are obsolete and can be deleted.

## Team

Built during the Kizuna hackathon (Tunisia × Japan).

| Role | Member | Scope |
|---|---|---|
| M1 · Front end | [Yesmine Dhouib] | `src/pages/*`, `src/components/*`, `src/styles/*` |
| M2 · Back end, calculations, Kizuna | [ines.sefi] | `src/lib/calcul.js`, `src/lib/db.js`, `src/lib/store.jsx`, `supabase/` |
| M3 · OCR, evidence, PDF, pitch | [tasnim elmehrabi] | `src/lib/ocr.js`, `src/lib/preuve.js`, `src/lib/pdf.js` |

---

<div align="center">

**Mieru 見える: see, so we never have to cut.**

ありがとう · شكرا · Thank you

</div>
