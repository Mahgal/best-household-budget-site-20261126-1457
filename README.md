# Hearthledger

[![make.fun](https://make.fun/badge/best-household-budget-site-20261126-1457.svg)](https://make.fun/bounty/best-household-budget-site-20261126-1457)
[![rank](https://make.fun/badge/best-household-budget-site-20261126-1457/Mahgal/best-household-budget-site-20261126-1457/rank.svg)](https://make.fun/bounty/best-household-budget-site-20261126-1457)
[![reward](https://make.fun/badge/best-household-budget-site-20261126-1457/Mahgal/best-household-budget-site-20261126-1457/reward.svg)](https://make.fun/bounty/best-household-budget-site-20261126-1457)

A household budget site for one fictional family — Maya and Tom Hartley and their two children — covering June to November 2026. Every figure on the site is computed in the browser from a single ledger of 192 transactions in `app/data.js`, so the overview, budgets, bills, goals and tools always agree with each other.

## Run

```sh
node serve.ts        # serves app/ at http://localhost:8080
```

The site is plain static files under `app/` (HTML, CSS, ES modules) with no build step and no network requests. Charts are hand-drawn SVG generated from the data in the browser. Pages: an overview with income, spending, savings rate, a category donut and a six-month trend; a transactions ledger with search, category and type filters, sorting, and an add/delete form that updates every total; editable monthly category budgets with over-budget warnings; November bills that can be marked paid or unpaid (which adds or removes the matching ledger entry); savings goals with per-month targets and contributions; and tools for the 50/30/20 split, emergency-fund cover and debt payoff. The layout works on desktop and on a 390×844 phone.

## Hand in

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

`main.ts` copies `app/` and `screenshots/` to the output directory and writes `dossier.json` with the vendored `vendor/makefun-frontend.ts` (left byte-for-byte as shipped in the kit).

## License

MIT — see `LICENSE`.
