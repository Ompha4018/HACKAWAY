// sidebar.js
document.addEventListener("DOMContentLoaded", () => {
  const sidebarContainer = document.getElementById("vitalink-sidebar-target");
  if (!sidebarContainer) {
    console.error("VitaLink Framework Error: Target container #vitalink-sidebar-target missing.");
    return;
  }

  // 1. Structural HTML Component isolation allocation definition
  const sidebarHTML = `
    <button class="floating-menu-trigger" id="sidebar-open-trigger" aria-label="Open Sidebar Menu">
      <i data-lucide="menu"></i>
    </button>

    <aside class="sidebar">
      <div class="logo">
        <div>
          <div class="logo-mark">Vita<span>Link</span></div>
          <div class="logo-sub">CareSync · Innovations</div>
        </div>
        <button class="sidebar-toggle-btn" id="sidebar-close-trigger" aria-label="Collapse Sidebar Menu">
          <i data-lucide="chevron-left"></i>
        </button>
      </div>
      <nav class="nav">
        <div class="nav-section">Clinical</div>
        <a href="/" class="nav-item" data-path="/"><i data-lucide="clipboard-list"></i><span>Patient Registry</span></a>
        <a href="/register" class="nav-item" data-path="/register"><i data-lucide="user-plus"></i><span>Register Patient</span></a>
        <a href="/chw" class="nav-item" data-path="/chw"><i data-lucide="map-pin"></i><span>CHW Dispatch</span></a>
        <a href="/pharmacy" class="nav-item" data-path="/pharmacy"><i data-lucide="pill"></i><span>QuickScript</span></a>
        
        <div class="nav-section">Patient Tools</div>
        <a href="/book" class="nav-item" data-path="/book"><i data-lucide="calendar"></i><span>Book Appointment</span></a>
        <a href="/checkin" class="nav-item" data-path="/checkin"><i data-lucide="stethoscope"></i><span>Symptom Check-In</span></a>
        
        <div class="nav-section">Community</div>
        <a href="/households" class="nav-item" data-path="/households"><i data-lucide="home"></i><span>Household Risk</span></a>
        <a href="/impact" class="nav-item" data-path="/impact"><i data-lucide="trending-up"></i><span>Impact Dashboard</span></a>
      </nav>
      <div class="sidebar-footer">
        <strong>Ga-Rankuwa Clinic 1</strong>
        <span>GRK-001 · Active Node</span>
      </div>
    </aside>
  `;

  // Inject structural code elements safely
  sidebarContainer.innerHTML = sidebarHTML;

  // 2. Automated Path Location Tracking Mapping Matrix (Calculates dynamic highlighting parameters)
  const currentPathname = window.location.pathname;
  const navigationItems = sidebarContainer.querySelectorAll(".nav-item");
  
  navigationItems.forEach(item => {
    const baselinePath = item.getAttribute("data-path");
    // Remove active markers completely to prevent layout pollution handles
    item.classList.remove("active");
    
    if (baselinePath === currentPathname) {
      item.classList.add("active");
    } else if (baselinePath !== "/" && currentPathname.startsWith(baselinePath)) {
      // Handles nested subroute tracking structures neatly (e.g., /patient/1021 matching details subviews)
      item.classList.add("active");
    }
  });

  // 3. Open and Close State Controllers Logic Architecture
  const openBtn = document.getElementById("sidebar-open-trigger");
  const closeBtn = document.getElementById("sidebar-close-trigger");

  // Keep state tracked uniformly across screen loads using standard localStorage mappings
  const isCollapsed = localStorage.getItem("vitalink_sidebar_collapsed") === "true";
  if (isCollapsed) {
    document.body.classList.add("sidebar-collapsed");
  }

  openBtn.addEventListener("click", () => {
    document.body.classList.remove("sidebar-collapsed");
    localStorage.setItem("vitalink_sidebar_collapsed", "false");
  });

  closeBtn.addEventListener("click", () => {
    document.body.classList.add("sidebar-collapsed");
    localStorage.setItem("vitalink_sidebar_collapsed", "true");
  });

  // Re-run vector symbol mapper initialization if lucide engine asset modules are active
  if (window.lucide && typeof lucide.createIcons === "function") {
    lucide.createIcons();
  }
});