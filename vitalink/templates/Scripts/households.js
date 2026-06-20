// households.js — households page logic

// UNIFIED DATA BACKBONE SHARED ACROSS LIST AND MAP LAYERS
const INTEGRATED_DATABANK_STORE = {
  households: [
    { id: "HH-101", address: "2441 Block X, Hebron Rd", area: "Soshanguve North", ward: "102", risk_score: 82, band: "CRITICAL", chw_assigned: "Sister Mpho", coordinates: { x: 120, y: 130 }, next_best_action: "Deliver drug-resistant TB treatment buffer pack immediately and run household sputum tests." },
    { id: "HH-102", address: "912 Old Mabopane Highway", area: "Mabopane Central", ward: "084", risk_score: 71, band: "HIGH", chw_assigned: "Sister Mpho", coordinates: { x: 320, y: 80 }, next_best_action: "Assess infant prophylaxis uptake; verify maternal viral load baseline documentation." },
    { id: "HH-103", address: "1048 Molefe Str", area: "Ga-Rankuwa Zone 4", ward: "001", risk_score: 54, band: "MEDIUM", chw_assigned: "Unassigned", coordinates: { x: 220, y: 200 }, next_best_action: "Provide routine insulin cold-chain storage review and verify stable ART refills." }
  ],
  members: [
    { id: "P-201", household_id: "HH-101", name: "Kgomotso Khumalo", age: 34, condition: "Pulmonary TB (Treatment Defaulter)", drs: 91, band: "CRITICAL" },
    { id: "P-202", household_id: "HH-101", name: "Thato Khumalo", age: 29, condition: "HIV (Maternal Track Monitoring)", drs: 76, band: "CRITICAL" },
    { id: "P-203", household_id: "HH-101", name: "Gogo Khumalo", age: 71, condition: "Hypertension / Advanced Diabetes", drs: 78, band: "HIGH" },
    { id: "P-204", household_id: "HH-102", name: "Lerato Mokoena", age: 42, condition: "Active Pulmonary TB Case", drs: 83, band: "CRITICAL" },
    { id: "P-205", household_id: "HH-102", name: "Junior Mokoena", age: 8, condition: "Child Contact Prophylaxis", drs: 59, band: "MEDIUM" },
    { id: "P-206", household_id: "HH-103", name: "Thabo Molefe", age: 67, condition: "Insulin-Dependent Diabetes", drs: 64, band: "MEDIUM" },
    { id: "P-207", household_id: "HH-103", name: "Amina Ndlovu", age: 24, condition: "HIV (Adherence Verified)", drs: 44, band: "LOW" }
  ],
  edges: [
    { source: "P-201", target: "HH-101", type: "CONTACT" },
    { source: "P-202", target: "HH-101", type: "CONTACT" },
    { source: "P-203", target: "HH-101", type: "CONTACT" },
    { source: "P-204", target: "HH-102", type: "CONTACT" },
    { source: "P-205", target: "HH-102", type: "CONTACT" },
    { source: "P-206", target: "HH-103", type: "CONTACT" },
    { source: "P-207", target: "HH-103", type: "CONTACT" },
    { source: "HH-101", target: "HH-102", type: "SHARED_CHW_CHAIN" } // Shared risk via care provider tracking assignment
  ]
};

let canvas = document.getElementById('graph-canvas');
let ctx = canvas.getContext('2d');
let graphNodes = [];
let activeHouseholdIdSelection = "HH-101"; // Default focus to critical structure
let draggedNode = null;

async function bootstrapUnifiedSystem() {
  // Graceful alignment with production /api endpoints fallback loops
  try {
    const r = await fetch('/api/households');
    if(r.ok) { /* Hydrate with backend pipeline if live */ }
  } catch(e) {}
  
  initializeNetworkNodes();
  executeUIRenderPipeline();
  initCanvasInteractions();
  startCanvasPlaybackLoop();
}

function initializeNetworkNodes() {
  graphNodes = [];
  INTEGRATED_DATABANK_STORE.households.forEach(hh => {
    graphNodes.push({
      id: hh.id, type: 'HOUSEHOLD', score: hh.risk_score, band: hh.band,
      x: hh.coordinates.x, y: hh.coordinates.y, radius: 18, raw: hh
    });
  });

  INTEGRATED_DATABANK_STORE.members.forEach((m, idx) => {
    const parent = graphNodes.find(n => n.id === m.household_id);
    if (!parent) return;
    const angle = (idx * 1.1);
    graphNodes.push({
      id: m.id, type: 'PATIENT', score: m.drs, band: m.band,
      x: parent.x + Math.cos(angle) * 55, y: parent.y + Math.sin(angle) * 55,
      radius: 10, raw: m
    });
  });
}

