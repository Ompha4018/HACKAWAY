// index.js — Patient Registry page logic

let allPatients = [];
let activeFilter = 'all';

document.getElementById('today-date').textContent =
  new Date().toLocaleDateString('en-ZA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

function drsColor(d) {
  return d >= 75 ? '#C0392B' : d >= 65 ? '#C07F2A' : d >= 40 ? '#7A8B1A' : '#1A7A4A';
}

function condClass(c) {
  const m = {
    'HIV': 'cHIV', 'TB': 'cTB', 'HIV/TB': 'cHIVTB',
    'Diabetes': 'cDiabetes', 'Hypertension': 'cHypertension', 'HIV/Diabetes': 'cHIVDiabetes'
  };
  return m[c] || 'cHIV';
}

async function loadStats() {
  try {
    const d = await fetch('/api/stats').then(r => r.json());
    document.getElementById('s-total').textContent   = d.total    || 0;
    document.getElementById('s-crit').textContent    = d.critical || 0;
    document.getElementById('s-high').textContent    = d.high     || 0;
    document.getElementById('s-alerted').textContent = d.alerted  || 0;
    document.getElementById('s-insulin').textContent = d.insulin_patients || '—';
    if (d.critical > 0) {
      document.getElementById('alert-banner').classList.add('show');
      document.getElementById('alert-text').textContent =
        `${d.critical} CRITICAL patient${d.critical > 1 ? 's' : ''} — DRS above 75`;
    }
  } catch (err) {
    console.error('Failed to sync structural dashboard statistics.', err);
  }
}

async function loadPatients() {
  try {
    allPatients = await fetch('/api/patients').then(r => r.json());
    renderTable(allPatients);
  } catch (err) {
    document.getElementById('table-body').innerHTML = '<div class="loading">Mesh connection network processing error.</div>';
  }
}

function renderTable(patients) {
  const f = activeFilter === 'all' ? patients : patients.filter(p => p.risk_band === activeFilter);
  const s = document.getElementById('search').value.toLowerCase();
  const final = s ? f.filter(p =>
    p.name.toLowerCase().includes(s) || p.condition.toLowerCase().includes(s) ||
    p.clinic.toLowerCase().includes(s) || p.area.toLowerCase().includes(s)
  ) : f;

  document.getElementById('table-count').textContent = `${final.length} patients`;

  if (!final.length) {
    document.getElementById('table-body').innerHTML = '<div class="loading">No records match parameters.</div>';
    return;
  }

  const rows = final.map(p => {
    const dc = drsColor(p.drs);
    const sc = drsColor(p.svs || 0);
    const waBtn = p.whatsapp_sent
      ? `<span class="action-btn btn-wa sent">✓ Sent</span>`
      : `<button class="action-btn btn-wa" onclick="sendWA(event,${p.id})"><i class="fa-brands fa-whatsapp"></i></button>`;

    return `<tr onclick="location.href='/patient/${p.id}'">
      <td><div class="patient-name">${p.name}</div><div class="patient-id">VTL-${String(p.id).padStart(4,'0')} · ${p.area}</div></td>
      <td><span class="cond-tag ${condClass(p.condition)}">${p.condition}</span></td>
      <td>
        <div class="dual-score">
          <div class="score-line"><span class="score-tag">DRS</span><div class="score-bar-wrap"><div class="score-bar" style="width:${p.drs}%;background:${dc}"></div></div><span class="score-num" style="color:${dc}">${p.drs}</span></div>
          <div class="score-line"><span class="score-tag">SVS</span><div class="score-bar-wrap"><div class="score-bar" style="width:${p.svs||0}%;background:${sc}"></div></div><span class="score-num" style="color:${sc}">${p.svs||0}</span></div>
        </div>
      </td>
      <td><span class="risk-badge r${p.risk_band}">${p.risk_band}</span></td>
      <td class="clinic-small">${p.clinic}</td>
      <td>
        <div class="actions-cell">
          ${waBtn}
          <a href="/patient/${p.id}" class="action-btn btn-view" onclick="event.stopPropagation()">View &rarr;</a>
        </div>
      </td>
    </tr>`;
  }).join('');

  document.getElementById('table-body').innerHTML = `
    <table>
      <thead>
        <tr><th>Patient</th><th>Condition</th><th>DRS / SVS Scores</th><th>Risk</th><th>Clinic</th><th>Actions</th></tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>`;

  setTimeout(() => { if (window.lucide) lucide.createIcons(); }, 20);
}

async function sendWA(e, pid) {
  e.stopPropagation();
  const btn = e.currentTarget;
  btn.textContent = '...'; btn.disabled = true;
  try {
    await fetch(`/api/send_whatsapp/${pid}`, { method: 'POST' });
    btn.outerHTML = `<span class="action-btn btn-wa sent">✓ Sent</span>`;
    const p = allPatients.find(x => x.id === pid);
    if (p) p.whatsapp_sent = 1;
  } catch (err) {
    btn.innerHTML = `<i class="fa-brands fa-whatsapp"></i>`;
    btn.disabled = false;
  }
}

async function loadActivity() {
  try {
    const data = await fetch('/api/activity').then(r => r.json());
    document.getElementById('act-count').textContent = data.length + ' events';
    if (!data.length) return;

    const icons   = { booking: 'calendar', fine: 'smile', mild: 'meh', severe: 'frown' };
    const classes = { booking: 'booking', fine: 'checkin-fine', mild: 'checkin-mild', severe: 'checkin-severe' };

    const html = data.map(a => {
      const typeKey = a.type === 'booking' ? 'booking' : (a.detail || 'fine');
      const ic      = `<i data-lucide="${a.type === 'booking' ? 'calendar' : (icons[a.detail] || 'activity')}"></i>`;
      const cls     = classes[typeKey] || 'checkin-fine';
      const detail  = a.type === 'booking'
        ? `Booked: ${a.extra || ''} on ${a.detail || ''}`
        : `Reported: ${a.detail} symptoms`;

      return `<div class="act-item">
        <div class="act-icon ${cls}">${ic}</div>
        <div class="act-info">
          <div class="act-name">${a.name || 'Unknown'}</div>
          <div class="act-detail">${detail}</div>
          <div class="act-time">${a.ts || ''} · ${a.clinic || ''}</div>
        </div>
      </div>`;
    }).join('');

    document.getElementById('activity-feed').innerHTML = html;
    setTimeout(() => { if (window.lucide) lucide.createIcons(); }, 20);
  } catch (err) {
    console.warn('Activity log synchronization error occurred.');
  }
}

// EVENT HANDLERS
document.querySelectorAll('.filter-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    activeFilter = btn.dataset.filter;
    renderTable(allPatients);
  });
});

document.getElementById('search').addEventListener('input', () => renderTable(allPatients));

// STARTUP
window.addEventListener('DOMContentLoaded', () => {
  loadStats();
  loadPatients();
  loadActivity();
  setInterval(loadActivity, 15000);
});
