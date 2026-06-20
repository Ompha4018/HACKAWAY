// pharmacy.js — pharmacy page logic

lucide.createIcons();

let queueData = [];
let scannedItem = null;
let currentFilter = "all";
const dispensed = new Set();

const today = new Date();
const tomorrow = new Date(today); 
tomorrow.setDate(today.getDate() + 1);

function formatDate(ds) {
  const d = new Date(ds);
  const diff = Math.round((d - today) / 86400000);
  if(diff < 0) return {label: ds, cls: 'date-urgent'};
  if(diff === 0) return {label: 'TODAY ⚠', cls: 'date-urgent'};
  if(diff === 1) return {label: 'TOMORROW', cls: 'date-soon'};
  return {label: ds, cls: 'date-normal'};
}

async function load() {
  try {
    const r = await fetch('/api/pharmacy_queue');
    queueData = await r.json();

    if(queueData.length === 0){
      document.getElementById('queue-body').innerHTML = '<div class="loading">No collections due in the next 3 days.</div>';
      document.getElementById('stat-urgent').textContent = '0';
      document.getElementById('stat-ready').textContent = '0';
      document.getElementById('stat-pending').textContent = '0';
      document.getElementById('queue-count').textContent = '0 patients';
      return;
    }

    // 1. Calculate general stats metrics from the master queue array
    const urgent = queueData.filter(q => {
      const diff = Math.round((new Date(q.collection_date) - today) / 86400000);
      return diff <= 1;
    }).length;
    const ready = queueData.filter(q => q.status === 'ready').length;
    const pending = queueData.filter(q => q.status === 'pending').length;

    document.getElementById('stat-urgent').textContent = urgent;
    document.getElementById('stat-ready').textContent = ready;
    document.getElementById('stat-pending').textContent = pending;

    // 2. NOW define the filtered array configuration safely
    filtered = queueData.filter(q => {
      if(currentFilter == "ready") return q.status === "ready";
      if(currentFilter == "pending") return q.status !== "ready";
      if(currentFilter == "today") return Math.round((new Date(q.collection_date) - today) / 86400000) <= 0;
      return true;
    });

    // 3. You can now read filtered.length safely without throwing a crash error
    document.getElementById('queue-count').textContent = `${filtered.length} patients`;

    // 4. Map rows array data logic cleanly
    const rows = filtered.map(q => {
      const {label, cls} = formatDate(q.collection_date);
      const isDone = dispensed.has(q.qr_code.toUpperCase());
      
      const statusHtml = isDone
        ? '<span class="status-badge status-dispensed">Dispensed</span>'
        : q.status === 'ready'
          ? '<span class="status-badge status-ready">✓ Ready</span>'
          : '<span class="status-badge status-pending">Pending</span>';
          
      const prepBtn = isDone
        ? '<button class="prep-btn done">Dispensed</button>'
        : q.status === 'ready'
          ? `<button class="prep-btn done">Pre-packed ✓</button>`
          : `<button class="prep-btn" onclick="markPrepared('${q.qr_code}',this)">Pre-pack Now</button>`;
          
      return `
        <tr>
          <td><strong>${q.name}</strong><br><span style="font-size:11px;color:var(--muted)">${q.condition} · ${q.clinic}</span></td>
          <td>${q.medication}<br><span style="font-size:11px;color:var(--muted)">${q.dosage}</span></td>
          <td class="${cls}">${label}</td>
          <td>${statusHtml}</td>
          <td><div class="qr-mono" style="cursor:pointer" onclick="fillQR('${q.qr_code}')" title="Click to test scan">${q.qr_code}</div></td>
          <td>${prepBtn}</td>
        </tr>`;
    }).join('');

    document.getElementById('queue-body').innerHTML = `
      <table>
        <thead>
          <tr>
            <th>Patient</th><th>Medication</th><th>Pickup</th>
            <th>Status</th><th>QR Code</th><th>Status</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>`;
      
    // Re-render icons if needed dynamically
    if (window.lucide && typeof lucide.createIcons === 'function') {
      lucide.createIcons();
    }
  } catch(err) {
    console.error("Queue loader error pipeline:", err);
    document.getElementById('queue-body').innerHTML = '<div class="loading">Error loading system metrics.</div>';
  }
}

function filterQueue(type, btn) {
  currentFilter = type;
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  load();
}

function fillQR(code) {
  document.getElementById('qr-input').value = code;
}

function markPrepared(qr, btn) {
  btn.textContent = 'Pre-packing...';
  setTimeout(() => {
    btn.textContent = 'Pre-packed ✓';
    btn.className = 'prep-btn done';
    // Match structure update seamlessly
    const item = queueData.find(q => q.qr_code === qr);
    if(item) item.status = 'ready';
    load();
  }, 800);
}

function scanQR() {
  const code = document.getElementById('qr-input').value.trim().toUpperCase();
  if(!code) { alert('Please enter a QR code.'); return; }
  const item = queueData.find(q => q.qr_code.toUpperCase() === code);
  const resultBox = document.getElementById('scan-result');
  if(!item) {
    document.getElementById('result-name').textContent = '❌ QR Not Found';
    document.getElementById('result-med').textContent = 'Please verify the code and try again.';
    document.getElementById('result-details').textContent = '';
    document.getElementById('dispense-btn').style.display = 'none';
    resultBox.classList.add('show');
    return;
  }
  scannedItem = item;
  document.getElementById('result-name').textContent = '✓ ' + item.name;
  document.getElementById('result-med').textContent = item.medication + ' — ' + item.dosage;
  document.getElementById('result-details').innerHTML = `
    <span style="color:var(--muted)">Condition:</span> <strong>${item.condition}</strong> &nbsp;·&nbsp;
    <span style="color:var(--muted)">Clinic:</span> <strong>${item.clinic}</strong><br>
    <span style="color:var(--muted)">Status:</span> <strong style="color:${item.status==='ready'?'var(--green)':'var(--gold)'}">${item.status==='ready'?'✓ Pre-packed & ready':'⏳ Pending preparation'}</strong>`;
  const btn = document.getElementById('dispense-btn');
  btn.style.display = 'block';
  btn.className = dispensed.has(code) ? 'dispense-btn dispensed' : 'dispense-btn';
  btn.textContent = dispensed.has(code) ? 'Dispensed' : 'Dispense';
  resultBox.classList.add('show');
  if (window.lucide && typeof lucide.createIcons === 'function') lucide.createIcons();
}

function confirmDispense() {
  if(!scannedItem) return;
  const btn = document.getElementById('dispense-btn');
  btn.textContent = 'Dispensing...';
  setTimeout(() => {
    dispensed.add(scannedItem.qr_code.toUpperCase());
    btn.className = 'dispense-btn dispensed';
    btn.textContent = '✅ Dispensed';
    load();
  }, 600);
}

load();