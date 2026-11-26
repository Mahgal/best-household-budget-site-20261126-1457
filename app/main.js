// Hearthledger: the Hartley household budget. One ledger (data.js) drives every page:
// overview, transactions, budgets, bills, goals and tools all compute from the same
// transactions, so adding a transaction, paying a bill or moving a budget updates
// every total on the site. No network requests; charts are hand-drawn SVG.
//
//   #/               overview for the selected month
//   #/transactions   the ledger: search, filter, sort, add, delete
//   #/budgets        monthly category budgets, editable
//   #/bills          November bills, mark paid or unpaid
//   #/goals          savings goals and contributions
//   #/tools          50/30/20 split, emergency fund and debt payoff calculators
//
// window.__shotReady is false while a page renders and true once it is on screen.

import { bills as seedBills, categories, debts, goals as seedGoals, household, months, transactions as seedTxns } from './data.js';

const app = document.getElementById('app');
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const money = (n) => `${n < 0 ? '−' : ''}$${Math.abs(Math.round(n)).toLocaleString('en-US')}`;
const money2 = (n) => `${n < 0 ? '−' : ''}$${Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const pct = (n) => `${n.toFixed(1)}%`;
const catColor = (name) => (categories.find((c) => c.name === name) || {}).color || '#8a8f7a';
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const monthLabel = (id) => {
  const found = months.find((m) => m.id === id);
  if (found) return found.label;
  const m = /^(\d{4})-(\d{2})$/.exec(id || '');
  return m ? `${MONTH_NAMES[Number(m[2]) - 1]} ${m[1]}` : id;
};
const monthShort = (id) => (months.find((m) => m.id === id) || {}).short || id;

const state = {
  month: '2026-11',
  txns: seedTxns.map((t) => ({ ...t })),
  budgets: Object.fromEntries(categories.map((c) => [c.name, c.budget])),
  bills: seedBills.map((b) => ({ ...b })),
  goals: seedGoals.map((g) => ({ ...g })),
  txnFilter: { q: '', cat: 'All', type: 'all', sort: 'date-desc' },
  billFilter: 'all',
  tools: { income: null, essentials: null, fundMonths: 6, debtId: 'd1', balance: 2340, apr: 21.9, payment: 150 },
  userSeq: 0,
};

const monthTxns = (mid) => state.txns.filter((t) => t.date.startsWith(mid));
const incomeOf = (mid) => monthTxns(mid).filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0);
const spendOf = (mid) => -monthTxns(mid).filter((t) => t.amount < 0).reduce((s, t) => s + t.amount, 0);
const catSpend = (mid, cat) => -monthTxns(mid).filter((t) => t.category === cat && t.amount < 0).reduce((s, t) => s + t.amount, 0);
const needsSpend = (mid) => categories.filter((c) => c.needs).reduce((s, c) => s + catSpend(mid, c.name), 0);
const wantsSpend = (mid) => categories.filter((c) => !c.needs).reduce((s, c) => s + catSpend(mid, c.name), 0);

function monthOptions(selected) {
  return months.map((m) => `<option value="${m.id}"${m.id === selected ? ' selected' : ''}>${m.label}</option>`).join('');
}
function monthSwitcher(id) {
  return `<div class="month-switch"><label for="${id}">Month</label><select id="${id}">${monthOptions(state.month)}</select></div>`;
}
function bindMonthSwitcher(id) {
  const el = document.getElementById(id);
  if (el) el.addEventListener('change', () => { state.month = el.value; render(); });
}

function donut(mid) {
  const rows = categories.map((c) => ({ name: c.name, value: catSpend(mid, c.name), color: c.color })).filter((r) => r.value > 0);
  const total = rows.reduce((s, r) => s + r.value, 0);
  const R = 80, C = 2 * Math.PI * R;
  let offset = 0;
  const segs = rows.map((r) => {
    const frac = total ? r.value / total : 0;
    const seg = `<circle cx="100" cy="100" r="${R}" fill="none" stroke="${r.color}" stroke-width="26" stroke-dasharray="${(frac * C).toFixed(1)} ${C.toFixed(1)}" stroke-dashoffset="${(-offset * C).toFixed(1)}" transform="rotate(-90 100 100)"><title>${esc(r.name)}: ${money(r.value)}</title></circle>`;
    offset += frac;
    return seg;
  }).join('');
  const legend = rows.map((r) => `<div class="bar-row"><span><span class="cat-dot" style="background:${r.color}"></span>${esc(r.name)}</span><span class="muted">${pct(total ? (r.value / total) * 100 : 0)}</span><span class="bar-amount">${money(r.value)}</span></div>`).join('');
  return `<div class="donut-wrap"><svg class="chart" viewBox="0 0 200 200" role="img" aria-label="Spending by category in ${esc(monthLabel(mid))}">${segs}<text x="100" y="96" text-anchor="middle" font-size="15" fill="#5c6b62">Spent</text><text x="100" y="118" text-anchor="middle" font-size="21" font-weight="bold" fill="#1d2a24">${money(total)}</text></svg><div>${legend}</div></div>`;
}

function trendChart() {
  const W = 720, H = 250, base = 205, top = 25;
  const maxV = Math.max(...months.map((m) => Math.max(incomeOf(m.id), spendOf(m.id)))) * 1.12;
  const slot = (W - 70) / months.length;
  const bw = Math.min(34, slot * 0.32);
  let out = `<line x1="45" y1="${base}" x2="${W - 10}" y2="${base}" stroke="#b9c6bd" stroke-width="1"/>`;
  months.forEach((m, i) => {
    const cx = 55 + slot * i + slot / 2;
    const inc = incomeOf(m.id), sp = spendOf(m.id);
    const ih = ((base - top) * inc) / maxV, sh = ((base - top) * sp) / maxV;
    const sel = m.id === state.month;
    out += `<rect x="${(cx - bw - 2).toFixed(1)}" y="${(base - ih).toFixed(1)}" width="${bw}" height="${ih.toFixed(1)}" rx="3" fill="#17624a" ${sel ? 'stroke="#1d2a24" stroke-width="2"' : ''}><title>${m.label} income ${money(inc)}</title></rect>`;
    out += `<rect x="${(cx + 2).toFixed(1)}" y="${(base - sh).toFixed(1)}" width="${bw}" height="${sh.toFixed(1)}" rx="3" fill="#c0562f" ${sel ? 'stroke="#1d2a24" stroke-width="2"' : ''}><title>${m.label} spending ${money(sp)}</title></rect>`;
    out += `<text x="${cx}" y="${base + 20}" text-anchor="middle" font-size="13" fill="#1d2a24">${m.short}</text>`;
    out += `<text x="${cx}" y="${base + 38}" text-anchor="middle" font-size="11.5" fill="#5c6b62">saved ${pct(inc ? ((inc - sp) / inc) * 100 : 0)}</text>`;
  });
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Income and spending by month, June to November 2026">${out}</svg><div class="legend"><span><span class="dot" style="background:#17624a"></span>Income</span><span><span class="dot" style="background:#c0562f"></span>Spending</span><span>Outlined pair: ${esc(monthLabel(state.month))}</span></div>`;
}

