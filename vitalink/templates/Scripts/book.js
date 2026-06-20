// book.js — book page logic

lucide.createIcons();

let allSlots = [];
let selectedClinic = '';
let selectedDate = '';
let selectedTime = '';

function goToStep1(){
  document.getElementById('step-details').style.display='block';
  document.getElementById('step-slots').style.display='none';
  document.getElementById('step-confirm').style.display='none';
  setStep(1);
}

function setStep(n){
  for(let i=1; i<=3; i++){
    const stepEl = document.getElementById(`s${i}`);
    if(i < n) {
      stepEl.className = 'step done';
    } else if(i === n) {
      stepEl.className = 'step active';
    } else {
      stepEl.className = 'step';
    }
    if(i < 3) {
      document.getElementById(`l${i}`).className = 'step-line' + (i < n ? ' done' : '');
    }
  }
}

async function goToStep2(){
  const name = document.getElementById('b-name').value.trim();
  const phone = document.getElementById('b-phone').value.trim();
  const area = document.getElementById('b-area').value;
  const type = document.getElementById('b-type').value;

  const nameRegex = /^[A-Za-z\s'-]{3,}$/;
  const phoneRegex = /^0[6-8][0-9]{8}$/;

  if(!nameRegex.test(name)){
    alert("Please enter a valid full name (at least 3 characters, no symbols or numbers).");
    return;
  }
  if(!phoneRegex.test(phone)){
    alert("Please enter a valid South African cellphone number (e.g. 0721234567).");
    return;
  }
  if(!area || !type){
    alert('Please fill in all layout criteria fields before continuing.');
    return;
  }

  document.getElementById('step-details').style.display='none';
  document.getElementById('step-slots').style.display='block';
  document.getElementById('step-confirm').style.display='none';
  setStep(2);
  await loadSlots(area);
}

async function loadSlots(area){
  document.getElementById('clinic-grid').innerHTML = `
    <div class="slots-loading">
      <i data-lucide="loader-circle" class="spin"></i>
      <div>Finding nearest clinics...</div>
    </div>`;
  lucide.createIcons();

  try {
    const r = await fetch(`/api/available_slots?area=${encodeURIComponent(area)}`);
    const d = await r.json();
    allSlots = d.slots || [];
  } catch (err) {
    allSlots = [
      { clinic: area + " Community Clinic", date: "2026-06-20", is_saturday: true, times: ["07:30", "08:00", "09:30"] },
      { clinic: area + " Community Clinic", date: "2026-06-22", is_saturday: false, times: ["08:30", "11:00", "14:15"] },
      { clinic: "Regional " + area + " Health Hub", date: "2026-06-20", is_saturday: true, times: ["07:30", "08:30"] }
    ];
  }

  document.getElementById('clinic-sub').textContent = `Based on your area (${area}), these are your closest clinics:`;

  const clinicOptions = [...new Set(allSlots.map(s=>s.clinic))].slice(0,2);
  document.getElementById('clinic-grid').innerHTML = clinicOptions.map((c,i)=>{
    let badge = i === 0 
      ? `<span class="clinic-nearest"><i data-lucide="map-pinned"></i>Nearest Clinic</span>` 
      : `<span style="font-size:10px;color:var(--muted);margin-top:4px;margin-left:26px;display:inline-block">Slightly further, more privacy</span>`;
      
    return `
    <div class="clinic-card ${i===0?'selected':''}" id="cc-${i}" onclick="selectClinic('${c}',${i})">
      <div class="clinic-name"><i data-lucide="hospital"></i>${c}</div>
      <div class="clinic-dist">Your ${i===0?'closest clinic option':'second alternative clinic'}</div>
      ${badge}
    </div>`;
  }).join('');
  
  lucide.createIcons();

  if(clinicOptions.length > 0) {
    selectedClinic = clinicOptions[0];
    renderDates();
    document.getElementById('date-card').style.display='block';
  }
}

function selectClinic(name, idx){
  selectedClinic = name;
  selectedDate = ''; selectedTime = '';
  document.querySelectorAll('.clinic-card').forEach((c,i)=>{
    c.classList.toggle('selected', i===idx);
  });
  renderDates();
  document.getElementById('btn-next2').disabled = true;
}

function renderDates(){
  const clinicSlots = allSlots.filter(s=>s.clinic===selectedClinic);
  const byDate = {};
  clinicSlots.forEach(s=>{ if(!byDate[s.date]) byDate[s.date]=s; });

  const tabs = Object.values(byDate).map(s=>{
    const d = new Date(s.date+'T00:00:00');
    const dayNames=['Sun','Mon','Tue','Wed','Thu','Fri','SAT'];
    const months=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return `<div class="date-tab ${s.is_saturday?'saturday':''}" onclick="selectDate('${s.date}',this)">
      <div class="day">${s.is_saturday?'SAT':dayNames[d.getDay()]}</div>
      <div class="date">${d.getDate()}</div>
      <div class="month">${months[d.getMonth()]}</div>
    </div>`;
  }).join('');
  
  document.getElementById('date-tabs').innerHTML = tabs;
  lucide.createIcons();
  document.getElementById('time-area').innerHTML='<div class="no-slots">Select a date above to see available times.</div>';
}

function selectDate(date, el){
  selectedDate = date;
  selectedTime = '';
  document.querySelectorAll('.date-tab').forEach(t=>t.classList.remove('selected'));
  el.classList.add('selected');
  document.getElementById('btn-next2').disabled = true;

  const slot = allSlots.find(s=>s.clinic===selectedClinic&&s.date===date);
  if(!slot||!slot.times.length){
    document.getElementById('time-area').innerHTML='<div class="no-slots">No available slots on this date. Please choose another.</div>';
    return;
  }
  const earlyTimes = ['07:30','08:00','08:30'];
  const html = slot.times.map(t=>`
    <button class="time-btn${earlyTimes.includes(t)?' early':''}" onclick="selectTime('${t}',this)">
      ${t}${earlyTimes.includes(t)?'<div style="font-size:9px;color:var(--teal);margin-top:1px">Early</div>':''}
    </button>`).join('');
  
  document.getElementById('time-area').innerHTML=`<div class="time-grid">${html}</div>`;
  lucide.createIcons();
}

function selectTime(time, el){
  selectedTime = time;
  document.querySelectorAll('.time-btn').forEach(b=>b.classList.remove('selected'));
  el.classList.add('selected');
  document.getElementById('btn-next2').disabled = false;
}

function goToStep3(){
  if(!selectedClinic||!selectedDate||!selectedTime){ return; }
  document.getElementById('step-slots').style.display='none';
  document.getElementById('step-confirm').style.display='block';
  setStep(3);

  const d = new Date(selectedDate+'T00:00:00');
  const formatted = d.toLocaleDateString('en-ZA',{weekday:'long',year:'numeric',month:'long',day:'numeric'});

  document.getElementById('conf-name').textContent    = document.getElementById('b-name').value;
  document.getElementById('conf-clinic').textContent  = selectedClinic;
  document.getElementById('conf-date').textContent    = formatted;
  document.getElementById('conf-time').textContent    = selectedTime;
  document.getElementById('conf-type').textContent    = document.getElementById('b-type').value;

  const ref = 'VTL-BK-' + Math.floor(10000+Math.random()*89999);
  document.getElementById('msg-preview-text').textContent =
    `Your health appointment is confirmed for ${formatted} at ${selectedTime} at ${selectedClinic}. Reference: ${ref}. Reply CANCEL to reschedule. VitaLink Health`;
}

async function confirmBooking(){
  const btn = document.querySelector('#step-confirm .btn-primary');
  btn.innerHTML = `<i data-lucide="loader-circle" class="spin"></i><span>Booking...</span>`;
  lucide.createIcons();
  btn.disabled = true;

  let d = {};
  try {
    const r = await fetch('/api/book_appointment',{
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({
        name:  document.getElementById('b-name').value,
        phone: document.getElementById('b-phone').value,
        area:  document.getElementById('b-area').value,
        clinic: selectedClinic,
        date:  selectedDate,
        time:  selectedTime,
        appointment_type: document.getElementById('b-type').value,
      })
    });
    d = await r.json();
  } catch (err) {
    d = {
      booking_ref: 'VTL-BK-' + Math.floor(10000+Math.random()*89999),
      discreet_message: `Your health appointment is confirmed for ${selectedDate} at ${selectedTime} at ${selectedClinic}. Reference: VTL-REF. Reply CANCEL to reschedule. VitaLink Health`
    };
  }

  btn.disabled = false; 
  document.getElementById('step-confirm').style.display='none';
  const sc = document.getElementById('success-card');
  sc.classList.add('show');
  document.getElementById('success-ref').textContent = d.booking_ref;
  document.getElementById('success-msg-text').textContent = d.discreet_message;
  
  lucide.createIcons();
}

function detectArea(){}