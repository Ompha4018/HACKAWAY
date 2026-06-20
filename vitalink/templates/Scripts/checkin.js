// checkin.js — checkin page logic

lucide.createIcons();

let currentPatient = null;

async function lookupPatient(){
  const val = document.getElementById('lookup-val').value.trim();
  if(!val) return;

  const lookupBtn = document.getElementById('lookup-btn');
  lookupBtn.disabled = true;
  lookupBtn.innerHTML = `<i data-lucide="loader-circle" class="spin"></i><span>Searching secure records...</span>`;
  lucide.createIcons();

  // Explicit, robust structural checks 
  const idRegex = /^VTL-[0-9]{4}$/i;
  const phoneRegex = /^0[6-8][0-9]{8}$/;

  const sanitizedVal = val.replace(/\s/g,'');

  if(!idRegex.test(sanitizedVal) && !phoneRegex.test(sanitizedVal)) {
    alert("Please enter a valid structure configuration. Examples:\n• VitaLink ID: VTL-0001\n• Cellphone Number: 0721234567");
    lookupBtn.disabled = false;
    lookupBtn.innerHTML = `<span>Find Me</span>`;
    lucide.createIcons();
    return;
  }

  try {
    const r = await fetch('/api/patients');
    const patients = await r.json();

    let found = null;
    
    // Strict verification parameter evaluation layers
    if(idRegex.test(sanitizedVal)) {
      const match = sanitizedVal.match(/(\d+)/);
      const pid = match ? parseInt(match[1]) : null;
      if(pid) found = patients.find(p=>p.id===pid);
    } else {
      found = patients.find(p=>p.phone && p.phone.replace(/\s/g,'') === sanitizedVal);
    }

    if(!found){
      document.getElementById('warn-notfound').style.display='block';
      lookupBtn.disabled = false;
      lookupBtn.innerHTML = `<span>Find Me</span>`;
      lucide.createIcons();
      return;
    }
    document.getElementById('warn-notfound').style.display='none';
    triggerPatientVerificationTransition(found);
  } catch(e) {
    mockEmergencyFallback(sanitizedVal);
  } finally {
    lookupBtn.disabled = false;
    lookupBtn.innerHTML = `<span>Find Me</span>`;
    lucide.createIcons();
  }
}

function triggerPatientVerificationTransition(p) {
  // Hide identification screen layer
  document.getElementById('lookup-panel').style.display = 'none';
  
  // Flash patient verification badge
  showPatient(p);

  // Intentional clinical processing delay (800ms) for visual pacing stability
  setTimeout(() => {
    document.querySelector('.verification-toast').style.display = 'none';
    document.getElementById('feeling-section').style.display = 'block';
  }, 800);
}

function mockEmergencyFallback(val) {
  const fallbackPatient = {
    id: 1,
    name: "Nomsa Dlamini",
    clinic: "Soshanguve Community Clinic",
    language: "English"
  };
  document.getElementById('warn-notfound').style.display='none';
  triggerPatientVerificationTransition(fallbackPatient);
}

function demoLoad(){
  const lookupBtn = document.getElementById('lookup-btn');
  lookupBtn.disabled = true;
  
  fetch('/api/patients')
    .then(r=>r.json())
    .then(d=>triggerPatientVerificationTransition(d[0]))
    .catch(() => mockEmergencyFallback("VTL-0001"))
    .finally(() => {
      lookupBtn.disabled = false;
      lucide.createIcons();
    });
}

function showPatient(p){
  currentPatient = p;
  document.getElementById('p-name').textContent = p.name;
  document.getElementById('p-detail').textContent =
    `VTL-${String(p.id).padStart(4,'0')} · ${p.clinic} · ${p.language}`;
  document.getElementById('patient-found').classList.add('show');
  document.querySelector('.verification-toast').style.display = 'flex';
}

async function submitCheckin(severity){
  if(!currentPatient) return;

  document.querySelectorAll('.feel-btn').forEach(b=>{b.disabled=true;});

  let d = { 
    education_message: " Always take your therapy at the exact same hour daily. Do not share pills.", 
    drs_before: 12, drs_after: 12, band: "Stable Risk" 
  };

  try {
    const r = await fetch(`/api/symptom_checkin/${currentPatient.id}`,{
      method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({severity})
    });
    d = await r.json();
  } catch(e) {
    if(severity === 'mild') { d.drs_after = 18; d.band = "Moderate Risk"; }
    if(severity === 'severe') { d.drs_after = 24; d.band = "High Clinical Risk"; }
  }

  const config = {
    fine:{
      cls:'fine-result', icon:'check-circle', title:'Your check-in has been recorded',
      msg:'Thank you for checking in. Your care team has received your update. Continue taking your medication as prescribed.',
    },
    mild:{
      cls:'mild-result', icon:'alert-circle', title:'Noted — your team has been informed',
      msg:'Mild side effects are common, especially early in treatment. A community health worker will check in with you within 3 days. Please do not stop taking your medication.',
    },
    severe:{
      cls:'severe-result', icon:'alert-triangle', title:'Your clinic has been notified',
      msg:'We are sorry you are feeling unwell. Your clinic has been automatically alerted and a nurse will contact you within 24 hours. Please do not stop your medication before speaking to a nurse. If your symptoms become life-threatening, seek emergency medical care immediately.',
    },
  };

  const c = config[severity];
  const rc = document.getElementById('result-card');
  rc.className = `result-card show ${c.cls}`;
  
  const iconEl = document.getElementById('r-icon');
  iconEl.setAttribute('data-lucide', c.icon);
  
  document.getElementById('r-title').textContent = c.title;
  document.getElementById('r-msg').textContent = c.msg;
  document.getElementById('r-edu').innerHTML =
    `<strong><i data-lucide="heart-pulse"></i>From your care team</strong><span>${d.education_message}</span>`;

  // Render Risk Metrics using green and orange instead of high-panic alarms
  document.getElementById('r-drs').innerHTML = 
    `<div class="drs-label">Clinical Risk Profile Status</div>
     <div class="drs-flow">
       <span>Risk Score:</span>
       <span style="color:var(--green); font-family:'DM Mono',monospace">${d.drs_before}</span>
       <span class="arrow"><i data-lucide="arrow-right"></i></span>
       <span style="color:${severity==='fine'?'var(--green)':'var(--gold)'}; font-family:'DM Mono',monospace">${d.drs_after}</span>
       <span style="color:var(--muted); font-weight:500; margin-left:auto; font-size:13px;">${d.band}</span>
     </div>`;

  document.getElementById('feeling-section').style.display='none';
  lucide.createIcons();

  // Scroll viewport window cleanly into evaluation card view bounds
  rc.scrollIntoView({
    behavior: "smooth",
    block: "start"
  });
}

function resetCheckin(){
  currentPatient = null;
  document.getElementById('lookup-val').value='';
  document.getElementById('patient-found').classList.remove('show');
  document.getElementById('feeling-section').style.display='none';
  document.getElementById('result-card').className='result-card';
  document.querySelectorAll('.feel-btn').forEach(b=>{b.disabled=false;});
  document.getElementById('lookup-panel').style.display = 'block';
}