function overviewPage() {
  const mid = state.month;
  const inc = incomeOf(mid), sp = spendOf(mid), left = inc - sp;
  const rate = inc ? (left / inc) * 100 : 0;
  const prev = months[months.findIndex((m) => m.id === mid) - 1];
  const prevNote = prev ? `Spending ${sp <= spendOf(prev.id) ? 'down' : 'up'} ${money(Math.abs(sp - spendOf(prev.id)))} on ${monthLabel(prev.id)}` : 'First month in the ledger';
  const over = categories.filter((c) => catSpend(mid, c.name) > state.budgets[c.name]);
  const unpaid = state.bills.filter((b) => !b.paid);
  const unpaidTotal = unpaid.reduce((s, b) => s + b.amount, 0);
  const goalSaved = state.goals.reduce((s, g) => s + g.saved, 0);
  const goalTarget = state.goals.reduce((s, g) => s + g.target, 0);
  const budgetRows = categories.map((c) => {
    const spent = catSpend(mid, c.name), limit = state.budgets[c.name];
    const p = limit ? (spent / limit) * 100 : 0;
    const cls = p > 100 ? 'over' : p >= 85 ? 'near' : '';
    const status = p > 100 ? `<span class="status-over">${money(spent - limit)} over</span>` : `<span class="status-ok">${money(limit - spent)} left</span>`;
    return `<div class="bar-row"><span><span class="cat-dot" style="background:${c.color}"></span>${esc(c.name)}</span><span class="bar-track"><span class="bar-fill" style="display:block;width:${Math.min(100, p).toFixed(1)}%;background:${p > 100 ? '#b3261e' : c.color}"></span></span><span class="bar-amount">${money(spent)} / ${money(limit)}</span></div><div class="small-text" style="margin:-2px 0 4px">${status} · ${pct(p)} of budget</div>`;
  }).join('');
  return `
  <section class="ledger-strip">
    <h1>${esc(monthLabel(mid))} at a glance</h1>
    <p>${esc(household.name)} (${esc(household.members)}) brought in ${money(inc)} and spent ${money(sp)}, leaving ${money(left)} to save or put toward goals. ${over.length ? `${over.length} ${over.length === 1 ? 'category is' : 'categories are'} over budget this month.` : 'Every category is within budget this month.'}</p>
    <div class="strip-figures">
      <div><span>Income</span><strong>${money(inc)}</strong></div>
      <div><span>Spending</span><strong>${money(sp)}</strong></div>
      <div><span>Left over</span><strong>${money(left)}</strong></div>
      <div><span>Savings rate</span><strong>${pct(rate)}</strong></div>
    </div>
  </section>
  <div class="page-head"><p>${esc(prevNote)}. Change the month to compare; every figure below follows.</p>${monthSwitcher('ov-month')}</div>
  <div class="grid grid-4">
    <div class="card kpi"><div class="kpi-label">Income in ${esc(monthShort(mid))}</div><div class="kpi-value">${money(inc)}</div><div class="kpi-note">Two salaries plus freelance work</div></div>
    <div class="card kpi"><div class="kpi-label">Spending in ${esc(monthShort(mid))}</div><div class="kpi-value">${money(sp)}</div><div class="kpi-note">${monthTxns(mid).filter((t) => t.amount < 0).length} purchases and bills</div></div>
    <div class="card kpi"><div class="kpi-label">Left over</div><div class="kpi-value ${left >= 0 ? 'pos' : 'neg'}">${money(left)}</div><div class="kpi-note">Before goal contributions</div></div>
    <div class="card kpi"><div class="kpi-label">Still to pay</div><div class="kpi-value">${money(unpaidTotal)}</div><div class="kpi-note">${unpaid.length} November ${unpaid.length === 1 ? 'bill' : 'bills'} unpaid · <a href="#/bills">see bills</a></div></div>
  </div>
  <div class="grid grid-2">
    <section class="card"><h2>Where the money went</h2>${donut(mid)}<p class="small-text muted" style="margin-top:10px">Housing is the largest slice every month; groceries come next. <a href="#/transactions">Open the ledger</a> to see each purchase.</p></section>
    <section class="card"><h2>Income against spending</h2>${trendChart()}<p class="small-text muted" style="margin-top:10px">The household has saved between 41.9% and 44.5% of income in each of the last six months.</p></section>
  </div>
  <div class="grid grid-2">
    <section class="card"><h2>Budget health</h2>${budgetRows}<p class="small-text" style="margin-top:10px"><a href="#/budgets">Adjust budgets</a> — changes here update the bars at once.</p></section>
    <section class="card"><h2>Saving toward</h2>
      ${state.goals.map((g) => `<div class="goal-head"><strong>${esc(g.name)}</strong><span class="goal-amount">${money(g.saved)} <span class="muted" style="font-size:14px">of ${money(g.target)}</span></span></div><div class="progress"><div style="width:${((g.saved / g.target) * 100).toFixed(1)}%"></div></div><p class="small-text muted">${pct((g.saved / g.target) * 100)} saved · target ${esc(monthLabel(g.deadline))}</p>`).join('')}
      <p class="summary-line">All goals: <strong>${money(goalSaved)}</strong> of <strong>${money(goalTarget)}</strong> · <a href="#/goals">add a contribution</a></p>
    </section>
  </div>`;
}

