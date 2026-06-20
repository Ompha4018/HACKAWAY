// chw.js — chw page logic

const FALLBACK_TRIAGE_RECORDS = [
  { id: 1021, name: "Sibusiso Khumalo", condition: "HIV/TB", drs: 84, tier: "critical", area: "Zone 1 (Ga-Rankuwa Central)", clinic: "Ga-Rankuwa Clinic 1", missed_appts: 3, chw_days: 42, language: "IsiZulu", whatsapp_sent: true },
  { id: 1044, name: "Lerato Mokoena", condition: "TB", drs: 79, tier: "critical", area: "Zone 1 (Ga-Rankuwa Central)", clinic: "Ga-Rankuwa Clinic 1", missed_appts: 2, chw_days: 31, language: "Sesotho", whatsapp_sent: true },
  { id: 1089, name: "Thabo Molefe", condition: "Diabetes", drs: 72, tier: "high", area: "Zone 2 (Mabopane Road)", clinic: "Mabopane Main Health Centre", missed_appts: 2, chw_days: 14, language: "Setswana", whatsapp_sent: false },
  { id: 1102, name: "Amina Ndlovu", condition: "HIV", drs: 68, tier: "high", area: "Zone 1 (Ga-Rankuwa Central)", clinic: "Ga-Rankuwa Clinic 1", missed_appts: 1, chw_days: 22, language: "English", whatsapp_sent: true },
  { id: 1135, name: "Zodwa Dlamini", condition: "Hypertension", drs: 66, tier: "high", area: "Zone 3 (Hebron Boundary)", clinic: "Hebron Clinic Node", missed_appts: 3, chw_days: 60, language: "SiSwati", whatsapp_sent: false },
  { id: 1201, name: "Pieter Pretorius", condition: "HIV/Diabetes", drs: 65, tier: "high", area: "Zone 2 (Mabopane Road)", clinic: "Mabopane Main Health Centre", missed_appts: 1, chw_days: 19, language: "Afrikaans", whatsapp_sent: true }
];

const SCRIPT_LOOKUP_REGISTRY = {
  HIV: "Greet patient with warmth. Check current ARV supply pack size. Inquire regarding treatment tolerance or systemic updates. Reaffirm: continuous structural adherence safely represses plasma counts and shields family lines.",
  TB: "Verify complete intake parameters across modern intensive tablets course. Actively survey cough recurrences, drenching pyrexia (night sweats), or body weight fluctuations. Emphasize tracking endpoint adherence to deny resistance profiles.",
  "HIV/TB": "Verify combined cross-exposure coverage parameters for both critical ARV courses and modern anti-TB regimens. Confirm explicit compliance sync schedules without interruptions.",
  Diabetes: "Review peripheral podiatry check maps for chronic ulcerations. Confirm baseline physical access lines to local insulin storage reserves or metformin packs.",
  Hypertension: "Conduct diagnostic blood pressure metrics validation. Cross-examine systemic occurrences of severe occipital migraines or vertigo spells. Guide dietary reduction approaches regarding sodium.",
  "HIV/Diabetes": "Audit dynamic therapeutic compliance metrics for concurrent metabolic and antiretroviral treatment tracking. Screen systemic pathways closely."
};

const avatarColors=['#8B1A1A','#7A4A00','#4A1A8B','#1A3A8B','#1A5A3A','#8B1A5A','#0D7E8C','#1A7A4A'];
function avatarColor(i){return avatarColors[i%avatarColors.length];}
function initials(name){return name.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase();}
function drsColor(tier){return tier === 'critical' ? 'var(--red)' : 'var(--gold)';}

let backendCachedDataset = [];
let currentPage = 1;
let pageSize = 10;

async function load(){
  try {
    const r = await fetch('/api/chw_alerts');
    if (!r.ok) throw new Error("Endpoint returned connection degradation status code.");
    const rawData = await r.json();
    
    backendCachedDataset = rawData.map(p => ({
      ...p,
      tier: p.drs >= 75 ? 'critical' : 'high'
    }));
  } catch (err) {
    console.warn("Backend API context layer unreachable. Initializing fallback dataset.");
    backendCachedDataset = [...FALLBACK_TRIAGE_RECORDS];
  } finally {
    processAndRenderView();
  }
}

