// impact.js — impact page logic

// Instantiates Lucide structure mapping
function updateIcons() {
  if (window.lucide && typeof lucide.createIcons === 'function') {
    lucide.createIcons();
  }
}

document.getElementById('today-date').textContent = new Date().toLocaleDateString('en-ZA',{year:'numeric',month:'long',day:'numeric'});

function fmt(n) { return n >= 1000 ? n.toLocaleString('en-ZA') : n; }
function fmtZAR(n) {
  if (n >= 1000000) return 'R' + (n/1000000).toFixed(1) + 'M';
  if (n >= 1000)    return 'R' + (n/1000).toFixed(0) + 'K';
  return 'R' + n;
}

async function load() {
  // Built in fallback mockup data in case endpoint fails mid-hackathon
  let d = {
    retained: 4120, prevented: 940, chw_visits: 2341,
    cost_savings_zar: 1450000, lives_impacted: 15400, drs_accuracy: 94.2,
    trend_months: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
    trend_retained: [210, 280, 340, 410, 490, 580],
    trend_prevented: [60, 95, 140, 190, 240, 310],
    adherence: { 'Hypertension Care': 82, 'HIV Care (ART)': 74, 'Diabetes Management': 61, 'TB Treatment Direct': 49 },
    congestion: [
      { name: 'Soshanguve CHC', expected: 310, wait_hrs: 2.5, level: 'high' },
      { name: 'Ga-Rankuwa Clinic 1', expected: 145, wait_hrs: 0.8, level: 'low' },
      { name: 'Equstra Health Node', expected: 215, wait_hrs: 1.4, level: 'medium' }
    ]
  };

  try {
    const r = await fetch('/api/impact_stats');
    if (r.ok) d = await r.json();
  } catch(e) {
    console.warn("Using baseline mock matrix variables.", e);
  }

  // Simplified metric array based on SaaS guidelines
  const impactCards = [
    {val: fmt(d.retained),           lbl: 'Care Trends',          delta: '↑ This pilot period',                color: '#1A7A4A'},
    {val: fmt(d.prevented),          lbl: 'Appointments Saved',   delta: 'Via WhatsApp + CHW intervention',     color: '#0D7E8C'},
    {val: fmt(d.chw_visits),         lbl: 'CHW Visits',           delta: 'Community health workers deployed',   color: '#C07F2A'},
    {val: fmtZAR(d.cost_savings_zar),lbl: 'Cost Savings',          delta: 'Retreatment costs avoided',           color: '#1A7A4A'},
    {val: fmt(d.lives_impacted),     lbl: 'Lives Reached',        delta: 'Tshwane pilot area estimate',         color: '#0D7E8C'},
    {val: d.drs_accuracy + '%',      lbl: 'Prediction Accuracy',  delta: 'Continuously improving with data',    color: '#6B4FBB'},
  ];

  const adherenceRows = Object.entries(d.adherence||{}).map(([cond, pct]) => {
    const color = pct >= 70 ? '#1A7A4A' : pct >= 55 ? '#C07F2A' : '#C0392B';
    return `
      <div class="progress-row">
        <div class="progress-label">${cond}</div>
        <div class="progress-track"><div class="progress-fill" style="width:${pct}%;background:${color};"></div></div>
        <div class="progress-pct" style="color:${color};">${pct}%</div>
      </div>`;
  }).join('');

  const congRows = (d.congestion||[]).map(c => {
    const pct = Math.round(c.expected / 412 * 100);
    const levelClass = c.level === 'high' ? 'cong-high' : c.level === 'medium' ? 'cong-medium' : 'cong-low';
    const fillColor  = c.level === 'high' ? '#C0392B' : c.level === 'medium' ? '#C07F2A' : '#1A7A4A';
    return `
      <div class="congestion-row">
        <div class="cong-name">${c.name}</div>
        <div class="cong-bar-wrap"><div class="cong-bar"><div class="cong-fill" style="width:${pct}%;background:${fillColor};"></div></div></div>
        <div class="cong-pts">${c.expected}</div>
        <div class="cong-time">${c.wait_hrs}h wait</div>
        <span class="cong-badge ${levelClass}">${c.level.toUpperCase()}</span>
      </div>`;
  }).join('');

  document.getElementById('content').innerHTML = `
    <div class="impact-grid">
      ${impactCards.map(c=>`
        <div class="impact-card">
          <div class="impact-val" style="color:${c.color}">${c.val}</div>
          <div class="impact-lbl">${c.lbl}</div>
          <div class="impact-delta">${c.delta}</div>
        </div>`).join('')}
    </div>

    <div class="two-col">
      <div>
        <div class="section-title">
          <i data-lucide="activity"></i>
          <span>Adherence</span>
        </div>
        <div class="card">${adherenceRows}</div>

        <div class="section-title">
          <i data-lucide="building-2"></i>
          <span>Tomorrow's Clinic Load</span>
        </div>
        <div class="card">${congRows}</div>
      </div>
      <div>
        <div class="section-title">
          <i data-lucide="line-chart"></i>
          <span>Care Trends</span>
        </div>
        <div class="card" style="padding:16px;">
          <canvas id="trend-chart" width="400" height="220"></canvas>
        </div>

        <div class="projection-card">
          <h3>5-Year Tshwane Projection</h3>
          <div class="proj-grid">
            <div class="proj-item"><div class="proj-val">12,000+</div><div class="proj-lbl">Lives protected from default</div></div>
            <div class="proj-item"><div class="proj-val">R400M+</div><div class="proj-lbl">Avoidable retreatment cost savings</div></div>
            <div class="proj-item"><div class="proj-val">800+</div><div class="proj-lbl">CHWs empowered with intelligence</div></div>
            <div class="proj-item"><div class="proj-val">72</div><div class="proj-lbl">Tshwane clinics fully paperless</div></div>
          </div>
        </div>
      </div>
    </div>
  `;

  updateIcons();
  drawChart(d.trend_months, d.trend_retained, d.trend_prevented);
}