function filteredTxns() {
  const f = state.txnFilter;
  let rows = monthTxns(state.month).filter((t) => {
    if (f.cat !== 'All' && t.category !== f.cat) return false;
    if (f.type === 'income' && t.amount <= 0) return false;
    if (f.type === 'spending' && t.amount >= 0) return false;
    if (f.q && !`${t.description} ${t.category}`.toLowerCase().includes(f.q.toLowerCase())) return false;
    return true;
  });
  const by = {
    'date-desc': (a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id),
    'date-asc': (a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id),
    'amount-desc': (a, b) => Math.abs(b.amount) - Math.abs(a.amount),
    'amount-asc': (a, b) => Math.abs(a.amount) - Math.abs(b.amount),
  };
  rows.sort(by[f.sort] || by['date-desc']);
  return rows;
}

function txnRowsHtml() {
  const rows = filteredTxns();
  if (!rows.length) return '<tr><td colspan="5">No transactions match. Clear the search or pick another category.</td></tr>';
  return rows.map((t) => `<tr>
    <td>${esc(t.date)}</td>
    <td>${esc(t.description)}</td>
    <td><span class="cat-dot" style="background:${catColor(t.category)}"></span>${esc(t.category)}</td>
    <td class="num ${t.amount > 0 ? 'pos' : ''}">${t.amount > 0 ? '+' : '−'}${money(Math.abs(t.amount)).slice(0)}</td>
    <td class="num"><button type="button" class="small danger" data-del="${esc(t.id)}">Delete</button></td>
  </tr>`).join('');
}

function txnSummaryHtml() {
  const rows = filteredTxns();
  const inc = rows.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0);
  const sp = -rows.filter((t) => t.amount < 0).reduce((s, t) => s + t.amount, 0);
  return `Showing <strong>${rows.length}</strong> of ${monthTxns(state.month).length} transactions in ${esc(monthLabel(state.month))} · income <strong>${money(inc)}</strong> · spending <strong>${money(sp)}</strong> · net <strong>${money(inc - sp)}</strong>. Month totals: income ${money(incomeOf(state.month))}, spending ${money(spendOf(state.month))}, left ${money(incomeOf(state.month) - spendOf(state.month))}.`;
}

function transactionsPage() {
  const f = state.txnFilter;
  const catOpts = ['All', 'Income', ...categories.map((c) => c.name)].map((c) => `<option${c === f.cat ? ' selected' : ''}>${esc(c)}</option>`).join('');
  const addCats = ['Income', ...categories.map((c) => c.name)].map((c) => `<option>${esc(c)}</option>`).join('');
  return `
  <div class="page-head"><div><h1>Transactions</h1><p>Every purchase and payment for the selected month. Add one and the overview, budgets and tools update with it.</p></div>${monthSwitcher('tx-month')}</div>
  <section class="card">
    <div class="controls">
      <div class="field"><label for="tx-q">Search</label><input type="search" id="tx-q" placeholder="e.g. groceries, rent, salary" value="${esc(f.q)}"></div>
      <div class="field"><label for="tx-cat">Category</label><select id="tx-cat">${catOpts}</select></div>
      <div class="field"><label for="tx-type">Type</label><select id="tx-type">
        <option value="all"${f.type === 'all' ? ' selected' : ''}>Income and spending</option>
        <option value="income"${f.type === 'income' ? ' selected' : ''}>Income only</option>
        <option value="spending"${f.type === 'spending' ? ' selected' : ''}>Spending only</option>
      </select></div>
      <div class="field"><label for="tx-sort">Sort</label><select id="tx-sort">
        <option value="date-desc"${f.sort === 'date-desc' ? ' selected' : ''}>Newest first</option>
        <option value="date-asc"${f.sort === 'date-asc' ? ' selected' : ''}>Oldest first</option>
        <option value="amount-desc"${f.sort === 'amount-desc' ? ' selected' : ''}>Largest amount</option>
        <option value="amount-asc"${f.sort === 'amount-asc' ? ' selected' : ''}>Smallest amount</option>
      </select></div>
      <button type="button" class="ghost" id="tx-clear">Clear filters</button>
    </div>
    <p class="summary-line" id="tx-summary">${txnSummaryHtml()}</p>
    <div class="table-wrap"><table>
      <thead><tr><th>Date</th><th>Description</th><th>Category</th><th class="num">Amount</th><th class="num">Action</th></tr></thead>
      <tbody id="tx-body">${txnRowsHtml()}</tbody>
    </table></div>
  </section>
  <section class="card">
    <h2>Add a transaction</h2>
    <p class="muted">It joins the ledger at once: the table above, the month totals, the overview and the budgets all move.</p>
    <form id="tx-add" class="form-grid">
      <div class="field"><label for="add-date">Date</label><input type="date" id="add-date" value="${state.month}-24" min="2026-06-01" max="2026-11-30" required></div>
      <div class="field"><label for="add-desc">Description</label><input type="text" id="add-desc" placeholder="e.g. Weekly shop" required></div>
      <div class="field"><label for="add-cat">Category</label><select id="add-cat">${addCats}</select></div>
      <div class="field"><label for="add-type">Type</label><select id="add-type"><option value="spending">Spending</option><option value="income">Income</option></select></div>
      <div class="field"><label for="add-amt">Amount ($)</label><input type="number" id="add-amt" min="1" step="1" value="50" required></div>
      <button type="submit">Add</button>
    </form>
    <p class="small-text muted" id="tx-added" aria-live="polite"></p>
  </section>`;
}

