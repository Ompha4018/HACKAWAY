// register.js — register page logic

// CLINIC BOUND WARD DATA MAPPINGS
const CLINIC_AREAS = {
  "Ga-Rankuwa Clinic 1":       {area:"Ga-Rankuwa Zone 3",   ward:76},
  "Soshanguve BB Clinic":      {area:"Soshanguve Block BB",  ward:80},
  "Mabopane CHC":              {area:"Mabopane Section E",   ward:84},
  "Atteridgeville CHC":        {area:"Atteridgeville West",  ward:91}
};

const PATHWAY_LABELS = {
  1:"WhatsApp digital reminders tracking trajectory maps.",
  2:"Telephonic follow-up sequence integration.",
  3:"CHW dispatch confirmation route sequence allocation.",
  4:"Priority clinical tracking fast-track structural paths.",
  5:"Urgent tracking protocols activated immediately."
};

function updateArea(){
  const clinic = document.getElementById('clinic').value;
  if(CLINIC_AREAS[clinic]){
    document.getElementById('area').value = CLINIC_AREAS[clinic].area;
    document.getElementById('ward').value = CLINIC_AREAS[clinic].ward;
  } else {
    document.getElementById('area').value = "";
    document.getElementById('ward').value = "";
  }
  updatePreview();
}

function setToggle(fieldId, val, btn, groupId, activeClass='active'){
  document.getElementById(fieldId).value = val;
  document.querySelectorAll(`#${groupId} .toggle-btn`).forEach(b=>{
    b.classList.remove('active','active-red');
  });
  btn.classList.add(activeClass);
  updatePreview();
}

// EXPLAINABLE ENGINE DESIGN MATRIX CALCULATIONS
function calcDRS(missed, gaps, lab, chw, visit){
  const m = Math.min(missed * 20, 100);
  const p = Math.min(gaps * 25, 100);
  const l = lab * 100;
  const c = Math.min((chw / 90) * 100, 100);
  const v = Math.min((visit / 60) * 100, 100);
  
  const score = Math.round(Math.min(m*0.35 + p*0.25 + l*0.15 + c*0.15 + v*0.10, 100)*10)/10;
  
  let explanation = [];
  if (m > 40) explanation.push(`Missed clinical appointments (${missed}) contribute heavily to compliance erosion`);
  if (p > 50) explanation.push(`Dispensation pickup breaks (${gaps}) signify severe pharmacy drop barriers`);
  if (l > 40) explanation.push(`Deteriorating physiological laboratory vectors signify unchecked progression`);
  
  return { score, drivers: explanation.join(" | ") || "Stable tracking metrics observed consistently." };
}

function calcSVS(unemp, transport, dist, food, mchw, isolatedCaregiver, grant){
  const u = unemp ? 100 : 0;
  const t = Math.min(transport * 50, 100);
  const d = Math.min((dist / 15) * 100, 100);
  const f = food ? 100 : 0;
  const c2 = Math.min((mchw / 5) * 100, 100);
  const ic = isolatedCaregiver ? 100 : 0;
  const g = grant ? 100 : 0;
  
  const score = Math.round(Math.min(u*0.25 + t*0.20 + d*0.18 + f*0.15 + c2*0.12 + ic*0.06 + g*0.04, 100)*10)/10;
  
  let explanation = [];
  if (f > 0) explanation.push("Severe food insecurity creates competing survival priorities over pill-taking");
  if (t > 30 || d > 40) explanation.push(`High spatial insulation clinic access barrier detected (${dist}km out)`);
  if (ic > 0) explanation.push("Isolated family structures limit treatment backup support");
  
  return { score, drivers: explanation.join(" | ") || "Socio-economic hurdles within system parameters." };
}

function band(score){
  if(score>=75) return "CRITICAL";
  if(score>=65) return "HIGH";
  if(score>=40) return "MEDIUM";
  return "LOW";
}

function cpl(drs,svs){
  const c=(drs*0.6)+(svs*0.4);
  if(c>=80) return 5;
  if(c>=70) return 4;
  if(c>=55) return 3;
  if(c>=40) return 2;
  return 1;
}

function updatePreview(){
  const drsData = calcDRS(
    +document.getElementById('missed_appts').value,
    +document.getElementById('med_pickup_gaps').value,
    +document.getElementById('lab_trend').value/10,
    +document.getElementById('chw_days').value,
    +document.getElementById('visit_days').value
  );

  const svsData = calcSVS(
    +document.getElementById('unemployed').value,
    +document.getElementById('transport_difficulty').value,
    +document.getElementById('distance_km').value,
    +document.getElementById('food_insecure').value,
    +document.getElementById('missed_chw').value,
    +document.getElementById('single_caregiver_isolated').value,
    +document.getElementById('grant_dependent').value
  );

  const b_drs = band(drsData.score);
  const b_svs = band(svsData.score);
  const level = cpl(drsData.score, svsData.score);

  document.getElementById('prev-drs').textContent = drsData.score.toFixed(1);
  document.getElementById('prev-svs').textContent = svsData.score.toFixed(1);
  document.getElementById('prev-cpl').textContent = level;

  const bandColors={CRITICAL:'#C0392B',HIGH:'#C07F2A',MEDIUM:'#8B9A00',LOW:'#1A7A4A'};
  
  document.getElementById('prev-drs-band').textContent = b_drs;
  document.getElementById('prev-drs-band').style.background = bandColors[b_drs];
  
  document.getElementById('prev-svs-band').textContent = b_svs;
  document.getElementById('prev-svs-band').style.background = bandColors[b_svs];

  document.getElementById('explainability-log').innerHTML = 
    `<strong>Clinical Drivers:</strong> ${drsData.drivers}<br><strong style="color:#E6C283">Social Drivers:</strong> ${svsData.drivers}`;

  document.getElementById('prev-pathway').innerHTML =
    `<strong>Level ${level} Care Pathway Action Assignment:</strong> ${PATHWAY_LABELS[level]}`;
}