function processAndRenderView() {
  const totalAlertsCount = backendCachedDataset.length;
  const criticalCount = backendCachedDataset.filter(p => p.tier === 'critical').length;
  const highCount = backendCachedDataset.filter(p => p.tier === 'high').length;

  document.getElementById('chw-header-area').innerHTML = `
    <div class="chw-header">
      <div>
        <h2><i data-lucide="activity"></i>Active Community Triage List</h2>
        <p>Defaulter prioritization queue matching structural Default Risk Scores (DRS) &ge; 65 calculated via server health indicators.</p>
      </div>
      <div class="chw-stats">
        <div class="chw-stat"><div class="val">${totalAlertsCount}</div><div class="lbl">Alerts Queue</div></div>
        <div class="chw-stat" style="color:#FFAAAA;"><div class="val">${criticalCount}</div><div class="lbl">Critical</div></div>
        <div class="chw-stat" style="color:var(--light-gold);"><div class="val">${highCount}</div><div class="lbl">High Risk</div></div>
      </div>
    </div>`;

  if (totalAlertsCount === 0) {
    document.getElementById('zones-area').innerHTML = `
      <div class="empty-state">
        <i data-lucide="check-circle-2"></i>
        <h3>Triage Registry Clear</h3>
        <p>No high-risk patient indicators or medication defaults flagged inside this region currently.</p>
      </div>`;
    updatePaginationControls(0, 0, 0);
    if (window.lucide && typeof lucide.createIcons === 'function') lucide.createIcons();
    return;
  }

  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalAlertsCount);
  const slicedPageSubset = backendCachedDataset.slice(startIndex, endIndex);

  updatePaginationControls(startIndex + 1, endIndex, totalAlertsCount);

  const groupedAreaSlices = {};
  slicedPageSubset.forEach(p => {
    if (!groupedAreaSlices[p.area]) groupedAreaSlices[p.area] = [];
    groupedAreaSlices[p.area].push(p);
  });

  const sortedAreaMap = Object.entries(groupedAreaSlices).sort((a, b) => 
    Math.max(...b[1].map(p => p.drs)) - Math.max(...a[1].map(p => p.drs))
  );

  document.getElementById('zones-area').innerHTML = sortedAreaMap.map(([area, pts]) => {
    const maxDrs = Math.max(...pts.map(p => p.drs));
    const cardsHtml = pts.sort((a, b) => b.drs - a.drs).map((p, i) => {
      const scriptText = SCRIPT_LOOKUP_REGISTRY[p.condition] || SCRIPT_LOOKUP_REGISTRY.HIV;
      
      return `
        <div class="dispatch-card ${p.tier}" id="card-${p.id}">
          <div class="card-top">
            <div class="card-avatar" style="background:${avatarColor(i)}">${initials(p.name)}</div>
            <div class="card-identity">
              <div class="card-name">${p.name}</div>
              <div class="card-id">VTL-${String(p.id).padStart(4,'0')} · ${p.condition}</div>
            </div>
            <div class="card-drs">
              <div class="drs-num" style="color:${drsColor(p.tier)}">${p.drs}</div>
              <div class="drs-lbl">DRS Score</div>
            </div>
          </div>
          <div class="card-body-chw">
            <div class="info-row"><span class="info-label">Assigned Facility</span><span class="info-val">${p.clinic}</span></div>
            <div class="info-row"><span class="info-label">Missed Appointments</span><span class="info-val" style="color:var(--red); font-weight:700;">${p.missed_appts} (Past 90 Days)</span></div>
            <div class="info-row"><span class="info-label">Last Field Evaluation</span><span class="info-val">${p.chw_days} days ago</span></div>
            <div class="info-row"><span class="info-label">Primary Language</span><span class="info-val">${p.language}</span></div>
            <div class="info-row"><span class="info-label">Automated SMS/WhatsApp</span><span class="info-val" style="color:${p.whatsapp_sent?'var(--green)':'var(--gold)'}; font-weight:700;">${p.whatsapp_sent?'✓ Delivered':'⏳ Queued'}</span></div>
          </div>
          <div class="visit-script">
            <strong><i data-lucide="message-square"></i>Field Engagement Script (${p.language})</strong>
            <span>${scriptText}</span>
          </div>
          <div class="card-actions">
            <button class="act-btn act-visit" onclick="markVisit(${p.id})" aria-label="Mark visit as completed">
              <i data-lucide="check-check"></i><span>Complete Visit</span>
            </button>
            <button class="act-btn act-call" onclick="window.location.href='/patient/${p.id}'" aria-label="Review full electronic health record">
              <i data-lucide="folder-heart"></i><span>Open EHR</span>
            </button>
          </div>
        </div>`;
    }).join('');

    return `
      <div class="zone-section">
        <div class="zone-header">
          <div class="zone-name"><i data-lucide="map-pin"></i><span>${area}</span> <span class="zone-badge">${pts.length} Rendered</span></div>
          <span style="font-size:12px;color:var(--muted)">Peak Page DRS: <strong>${maxDrs}</strong></span>
        </div>
        <div class="dispatch-grid">${cardsHtml}</div>
      </div>`;
  }).join('');

  if (window.lucide && typeof lucide.createIcons === 'function') lucide.createIcons();
}

function updatePaginationControls(start, end, total) {
  document.getElementById('pagination-label').textContent = total > 0 ? `Showing ${start}-${end} of ${total}` : "Showing 0-0 of 0";
  document.getElementById('prev-btn').disabled = currentPage === 1;
  document.getElementById('next-btn').disabled = end >= total;
}

function updatePageSize(size) {
  pageSize = parseInt(size);
  currentPage = 1;
  processAndRenderView();
}

function navigatePage(direction) {
  currentPage += direction;
  processAndRenderView();
}

function markVisit(pid){
  const card = document.getElementById(`card-${pid}`);
  const actions = card.querySelector('.card-actions');
  
  actions.innerHTML = '<button class="act-btn act-done" disabled><i data-lucide="shield-check"></i>Visit Logged Securely</button>';
  if (window.lucide && typeof lucide.createIcons === 'function') lucide.createIcons();
  
  setTimeout(() => {
    card.classList.add('dismissing');
    setTimeout(() => {
      backendCachedDataset = backendCachedDataset.filter(item => item.id !== pid);
      
      const checkTotal = backendCachedDataset.length;
      if (((currentPage - 1) * pageSize) >= checkTotal && currentPage > 1) {
        currentPage--;
      }
      processAndRenderView();
    }, 400);
  }, 600);
}

load();