function bindTransactions() {
  bindMonthSwitcher('tx-month');
  const refresh = () => {
    document.getElementById('tx-body').innerHTML = txnRowsHtml();
    document.getElementById('tx-summary').innerHTML = txnSummaryHtml();
    bindDeleteButtons();
  };
  const q = document.getElementById('tx-q');
  q.addEventListener('input', () => { state.txnFilter.q = q.value; refresh(); });
  document.getElementById('tx-cat').addEventListener('change', (e) => { state.txnFilter.cat = e.target.value; refresh(); });
  document.getElementById('tx-type').addEventListener('change', (e) => { state.txnFilter.type = e.target.value; refresh(); });
  document.getElementById('tx-sort').addEventListener('change', (e) => { state.txnFilter.sort = e.target.value; refresh(); });
  document.getElementById('tx-clear').addEventListener('click', () => {
    state.txnFilter = { q: '', cat: 'All', type: 'all', sort: 'date-desc' };
    render();
  });
  function bindDeleteButtons() {
    document.querySelectorAll('[data-del]').forEach((btn) => btn.addEventListener('click', () => {
      const t = state.txns.find((x) => x.id === btn.dataset.del);
      state.txns = state.txns.filter((x) => x.id !== btn.dataset.del);
      state.bills.forEach((b) => { if (b.txnId === btn.dataset.del) { b.paid = false; b.txnId = null; } });
      refresh();
      document.getElementById('tx-added').textContent = t ? `Deleted “${t.description}” (${money(Math.abs(t.amount))}). Month totals updated.` : '';
    }));
  }
  bindDeleteButtons();
  document.getElementById('tx-add').addEventListener('submit', (e) => {
    e.preventDefault();
    const date = document.getElementById('add-date').value;
    const desc = document.getElementById('add-desc').value.trim();
    const cat = document.getElementById('add-cat').value;
    const type = document.getElementById('add-type').value;
    const amt = Math.abs(Number(document.getElementById('add-amt').value));
    if (!date || !desc || !amt) return;
    state.userSeq += 1;
    const category = type === 'income' ? 'Income' : (cat === 'Income' ? 'Other' : cat);
    state.txns.push({ id: `u${state.userSeq}`, date, description: desc, category, amount: type === 'income' ? amt : -amt });
    state.month = date.slice(0, 7);
    state.txnFilter = { q: '', cat: 'All', type: 'all', sort: 'date-desc' };
    render();
    const note = document.getElementById('tx-added');
    if (note) note.textContent = `Added “${desc}” (${type === 'income' ? '+' : '−'}${money(amt)}) to ${monthLabel(state.month)}. The overview and budgets now include it.`;
  });
}

function budgetStatus(spent, limit) {
  const p = limit ? (spent / limit) * 100 : 0;
  if (p > 100) return { p, cls: 'over', text: `${money(spent - limit)} over budget` };
  if (p >= 85) return { p, cls: 'near', text: `${money(limit - spent)} left — close to the limit` };
  return { p, cls: '', text: `${money(limit - spent)} left` };
}

