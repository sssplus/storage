/* ============================================================
   PodcastForge v2 — AI Stack Tracker
   Vanilla JS port of the React component, uses app.js callAI
   ============================================================ */

const TK_STORAGE_KEY = "ai-stack-subs-v1";
const EXCHANGE_RATE = 83; // 1 USD = 83 INR

const CATEGORIES = [
  "Chat assistant", "Coding", "Image / Video", "Search / Research",
  "Writing", "Audio / Voice", "Agents / Automation", "Other"
];

const CAT_COLORS = {
  "Chat assistant": "#2D5BFF", Coding: "#0B7A63", "Image / Video": "#9B3DD1",
  "Search / Research": "#C77800", Writing: "#D13D6B", "Audio / Voice": "#0E8FA8",
  "Agents / Automation": "#6B4FE0", Other: "#5A6B7E"
};

const PRESETS = [
  { name: "ChatGPT Plus", category: "Chat assistant", price: 20, cycle: "monthly" },
  { name: "Claude Pro", category: "Chat assistant", price: 20, cycle: "monthly" },
  { name: "Cursor Pro", category: "Coding", price: 20, cycle: "monthly" },
  { name: "GitHub Copilot", category: "Coding", price: 10, cycle: "monthly" },
  { name: "Perplexity Pro", category: "Search / Research", price: 20, cycle: "monthly" },
  { name: "Midjourney", category: "Image / Video", price: 10, cycle: "monthly" },
  { name: "ElevenLabs", category: "Audio / Voice", price: 5, cycle: "monthly" },
  { name: "Notion AI", category: "Writing", price: 10, cycle: "monthly" }
];

let tkState = {
  subs: [],
  audit: null,
  auditing: false,
  auditError: ""
};

let tkUid = 0;
const newTkId = () => `${Date.now()}-${tkUid++}`;

function getCurrency() {
  return localStorage.getItem('pf_currency') === 'INR' ? '₹' : '$';
}

function getDisplayPrice(sub) {
  const displayCur = getCurrency() === '₹' ? 'INR' : 'USD';
  const subCur = sub.currency || 'USD'; // default to USD for legacy saved subs
  if (displayCur === subCur) return sub.price;
  if (displayCur === 'INR' && subCur === 'USD') return sub.price * EXCHANGE_RATE;
  if (displayCur === 'USD' && subCur === 'INR') return sub.price / EXCHANGE_RATE;
  return sub.price;
}

const tkMonthly = (s) => {
  const p = getDisplayPrice(s);
  return s.cycle === "annual" ? p / 12 : p;
};

const tkFmt = (n) => `${getCurrency()}${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const daysUntil = (dateStr) => {
  if (!dateStr) return null;
  const d = new Date(dateStr + "T00:00:00");
  if (isNaN(d)) return null;
  return Math.ceil((d - new Date()) / 86400000);
};

// Load
function tkInit() {
  try {
    const raw = localStorage.getItem(TK_STORAGE_KEY);
    if (raw) {
      const data = JSON.parse(raw);
      tkState.subs = Array.isArray(data.subs) ? data.subs : [];
    }
  } catch (e) { console.error(e); }
  
  tkRender();
  
  // Listen for currency change from main app
  window.addEventListener('currency-changed', tkRender);
}

// Save
function tkSave() {
  localStorage.setItem(TK_STORAGE_KEY, JSON.stringify({ subs: tkState.subs }));
  tkRender();
}

// Mutations
function tkAddPreset(idx) {
  const p = PRESETS[idx];
  if (tkState.subs.some(s => s.name === p.name)) return; // already added
  tkState.subs.push({ ...p, renewal: null, id: newTkId(), currency: 'USD' });
  tkState.audit = null;
  tkSave();
}

function tkAddCustom() {
  const name = document.getElementById('tk-in-name').value.trim();
  const cat = document.getElementById('tk-in-cat').value;
  const price = parseFloat(document.getElementById('tk-in-price').value);
  const cycle = document.getElementById('tk-in-cycle').value;
  const renewal = document.getElementById('tk-in-renew').value;

  if (!name || isNaN(price) || price <= 0) return;

  const cur = getCurrency() === '₹' ? 'INR' : 'USD';
  tkState.subs.push({ name, category: cat, price, cycle, renewal: renewal || null, id: newTkId(), currency: cur });
  tkState.audit = null;
  tkSave();
}

function tkRemove(id) {
  tkState.subs = tkState.subs.filter(s => s.id !== id);
  tkState.audit = null;
  tkSave();
}

// AI Audit
async function tkRunAudit() {
  if (!window.app || !localStorage.getItem('pf_api_key')) {
    tkState.auditError = "Please enter your API key in the main app above to run an audit.";
    tkRender();
    return;
  }
  
  tkState.auditing = true;
  tkState.auditError = "";
  tkState.audit = null;
  tkRender();

  const stack = tkState.subs.map((s) => ({
    name: s.name,
    category: s.category,
    monthlyCost: +tkMonthly(s).toFixed(2),
  }));

  const sysPrompt = "You are an expert at auditing AI tool subscriptions for waste and overlap. Respond with ONLY a JSON object, no markdown fences.";
  const userPrompt = `Here is a user's stack (costs in ${getCurrency()}/mo): ${JSON.stringify(stack)}. 