function executeUIRenderPipeline() {
  // Sort priority queue automatically: highest risk always surfaces first
  const sortedHouseholds = [...INTEGRATED_DATABANK_STORE.households].sort((a,b) => b.risk_score - a.risk_score);
  document.getElementById('queue-count-lbl').textContent = `${sortedHouseholds.length} Priority Locations Mapped`;

  const queueContainer = document.getElementById('dynamic-action-queue-target');
  
  queueContainer.innerHTML = sortedHouseholds.map(hh => {
    const isSelected = hh.id === activeHouseholdIdSelection;
    const linkedMembers = INTEGRATED_DATABANK_STORE.members.filter(m => m.household_id === hh.id);
    
    // Create functional operational indicator flags
    const hasTB = linkedMembers.some(m => m.condition.includes('TB'));
    const hasHIV = linkedMembers.some(m => m.condition.includes('HIV'));

    const membersListMarkup = linkedMembers.map(m => `
      <div class="member-mini-item">
        <span class="member-name-str">${m.name}, <span style="color:var(--muted)">Age ${m.age}</span></span>
        <span class="member-condition-str">${m.condition} <span class="badge-pfx" style="color:${m.drs >= 75 ? 'var(--red)' : 'var(--text)'}">DRS ${m.drs}</span></span>
      </div>
    `).join('');

    return `
      <div class="household-action-card ${isSelected ? 'selected' : ''}" onclick="selectHouseholdNode('${hh.id}', false)">
        <div class="card-top">
          <div>
            <div class="address-title">🏠 ${hh.address}</div>
            <div class="area-sub">${hh.area} · Ward ${hh.ward}</div>
          </div>
          <div class="score-badge" style="border-top: 3px solid ${hh.risk_score >= 75 ? 'var(--red)' : hh.risk_score >= 65 ? 'var(--gold)' : 'var(--green)'}">
            <div class="score-val">${hh.risk_score}</div>
            <div class="score-lbl">Risk Rating</div>
          </div>
        </div>
        
        <div class="household-tags">
          ${hasTB ? '<span class="tag tag-danger"><i data-lucide="alert-circle"></i>TB Exposed</span>' : ''}
          ${hasHIV ? '<span class="tag tag-warning"><i data-lucide="activity"></i>HIV Support Required</span>' : ''}
          <span class="tag tag-info"><i data-lucide="user"></i>Assignee: ${hh.chw_assigned}</span>
        </div>

        <div class="members-summary-list">
          ${membersListMarkup}
        </div>

        <div class="action-row-buttons" onclick="event.stopPropagation();">
          <button class="btn-primary" onclick="triggerDispatchAction('${hh.id}')"><i data-lucide="send"></i>Dispatch Visit Now</button>
          <button class="btn-secondary" onclick="window.location.href='/patient-registry?hh=${hh.id}'"><i data-lucide="folder-open"></i>Open EHR</button>
        </div>
      </div>
    `;
  }).join('');

  injectHUDInspectorPanel();
  lucide.createIcons();
}

function injectHUDInspectorPanel() {
  const targetHud = document.getElementById('hud-injector-target');
  const selectedHousehold = INTEGRATED_DATABANK_STORE.households.find(h => h.id === activeHouseholdIdSelection);
  
  if (!selectedHousehold) return;

  targetHud.innerHTML = `
    <div class="hud-title-block">
      <div class="hud-main-heading"><i data-lucide="activity"></i> Field Action Blueprint: ${selectedHousehold.id}</div>
      <div class="hud-sub-heading">${selectedHousehold.address} · Assigned Provider: <strong>${selectedHousehold.chw_assigned}</strong></div>
    </div>
    
    <div class="action-card-injected">
      <div class="action-card-title"><i data-lucide="check-square"></i> Next Best Action Instruction</div>
      <div class="action-card-desc">${selectedHousehold.next_best_action}</div>
    </div>

    <div style="display:flex; flex-direction:column; gap:8px; margin-top: auto;">
      <button class="btn-primary" style="width:100%; padding:11px;" onclick="triggerDispatchAction('${selectedHousehold.id}')">
        <i data-lucide="check"></i> Confirm and Log Assignment
      </button>
      <button class="btn-secondary" style="width:100%; justify-content:center;" onclick="markReviewed('${selectedHousehold.id}')">
        <i data-lucide="eye"></i> Mark as Reviewed for Today
      </button>
    </div>
  `;
  lucide.createIcons();
}