function budgetsPage() {
  const mid = state.month;
  const rows = categories.map((c) => {
    const spent = catSpend(mid, c.name), limit = state.budgets[c.name];
    const st = budgetStatus(spent, limit);
    return `<tr>
      <td><span class="cat-dot" style="background:${c.color}"></span><strong>${esc(c.name)}</strong></td>
      <td class="num">${money(spent)}</td>
      <td class="num"><input type="number" class="budget-input" min="0" step="10" value="${limit}" data-budget="${esc(c.name)}" aria-label="Monthly budget for ${esc(c.name)}"></td>
      <td style="min-width:180px"><div class="progress"><div class="${st.cls}" data-bar="${esc(c.name)}" style="width:${Math.min(100, st.p).toFixed(1)}%"></div></div></td>
      <td data-status="${esc(c.name)}"><span class="${st.p > 100 ? 'status-over' : st.p >= 85 ? 'status-near' : 'status-ok'}">${st.text}</span><br><span class="muted small-text">${pct(st.p)} used</span></td>
    </tr>`;
  }).join('');
  const totalBudget = categories.reduce((s, c) => s + state.budgets[c.name], 0);
  const totalSpent = spendOf(mid);
  const over = categories.filter((c) => catSpend(mid, c.name) > state.budgets[c.name]);
  return `
  <div class="page-head"><div><h1>Budgets</h1><p>Monthly limits by category, set against what the ledger says was actually spent. Type a new limit and the bar, the status and the totals move immediately.</p></div>${monthSwitcher('bd-month')}</div>
  ${over.length ? `<div class="notice bad"><strong>${over.length} ${over.length === 1 ? 'category is' : 'categories are'} over budget in ${esc(monthLabel(mid))}:</strong> ${over.map((c) => `${esc(c.name)} by ${money(catSpend(mid, c.name) - state.budgets[c.name])}`).join(', ')}. Raise the limit below or trim next month's spending.</div>` : `<div class="notice">Every category is within budget in ${esc(monthLabel(mid))}.</div>`}
  <section class="card">
    <p class="summary-line" id="bd-summary">Total budget <strong>${money(totalBudget)}</strong> · spent <strong>${money(totalSpent)}</strong> · ${totalBudget - totalSpent >= 0 ? `<strong>${money(totalBudget - totalSpent)}</strong> of budget unused` : `<strong>${money(totalSpent - totalBudget)}</strong> over the combined budget`} · income ${money(incomeOf(mid))} leaves ${money(incomeOf(mid) - totalSpent)} unspent.</p>
    <div class="table-wrap"><table>
      <thead><tr><th>Category</th><th class="num">Spent</th><th class="num">Budget ($)</th><th>Progress</th><th>Status</th></tr></thead>
      <tbody>${rows}</tbody>
    </table></div>
    <p style="margin-top:14px"><button type="button" class="ghost" id="bd-reset">Reset budgets to the household defaults</button></p>
    <p class="small-text muted">Defaults total $4,420 a month: housing $2,150, groceries $700, transport $320, utilities $230, dining out $180, health $150, kids &amp; school $200, entertainment $140, shopping $250, other $100.</p>
  </section>`;
}

function bindBudgets() {
  bindMonthSwitcher('bd-month');
  const summary = () => {
    const mid = state.month;
    const totalBudget = categories.reduce((s, c) => s + state.budgets[c.name], 0);
    const totalSpent = spendOf(mid);
    document.getElementById('bd-summary').innerHTML = `Total budget <strong>${money(totalBudget)}</strong> · spent <strong>${money(totalSpent)}</strong> · ${totalBudget - totalSpent >= 0 ? `<strong>${money(totalBudget - totalSpent)}</strong> of budget unused` : `<strong>${money(totalSpent - totalBudget)}</strong> over the combined budget`} · income ${money(incomeOf(mid))} leaves ${money(incomeOf(mid) - totalSpent)} unspent.`;
  };
  document.querySelectorAll('[data-budget]').forEach((input) => input.addEventListener('input', () => {
    const name = input.dataset.budget;
    const limit = Math.max(0, Number(input.value) || 0);
    state.budgets[name] = limit;
    const spent = catSpend(state.month, name);
    const st = budgetStatus(spent, limit);
    const bar = document.querySelector(`[data-bar="${CSS.escape(name)}"]`);
    bar.style.width = `${Math.min(100, st.p).toFixed(1)}%`;
    bar.className = st.cls;
    document.querySelector(`[data-status="${CSS.escape(name)}"]`).innerHTML = `<span class="${st.p > 100 ? 'status-over' : st.p >= 85 ? 'status-near' : 'status-ok'}">${st.text}</span><br><span class="muted small-text">${pct(st.p)} used</span>`;
    summary();
  }));
  document.getElementById('bd-reset').addEventListener('click', () => {
    state.budgets = Object.fromEntries(categories.map((c) => [c.name, c.budget]));
    render();
  });
}

function billsPage() {
  const today = '2026-11-26';
  const shown = state.bills.filter((b) => state.billFilter === 'all' || (state.billFilter === 'paid' ? b.paid : !b.paid));
  const total = state.bills.reduce((s, b) => s + b.amount, 0);
  const paidTotal = state.bills.filter((b) => b.paid).reduce((s, b) => s + b.amount, 0);
  const rows = shown.map((b) => {
    const pill = b.paid ? '<span class="pill paid">Paid</span>' : (b.due < today ? '<span class="pill due">Overdue</span>' : '<span class="pill soon">Due soon</span>');
    return `<tr>
      <td><strong>${esc(b.name)}</strong><br><span class="muted small-text"><span class="cat-dot" style="background:${catColor(b.category)}"></span>${esc(b.category)}</span></td>
      <td>${esc(b.due)}</td>
      <td class="num">${money(b.amount)}</td>
      <td>${pill}</td>
      <td class="num"><button type="button" class="small ${b.paid ? 'ghost' : ''}" data-bill="${esc(b.id)}">${b.paid ? 'Mark unpaid' : 'Mark paid'}</button></td>
    </tr>`;
  }).join('');
  return `
  <div class="page-head"><div><h1>Bills</h1><p>November's regular bills. Marking one paid adds it to the ledger (or removes it again), so spending, budgets and the overview follow.</p></div></div>
  <div class="grid grid-3">
    <div class="card kpi"><div class="kpi-label">November bills total</div><div class="kpi-value">${money(total)}</div><div class="kpi-note">Nine regular bills</div></div>
    <div class="card kpi"><div class="kpi-label">Already paid</div><div class="kpi-value pos">${money(paidTotal)}</div><div class="kpi-note">${state.bills.filter((b) => b.paid).length} of ${state.bills.length} bills</div></div>
    <div class="card kpi"><div class="kpi-label">Still to pay</div><div class="kpi-value">${money(total - paidTotal)}</div><div class="kpi-note">Mobile phones, car insurance, home insurance</div></div>
  </div>
  <section class="card">
    <div class="controls"><div class="tabs" role="group" aria-label="Filter bills">
      <button type="button" data-billfilter="all" class="${state.billFilter === 'all' ? 'active' : ''}">All bills</button>
      <button type="button" data-billfilter="unpaid" class="${state.billFilter === 'unpaid' ? 'active' : ''}">Unpaid</button>
      <button type="button" data-billfilter="paid" class="${state.billFilter === 'paid' ? 'active' : ''}">Paid</button>
    </div></div>
    <div class="table-wrap"><table>
      <thead><tr><th>Bill</th><th>Due</th><th class="num">Amount</th><th>Status</th><th class="num">Action</th></tr></thead>
      <tbody>${rows || '<tr><td colspan="5">No bills in this view.</td></tr>'}</tbody>
    </table></div>
    <p class="small-text muted" style="margin-top:10px">Paid bills are already in the <a href="#/transactions">ledger</a> under their category — rent under Housing, electricity, internet and water under Utilities, the gym under Health, streaming under Entertainment.</p>
  </section>`;
}

function bindBills() {
  document.querySelectorAll('[data-billfilter]').forEach((btn) => btn.addEventListener('click', () => {
    state.billFilter = btn.dataset.billfilter;
    render();
  }));
  document.querySelectorAll('[data-bill]').forEach((btn) => btn.addEventListener('click', () => {
    const bill = state.bills.find((b) => b.id === btn.dataset.bill);
    if (!bill) return;
    if (bill.paid) {
      if (bill.txnId) state.txns = state.txns.filter((t) => t.id !== bill.txnId);
      bill.paid = false;
      bill.txnId = null;
    } else {
      state.userSeq += 1;
      const id = `u${state.userSeq}`;
      state.txns.push({ id, date: bill.due, description: bill.name, category: bill.category, amount: -bill.amount });
      bill.paid = true;
      bill.txnId = id;
    }
    render();
  }));
}

function monthsUntil(deadline) {
  const [y1, m1] = state.month.split('-').map(Number);
  const [y2, m2] = deadline.split('-').map(Number);
  return Math.max(1, (y2 - y1) * 12 + (m2 - m1));
}

function goalsPage() {
  const left = incomeOf(state.month) - spendOf(state.month);
  const neededTotal = state.goals.reduce((s, g) => s + Math.max(0, g.target - g.saved) / monthsUntil(g.deadline), 0);
  const cards = state.goals.map((g) => {
    const p = (g.saved / g.target) * 100;
    const remaining = Math.max(0, g.target - g.saved);
    const monthsLeft = monthsUntil(g.deadline);
    const perMonth = remaining / monthsLeft;
    return `<section class="card">
      <div class="goal-head"><h2 style="margin:0">${esc(g.name)}</h2><span class="goal-amount">${money(g.saved)} <span class="muted" style="font-size:14px">of ${money(g.target)}</span></span></div>
      <p class="muted">${esc(g.note)}</p>
      <div class="progress"><div style="width:${Math.min(100, p).toFixed(1)}%"></div></div>
      <p class="summary-line">${pct(p)} saved · ${money(remaining)} to go · target ${esc(monthLabel(g.deadline))} (${monthsLeft} ${monthsLeft === 1 ? 'month' : 'months'}) · needs <strong>${money2(perMonth)}</strong> a month</p>
      <form class="inline-form" data-goalform="${esc(g.id)}">
        <div class="field"><label for="amt-${esc(g.id)}">Add a contribution ($)</label><input type="number" id="amt-${esc(g.id)}" min="1" step="1" value="100" required></div>
        <button type="submit">Add</button>
      </form>
    </section>`;
  }).join('');
  return `
  <div class="page-head"><div><h1>Savings goals</h1><p>Four pots the household is filling. Each card works out what it needs per month from ${esc(monthLabel(state.month))} to its target date; add a contribution and the figures move.</p></div>${monthSwitcher('gl-month')}</div>
  <div class="notice">Together the goals need <strong>${money2(neededTotal)}</strong> a month. ${esc(monthLabel(state.month))} left <strong>${money(left)}</strong> unspent, so the plan fits with ${money(Math.max(0, left - neededTotal))} to spare.</div>
  <div class="grid grid-2">${cards}</div>`;
}

function bindGoals() {
  bindMonthSwitcher('gl-month');
  document.querySelectorAll('[data-goalform]').forEach((form) => form.addEventListener('submit', (e) => {
    e.preventDefault();
    const goal = state.goals.find((g) => g.id === form.dataset.goalform);
    const amt = Math.abs(Number(form.querySelector('input[type="number"]').value));
    if (!goal || !amt) return;
    goal.saved = Math.min(goal.target, goal.saved + amt);
    render();
  }));
}

function debtPlan(balance, apr, payment) {
  const r = apr / 1200;
  if (balance <= 0) return { months: 0, interest: 0, total: 0, warn: '' };
  if (payment <= balance * r) return { months: Infinity, interest: Infinity, total: Infinity, warn: `A payment of ${money(payment)} does not cover the monthly interest of ${money2(balance * r)}, so the balance would never fall. Raise the payment above ${money2(balance * r)}.` };
  let bal = balance, interest = 0, months = 0;
  while (bal > 0 && months < 1200) {
    const i = bal * r;
    interest += i;
    bal += i - payment;
    months += 1;
    if (bal < 0) bal = 0;
  }
  return { months, interest, total: balance + interest, warn: '' };
}

function payoffDate(months) {
  const [y, m] = state.month.split('-').map(Number);
  const d = new Date(y, m - 1 + months, 1);
  return `${months === 1 ? 'month' : 'months'} from ${monthLabel(state.month)} — debt-free by ${d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`;
}

function toolsPage() {
  const mid = state.month;
  const income = state.tools.income ?? incomeOf(mid);
  const essentials = state.tools.essentials ?? needsSpend(mid);
  const needs = needsSpend(mid), wants = wantsSpend(mid), saved = incomeOf(mid) - spendOf(mid);
  const plan = debtPlan(state.tools.balance, state.tools.apr, state.tools.payment);
  const emergency = state.goals.find((g) => g.id === 'g1');
  const fundTarget = essentials * state.tools.fundMonths;
  const coverage = essentials ? emergency.saved / essentials : 0;
  const debtOpts = debts.map((d) => `<option value="${d.id}"${d.id === state.tools.debtId ? ' selected' : ''}>${esc(d.name)} — ${money(d.balance)} at ${d.apr}%</option>`).join('');
  return `
  <div class="page-head"><div><h1>Tools</h1><p>Three calculators fed by the ledger's own figures. Change any number and the result updates as you type.</p></div>${monthSwitcher('tl-month')}</div>
  <section class="card">
    <h2>The 50/30/20 split</h2>
    <p class="muted">A common rule of thumb: half of take-home pay for needs, 30% for wants, 20% for saving. The Hartleys' actual ${esc(monthLabel(mid))} split is measured from the ledger — needs are housing, utilities, groceries, transport, health and kids &amp; school.</p>
    <div class="controls">
      <div class="field"><label for="tl-income">Monthly take-home pay ($)</label><input type="number" id="tl-income" min="0" step="10" value="${income}"></div>
    </div>
    <div class="split-bar" aria-hidden="true"><div id="split-needs" style="background:#17624a;width:50%"></div><div id="split-wants" style="background:#c0562f;width:30%"></div><div id="split-save" style="background:#b98a2f;width:20%"></div></div>
    <p class="summary-line" id="split-out"></p>
    <p class="summary-line">Actual ${esc(monthLabel(mid))}: needs <strong>${money(needs)}</strong> (${pct(incomeOf(mid) ? (needs / incomeOf(mid)) * 100 : 0)}), wants <strong>${money(wants)}</strong> (${pct(incomeOf(mid) ? (wants / incomeOf(mid)) * 100 : 0)}), saved <strong>${money(saved)}</strong> (${pct(incomeOf(mid) ? (saved / incomeOf(mid)) * 100 : 0)}). The household spends less on wants than the rule allows and saves about twice the 20% share.</p>
  </section>
  <div class="grid grid-2">
    <section class="card">
      <h2>Emergency fund</h2>
      <p class="muted">How long the emergency fund would carry the household if income stopped. Essentials default to ${esc(monthLabel(mid))}'s needs spending from the ledger.</p>
      <div class="controls">
        <div class="field"><label for="tl-essentials">Monthly essentials ($)</label><input type="number" id="tl-essentials" min="0" step="10" value="${essentials}"></div>
        <div class="field"><label for="tl-fundmonths">Months of cover</label><select id="tl-fundmonths">
          ${[3, 6, 9, 12].map((n) => `<option value="${n}"${n === state.tools.fundMonths ? ' selected' : ''}>${n} months</option>`).join('')}
        </select></div>
      </div>
      <p class="summary-line" id="fund-out"></p>
      <p class="small-text muted">The emergency fund currently holds ${money(emergency.saved)} of its ${money(emergency.target)} goal — see <a href="#/goals">goals</a>.</p>
    </section>
    <section class="card">
      <h2>Debt payoff</h2>
      <p class="muted">Pick a debt or type your own figures. The plan assumes the same payment every month and no new spending on the card.</p>
      <div class="controls">
        <div class="field"><label for="tl-debt">Debt</label><select id="tl-debt">${debtOpts}</select></div>
        <div class="field"><label for="tl-balance">Balance ($)</label><input type="number" id="tl-balance" min="0" step="10" value="${state.tools.balance}"></div>
        <div class="field"><label for="tl-apr">APR (%)</label><input type="number" id="tl-apr" min="0" step="0.1" value="${state.tools.apr}"></div>
        <div class="field"><label for="tl-payment">Monthly payment ($)</label><input type="number" id="tl-payment" min="0" step="5" value="${state.tools.payment}"></div>
      </div>
      <p class="summary-line" id="debt-out"></p>
    </section>
  </div>
  <section class="card">
    <h2>Month by month</h2>
    <div class="table-wrap"><table>
      <thead><tr><th>Month</th><th class="num">Income</th><th class="num">Spending</th><th class="num">Left over</th><th class="num">Savings rate</th></tr></thead>
      <tbody>${months.map((m) => `<tr${m.id === mid ? ' style="font-weight:600"' : ''}><td>${esc(m.label)}</td><td class="num">${money(incomeOf(m.id))}</td><td class="num">${money(spendOf(m.id))}</td><td class="num">${money(incomeOf(m.id) - spendOf(m.id))}</td><td class="num">${pct(incomeOf(m.id) ? ((incomeOf(m.id) - spendOf(m.id)) / incomeOf(m.id)) * 100 : 0)}</td></tr>`).join('')}</tbody>
    </table></div>
    <p class="small-text muted" style="margin-top:10px">Six months in, the household has kept ${money(months.reduce((s, m) => s + incomeOf(m.id) - spendOf(m.id), 0))} of ${money(months.reduce((s, m) => s + incomeOf(m.id), 0))} earned. September's dentist bill and August's school supplies are the two visible bumps.</p>
  </section>`;
}

function bindTools() {
  bindMonthSwitcher('tl-month');
  const splitOut = document.getElementById('split-out');
  const fundOut = document.getElementById('fund-out');
  const debtOut = document.getElementById('debt-out');
  const emergency = state.goals.find((g) => g.id === 'g1');
  const updateSplit = () => {
    const income = Math.max(0, Number(document.getElementById('tl-income').value) || 0);
    state.tools.income = income;
    splitOut.innerHTML = `On ${money(income)} a month the rule allows needs <strong>${money(income * 0.5)}</strong>, wants <strong>${money(income * 0.3)}</strong> and saving <strong>${money(income * 0.2)}</strong>.`;
  };
  const updateFund = () => {
    const essentials = Math.max(0, Number(document.getElementById('tl-essentials').value) || 0);
    const monthsCover = Number(document.getElementById('tl-fundmonths').value);
    state.tools.essentials = essentials;
    state.tools.fundMonths = monthsCover;
    const target = essentials * monthsCover;
    const coverage = essentials ? emergency.saved / essentials : 0;
    fundOut.innerHTML = `${monthsCover} months of essentials is <strong>${money(target)}</strong>. The fund's ${money(emergency.saved)} covers <strong>${coverage.toFixed(1)} months</strong> today${target > emergency.saved ? `, leaving <strong>${money(target - emergency.saved)}</strong> still to save` : ' — the target is met'}.`;
  };
  const updateDebt = () => {
    state.tools.balance = Math.max(0, Number(document.getElementById('tl-balance').value) || 0);
    state.tools.apr = Math.max(0, Number(document.getElementById('tl-apr').value) || 0);
    state.tools.payment = Math.max(0, Number(document.getElementById('tl-payment').value) || 0);
    const plan = debtPlan(state.tools.balance, state.tools.apr, state.tools.payment);
    debtOut.innerHTML = plan.warn
      ? `<span class="status-over">${esc(plan.warn)}</span>`
      : plan.months === 0
        ? 'Nothing owed — this debt is clear.'
        : `Paying ${money(state.tools.payment)} a month clears ${money(state.tools.balance)} in <strong>${plan.months} ${payoffDate(plan.months)}</strong>. Interest costs <strong>${money2(plan.interest)}</strong>; total repaid <strong>${money2(plan.total)}</strong>.`;
  };
  document.getElementById('tl-income').addEventListener('input', updateSplit);
  document.getElementById('tl-essentials').addEventListener('input', updateFund);
  document.getElementById('tl-fundmonths').addEventListener('change', updateFund);
  ['tl-balance', 'tl-apr', 'tl-payment'].forEach((id) => document.getElementById(id).addEventListener('input', updateDebt));
  document.getElementById('tl-debt').addEventListener('change', (e) => {
    const d = debts.find((x) => x.id === e.target.value);
    if (!d) return;
    state.tools.debtId = d.id;
    document.getElementById('tl-balance').value = d.balance;
    document.getElementById('tl-apr').value = d.apr;
    document.getElementById('tl-payment').value = d.payment;
    updateDebt();
  });
  updateSplit();
  updateFund();
  updateDebt();
}

