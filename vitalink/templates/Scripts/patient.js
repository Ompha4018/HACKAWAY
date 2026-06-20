// patient.js — patient page logic
// `pid` is provided by an inline <script> in patient.html (rendered server-side),
// since this file is served as a static asset and Jinja templates are never
// evaluated inside static files.

function renderIcons() {
  if (window.lucide && typeof lucide.createIcons === 'function') {
    lucide.createIcons();
  }
}

function drsColor(drs) {
  if (drs >= 75) return '#C0392B';
  if (drs >= 65) return '#C07F2A';
  if (drs >= 40) return '#7A8B1A';
  return '#1A7A4A';
}

function avatarColor(cond) {
  const m = {'HIV':'#8B1A1A','TB':'#7A4A00','HIV/TB':'#4A1A8B','Diabetes':'#1A3A8B','Hypertension':'#1A5A3A','HIV/Diabetes':'#8B1A5A'};
  return m[cond] || '#1A7A4A';
}

function initials(name) {
  return name.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase();
}

function statusClass(s){ return `status-${s}`; }
function trendClass(t){ return `trend-${t}`; }

function riskFactor(label, value, max, color) {
  const pct = Math.min(Math.round((value/max)*100), 100);
  return `
    <div style="margin-bottom:12px">
      <div style="display:flex;justify-content:space-between;margin-bottom:4px">
        <span style="font-size:12px;font-weight:600">${label}</span>
        <span style="font-size:12px;font-family:'DM Mono',monospace;color:${color};font-weight:700">${value}</span>
      </div>
      <div style="height:6px;background:#EEF2EE;border-radius:3px;overflow:hidden">
        <div style="height:100%;width:${pct}%;background:${color};border-radius:3px;transition:width .5s"></div>
      </div>
    </div>`;
}