function drawChart(months, retained, prevented) {
  const canvas = document.getElementById('trend-chart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height, pad = 36;
  ctx.clearRect(0, 0, W, H);
  ctx.font = '11px DM Sans, system-ui, sans-serif';

  const maxVal = Math.max(...retained, ...prevented) * 1.15;
  const toY = v => pad + (H - 2*pad) * (1 - v/maxVal);
  const toX = i => pad + (W - 2*pad) * i / (months.length-1);

  // Grid lines
  ctx.strokeStyle = '#E0E8E4'; ctx.lineWidth = 1;
  [100,200,300,400,500].filter(v=>v<maxVal).forEach(v => {
    const y = toY(v);
    ctx.beginPath(); ctx.moveTo(pad, y); ctx.lineTo(W-pad, y); ctx.stroke();
    ctx.fillStyle = '#6B7F73'; ctx.textAlign = 'right'; ctx.fillText(v, pad-5, y+4);
  });

  // Month labels
  months.forEach((m,i) => {
    ctx.fillStyle = '#6B7F73'; ctx.textAlign = 'center';
    ctx.fillText(m, toX(i), H-8);
  });

  // Lines
  [[retained,'#1A7A4A','Retained'],[prevented,'#0D7E8C','Prevented']].forEach(([data,col,lbl]) => {
    ctx.beginPath(); ctx.strokeStyle = col; ctx.lineWidth = 2.5; ctx.lineJoin = 'round';
    data.forEach((v,i) => i===0 ? ctx.moveTo(toX(i),toY(v)) : ctx.lineTo(toX(i),toY(v)));
    ctx.stroke();
    data.forEach((v,i) => {
      ctx.beginPath(); ctx.arc(toX(i), toY(v), 4, 0, Math.PI*2);
      ctx.fillStyle = col; ctx.fill();
    });
  });

  // Legend
  ctx.font = '11px DM Sans, system-ui, sans-serif';
  ctx.fillStyle = '#1A7A4A'; ctx.textAlign = 'left'; ctx.fillText('Retained', pad+2, 16);
  ctx.fillStyle = '#0D7E8C'; ctx.fillText('Prevented', pad+72, 16);
}

load();