function notFoundPage() {
  return `<section class="card"><h1>Page not found</h1><p>There is no page at this address. Start from the <a href="#/">overview</a>, or open the <a href="#/transactions">transactions</a>, <a href="#/budgets">budgets</a>, <a href="#/bills">bills</a>, <a href="#/goals">goals</a> or <a href="#/tools">tools</a>.</p></section>`;
}

const routes = {
  overview: { page: overviewPage, bind: () => bindMonthSwitcher('ov-month'), title: 'Overview' },
  transactions: { page: transactionsPage, bind: bindTransactions, title: 'Transactions' },
  budgets: { page: budgetsPage, bind: bindBudgets, title: 'Budgets' },
  bills: { page: billsPage, bind: bindBills, title: 'Bills' },
  goals: { page: goalsPage, bind: bindGoals, title: 'Goals' },
  tools: { page: toolsPage, bind: bindTools, title: 'Tools' },
};

function render() {
  window.__shotReady = false;
  const name = (location.hash.replace(/^#\/?/, '').split(/[/?]/)[0] || 'overview');
  const route = routes[name];
  document.querySelectorAll('[data-nav]').forEach((a) => a.classList.toggle('active', a.dataset.nav === name));
  if (route) {
    document.title = `${route.title} | Hearthledger`;
    app.innerHTML = route.page();
    route.bind();
  } else {
    document.title = 'Not found | Hearthledger';
    app.innerHTML = notFoundPage();
  }
  window.scrollTo(0, 0);
  window.__shotReady = true;
}

window.addEventListener('hashchange', render);
render();