async function load() {
  try {
    const r = await fetch(`/api/patient/${pid}`);
    const d = await r.json();
    if (d.error) { 
      document.getElementById('content').innerHTML = '<div class="loading">Patient not found.</div>'; 
      return; 
    }

    const p = d.patient;
    const color = drsColor(p.drs);
    const bgColor = avatarColor(p.condition);

    document.title = `VitaLink — ${p.name}`;
    document.getElementById('breadcrumb').textContent = p.name;

    const riskColors = {CRITICAL:'#FEF0EE;color:#C0392B',HIGH:'#FDF4E3;color:#C07F2A',MEDIUM:'#FFF8E1;color:#8B6914',LOW:'#E8F5EE;color:#0F5233'};
    const rc = riskColors[p.risk_band] || riskColors.LOW;

    const appts = d.appointments.map(a => `
      <div class="appt-item">
        <div class="appt-dot ${a.status}"></div>
        <div class="appt-info">
          <div class="appt-type">${a.type}</div>
          <div class="appt-date">${a.date} · ${a.clinic}</div>
        </div>
        <span class="${statusClass(a.status)} appt-status">${a.status.toUpperCase()}</span>
      </div>`).join('');

    const meds = d.medications.map(m => `
      <div class="med-item">
        <div class="med-name"><i data-lucide="pill"></i> ${m.medication}</div>
        <div class="med-dose">${m.dosage}</div>
        <div class="med-collect">
          <i data-lucide="calendar"></i> Collection: <strong>${m.collection_date}</strong> · 
          <span class="med-status-tag" style="color:${m.status==='ready'?'var(--green)':'var(--gold)'}">
            <i data-lucide="${m.status==='ready' ? 'check-circle-2' : 'clock-3'}"></i>
            ${m.status === 'ready' ? 'Ready' : 'Pending'}
          </span>
        </div>
        <div class="qr-code"><i data-lucide="qr-code"></i> QR: ${m.qr_code}</div>
      </div>`).join('');

    const labs = d.labs.map(l => `
      <div class="lab-item">
        <div>
          <div class="lab-name">${l.test_type}</div>
          <div class="lab-date">${l.date}</div>
        </div>
        <div style="text-align:right">
          <div class="lab-result">${l.result}</div>
          <div class="${trendClass(l.trend)} lab-trend">${l.trend}</div>
        </div>
      </div>`).join('');

    // Native custom inline SVG path asset vector for presentation layout harmony
    const waBtn = p.whatsapp_sent
      ? `<button class="btn btn-alert sent" disabled>✓ Sent</button>`
      : `<button class="btn btn-alert" id="wa-btn" onclick="sendWA()">
          <svg class="wa-icon" viewBox="0 0 448 512" xmlns="http://www.w3.org/2000/svg"><path d="M380.9 97.1C339 55.1 283.2 32 223.9 32c-122.4 0-222 99.6-222 222 0 39.1 10.2 77.3 29.6 111L0 480l117.7-30.9c32.4 17.7 68.9 27 106.1 27h.1c122.3 0 224.1-99.6 224.1-222 0-59.3-25.2-115-67.1-157zm-157 341.6c-33.2 0-65.7-8.9-94-25.7l-6.7-4-69.8 18.3L72 359.2l-4.4-7c-18.5-29.4-28.2-63.3-28.2-98.2 0-101.7 82.8-184.5 184.6-184.5 49.3 0 95.6 19.2 130.4 54.1 34.8 34.9 56.2 81.2 56.1 130.5 0 101.8-84.9 184.6-186.6 184.6zm101.2-138.2c-5.5-2.8-32.8-16.2-37.9-18-5.1-1.9-8.8-2.8-12.5 2.8-3.7 5.6-14.3 18-17.6 21.8-3.2 3.7-6.5 4.2-12 1.4-32.6-16.3-54-29.1-75.5-66-5.7-9.8 5.7-9.1 16.3-30.3 1.8-3.7 .9-6.9-.5-9.7-1.4-2.8-12.5-30.1-17.1-41.2-4.5-10.8-9.1-9.3-12.5-9.5-3.2-.2-6.9-.2-10.6-.2-3.7 0-9.7 1.4-14.8 6.9-5.1 5.6-19.4 19-19.4 46.3 0 27.3 19.9 53.7 22.6 57.4 2.8 3.7 39.1 59.7 94.8 83.8 35.2 15.2 49 16.5 66.6 13.9 10.7-1.6 32.8-13.4 37.4-26.4 4.6-13 4.6-24.1 3.2-26.4-1.3-2.5-5-3.9-10.5-6.6z"/></svg>
          <span>Send Alert</span>
         </button>`;

    document.getElementById('content').innerHTML = `
      <div class="patient-header">
        <div class="patient-avatar" style="background:${bgColor}">${initials(p.name)}</div>
        <div class="patient-info">
          <h2>${p.name}</h2>
          <div class="pid">VTL-${String(p.id).padStart(4,'0')} · Enrolled ${p.enrolled_date}</div>
          <div class="patient-meta">
            <span class="meta-tag"><i data-lucide="user"></i><strong>${p.age} yrs · ${p.gender}</strong></span>
            <span class="meta-tag"><i data-lucide="building-2"></i><strong>${p.clinic}</strong></span>
            <span class="meta-tag"><i data-lucide="map-pin"></i><strong>${p.area}</strong></span>
            <span class="meta-tag"><i data-lucide="globe"></i><strong>${p.language}</strong></span>
            <span class="meta-tag"><i data-lucide="phone"></i><strong>${p.phone}</strong></span>
            <span class="meta-tag"><i data-lucide="user-check"></i>CHW: <strong>${p.chw_name}</strong></span>
          </div>
        </div>
        <div class="drs-panel">
          <div class="drs-label">Default Risk Score</div>
          <div class="drs-circle" style="border-color:${color}; color:${color}">
            <div class="drs-number">${p.drs}</div>
            <div class="drs-max">/100</div>
          </div>
          <span class="risk-chip" style="background:${rc.split(';')[0].split(':')[1]};color:${rc.split(';')[1].split(':')[1]}">${p.risk_band}</span>
        </div>
      </div>

      <div class="grid-3">
        <div class="card">
          <div class="card-head">
            <span class="card-title"><i data-lucide="calendar-days"></i>Appointments</span>
            <span style="font-size:11px;color:var(--muted)">${d.appointments.length} records</span>
          </div>
          <div class="card-body">${appts || '<p style="color:var(--muted);font-size:13px">No appointments recorded.</p>'}</div>
        </div>
        <div class="card">
          <div class="card-head">
            <span class="card-title"><i data-lucide="pill"></i>Medications</span>
          </div>
          <div class="card-body">${meds || '<p style="color:var(--muted);font-size:13px">No medications recorded.</p>'}</div>
        </div>
        <div class="card">
          <div class="card-head">
            <span class="card-title"><i data-lucide="activity"></i>Lab Results</span>
            <span style="font-size:11px;color:var(--muted)">${d.labs.length} results</span>
          </div>
          <div class="card-body">${labs || '<p style="color:var(--muted);font-size:13px">No lab results available.</p>'}</div>
        </div>
      </div>

      <div class="grid-2">
        <div class="card">
          <div class="card-head">
            <span class="card-title"><i data-lucide="triangle-alert"></i>Risk Factors</span>
          </div>
          <div class="card-body">
            ${riskFactor('Missed Appointments', p.missed_appts, 5, '#C0392B')}
            ${riskFactor('Medication Pickup Gaps', p.med_pickup_gaps, 4, '#C07F2A')}
            ${riskFactor('Lab Trend (Worsening)', Math.round(p.lab_trend*100), 100, '#8B4A00')}
            ${riskFactor('Days Since CHW Contact', p.chw_days, 90, '#1A3A8B')}
            ${riskFactor('Socioeconomic Flags', p.socio_flags, 3, '#4A1A8B')}
            ${riskFactor('Days Since Last Visit', p.visit_days, 60, '#1A5A3A')}
          </div>
        </div>
        <div class="card">
          <div class="card-head">
            <span class="card-title"><i data-lucide="file-text"></i>Clinical Notes</span>
          </div>
          <div class="card-body">
            <div class="notes-box">${p.notes}</div>
            <div style="margin-top:16px">
              <div style="font-size:11px;color:var(--muted);margin-bottom:8px">INTERVENTION STATUS</div>
              <div style="font-size:13px">Last visit: <strong>${p.last_visit}</strong></div>
              <div style="font-size:13px;margin-top:4px">Assigned CHW: <strong>${p.chw_name}</strong></div>
            </div>
          </div>
        </div>
      </div>

      <div class="action-row">
        ${waBtn}
        <button class="btn btn-secondary" onclick="window.location.href='/chw'"><i data-lucide="map-pin"></i><span>Assign</span></button>
        <button class="btn btn-secondary" onclick="window.location.href='/pharmacy'"><i data-lucide="pill"></i><span>Dispense</span></button>
        <button class="btn" style="background:var(--teal);color:#fff" id="intervene-btn" onclick="simulateIntervention()"><i data-lucide="activity"></i><span>Ready</span></button>
        <button class="btn btn-secondary" onclick="window.print()"><i data-lucide="printer"></i><span>Print</span></button>
      </div>
    `;
    
    renderIcons();
  } catch(err) {
    console.error("Critical rendering pipeline issue:", err);
    document.getElementById('content').innerHTML = '<div class="loading">Error loading profile data matrix.</div>';
  }
}

