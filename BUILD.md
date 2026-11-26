# Build notes — Hearthledger

Entry for make.fun `best-household-budget-site-20261126-1457` ("Make the best household budget site"). Built 2026-11-26, after the competition opened (2026-11-26T14:57Z).

## Constraints taken from the kit (RULES.txt / competition.yaml / starter)

- Static site under `app/`, `app/index.html` opens on desktop and phone with **no network request**; every script, style and media file is under `app/` (this site loads only `style.css`, `main.js` and its `data.js` module — no images, fonts or frames at all).
- Original design, text, names and figures — the household, its employers, shops and every amount are invented for this entry.
- `main.ts` at repo root copies `app/` + `screenshots/` to the output dir and writes `dossier.json` via `buildDossier` from `vendor/makefun-frontend.ts`, left byte-for-byte as shipped (sha256 `4c8da1c8e76490b3a847670f49137d3ec23953e3c988fe6a6cb320fce5739240`, verified against the kit starter).
- Caps from the starter: dossier text ≤ 163840 bytes, ≤ 4 screenshots each ≤ 262144 bytes, `app/` ≤ 993 files and ≤ 16 MiB.
- OSI license (starter MIT kept). The GitHub remote is created by the main chat after this build — this build produced the local repository only. No bundle/submit was run in this build session.
- `main.ts` is the starter's, unchanged: it only `mkdirSync(out, {recursive:true})` and copies into it — no chmod on the output directory itself.

## Design

"Hearthledger", the budget site of the fictional Hartley household (Maya, Tom and two children). One ledger in `app/data.js` — 192 transactions, June to November 2026 — drives every page, so all totals agree by construction: November income $7,610 (salaries $4,200 + $3,150, freelance $260), spending $4,404 across ten categories that sum exactly to the month total, $3,206 left over, a 42.1% savings rate; each of the six months saves 41.9–44.5%. Category budgets total $4,420; in November groceries, dining out, entertainment and shopping run slightly over, which the budgets page calls out. Nine November bills total $2,771 ($2,445 paid, $326 still to pay); the paid ones are the same ledger entries the transactions page shows. Four savings goals hold $15,620 of $23,300 and need $1,676.64 a month together.

Pages (hash routes, every page reachable by link from the header and footer): Overview (month summary strip, KPI cards, category donut, six-month income/spending chart, budget health, goals), Transactions (month switcher, search, category/type filters, four sort orders, add and delete that move every total), Budgets (editable limits with live progress bars, over-budget warnings, reset), Bills (paid/unpaid filter; marking paid adds the ledger entry, marking unpaid removes it), Goals (progress, monthly amount needed to each target date, contributions), Tools (50/30/20 split against the household's actual needs/wants/saved, emergency-fund cover, debt payoff with interest and a debt-free date, month-by-month table). Charts are hand-drawn SVG from the data — no libraries, no external requests. Phone layout verified at 390×844.

## Evidence

- Deterministic double run: `MAKEFUN_OUTPUT_DIR=/tmp/out1 node main.ts` and `…=/tmp/out2 node main.ts` → `diff -r` reports the two output trees **identical**; `dossier.json` sha256 `655e774d63954b5f1594fc33a2371b5bcdccb2eaac27a0836160c151fa3853c9` in both runs.
- `app/`: 4 files, 77453 bytes. Screenshots: 4 JPEGs, each ≤ 262144 bytes (106746 / 100499 / 106742 / 53434).
- Screenshots are real headless-Chromium renders of this site served by `serve.ts` (1280×800 ×3, 390×844 ×1), each visually inspected: cover = November overview with the summary strip, KPI cards, donut and trend chart; transactions = the November ledger with its filters; tools = the 50/30/20 split against actuals plus the fund and debt calculators; phone = savings goals at 390×844. One fix during inspection: the first capture round inherited the test session's June month state, so the shots were retaken after a real reload and verified to show fresh November figures.
- Controls exercised in headless Chromium (26 checks, all passing, no page errors): overview figures and charts; transaction search (groceries → 4 rows), clear, add ($4,404 → $4,441), delete (back to $4,404), largest-first sort; budget edit (dining out $180 → $200 flips the status to "$14 left") and reset; paying the mobile bill ($326 → $238 still to pay, overview spending $4,404 → $4,492) and unpaying it; a $100 goal contribution ($9,840 → $9,940); the 50/30/20 split on $5,000, the debt warning when the payment does not cover interest, a payoff plan (19 months, debt-free June 2028, $439.25 interest), emergency-fund cover; month switching to June ($7,590 income); the not-found page.
- Kit check: see the kit-check section below (transcripts are supplied by the main chat at bundle time; `transcripts_present` is the only permitted FAIL in this build session).

## Rejected approaches

- Separate per-page figures: rejected — computing every total from one transaction ledger keeps the overview, budgets, bills and tools consistent when the visitor adds a transaction or pays a bill.
- Chart library: rejected — hand-drawn SVG keeps the site dependency-free and the dossier source entirely original.

## Kit check (build session, no transcripts)

KITCHECK_PENDING