Shape required: {"summary": "two-sentence overall assessment", "estimatedMonthlySavings": <number>, "verdicts": [{"name": "<tool name>", "verdict": "keep" | "cut" | "consolidate", "reason": "<one concise sentence>"}]}. 
Be specific about functional overlap between the actual tools listed. One verdict per tool.`;

  try {
    const res = await window.app.callAI(sysPrompt, userPrompt);
    const clean = res.replace(/```json|```/g, "").trim();
    tkState.audit = JSON.parse(clean);
  } catch (e) {
    tkState.auditError = "Audit failed: " + e.message;
  } finally {
    tkState.auditing = false;
    tkRender();
  }
}

// Render
function tkRender() {
  const container = document.getElementById('tracker-container');
  if (!container) return; // Not on page

  const { subs, audit, auditing, auditError } = tkState;
  const c = getCurrency();

  const monthlyTotal = subs.reduce((a, s) => a + tkMonthly(s), 0);
  const annualTotal = monthlyTotal * 12;

  const byCategory = {};
  subs.forEach((s) => {
    byCategory[s.category] = byCategory[s.category] || { total: 0, items: [] };
    byCategory[s.category].total += tkMonthly(s);
    byCategory[s.category].items.push(s);
  });

  const overlaps = Object.entries(byCategory).filter(([, v]) => v.items.length >= 2);
  const overlapSpend = overlaps.reduce((a, [, v]) => a + v.total, 0);

  const upcoming = subs
    .map((s) => ({ ...s, days: daysUntil(s.renewal) }))
    .filter((s) => s.days !== null && s.days >= 0 && s.days <= 7)
    .sort((a, b) => a.days - b.days);

  let html = ``;

  // 1. Burn Meter
  html += `
    <div class="tk-card tk-burn-card">
      <div class="tk-burn-header">
        <div>
          <div class="tk-label">MONTHLY BURN</div>
          <div class="tk-burn-total">${tkFmt(monthlyTotal)}<span class="tk-burn-mo">/mo</span></div>
        </div>
        <div class="tk-burn-right">
          <div class="tk-label">ANNUALISED</div>
          <div class="tk-annualised">${tkFmt(annualTotal)}</div>
          <div class="${overlapSpend > 0 ? 'tk-overlap-warn' : 'tk-overlap-ok'}">
            ${overlapSpend > 0 ? `${tkFmt(overlapSpend)}/mo in overlapping categories` : (subs.length > 0 ? 'no category overlap' : '')}
          </div>
        </div>
      </div>
  `;

  if (monthlyTotal > 0) {
    html += `<div class="tk-bar-wrap"><div class="tk-bar">`;
    Object.entries(byCategory).forEach(([cat, v]) => {
      const pct = (v.total / monthlyTotal) * 100;
      html += `<div class="tk-bar-seg" title="${cat}: ${tkFmt(v.total)}/mo" style="width:${pct}%; background:${CAT_COLORS[cat]}"></div>`;
    });
    html += `</div></div><div class="tk-legend">`;
    Object.entries(byCategory).forEach(([cat, v]) => {
      html += `<span class="tk-legend-item"><span class="tk-legend-dot" style="background:${CAT_COLORS[cat]}"></span> ${cat} · ${tkFmt(v.total)}</span>`;
    });
    html += `</div>`;
  } else {
    html += `<div class="tk-empty-hint">Your meter is empty. Add the tools you pay for below.</div>`;
  }
  html += `</div>`; // end burn card

  // 2. Upcoming Renewals
  if (upcoming.length > 0) {
    html += `<div class="tk-card tk-renewal-card"><div class="tk-label">RENEWING WITHIN 7 DAYS</div>`;
    upcoming.forEach(s => {
      html += `<div class="tk-renewal-row"><span class="tk-renewal-name">${s.name}</span><span class="tk-renewal-amt">${tkFmt(getDisplayPrice(s))} in ${s.days === 0 ? 'today' : s.days + 'd'}</span></div>`;
    });
    html += `</div>`;
  }

  // 3. Presets
  html += `
    <div class="tk-presets-section">
      <div class="tk-label">ONE-TAP ADD</div>
      <div class="tk-presets">
  `;
  PRESETS.forEach((p, idx) => {
    const added = subs.some(s => s.name === p.name);
    const displayPrice = getDisplayPrice({ price: p.price, currency: 'USD' });
    html += `<button class="tk-preset-btn ${added ? 'added' : ''}" ${added ? 'disabled' : ''} onclick="tkAddPreset(${idx})">
      ${added ? '✓ ' : '+ '}${p.name} <span class="tk-preset-price">${c}${displayPrice}</span>
    </button>`;
  });
  html += `</div></div>`;

  // 4. Custom Form
  html += `
    <div class="tk-card tk-form-card">
      <div class="tk-label">ADD A SUBSCRIPTION</div>
      <div class="tk-form-grid">
        <input class="tk-input" id="tk-in-name" placeholder="Tool name">
        <select class="tk-input" id="tk-in-cat">
          ${CATEGORIES.map(cat => `<option value="${cat}">${cat}</option>`).join('')}
        </select>
        <input class="tk-input" id="tk-in-price" type="number" min="0" step="0.01" placeholder="Price (${c})">
        <select class="tk-input" id="tk-in-cycle">
          <option value="monthly">Billed monthly</option>
          <option value="annual">Billed annually</option>
        </select>
        <input class="tk-input" id="tk-in-renew" type="date" title="Renewal Date">
        <button class="tk-add-btn" onclick="tkAddCustom()">Add to stack</button>
      </div>
    </div>
  `;

  // 5. The Stack List
  if (subs.length > 0) {
    html += `<div class="tk-sub-section"><div class="tk-label">YOUR STACK · ${subs.length} ${subs.length === 1 ? 'tool' : 'tools'}</div><div class="tk-sub-list">`;
    subs.forEach(s => {
      const dup = byCategory[s.category].items.length >= 2;
      html += `
        <div class="tk-sub-row" style="border-left-color: ${CAT_COLORS[s.category]}">
          <div class="tk-sub-info">
            <div class="tk-sub-name">${s.name} ${dup ? `<span class="tk-overlap-tag">OVERLAP</span>` : ''}</div>
            <div class="tk-sub-meta">${s.category} · ${s.cycle} billing ${s.renewal ? '· renews ' + s.renewal : ''}</div>
          </div>
          <div class="tk-sub-price">${tkFmt(tkMonthly(s))}<span class="tk-sub-mo">/mo</span></div>
          <button class="tk-remove-btn" onclick="tkRemove('${s.id}')">✕</button>
        </div>
      `;
    });
    html += `</div></div>`;
  }

  // 6. AI Audit
  if (subs.length >= 2) {
    html += `
      <div class="tk-card tk-audit-card">
        <div class="tk-audit-header">
          <div>
            <div class="tk-label">AI AUDIT</div>
            <div class="tk-audit-desc">Claude/Gemini reviews your stack for functional overlap and tells you what to keep, cut, or consolidate. Uses your main app API key.</div>
          </div>
          <button class="tk-audit-btn ${auditing ? 'loading' : ''}" onclick="tkRunAudit()" ${auditing ? 'disabled' : ''}>
            ${auditing ? 'Auditing...' : 'Audit my stack'}
          </button>
        </div>
    `;

    if (auditError) html += `<div class="tk-audit-error">${auditError}</div>`;
    
    if (audit) {
      html += `
        <div class="tk-audit-results">
          <div class="tk-audit-summary">${audit.summary}</div>
          ${audit.estimatedMonthlySavings > 0 ? `<div class="tk-audit-savings">Potential savings: ${tkFmt(audit.estimatedMonthlySavings)}/mo</div>` : ''}
          <div class="tk-verdicts">
      `;
      (audit.verdicts || []).forEach(v => {
        const cls = v.verdict === 'keep' ? 'tk-verdict-keep' : (v.verdict === 'cut' ? 'tk-verdict-cut' : 'tk-verdict-consolidate');
        html += `
          <div class="tk-verdict-row">
            <span class="tk-verdict-tag ${cls}">${v.verdict}</span>
            <span class="tk-verdict-text"><strong>${v.name}</strong> — ${v.reason}</span>
          </div>
        `;
      });
      html += `</div></div>`;
    }
    html += `</div>`;
  }

  html += `<div class="tk-footer">Data is saved automatically on this device · ${subs.length} tracked</div>`;

  // Preserve the lock overlay if it exists
  const lockHTML = document.getElementById('tracker-lock')?.outerHTML || '';
  container.innerHTML = html + lockHTML;
}

// Expose mutations to global for inline handlers
window.tkAddPreset = tkAddPreset;
window.tkAddCustom = tkAddCustom;
window.tkRemove = tkRemove;
window.tkRunAudit = tkRunAudit;

// Boot
tkInit();