async function simulateIntervention(){
  const btn = document.getElementById('intervene-btn');
  btn.innerHTML = `<i data-lucide="refresh-cw" class="spin"></i><span>Running...</span>`;
  renderIcons();
  btn.disabled = true;
  try {
    const r = await fetch('/api/simulate_intervention/'+pid, {method:'POST'});
    const d = await r.json();
    if(d.success){
      const banner = document.createElement('div');
      banner.style.cssText = 'background:#0F5233;color:#fff;padding:16px 24px;border-radius:10px;margin-bottom:20px;';
      banner.innerHTML = '<strong>Intervention Outcome</strong><br>' + d.message +
        '<br><small style="opacity:.7">DRS: ' + d.old_drs + ' → ' + d.new_drs +
        ' | Band: ' + d.old_band + ' → ' + d.new_band + '</small>';
      document.querySelector('.content').insertBefore(banner, document.querySelector('.patient-header'));
      btn.innerHTML = '<span>✓ Saved</span>';
      btn.style.background='var(--green)';
      setTimeout(()=>load(), 1200);
    }
  } catch(e) {
    btn.disabled = false;
    btn.innerHTML = '<span>Ready</span>';
  }
}

async function sendWA() {
  const btn = document.getElementById('wa-btn');
  btn.innerHTML = '<span>Sending...</span>';
  btn.disabled = true;
  try {
    await fetch(`/api/send_whatsapp/${pid}`, {method:'POST'});
    btn.className = 'btn btn-alert sent';
    btn.innerHTML = '<span>✓ Sent</span>';
  } catch(e) {
    btn.disabled = false;
    btn.innerHTML = '<span>Send Alert</span>';
  }
}

load();