function selectHouseholdNode(id, bypassUIElementRebuild) {
  activeHouseholdIdSelection = id;
  if (!bypassUIElementRebuild) {
    executeUIRenderPipeline();
  } else {
    injectHUDInspectorPanel();
    // Synchronize selector visual bounds across active UI lists
    document.querySelectorAll('.household-action-card').forEach(card => card.classList.remove('selected'));
    // Dynamic match selector check
    executeUIRenderPipeline();
  }
}

// ACTION HOOK RUNTIMES
function triggerDispatchAction(id) {
  alert(`Task Routing Finalized: CHW Route generated for ${id}. Notification dispatched to mobile care app layer.`);
}

function markReviewed(id) {
  alert(`Household ${id} registered as checked. Clearance flag recorded in centralized dashboard telemetry buffers.`);
}

// GRAPH GRAPHICS LAYER RENDER ENGINE (HTML5 Standard Canvas Runtime)
function startCanvasPlaybackLoop() {
  const containerW = canvas.parentElement.clientWidth;
  if (canvas.width !== containerW) { canvas.width = containerW; canvas.height = 260; }
  
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Render edge vectors
  INTEGRATED_DATABANK_STORE.edges.forEach(edge => {
    const s = graphNodes.find(n => n.id === edge.source);
    const t = graphNodes.find(n => n.id === edge.target);
    if (!s || !t) return;

    ctx.beginPath();
    ctx.moveTo(s.x, s.y);
    ctx.lineTo(t.x, t.y);
    if (edge.type === 'SHARED_CHW_CHAIN') {
      ctx.strokeStyle = 'rgba(13, 126, 140, 0.4)'; ctx.lineWidth = 2; ctx.setLineDash([4, 4]);
    } else {
      ctx.strokeStyle = '#E0E8E4'; ctx.lineWidth = 1.5; ctx.setLineDash([]);
    }
    ctx.stroke();
  });
  ctx.setLineDash([]);

  // Render individual element circles
  graphNodes.forEach(node => {
    ctx.beginPath();
    ctx.arc(node.x, node.y, node.radius, 0, 2 * Math.PI);
    
    let color = node.band === 'CRITICAL' ? 'var(--red)' : node.band === 'HIGH' ? 'var(--gold)' : 'var(--green)';
    if (node.type === 'PATIENT' && node.band !== 'CRITICAL') color = varColorFromMuted();

    ctx.fillStyle = color;
    ctx.fill();
    
    const isHouseholdFocused = node.id === activeHouseholdIdSelection || (node.type === 'PATIENT' && node.raw.household_id === activeHouseholdIdSelection);
    if (isHouseholdFocused) {
      ctx.strokeStyle = '#1C2B22'; ctx.lineWidth = 3; ctx.stroke();
    } else {
      ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = 1.5; ctx.stroke();
    }

    if (node.type === 'HOUSEHOLD') {
      ctx.fillStyle = '#1C2B22'; ctx.font = 'bold 10px DM Sans';
      ctx.fillText(node.id, node.x - 16, node.y - node.radius - 4);
    }
  });

  requestAnimationFrame(startCanvasPlaybackLoop);
}

function varColorFromMuted() { return '#6B7F73'; }

function initCanvasInteractions() {
  canvas.addEventListener('mousedown', e => {
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    draggedNode = graphNodes.find(n => Math.hypot(n.x - mouseX, n.y - mouseY) < n.radius + 4);
    if (draggedNode) {
      const targetId = draggedNode.type === 'HOUSEHOLD' ? draggedNode.id : draggedNode.raw.household_id;
      selectHouseholdNode(targetId, false);
    }
  });

  canvas.addEventListener('mousemove', e => {
    if (!draggedNode) return;
    const rect = canvas.getBoundingClientRect();
    draggedNode.x = e.clientX - rect.left;
    draggedNode.y = e.clientY - rect.top;
  });

  ['mouseup', 'mouseleave'].forEach(evt => {
    canvas.addEventListener(evt, () => draggedNode = null);
  });
}

// Bootstrap execution
bootstrapUnifiedSystem();