function toggleInsulin(){
  const cond = document.getElementById('condition').value;
  document.getElementById('insulin-section').style.display = cond.includes('Diabetes') ? 'block':'none';
  document.getElementById('arv-section').style.display = (cond.includes('HIV') || cond.includes('TB')) ? 'block':'none';
}

// OFFLINE STORAGE QUEUE IMPLEMENTATION
let offlineStorageQueue = JSON.parse(localStorage.getItem('vitalink_sync_queue')) || [];
function checkQueueDisplay(){
  const banner = document.getElementById('sync-banner');
  const countEl = document.getElementById('queue-count');
  if(offlineStorageQueue.length > 0){
    banner.style.display = 'block';
    countEl.textContent = offlineStorageQueue.length;
  } else {
    banner.style.display = 'none';
  }
}

async function submitForm(){
  const name = document.getElementById('name').value.trim();
  const age  = document.getElementById('age').value;
  const cond = document.getElementById('condition').value;
  const clinic = document.getElementById('clinic').value;
  const lang = document.getElementById('language').value;

  if(!name || !age || isNaN(age) || age < 0 || age > 120 || !cond || !clinic || !lang){
    alert('Capture Processing Error: Ensure all basic identification parameters are complete and within accurate ranges.');
    return;
  }

  if (cond.includes('Diabetes')) {
    if (!document.getElementById('medication').value || !document.getElementById('dosage').value || !document.getElementById('collection_date').value) {
      alert('Validation Error: Diabetes diagnosis requires full QuickScript packing, dosage, and collection date assignments.');
      return;
    }
  }
  if (cond.includes('HIV')) {
    if (!document.getElementById('medication_arv').value || !document.getElementById('arv_collection').value) {
      alert('Validation Error: HIV care pathway designation requires precise antiretroviral therapeutic cocktail selection.');
      return;
    }
  }

  const payload = {
    patient_id: "PT-" + Math.floor(Math.random() * 900000 + 100000),
    timestamp: new Date().toISOString(),
    audit_actor: "Nurse_Intake_Station_1",
    name, age, gender: document.getElementById('gender').value,
    condition: cond, clinic, language: lang,
    phone: document.getElementById('phone').value,
    area: document.getElementById('area').value,
    ward: document.getElementById('ward').value,
    chw_name: document.getElementById('chw_name').value,
    next_appointment: document.getElementById('next_appointment').value,
    missed_appts: document.getElementById('missed_appts').value,
    med_pickup_gaps: document.getElementById('med_pickup_gaps').value,
    lab_trend: (document.getElementById('lab_trend').value/10).toFixed(1),
    chw_days: document.getElementById('chw_days').value,
    visit_days: document.getElementById('visit_days').value,
    unemployed: document.getElementById('unemployed').value,
    transport_difficulty: document.getElementById('transport_difficulty').value,
    distance_km: document.getElementById('distance_km').value,
    food_insecure: document.getElementById('food_insecure').value,
    missed_chw: document.getElementById('missed_chw').value,
    single_caregiver_isolated: document.getElementById('single_caregiver_isolated').value,
    grant_dependent: document.getElementById('grant_dependent').value,
    household_address: document.getElementById('household_address').value,
    hh_total: document.getElementById('hh_total').value,
    hh_children: document.getElementById('hh_children').value,
    hh_elderly: document.getElementById('hh_elderly').value,
    notes: document.getElementById('notes').value,
    medication: cond.includes('Diabetes') ? document.getElementById('medication').value : document.getElementById('medication_arv').value,
    dosage: document.getElementById('dosage').value || "Standard Protocol Alignment",
    collection_date: cond.includes('Diabetes') ? document.getElementById('collection_date').value : document.getElementById('arv_collection').value
  };

  const btn = document.querySelector('.btn-submit');
  const originalText = btn.innerHTML;
  btn.textContent = 'Processing Intake Transmissions...'; btn.disabled = true;

  try {
    const response = await fetch('/api/register_patient', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    
    const resData = await response.json();
    btn.innerHTML = originalText; btn.disabled = false;

    if(resData.success) {
      renderSuccessModal(name, resData, payload);
    } else {
      alert('Local Mesh Rejection: ' + resData.error);
    }
  } catch (networkError) {
    offlineStorageQueue.push(payload);
    localStorage.setItem('vitalink_sync_queue', JSON.stringify(offlineStorageQueue));
    btn.innerHTML = originalText; btn.disabled = false;
    checkQueueDisplay();
    
    const mockLocalFallback = {
      success: true, message: "Stored locally into transaction retry queue due to facility offline conditions.",
      drs: document.getElementById('prev-drs').textContent, drs_band: document.getElementById('prev-drs-band').textContent,
      svs: document.getElementById('prev-svs').textContent, svs_band: document.getElementById('prev-svs-band').textContent,
      care_pathway_level: document.getElementById('prev-cpl').textContent, patient_id: payload.patient_id
    };
    renderSuccessModal(name, mockLocalFallback, payload);
  }
}

function renderSuccessModal(name, data, payload) {
  const colors = { CRITICAL: '#C0392B', HIGH: '#C07F2A', MEDIUM: '#8B9A00', LOW: '#1A7A4A' };
  document.getElementById('modal-title').textContent = `${name} Processed`;
  document.getElementById('modal-message').textContent = data.message;
  document.getElementById('modal-scores').innerHTML = `
    <div class="modal-score"><div class="v" style="color:${colors[data.drs_band]}">${data.drs}</div><div class="l">DRS · ${data.drs_band}</div></div>
    <div class="modal-score"><div class="v" style="color:${colors[data.svs_band]}">${data.svs}</div><div class="l">SVS · ${data.svs_band}</div></div>
    <div class="modal-score"><div class="v">LVL ${data.care_pathway_level}</div><div class="l">Triage Line</div></div>`;
  document.getElementById('modal-view').onclick = () => alert(`Audit Trail:\nActor: ${payload.audit_actor}\nID Ref: ${data.patient_id}\nStamp: ${payload.timestamp}`);
  document.getElementById('modal').classList.add('show');
  setTimeout(() => { if(window.lucide) lucide.createIcons(); }, 10);
}

function resetForm(){
  document.getElementById('modal').classList.remove('show');
  document.querySelectorAll('input[type=text], input[type=number], input[type=date], textarea').forEach(i => i.value = '');
  document.querySelectorAll('select').forEach(s => s.selectedIndex = 0);
  document.querySelectorAll('input[type=range]').forEach(r => r.value = r.min || 0);
  
  document.getElementById('unemployed').value = '0';
  document.getElementById('food_insecure').value = '0';
  document.getElementById('single_caregiver_isolated').value = '0';
  document.getElementById('grant_dependent').value = '0';
  document.getElementById('transport_difficulty').value = '0';

  document.querySelectorAll('.toggle-group').forEach(g => {
    g.querySelectorAll('.toggle-btn').forEach(b => b.classList.remove('active','active-red'));
    if(g.querySelector('.toggle-btn')) g.querySelector('.toggle-btn').classList.add('active');
  });

  document.getElementById('missed_val').textContent='0';
  document.getElementById('pickup_val').textContent='0';
  document.getElementById('lab_val').textContent='0.0';
  document.getElementById('chw_val').textContent='0';
  document.getElementById('visit_val').textContent='0';
  document.getElementById('dist_val').textContent='2km';
  document.getElementById('mchw_val').textContent='0';
  
  initDefaultTimelineDates();
  toggleInsulin();
  updatePreview();
}

function initDefaultTimelineDates(){
  const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 7);
  const nextMonth = new Date(); nextMonth.setDate(nextMonth.getDate() + 30);
  
  const nextApptEl = document.getElementById('next_appointment');
  const collDateEl = document.getElementById('collection_date');
  const arvCollEl  = document.getElementById('arv_collection');
  
  if(nextApptEl) nextApptEl.value = tomorrow.toISOString().split('T')[0];
  if(collDateEl) collDateEl.value = nextMonth.toISOString().split('T')[0];
  if(arvCollEl)  arvCollEl.value  = nextMonth.toISOString().split('T')[0];
}

// BACKGROUND MESH SYNC CHECKER LOOP
setInterval(async () => {
  if (offlineStorageQueue.length === 0) return;
  document.getElementById('network-status').textContent = "⚡ Background Queue Sync Attempt Processing...";
  
  try {
    const payloadToSync = offlineStorageQueue[0];
    const checkMesh = await fetch('/api/register_patient', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payloadToSync)
    });
    
    if (checkMesh.ok) {
      offlineStorageQueue.shift();
      localStorage.setItem('vitalink_sync_queue', JSON.stringify(offlineStorageQueue));
      checkQueueDisplay();
    }
    document.getElementById('network-status').textContent = "🌐 Connected to Local Mesh Server";
  } catch(e) {
    document.getElementById('network-status').textContent = "⚠️ Mesh Disconnected — Local Standalone Mode Active";
  }
}, 12000);

window.onload = function(){
  initDefaultTimelineDates();
  checkQueueDisplay();
  updatePreview();
  if(window.lucide) lucide.createIcons();
};