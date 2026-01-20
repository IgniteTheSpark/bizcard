/* global window, document */
// BizCard 2.0 Unified Timeline - Prototype Logic

const DATA = window.__PROTO_DATA__;

// ============================================
// Utilities
// ============================================

function $(sel, root = document) {
  return root.querySelector(sel);
}

function $$(sel, root = document) {
  return Array.from(root.querySelectorAll(sel));
}

function escapeHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function parseISO(iso) {
  return new Date(iso);
}

function fmtTime(iso) {
  const d = parseISO(iso);
  const h = d.getHours();
  const m = d.getMinutes().toString().padStart(2, "0");
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = ((h + 11) % 12) + 1;
  return `${h12}:${m} ${ampm}`;
}

function fmtDate(iso) {
  const d = parseISO(iso);
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${months[d.getMonth()]} ${d.getDate()}`;
}

function fmtFullDate(iso) {
  const d = parseISO(iso);
  const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  return `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

function fmtDayLabel(iso) {
  const d = parseISO(iso);
  const months = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
  const today = new Date("2026-01-08");
  const isToday = d.toDateString() === today.toDateString();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday = d.toDateString() === yesterday.toDateString();
  
  const label = `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
  if (isToday) return `${label} (Today)`;
  if (isYesterday) return `${label} (Yesterday)`;
  return label;
}

function getDayKey(iso) {
  const d = parseISO(iso);
  return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, "0")}-${d.getDate().toString().padStart(2, "0")}`;
}

function getContact(id) {
  return DATA.CONTACTS.find((c) => c.id === id);
}

function getTimelineItem(id) {
  return state.timeline.find((t) => t.id === id);
}

// ============================================
// State
// ============================================

const state = {
  scope: {
    q: "",
    view: "all", // all | meetings | calls
    personIds: [], // Multi-select contacts
    dateFrom: null, // Date object or null
    dateTo: null, // Date object or null
  },
  ui: {
    currentPage: "timeline", // timeline | actions
    openClusterIds: new Set(),
    fabOpen: false,
    hwConnected: DATA.HARDWARE.connected,
    selectedPersonIds: [], // Temp selection in person picker modal
    smartBannerDismissed: false, // Smart Banner visibility
  },
  // Temp state for search modal (before apply)
  searchTemp: {
    q: "",
    view: "all",
    personIds: [],
    dateFrom: null,
    dateTo: null,
  },
  actions: DATA.ACTIONS.map((a) => ({ ...a })),
  timeline: DATA.TIMELINE.map((t) => ({ ...t })),
  toast: {
    timer: null,
    undoFn: null,
  },
};

// ============================================
// DOM References
// ============================================

const el = {
  app: $("#app"),
  scrollContainer: $("#scrollContainer"),
  context: $("#context"),
  actionhubToggle: $("#actionhubToggle"),
  actionhubPanel: $("#actionhubPanel"),
  actionhubBadge: $("#actionhubBadge"),
  actionhubTitle: $("#actionhubTitle"),
  actionList: $("#actionList"),
  scopeChips: $("#scopeChips"),
  btnClearScope: $("#btnClearScope"),
  streamInner: $("#streamInner"),
  
  // Header
  btnDrawer: $("#btnDrawer"),
  btnShare: $("#btnShare"),
  hwStatusBar: $("#hwStatusBar"),
  hwStatusPill: $("#hwStatusPill"),
  btnMeetings: $("#btnMeetings"),
  btnCalls: $("#btnCalls"),
  btnDate: $("#btnDate"),
  btnPerson: $("#btnPerson"),
  
  // FAB
  fab: $("#fab"),
  fabMain: $("#fabMain"),
  fabMenu: $("#fabMenu"),
  
  // Overlays
  backdrop: $("#backdrop"),
  drawer: $("#drawer"),
  btnCloseDrawer: $("#btnCloseDrawer"),
  hwConnectedState: $("#hwConnectedState"),
  hwDisconnectedState: $("#hwDisconnectedState"),
  btnConnectHw: $("#btnConnectHw"),
  btnDisconnectHw: $("#btnDisconnectHw"),
  hwModalStatus: $("#hwModalStatus"),
  btnHwSettings: $("#btnHwSettings"),
  personModal: $("#personModal"),
  dateModal: $("#dateModal"),
  actionModal: $("#actionModal"),
  contactModal: $("#contactModal"),
  meetingModal: $("#meetingModal"),
  hardwareModal: $("#hardwareModal"),
  contactDetailBody: $("#contactDetailBody"),
  meetingDetailBody: $("#meetingDetailBody"),
  // Drawer Navigation
  btnHardwareSettings: $("#btnHardwareSettings"),
  btnAgentSettings: $("#btnAgentSettings"),
  btnAccountSettings: $("#btnAccountSettings"),
  btnEditProfile: $("#btnEditProfile"),
  hwNavStatus: $("#hwNavStatus"),
  personSearch: $("#personSearch"),
  personList: $("#personList"),
  personModalFooter: $("#personModalFooter"),
  btnApplyPersons: $("#btnApplyPersons"),
  // Filter Tabs
  filterTabs: $("#filterTabs"),
  // Active Filters Bar
  activeFiltersBar: $("#activeFiltersBar"),
  activeFiltersList: $("#activeFiltersList"),
  btnClearFilters: $("#btnClearFilters"),
  
  // Bottom Bar & View Switcher
  bottomBar: $("#bottomBar"),
  viewSwitcher: $("#viewSwitcher"),
  actionsBadge: $("#actionsBadge"),
  // Pages
  pageTimeline: $("#pageTimeline"),
  pageActions: $("#pageActions"),
  actionsContent: $("#actionsContent"),
  
  // Search Modal
  btnSearch: $("#btnSearch"),
  searchModal: $("#searchModal"),
  searchModalInput: $("#searchModalInput"),
  searchInputClear: $("#searchInputClear"),
  btnSearchCancel: $("#btnSearchCancel"),
  btnSearchApply: $("#btnSearchApply"),
  btnShowAllPeople: $("#btnShowAllPeople"),
  btnHideAllPeople: $("#btnHideAllPeople"),
  peopleSection: $("#peopleSection"),
  peopleQuickList: $("#peopleQuickList"),
  allContactsSection: $("#allContactsSection"),
  allContactsList: $("#allContactsList"),
  allContactsSearchInput: $("#allContactsSearchInput"),
  allContactsSelectedCount: $("#allContactsSelectedCount"),
  btnConfirmAllContacts: $("#btnConfirmAllContacts"),
  // Date Picker
  datePresets: $("#datePresets"),
  dateFrom: $("#dateFrom"),
  dateTo: $("#dateTo"),
  btnApplyDate: $("#btnApplyDate"),
  noteModal: $("#noteModal"),
  noteInput: $("#noteInput"),
  btnAddNote: $("#btnAddNote"),
  // Insights & Smart Banner
  insightsModule: $("#insightsModule"),
  insightsGrid: $("#insightsGrid"),
  insightsPeriod: $("#insightsPeriod"),
  insightMeetings: $("#insightMeetings"),
  insightCalls: $("#insightCalls"),
  insightVisits: $("#insightVisits"),
  insightContacts: $("#insightContacts"),
  smartBanner: $("#smartBanner"),
  smartBannerClose: $("#smartBannerClose"),
  smartBannerAction: $("#smartBannerAction"),
  // Edit Action Modal
  editActionModal: $("#editActionModal"),
  editActionInput: $("#editActionInput"),
  btnSaveEditAction: $("#btnSaveEditAction"),
  btnCancelEditAction: $("#btnCancelEditAction"),
  
  // Toast
  toast: $("#toast"),
  toastMsg: $("#toastMsg"),
  toastAction: $("#toastAction"),
};

// ============================================
// Overlay Management
// ============================================

function lockApp(lock) {
  el.app.classList.toggle("locked", lock);
}

function closeAllOverlays() {
  closeDrawer();
  closeSearchModal();
  closeModal(el.personModal);
  closeModal(el.dateModal);
  closeModal(el.noteModal);
  closeModal(el.contactModal);
  closeModal(el.meetingModal);
  if (el.hardwareModal) closeModal(el.hardwareModal);
  closeFab();
}

function openDrawer() {
  closeAllOverlays();
  el.drawer.classList.add("open");
  el.backdrop.hidden = false;
  lockApp(true);
  updateHardwareUI();
}

function closeDrawer() {
  el.drawer.classList.remove("open");
  el.backdrop.hidden = true;
  lockApp(false);
}

function openModal(modalEl) {
  closeAllOverlays();
  modalEl.hidden = false;
  lockApp(true);
}

function closeModal(modalEl) {
  modalEl.hidden = true;
  lockApp(false);
}

function openSearchModal() {
  // Copy current scope to temp
  state.searchTemp = {
    q: state.scope.q,
    view: state.scope.view,
    personIds: [...state.scope.personIds],
    dateFrom: state.scope.dateFrom,
    dateTo: state.scope.dateTo,
  };
  
  el.searchModal.hidden = false;
  lockApp(true);
  
  // Reset to quick list view
  showPeopleQuickView();
  
  // Sync to input
  if (el.searchModalInput) {
    el.searchModalInput.value = state.searchTemp.q || "";
    el.searchModalInput.focus();
    updateSearchInputClear();
  }
  
  updateSearchModalFilters();
  renderPeopleQuickList();
}

function closeSearchModal() {
  // Cancel - just close without applying
  el.searchModal.hidden = true;
  lockApp(false);
}

function applySearch() {
  // Apply temp state to scope
  state.scope.q = state.searchTemp.q;
  state.scope.view = state.searchTemp.view;
  state.scope.personIds = [...state.searchTemp.personIds];
  state.scope.dateFrom = state.searchTemp.dateFrom;
  state.scope.dateTo = state.searchTemp.dateTo;
  
  closeSearchModal();
  render();
}

function updateSearchInputClear() {
  if (el.searchInputClear) {
    el.searchInputClear.hidden = !state.searchTemp.q;
  }
}

function updateSearchModalFilters() {
  // Update type filter buttons
  $$("[data-sfilter]").forEach((btn) => {
    const filter = btn.dataset.sfilter;
    btn.classList.toggle("active", state.searchTemp.view === filter);
  });
  
  // Update date buttons
  $$("[data-sdate]").forEach((btn) => {
    btn.classList.remove("active");
  });
}

function renderPeopleQuickList() {
  if (!el.peopleQuickList) return;
  
  // Show first 6 contacts as "frequent"
  const contacts = DATA.CONTACTS.slice(0, 6);
  
  el.peopleQuickList.innerHTML = contacts.map((c) => `
    <div class="people-quick-item ${state.searchTemp.personIds.includes(c.id) ? "selected" : ""}" data-quick-person="${c.id}">
      <div class="people-quick-avatar">${escapeHtml(c.initials)}</div>
      <div class="people-quick-name">${escapeHtml(c.name.split(" ")[0])}</div>
    </div>
  `).join("");
  
  // Bind clicks
  $$("[data-quick-person]", el.peopleQuickList).forEach((item) => {
    item.onclick = () => {
      const pid = item.dataset.quickPerson;
      togglePersonInSearchTemp(pid);
      item.classList.toggle("selected", state.searchTemp.personIds.includes(pid));
    };
  });
}

function togglePersonInSearchTemp(pid) {
  if (state.searchTemp.personIds.includes(pid)) {
    state.searchTemp.personIds = state.searchTemp.personIds.filter((id) => id !== pid);
  } else {
    state.searchTemp.personIds.push(pid);
  }
}

function showPeopleQuickView() {
  if (el.peopleSection) el.peopleSection.hidden = false;
  if (el.allContactsSection) el.allContactsSection.hidden = true;
}

function showAllContactsView() {
  if (el.peopleSection) el.peopleSection.hidden = true;
  if (el.allContactsSection) el.allContactsSection.hidden = false;
  renderAllContactsList();
}

// Get statistics for a contact
function getContactStats(contactId) {
  const pendingActions = state.actions.filter(
    (a) => a.status === "pending" && (a.relatedContactIds || []).includes(contactId)
  ).length;
  
  const meetings = DATA.TIMELINE.filter(
    (t) => t.type === "meeting" && (t.contactIds || []).includes(contactId)
  ).length;
  
  const calls = DATA.TIMELINE.filter(
    (t) => t.type === "call" && (t.contactIds || []).includes(contactId)
  ).length;
  
  return { pendingActions, meetings, calls };
}

function renderContactStats(contactId) {
  const stats = getContactStats(contactId);
  const parts = [];
  
  if (stats.pendingActions > 0) {
    parts.push(`<span class="stat-badge action">${stats.pendingActions} action${stats.pendingActions > 1 ? "s" : ""}</span>`);
  }
  if (stats.meetings > 0) {
    parts.push(`<span class="stat-badge meeting">${stats.meetings} meeting${stats.meetings > 1 ? "s" : ""}</span>`);
  }
  if (stats.calls > 0) {
    parts.push(`<span class="stat-badge call">${stats.calls} call${stats.calls > 1 ? "s" : ""}</span>`);
  }
  
  return parts.length > 0 ? `<div class="contact-stats">${parts.join("")}</div>` : "";
}

function renderAllContactsList(searchQuery = "") {
  if (!el.allContactsList) return;
  
  let contacts = DATA.CONTACTS;
  
  // Filter by search query
  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    contacts = contacts.filter((c) => 
      c.name.toLowerCase().includes(q) ||
      (c.title && c.title.toLowerCase().includes(q)) ||
      (c.company && c.company.toLowerCase().includes(q))
    );
  }
  
  el.allContactsList.innerHTML = contacts.map((c) => `
    <div class="all-contacts-item ${state.searchTemp.personIds.includes(c.id) ? "selected" : ""}" data-all-contact="${c.id}">
      <div class="all-contacts-avatar">${escapeHtml(c.initials)}</div>
      <div class="all-contacts-info">
        <div class="all-contacts-name">${escapeHtml(c.name)}</div>
        <div class="all-contacts-title">${escapeHtml(c.title || "")} ${c.company ? "@ " + escapeHtml(c.company) : ""}</div>
        ${renderContactStats(c.id)}
      </div>
      <div class="all-contacts-check">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
          <polyline points="20 6 9 17 4 12"/>
        </svg>
      </div>
    </div>
  `).join("");
  
  // Bind clicks
  $$("[data-all-contact]", el.allContactsList).forEach((item) => {
    item.onclick = () => {
      const pid = item.dataset.allContact;
      togglePersonInSearchTemp(pid);
      item.classList.toggle("selected", state.searchTemp.personIds.includes(pid));
      updateAllContactsSelectedCount();
    };
  });
  
  updateAllContactsSelectedCount();
}

function updateAllContactsSelectedCount() {
  const count = state.searchTemp.personIds.length;
  if (el.allContactsSelectedCount) {
    el.allContactsSelectedCount.textContent = `${count} selected`;
  }
}

function confirmAllContactsSelection() {
  // Go back to People quick view and update it
  showPeopleQuickView();
  renderPeopleQuickList();
}

function toggleFab() {
  state.ui.fabOpen = !state.ui.fabOpen;
  el.fabMenu.hidden = !state.ui.fabOpen;
  el.fabMain.setAttribute("aria-expanded", state.ui.fabOpen ? "true" : "false");
}

function closeFab() {
  state.ui.fabOpen = false;
  el.fabMenu.hidden = true;
  el.fabMain.setAttribute("aria-expanded", "false");
}

// (updateSearchClearButton removed - now using search modal)

// ============================================
// Hardware UI
// ============================================

function updateHardwareUI() {
  const hw = DATA.HARDWARE;
  
  // Update header hardware status bar (main entry point)
  if (state.ui.hwConnected) {
    el.hwStatusPill.innerHTML = `
      <span class="hw-dot connected"></span>
      <span class="hw-name">${escapeHtml(hw.deviceName)}</span>
      <span class="hw-battery">🔋 ${hw.batteryPercent}%</span>
      <span class="hw-signal">📶</span>
    `;
    el.hwStatusPill.classList.add("connected");
    el.hwStatusPill.classList.remove("disconnected");
  } else {
    el.hwStatusPill.innerHTML = `
      <span class="hw-dot disconnected"></span>
      <span class="hw-name">Not connected</span>
    `;
    el.hwStatusPill.classList.add("disconnected");
    el.hwStatusPill.classList.remove("connected");
  }
  
  // Update drawer navigation status
  if (el.hwNavStatus) {
    if (state.ui.hwConnected) {
      el.hwNavStatus.textContent = `${hw.deviceName} · Connected`;
    } else {
      el.hwNavStatus.textContent = "Not connected";
    }
  }
  
  // Update hardware modal states
  if (el.hwConnectedState && el.hwDisconnectedState) {
    el.hwConnectedState.hidden = !state.ui.hwConnected;
    el.hwDisconnectedState.hidden = state.ui.hwConnected;
  }
}

function connectHardware() {
  state.ui.hwConnected = true;
  updateHardwareUI();
  showToast("BizCard Pro connected!", null);
}

function disconnectHardware() {
  state.ui.hwConnected = false;
  updateHardwareUI();
  showToast("Device disconnected", null);
}

// ============================================
// Toast
// ============================================

function showToast(message, undoFn) {
  el.toastMsg.textContent = message;
  el.toast.hidden = false;
  
  if (state.toast.timer) clearTimeout(state.toast.timer);
  
  if (undoFn) {
    el.toastAction.hidden = false;
    state.toast.undoFn = undoFn;
  } else {
    el.toastAction.hidden = true;
    state.toast.undoFn = null;
  }
  
  state.toast.timer = setTimeout(hideToast, 4000);
}

function hideToast() {
  el.toast.hidden = true;
  if (state.toast.timer) {
    clearTimeout(state.toast.timer);
    state.toast.timer = null;
  }
  state.toast.undoFn = null;
}

// ============================================
// Scope / Filtering
// ============================================

function clearScope() {
  state.scope.q = "";
  state.scope.view = "all";
  state.scope.personIds = [];
  state.scope.dateFrom = null;
  state.scope.dateTo = null;
  if (el.searchModalInput) el.searchModalInput.value = "";
}

// (updateFilterPills removed - using search modal filters now)

function getScopeChips() {
  const chips = [];
  if (state.scope.q) {
    chips.push({ key: "q", label: `"${state.scope.q}"` });
  }
  if (state.scope.view !== "all") {
    chips.push({ key: "view", label: state.scope.view === "meetings" ? "Meetings" : "Calls" });
  }
  if (state.scope.dateFrom || state.scope.dateTo) {
    const fromStr = state.scope.dateFrom ? fmtShortDate(state.scope.dateFrom) : "";
    const toStr = state.scope.dateTo ? fmtShortDate(state.scope.dateTo) : "";
    let label = "";
    if (fromStr && toStr) {
      label = `${fromStr} - ${toStr}`;
    } else if (fromStr) {
      label = `From ${fromStr}`;
    } else {
      label = `To ${toStr}`;
    }
    chips.push({ key: "date", label });
  }
  // Don't add personIds here, they're shown in active filters
  return chips;
}

function removeScopeKey(key) {
  if (key === "q") { 
    state.scope.q = ""; 
    if (el.searchModalInput) el.searchModalInput.value = ""; 
  }
  if (key === "view") state.scope.view = "all";
  if (key === "date") { state.scope.dateFrom = null; state.scope.dateTo = null; }
}

function removePersonFromScope(personId) {
  state.scope.personIds = state.scope.personIds.filter((id) => id !== personId);
  render();
}

function withinDateRange(iso) {
  // No date filter
  if (!state.scope.dateFrom && !state.scope.dateTo) return true;
  
  const d = parseISO(iso);
  d.setHours(0, 0, 0, 0);
  
  if (state.scope.dateFrom) {
    const from = new Date(state.scope.dateFrom);
    from.setHours(0, 0, 0, 0);
    if (d < from) return false;
  }
  
  if (state.scope.dateTo) {
    const to = new Date(state.scope.dateTo);
    to.setHours(23, 59, 59, 999);
    if (d > to) return false;
  }
  
  return true;
}

function matchesQuery(item, q) {
  if (!q) return true;
  const needle = q.toLowerCase().trim();
  if (!needle) return true;
  
  const contacts = (item.contactIds || [])
    .map(getContact)
    .filter(Boolean)
    .map((c) => `${c.name} ${c.title}`)
    .join(" ");
  
  const hay = `${item.title || ""} ${item.summary || ""} ${contacts}`.toLowerCase();
  return hay.includes(needle);
}

function matchesPersons(item) {
  if (state.scope.personIds.length === 0) return true;
  // Item must have at least one of the selected persons
  return (item.contactIds || []).some((cid) => state.scope.personIds.includes(cid));
}

function matchesView(item) {
  if (state.scope.view === "all") return true;
  if (state.scope.view === "meetings") return item.type === "meeting";
  if (state.scope.view === "calls") return item.type === "call";
  return true;
}

function getFilteredTimeline() {
  return state.timeline
    .filter((it) => withinDateRange(it.timestamp))
    .filter((it) => matchesPersons(it))
    .filter((it) => matchesQuery(it, state.scope.q))
    .filter((it) => matchesView(it));
}

function getFilteredActions(pendingOnly = false) {
  // Get all actions, or only pending ones
  let actions = pendingOnly 
    ? state.actions.filter((a) => a.status === "pending")
    : [...state.actions];
  
  // Apply search query
  if (state.scope.q) {
    const q = state.scope.q.toLowerCase();
    actions = actions.filter((a) => {
      const title = (a.title || "").toLowerCase();
      const names = (a.relatedContactIds || [])
        .map(getContact)
        .filter(Boolean)
        .map((c) => c.name.toLowerCase())
        .join(" ");
      return title.includes(q) || names.includes(q);
    });
  }
  
  // Apply view/type filter (meetings, calls)
  if (state.scope.view === "meetings") {
    actions = actions.filter((a) => a.source === "meeting");
  } else if (state.scope.view === "calls") {
    actions = actions.filter((a) => a.source === "call");
  }
  
  // Apply person filter
  if (state.scope.personIds.length > 0) {
    actions = actions.filter((a) => 
      (a.relatedContactIds || []).some((cid) => state.scope.personIds.includes(cid))
    );
  }
  
  // Apply date filter (based on related date)
  if (state.scope.dateFrom || state.scope.dateTo) {
    actions = actions.filter((a) => {
      if (!a.relatedDate) return true; // Keep actions without date
      return withinDateRange(a.relatedDate);
    });
  }
  
  // Sort: pending first, then done
  actions.sort((a, b) => {
    if (a.status === "pending" && b.status !== "pending") return -1;
    if (a.status !== "pending" && b.status === "pending") return 1;
    return 0;
  });
  
  // Note: view filter (meetings/calls) doesn't apply to actions directly
  // Actions are linked to timeline items which have types
  
  return actions;
}

// ============================================
// Rendering
// ============================================

function renderActiveFiltersBar() {
  // Update filter tabs state
  $$("[data-view]", el.filterTabs).forEach((tab) => {
    tab.classList.toggle("active", tab.dataset.view === state.scope.view);
  });
  
  // Update filter icon buttons
  el.btnDate.classList.toggle("active", !!(state.scope.dateFrom || state.scope.dateTo));
  el.btnPerson.classList.toggle("active", state.scope.personIds.length > 0);
  
  // Build list of removable filter chips (exclude view since it's in tabs)
  const filters = [];
  
  // 1. Search query
  if (state.scope.q) {
    filters.push({
      type: "query",
      icon: "🔍",
      text: state.scope.q,
      onRemove: () => {
        state.scope.q = "";
        if (el.searchModalInput) el.searchModalInput.value = "";
      }
    });
  }
  
  // 2. Date range
  if (state.scope.dateFrom || state.scope.dateTo) {
    const fromStr = state.scope.dateFrom ? fmtShortDate(state.scope.dateFrom) : "";
    const toStr = state.scope.dateTo ? fmtShortDate(state.scope.dateTo) : "";
    let dateText = "";
    if (fromStr && toStr) {
      dateText = `${fromStr} - ${toStr}`;
    } else if (fromStr) {
      dateText = `From ${fromStr}`;
    } else {
      dateText = `To ${toStr}`;
    }
    
    filters.push({
      type: "date",
      icon: "📅",
      text: dateText,
      onRemove: () => {
        state.scope.dateFrom = null;
        state.scope.dateTo = null;
      }
    });
  }
  
  // 3. Selected contacts
  state.scope.personIds.forEach((pid) => {
    const contact = getContact(pid);
    if (contact) {
      filters.push({
        type: "person",
        icon: null,
        avatar: contact.initials,
        text: contact.name.split(" ")[0], // First name only
        contactId: pid,
        onRemove: () => {
          state.scope.personIds = state.scope.personIds.filter((id) => id !== pid);
        }
      });
    }
  });
  
  // If no chips needed, hide the bar
  if (filters.length === 0) {
    el.activeFiltersBar.hidden = true;
    return;
  }
  
  // Render filter chips
  el.activeFiltersList.innerHTML = filters.map((f, i) => {
    if (f.type === "person") {
      return `
        <span class="filter-chip person-chip" data-filter-idx="${i}">
          <span class="filter-chip-avatar">${escapeHtml(f.avatar)}</span>
          <span class="filter-chip-text">${escapeHtml(f.text)}</span>
          <button class="filter-chip-remove" data-remove-filter="${i}">✕</button>
        </span>
      `;
    }
    return `
      <span class="filter-chip" data-filter-idx="${i}">
        <span class="filter-chip-icon">${f.icon}</span>
        <span class="filter-chip-text">${escapeHtml(f.text)}</span>
        <button class="filter-chip-remove" data-remove-filter="${i}">✕</button>
      </span>
    `;
  }).join("");
  
  el.activeFiltersBar.hidden = false;
  
  // Bind remove events
  $$("[data-remove-filter]", el.activeFiltersList).forEach((btn) => {
    btn.onclick = (e) => {
      e.stopPropagation();
      const idx = parseInt(btn.dataset.removeFilter, 10);
      if (filters[idx] && filters[idx].onRemove) {
        filters[idx].onRemove();
        render();
      }
    };
  });
  
  // Person chip click -> open contact detail
  $$(".person-chip", el.activeFiltersList).forEach((chip) => {
    chip.onclick = (e) => {
      if (e.target.classList.contains("filter-chip-remove")) return;
      const idx = parseInt(chip.dataset.filterIdx, 10);
      if (filters[idx] && filters[idx].contactId) {
        openContactDetail(filters[idx].contactId);
      }
    };
  });
}

// Helper for short date format
function fmtShortDate(date) {
  if (!date) return "";
  const d = new Date(date);
  const month = d.getMonth() + 1;
  const day = d.getDate();
  return `${month}.${day}`;
}

function renderScopeChips() {
  const chips = getScopeChips();
  
  if (chips.length === 0) {
    el.scopeChips.innerHTML = '<span style="color: var(--text-tertiary); font-size: 12px;">No filters</span>';
    return;
  }
  
  el.scopeChips.innerHTML = chips
    .map((c) => `
      <div class="chip">
        <span>${escapeHtml(c.label)}</span>
        <button class="chip-close" data-chip="${c.key}">✕</button>
      </div>
    `)
    .join("");
  
  $$("[data-chip]", el.scopeChips).forEach((btn) => {
    btn.onclick = () => {
      removeScopeKey(btn.dataset.chip);
      render();
    };
  });
}

// ============================================
// Insights Module
// ============================================

function getInsightsData() {
  // Count based on current filters
  const filteredTimeline = getFilteredTimeline();
  
  const meetings = filteredTimeline.filter((t) => t.type === "meeting").length;
  const calls = filteredTimeline.filter((t) => t.type === "call").length;
  
  // Visits = cluster items (profile views, clicks, etc.)
  let visits = 0;
  filteredTimeline.forEach((t) => {
    if (t.type === "cluster" && t.microMeta?.items) {
      visits += t.microMeta.items.length;
    }
  });
  
  // Contacts added (business cards) in filtered timeline
  const contacts = filteredTimeline.filter((t) => t.type === "card").length;
  
  return { meetings, calls, visits, contacts };
}

function getInsightsPeriodLabel() {
  // Generate period label based on current filters
  if (state.scope.dateFrom && state.scope.dateTo) {
    const from = fmtShortDate(state.scope.dateFrom);
    const to = fmtShortDate(state.scope.dateTo);
    if (from === to) {
      return from;
    }
    return `${from} - ${to}`;
  }
  if (state.scope.dateFrom) {
    return `From ${fmtShortDate(state.scope.dateFrom)}`;
  }
  if (state.scope.dateTo) {
    return `To ${fmtShortDate(state.scope.dateTo)}`;
  }
  if (state.scope.personIds.length > 0) {
    const names = state.scope.personIds
      .map(getContact)
      .filter(Boolean)
      .map((c) => c.name.split(" ")[0])
      .slice(0, 2)
      .join(", ");
    return names + (state.scope.personIds.length > 2 ? "..." : "");
  }
  return "All Time";
}

function renderInsights() {
  if (!el.insightsModule) return;
  
  const data = getInsightsData();
  
  // Update values
  if (el.insightMeetings) el.insightMeetings.textContent = data.meetings;
  if (el.insightCalls) el.insightCalls.textContent = data.calls;
  if (el.insightVisits) el.insightVisits.textContent = data.visits;
  if (el.insightContacts) el.insightContacts.textContent = data.contacts;
  
  // Update period label
  if (el.insightsPeriod) {
    el.insightsPeriod.textContent = getInsightsPeriodLabel();
  }
}

function renderSmartBanner() {
  if (!el.smartBanner) return;
  
  // Hide if dismissed
  if (state.ui.smartBannerDismissed) {
    el.smartBanner.hidden = true;
    return;
  }
  
  // Show different content based on context
  if (!state.ui.hwConnected) {
    el.smartBanner.innerHTML = `
      <div class="smart-banner-icon">📱</div>
      <div class="smart-banner-content">
        <div class="smart-banner-text">Connect your BizCard hardware</div>
        <div class="smart-banner-subtext">Enable NFC sharing and sync your profile</div>
      </div>
      <button class="smart-banner-action" id="smartBannerAction">Connect</button>
      <button class="smart-banner-close" id="smartBannerClose">×</button>
    `;
  } else {
    // Show a tip or promotional content when connected
    el.smartBanner.innerHTML = `
      <div class="smart-banner-icon">💡</div>
      <div class="smart-banner-content">
        <div class="smart-banner-text">Try Agent Call feature</div>
        <div class="smart-banner-subtext">Let AI handle incoming calls for you</div>
      </div>
      <button class="smart-banner-action" id="smartBannerAction">Learn More</button>
      <button class="smart-banner-close" id="smartBannerClose">×</button>
    `;
  }
  
  el.smartBanner.hidden = false;
  
  // Rebind events
  const closeBtn = $("#smartBannerClose", el.smartBanner);
  const actionBtn = $("#smartBannerAction", el.smartBanner);
  
  if (closeBtn) {
    closeBtn.onclick = () => {
      state.ui.smartBannerDismissed = true;
      el.smartBanner.hidden = true;
    };
  }
  
  if (actionBtn) {
    actionBtn.onclick = () => {
      if (!state.ui.hwConnected) {
        openModal(el.hardwareModal);
      } else {
        showToast("Agent Call settings (Coming Soon)", null);
      }
    };
  }
}

function renderActionsPage() {
  // Render Insights first
  renderInsights();
  
  // Render Smart Banner
  renderSmartBanner();
  
  const actions = getFilteredActions(); // Now returns all actions (pending + done)
  const pendingCount = actions.filter((a) => a.status === "pending").length;
  const doneCount = actions.filter((a) => a.status === "done").length;
  
  if (!el.actionsContent) return;
  
  if (actions.length === 0) {
    el.actionsContent.innerHTML = `
      <div class="actions-empty">
        <div class="actions-empty-icon">📋</div>
        <div class="actions-empty-title">No Actions</div>
        <div class="actions-empty-text">No actions${state.scope.q || state.scope.personIds.length ? " matching your filters" : ""}</div>
      </div>
    `;
    return;
  }
  
  // Separate system-generated and user actions
  const systemActions = actions.filter((a) => a.source === "system" && a.status === "pending");
  const userPendingActions = actions.filter((a) => a.source !== "system" && a.status === "pending");
  const doneActions = actions.filter((a) => a.status === "done");
  
  // Group header showing counts
  const headerHtml = `
    <div class="actions-header">
      <span class="actions-count-pending">${pendingCount} pending</span>
      ${doneCount > 0 ? `<span class="actions-count-done">${doneCount} completed</span>` : ""}
    </div>
  `;
  
  // Helper to render a single action card
  function renderActionCard(a) {
    const contacts = (a.relatedContactIds || [])
      .map(getContact)
      .filter(Boolean);
    const names = contacts.map((c) => c.name).join(", ");
    
    const meetingTitle = a.relatedMeetingTitle || "";
    const relatedDate = a.relatedDate ? fmtDate(a.relatedDate) : "";
    const timelineItemId = a.relatedTimelineItemId || "";
    const isDone = a.status === "done";
    
    // Source badge
    let sourceIcon, sourceLabel;
    if (a.source === "system") {
      sourceIcon = "🔔";
      sourceLabel = a.systemMeta?.type === "reconnect" ? "Reconnect" : 
                    a.systemMeta?.type === "follow_up" ? "Follow Up" : "Reminder";
    } else {
      sourceIcon = a.source === "meeting" ? "📍" : a.source === "call" ? "🤖" : "✏️";
      sourceLabel = a.source === "meeting" ? "Meeting" : a.source === "call" ? "Agent Call" : "Manual";
    }
    
    // System reason text
    const systemReason = a.source === "system" && a.systemMeta?.reason ? a.systemMeta.reason : "";
    
    return `
      <div class="action-card ${isDone ? "done" : ""} ${a.source === "system" ? "system-action" : ""}" data-action-id="${escapeHtml(a.id)}">
        <div class="action-card-checkbox ${isDone ? "checked" : ""}" data-toggle-action="${escapeHtml(a.id)}">
          ${isDone ? "✓" : ""}
        </div>
        <div class="action-card-body">
          <div class="action-card-header">
            <span class="action-card-source source-${a.source || 'manual'}">${sourceIcon} ${sourceLabel}</span>
            ${relatedDate ? `<span class="action-card-date">${escapeHtml(relatedDate)}</span>` : ""}
          </div>
          <div class="action-card-title">${escapeHtml(a.title)}</div>
          ${contacts.length > 0 ? `
            <div class="action-card-people">
              ${contacts.map((c) => `<span class="action-card-avatar" title="${escapeHtml(c.name)}">${escapeHtml(c.initials)}</span>`).join("")}
              <span class="action-card-names">${escapeHtml(names)}</span>
            </div>
          ` : ""}
          ${systemReason ? `<div class="action-card-reason">💡 ${escapeHtml(systemReason)}</div>` : ""}
          ${meetingTitle ? `<div class="action-card-meeting" data-goto-meeting="${escapeHtml(timelineItemId)}">↳ ${escapeHtml(meetingTitle)}</div>` : ""}
        </div>
        <button class="action-card-edit" data-edit-action-page="${escapeHtml(a.id)}" title="Edit">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
            <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
          </svg>
        </button>
      </div>
    `;
  }
  
  // Build grouped HTML
  let contentHtml = headerHtml;
  
  // System-generated reminders section (if any)
  if (systemActions.length > 0) {
    contentHtml += `
      <div class="actions-section">
        <div class="actions-section-title">
          <span class="actions-section-icon">🔔</span>
          <span>Suggested Actions</span>
        </div>
        ${systemActions.map(renderActionCard).join("")}
      </div>
    `;
  }
  
  // User pending actions section
  if (userPendingActions.length > 0) {
    contentHtml += `
      <div class="actions-section">
        <div class="actions-section-title">
          <span class="actions-section-icon">📋</span>
          <span>My Tasks</span>
        </div>
        ${userPendingActions.map(renderActionCard).join("")}
      </div>
    `;
  }
  
  // Completed section
  if (doneActions.length > 0) {
    contentHtml += `
      <div class="actions-section actions-section-done">
        <div class="actions-section-title">
          <span class="actions-section-icon">✓</span>
          <span>Completed</span>
        </div>
        ${doneActions.map(renderActionCard).join("")}
      </div>
    `;
  }
  
  el.actionsContent.innerHTML = contentHtml;
  
  // Bind checkbox toggle - use handleActionComplete for proper timeline sync
  $$("[data-toggle-action]", el.actionsContent).forEach((cb) => {
    cb.onclick = () => {
      const actionId = cb.dataset.toggleAction;
      const action = state.actions.find((a) => a.id === actionId);
      if (action) {
        const newStatus = action.status === "done" ? false : true;
        handleActionComplete(actionId, newStatus);
      }
    };
  });
  
  // Bind meeting link -> switch to timeline and show meeting
  $$("[data-goto-meeting]", el.actionsContent).forEach((tag) => {
    tag.onclick = (e) => {
      e.stopPropagation();
      const timelineItemId = tag.dataset.gotoMeeting;
      if (timelineItemId) {
        switchPage("timeline");
        setTimeout(() => openMeetingDetail(timelineItemId), 150);
      }
    };
  });
  
  // Bind edit buttons on actions page
  $$("[data-edit-action-page]", el.actionsContent).forEach((btn) => {
    btn.onclick = (e) => {
      e.stopPropagation();
      const actionId = btn.dataset.editActionPage;
      editActionItemFromPage(actionId);
    };
  });
}

function editActionItemFromPage(actionId) {
  openEditActionModal(actionId, "page");
}

function handleActionComplete(actionId, checked) {
  const idx = state.actions.findIndex((a) => a.id === actionId);
  if (idx < 0) return;
  
  const prev = state.actions[idx].status;
  state.actions[idx].status = checked ? "done" : "pending";
  
  // Track which log belongs to this action
  const logId = "log_" + actionId;
  
  if (checked) {
    // Create checkpoint on timeline
    const action = state.actions[idx];
    const log = {
      id: logId,
      type: "action_log",
      timestamp: new Date().toISOString(),
      source: "manual",
      title: "✔ Completed",
      summary: action.title,
      contactIds: action.relatedContactIds || [],
      status: "ready",
      actions: [],
      linkedActionId: actionId, // Track which action this log belongs to
    };
    state.timeline.unshift(log);
    
    showToast(`Completed: ${action.title}`, () => {
      state.actions[idx].status = prev;
      // Remove the log when undoing
      state.timeline = state.timeline.filter((t) => t.id !== logId);
      render();
    });
  } else {
    // Remove the checkpoint from timeline when unchecking
    state.timeline = state.timeline.filter((t) => t.id !== logId && t.linkedActionId !== actionId);
    showToast(`Restored: ${state.actions[idx].title}`, null);
  }
  
  render();
}

function renderStream() {
  const items = getFilteredTimeline();
  
  const groups = new Map();
  for (const it of items) {
    const day = getDayKey(it.timestamp);
    if (!groups.has(day)) groups.set(day, []);
    groups.get(day).push(it);
  }
  
  const days = Array.from(groups.keys()).sort((a, b) => (a > b ? -1 : 1));
  
  if (days.length === 0) {
    el.streamInner.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">📭</div>
        <div class="empty-title">No Results</div>
        <div class="empty-text">Try adjusting your filters</div>
        <button class="empty-btn" id="btnEmptyClear">Clear Filters</button>
      </div>
    `;
    const btn = $("#btnEmptyClear");
    if (btn) btn.onclick = () => { clearScope(); render(); };
    return;
  }
  
  el.streamInner.innerHTML = days
    .map((day) => {
      const list = groups.get(day);
      const dayLabel = fmtDayLabel(list[0].timestamp);
      
      return `
        <section class="day-group">
          <div class="day-header">
            <span class="day-label">${escapeHtml(dayLabel)}</span>
            <div class="day-line"></div>
          </div>
          ${list.map(renderTimelineItem).join("")}
        </section>
      `;
    })
    .join("");
  
  bindStreamInteractions();
}

function renderTimelineItem(it) {
  // For clusters, show time of first (earliest) activity as anchor
  let displayTime = it.timestamp;
  if (it.type === "cluster" && it.microMeta?.items?.length > 0) {
    // Get earliest timestamp from cluster items
    const sorted = [...it.microMeta.items].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
    displayTime = sorted[0].timestamp;
  }
  
  const time = fmtTime(displayTime);
  const dotClass = getDotClass(it.type);
  const content = renderItemContent(it);
  
  // For cluster type, we use a special layout
  if (it.type === "cluster") {
    return `
      <div class="tl-row tl-row-cluster">
        <div class="tl-left">
          <span class="tl-time">${escapeHtml(time)}</span>
        </div>
        <div class="tl-axis">
          <div class="tl-dot ${dotClass}"></div>
          <div class="tl-line"></div>
        </div>
        <div class="tl-content">
          ${content}
        </div>
      </div>
    `;
  }
  
  return `
    <div class="tl-row">
      <div class="tl-left">
        <span class="tl-time">${escapeHtml(time)}</span>
      </div>
      <div class="tl-axis">
        <div class="tl-dot ${dotClass}"></div>
        <div class="tl-line"></div>
      </div>
      <div class="tl-content">
        ${content}
      </div>
    </div>
  `;
}

function getDotClass(type) {
  const classes = {
    meeting: "meeting",
    call: "call",
    note: "note",
    action_note: "meeting", // Red dot for action items
    cluster: "cluster",
    processing: "note",
    action_log: "note",
    card: "card",
  };
  return classes[type] || "";
}

function renderItemContent(it) {
  switch (it.type) {
    case "meeting": return renderMeeting(it);
    case "call": return renderCall(it);
    case "note": return renderNote(it);
    case "action_note": return renderActionNote(it);
    case "cluster": return renderCluster(it);
    case "processing": return renderProcessing(it);
    case "action_log": return renderActionLog(it);
    case "card": return renderBusinessCard(it);
    default: return renderGeneric(it);
  }
}

function hasPendingActions(it) {
  return getPendingActionsCount(it) > 0;
}

function getPendingActionsCount(it) {
  const actionIds = it.actions || [];
  return actionIds
    .map((id) => state.actions.find((a) => a.id === id))
    .filter(Boolean)
    .filter((a) => a.status === "pending")
    .length;
}

function renderActionBadge(it) {
  const count = getPendingActionsCount(it);
  if (count === 0) return '';
  return `<div class="card-action-badge">🔴 ${count}</div>`;
}

function renderAvatarStack(contactIds, clickable = true) {
  const ids = contactIds || [];
  if (ids.length === 0) {
    return '<span class="no-contacts">No linked contact</span>';
  }
  
  const maxShow = 3;
  const shown = ids.slice(0, maxShow);
  const extra = ids.length - maxShow;
  
  let html = '<div class="avatar-stack">';
  shown.forEach((id) => {
    const c = getContact(id);
    if (c) {
      html += `<div class="avatar-stack-item" ${clickable ? `data-contact-id="${escapeHtml(c.id)}"` : ""} title="${escapeHtml(c.name)}">${escapeHtml(c.initials)}</div>`;
    }
  });
  if (extra > 0) {
    html += `<div class="avatar-stack-item more">+${extra}</div>`;
  }
  html += '</div>';
  return html;
}

function renderMeeting(it) {
  const place = it.meta?.place || "—";
  const duration = it.meta?.durationMin ? `${it.meta.durationMin}min` : "";
  
  return `
    <div class="card" data-item-id="${escapeHtml(it.id)}">
      <div class="card-head">
        <div class="card-type">
          <span class="card-type-icon">📍</span>
          <span>Meeting</span>
        </div>
        ${renderActionBadge(it)}
      </div>
      <div class="card-body">
        <div class="card-meta">
          <span class="card-meta-item">📍 ${escapeHtml(place)}</span>
          ${duration ? `<span class="card-meta-item">⏱ ${escapeHtml(duration)}</span>` : ""}
        </div>
        <div class="card-title">${escapeHtml(it.title)}</div>
        <div class="card-summary">${escapeHtml(it.summary)}</div>
      </div>
      <div class="card-footer">
        ${renderAvatarStack(it.contactIds)}
        <button class="expand-btn" data-expand-item="${escapeHtml(it.id)}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M9 18l6-6-6-6"/>
          </svg>
        </button>
      </div>
    </div>
  `;
}

function renderCall(it) {
  const dir = it.meta?.direction || "IN";
  const duration = it.meta?.durationMin ? `${it.meta.durationMin}min` : "";
  
  return `
    <div class="card" data-item-id="${escapeHtml(it.id)}">
      <div class="card-head">
        <div class="card-type">
          <span class="card-type-icon">🤖</span>
          <span>Agent Call</span>
          <span class="dir-badge">${dir === "IN" ? "← IN" : "→ OUT"}</span>
        </div>
        ${renderActionBadge(it)}
      </div>
      <div class="card-body">
        <div class="card-meta">
          ${duration ? `<span class="card-meta-item">⏱ ${escapeHtml(duration)}</span>` : ""}
        </div>
        <div class="card-title">${escapeHtml(it.title)}</div>
        <div class="card-summary">${escapeHtml(it.summary)}</div>
      </div>
      <div class="card-footer">
        ${renderAvatarStack(it.contactIds)}
        <button class="expand-btn" data-expand-item="${escapeHtml(it.id)}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M9 18l6-6-6-6"/>
          </svg>
        </button>
      </div>
    </div>
  `;
}

function renderNote(it) {
  const place = it.meta?.place || "";
  
  return `
    <div class="card" data-item-id="${escapeHtml(it.id)}">
      <div class="card-head">
        <div class="card-type">
          <span class="card-type-icon">📝</span>
          <span>Note</span>
        </div>
      </div>
      <div class="card-body">
        ${place ? `<div class="card-meta"><span class="card-meta-item">📍 ${escapeHtml(place)}</span></div>` : ""}
        <div class="card-title">${escapeHtml(it.title || "Quick Note")}</div>
        <div class="card-summary">${escapeHtml(it.summary || "")}</div>
      </div>
      ${it.contactIds?.length ? `
        <div class="card-footer">
          ${renderAvatarStack(it.contactIds)}
        </div>
      ` : ""}
    </div>
  `;
}

function renderActionNote(it) {
  const place = it.meta?.place || "";
  const hasPending = hasPendingActions(it);
  
  return `
    <div class="card" data-item-id="${escapeHtml(it.id)}">
      <div class="card-head">
        <div class="card-type">
          <span class="card-type-icon">✓</span>
          <span>Action Item</span>
        </div>
        ${hasPending ? '<div class="card-action-dot"></div>' : ''}
      </div>
      <div class="card-body">
        ${place ? `<div class="card-meta"><span class="card-meta-item">📍 ${escapeHtml(place)}</span></div>` : ""}
        <div class="card-title">${escapeHtml(it.title || "Action")}</div>
        <div class="card-summary">${escapeHtml(it.summary || "")}</div>
      </div>
      ${it.contactIds?.length ? `
        <div class="card-footer">
          ${renderAvatarStack(it.contactIds)}
        </div>
      ` : ""}
    </div>
  `;
}

function renderBusinessCard(it) {
  // Special layout for business card: avatar, name, title, company, place
  const c = it.contactIds?.length ? getContact(it.contactIds[0]) : null;
  const place = it.meta?.place || "Added";
  const source = it.meta?.source || "scan"; // scan | nfc | bizcard
  const isBizCardUser = it.meta?.isBizCardUser || false;
  
  // Determine badge type
  let badgeClass = "scanned";
  let badgeText = "Scanned";
  if (isBizCardUser) {
    badgeClass = "bizcard-user";
    badgeText = "BizCard";
  } else if (source === "nfc") {
    badgeClass = "nfc";
    badgeText = "NFC";
  }
  
  if (c) {
    return `
      <div class="bizcard" data-contact-id="${escapeHtml(c.id)}">
        <div class="bizcard-body">
          <div class="bizcard-avatar">${escapeHtml(c.initials)}</div>
          <div class="bizcard-info">
            <div class="bizcard-name">${escapeHtml(c.name)}</div>
            <div class="bizcard-title">${escapeHtml(c.title)}</div>
            <div class="bizcard-company">${escapeHtml(c.company)}</div>
          </div>
          <span class="bizcard-arrow">›</span>
        </div>
        <div class="bizcard-footer">
          <div class="bizcard-source">
            <span>📍</span>
            <span>${escapeHtml(place)}</span>
          </div>
          <span class="bizcard-type-badge ${badgeClass}">${badgeText}</span>
        </div>
      </div>
    `;
  }
  
  // Fallback for card without linked contact yet
  return `
    <div class="bizcard">
      <div class="bizcard-body">
        <div class="bizcard-avatar" style="background: var(--bg-tertiary); color: var(--text-tertiary);">?</div>
        <div class="bizcard-info">
          <div class="bizcard-name">${escapeHtml(it.title || "New Contact")}</div>
          <div class="bizcard-title">${escapeHtml(it.summary || "Processing...")}</div>
        </div>
        <span class="bizcard-arrow">›</span>
      </div>
      <div class="bizcard-footer">
        <div class="bizcard-source">
          <span>📍</span>
          <span>${escapeHtml(place)}</span>
        </div>
        <span class="bizcard-type-badge ${badgeClass}">${badgeText}</span>
      </div>
    </div>
  `;
}

function renderCluster(it) {
  const open = state.ui.openClusterIds.has(it.id);
  const items = it.microMeta?.items || [];
  
  // Sort items by time descending (newest first) for display
  const sortedItems = [...items].sort((a, b) => 
    new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
  
  return `
    <div class="cluster ${open ? "expanded" : ""}">
      ${open ? `
        <div class="cluster-body">
          ${sortedItems.map((x) => `
            <div class="cluster-item">
              <span class="cluster-time">${escapeHtml(fmtTime(x.timestamp))}</span>
              <div class="cluster-dot ${escapeHtml(x.color)}"></div>
              <span class="cluster-text"><strong>${escapeHtml(x.who)}</strong> · ${escapeHtml(x.verb)}</span>
            </div>
          `).join("")}
        </div>
      ` : ""}
      <div class="cluster-head" data-cluster-id="${escapeHtml(it.id)}">
        <span class="cluster-icon">🥞</span>
        <span class="cluster-title">${escapeHtml(it.title || `${items.length} Quick Activities`)}</span>
        <span class="cluster-toggle">${open ? "收起" : ""}</span>
      </div>
    </div>
  `;
}

function renderProcessing(it) {
  return `
    <div class="card">
      <div class="card-head">
        <div class="card-type">
          <span class="card-type-icon">⏳</span>
          <span>Processing...</span>
        </div>
      </div>
      <div class="processing-card">
        <div class="skeleton" style="width: 60%;"></div>
        <div class="skeleton" style="width: 90%;"></div>
        <div class="skeleton" style="width: 75%;"></div>
      </div>
    </div>
  `;
}

function renderActionLog(it) {
  return `
    <div class="card action-log-card">
      <div class="action-log-text">
        <strong>✔</strong> ${escapeHtml(it.summary)}
      </div>
    </div>
  `;
}

function renderGeneric(it) {
  return `
    <div class="card">
      <div class="card-body">
        <div class="card-title">${escapeHtml(it.title || it.type)}</div>
        <div class="card-summary">${escapeHtml(it.summary || "")}</div>
      </div>
    </div>
  `;
}

function bindStreamInteractions() {
  // Avatar stack items -> open contact detail
  $$("[data-contact-id]", el.streamInner).forEach((el) => {
    el.onclick = (e) => {
      e.stopPropagation();
      openContactDetail(el.dataset.contactId);
    };
  });
  
  // Expand button -> open meeting detail
  $$("[data-expand-item]", el.streamInner).forEach((btn) => {
    btn.onclick = (e) => {
      e.stopPropagation();
      openMeetingDetail(btn.dataset.expandItem);
    };
  });
  
  // Cluster toggle
  $$("[data-cluster-id]", el.streamInner).forEach((el) => {
    el.onclick = () => {
      const id = el.dataset.clusterId;
      if (state.ui.openClusterIds.has(id)) {
        state.ui.openClusterIds.delete(id);
      } else {
        state.ui.openClusterIds.add(id);
      }
      render();
    };
  });
}

// ============================================
// Meeting Detail Modal
// ============================================

function openMeetingDetail(itemId) {
  const item = getTimelineItem(itemId);
  if (!item) {
    showToast("Item not found", null);
    return;
  }
  
  state.ui.currentMeetingId = itemId;
  
  const contacts = (item.contactIds || []).map(getContact).filter(Boolean);
  const duration = item.meta?.durationMin ? `${item.meta.durationMin} min` : "";
  
  // Get related actions
  const relatedActions = state.actions.filter((a) => 
    a.relatedTimelineItemId === itemId
  );
  
  // Mock meeting content for demo (in real app, this comes from backend)
  const meetingContent = item.meta?.content || {
    overview: item.summary,
    background: {
      participants: contacts.map(c => c.name).join(", "),
      roles: "Decision Maker & Attendees",
      purpose: `Discuss ${item.title}`
    },
    keyConclusions: [
      "Discussed key topics and action items",
      "Agreed on next steps and timeline"
    ],
    topics: [
      {
        title: "Main Discussion",
        opinion: item.summary,
        detail: "Further details from the meeting recording..."
      }
    ],
    risks: [],
    highlights: [
      `"${item.summary}"`
    ]
  };
  
  el.meetingDetailBody.innerHTML = `
    <!-- Hero Header -->
    <div class="md-header">
      <h1 class="md-title">${escapeHtml(item.title)}</h1>
      <div class="md-meta">
        <span class="md-time">${escapeHtml(fmtTime(item.timestamp))}</span>
        <div class="md-participants-row">
          ${contacts.map((c) => `
            <div class="md-avatar" data-participant-id="${escapeHtml(c.id)}" title="${escapeHtml(c.name)}">${escapeHtml(c.initials)}</div>
          `).join("")}
          <button class="md-add-btn" id="btnAddParticipant" title="Add participant">+</button>
        </div>
      </div>
      <div class="md-lang-row">
        <span class="md-lang-label">📋 通用</span>
        <span class="md-lang-value">🌐 Chinese ›</span>
      </div>
    </div>
    
    <!-- Summary Section -->
    <div class="md-section">
      <h2 class="md-section-title">总结 / 整体总结</h2>
      <p class="md-text">${escapeHtml(meetingContent.overview)}</p>
    </div>
    
    <!-- Background Section -->
    <div class="md-section">
      <h2 class="md-section-title">会面背景</h2>
      <ul class="md-list">
        <li><strong>参与者:</strong> ${escapeHtml(meetingContent.background.participants || contacts.map(c => c.name).join(", "))}</li>
        <li><strong>角色:</strong> ${escapeHtml(meetingContent.background.roles)}</li>
        <li><strong>会面目的:</strong> ${escapeHtml(meetingContent.background.purpose)}</li>
      </ul>
    </div>
    
    <!-- Key Conclusions -->
    <div class="md-section">
      <h2 class="md-section-title">关键结论总结</h2>
      <ul class="md-list">
        ${meetingContent.keyConclusions.map(c => `<li>${escapeHtml(c)}</li>`).join("")}
      </ul>
    </div>
    
    <!-- Action Items (Checkable) -->
    ${relatedActions.length > 0 ? `
      <div class="md-section">
        <h2 class="md-section-title">下一步行动</h2>
        <div class="md-actions-list">
          ${relatedActions.map((a) => `
            <div class="md-action-item ${a.status === "done" ? "done" : ""}" data-action-row="${escapeHtml(a.id)}">
              <label class="md-action-checkbox-wrap">
                <input type="checkbox" data-md-action="${escapeHtml(a.id)}" ${a.status === "done" ? "checked" : ""} />
                <span class="md-action-check"></span>
              </label>
              <span class="md-action-text" data-action-text="${escapeHtml(a.id)}">${escapeHtml(a.title)}</span>
              <button class="md-action-edit" data-edit-action="${escapeHtml(a.id)}" title="Edit">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
                  <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
                </svg>
              </button>
            </div>
          `).join("")}
        </div>
      </div>
    ` : ""}
    
    <!-- Risks -->
    ${meetingContent.risks && meetingContent.risks.length > 0 ? `
      <div class="md-section">
        <h2 class="md-section-title">待定问题 / 风险点</h2>
        <ul class="md-list">
          ${meetingContent.risks.map(r => `<li>${escapeHtml(r)}</li>`).join("")}
        </ul>
      </div>
    ` : `
      <div class="md-section">
        <h2 class="md-section-title">待定问题 / 风险点</h2>
        <ul class="md-list"><li>无</li></ul>
      </div>
    `}
    
    <!-- Highlights -->
    ${meetingContent.highlights && meetingContent.highlights.length > 0 ? `
      <div class="md-section">
        <h2 class="md-section-title">附录: 高价值原话 / 片段</h2>
        <ul class="md-list md-quotes">
          ${meetingContent.highlights.map(h => `<li>${escapeHtml(h)}</li>`).join("")}
        </ul>
      </div>
    ` : ""}
    
    <!-- Bottom Actions -->
    <div class="md-bottom-actions">
      <button class="md-bottom-btn" id="btnMeetingShare">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8"/>
          <polyline points="16 6 12 2 8 6"/>
          <line x1="12" y1="2" x2="12" y2="15"/>
        </svg>
        Share
      </button>
      <button class="md-bottom-btn" id="btnMeetingCopy">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
          <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
        </svg>
        Copy
      </button>
    </div>
  `;
  
  openModal(el.meetingModal);
  bindMeetingDetailInteractions(itemId);
}

function bindMeetingDetailInteractions(itemId) {
  // Participant clicks
  $$("[data-participant-id]", el.meetingDetailBody).forEach((avatar) => {
    avatar.onclick = () => {
      closeModal(el.meetingModal);
      setTimeout(() => openContactDetail(avatar.dataset.participantId), 100);
    };
  });
  
  // Add participant button
  const btnAdd = $("#btnAddParticipant", el.meetingDetailBody);
  if (btnAdd) {
    btnAdd.onclick = () => {
      openAddParticipantPicker(itemId);
    };
  }
  
  // Action checkboxes
  $$("[data-md-action]", el.meetingDetailBody).forEach((checkbox) => {
    checkbox.onchange = () => {
      handleActionComplete(checkbox.dataset.mdAction, checkbox.checked);
      // Update UI without closing modal
      const row = checkbox.closest(".md-action-item");
      if (row) row.classList.toggle("done", checkbox.checked);
    };
  });
  
  // Action edit buttons
  $$("[data-edit-action]", el.meetingDetailBody).forEach((btn) => {
    btn.onclick = (e) => {
      e.stopPropagation();
      const actionId = btn.dataset.editAction;
      editActionItem(actionId, itemId);
    };
  });
  
  // Share button
  const btnShare = $("#btnMeetingShare", el.meetingDetailBody);
  if (btnShare) {
    btnShare.onclick = () => {
      showToast("Share options (Coming Soon)", null);
    };
  }
  
  // Copy button
  const btnCopy = $("#btnMeetingCopy", el.meetingDetailBody);
  if (btnCopy) {
    btnCopy.onclick = () => {
      // Copy summary to clipboard
      const item = getTimelineItem(itemId);
      if (item) {
        navigator.clipboard.writeText(item.summary).then(() => {
          showToast("Summary copied!", null);
        }).catch(() => {
          showToast("Failed to copy", null);
        });
      }
    };
  }
}

function editActionItem(actionId, meetingId) {
  openEditActionModal(actionId, "meeting", meetingId);
}

// Edit Action Modal
function openEditActionModal(actionId, context, meetingId = null) {
  const action = state.actions.find((a) => a.id === actionId);
  if (!action) return;
  
  state.ui.editingActionId = actionId;
  state.ui.editingActionContext = context;
  state.ui.editingActionMeetingId = meetingId;
  
  if (el.editActionInput) {
    el.editActionInput.value = action.title;
  }
  
  openModal(el.editActionModal);
  
  // Focus input
  setTimeout(() => {
    if (el.editActionInput) {
      el.editActionInput.focus();
      el.editActionInput.select();
    }
  }, 100);
}

function saveEditAction() {
  const actionId = state.ui.editingActionId;
  const context = state.ui.editingActionContext;
  const meetingId = state.ui.editingActionMeetingId;
  
  const action = state.actions.find((a) => a.id === actionId);
  if (!action) return;
  
  const newTitle = el.editActionInput ? el.editActionInput.value.trim() : "";
  if (newTitle === "") return;
  
  action.title = newTitle;
  closeModal(el.editActionModal);
  
  // Refresh appropriate view
  if (context === "meeting" && meetingId) {
    openMeetingDetail(meetingId);
  } else {
    renderActionsPage();
  }
  
  state.ui.editingActionId = null;
  state.ui.editingActionContext = null;
  state.ui.editingActionMeetingId = null;
}

function openAddParticipantPicker(meetingId) {
  // Store meeting ID for linking (not filtering)
  state.ui.linkingToMeetingId = meetingId;
  
  // Get current meeting's contacts
  const item = getTimelineItem(meetingId);
  const currentContactIds = item?.contactIds || [];
  state.ui.selectedPersonIds = [...currentContactIds];
  
  el.personSearch.value = "";
  renderPersonList("");
  
  // Update modal title to indicate linking mode
  const modalTitle = $(".modal-title", el.personModal);
  if (modalTitle) {
    modalTitle.textContent = "Link Contacts";
  }
  
  openModal(el.personModal);
}

// ============================================
// Contact Detail Modal
// ============================================

function openContactDetail(contactId) {
  const c = getContact(contactId);
  if (!c) return;
  
  el.contactDetailBody.innerHTML = `
    <!-- Hero -->
    <div class="contact-hero">
      <div class="contact-hero-avatar">${escapeHtml(c.initials)}</div>
      <div class="contact-hero-name">${escapeHtml(c.name)}</div>
      <div class="contact-hero-subtitle">${escapeHtml(c.title)} @ ${escapeHtml(c.company)}</div>
      
      <div class="contact-actions">
        <button class="contact-action" data-action="phone">
          <div class="contact-action-icon">📞</div>
          <span class="contact-action-label">Phone</span>
        </button>
        <button class="contact-action" data-action="email">
          <div class="contact-action-icon">✉️</div>
          <span class="contact-action-label">Email</span>
        </button>
        <button class="contact-action" data-action="message">
          <div class="contact-action-icon">💬</div>
          <span class="contact-action-label">Message</span>
        </button>
        <button class="contact-action" data-action="whatsapp">
          <div class="contact-action-icon">📱</div>
          <span class="contact-action-label">WhatsApp</span>
        </button>
      </div>
    </div>
    
    <!-- Info Sections -->
    <div class="info-group">
      ${c.email && c.email.length ? `
        <div class="info-row">
          <div class="info-label">Email</div>
          ${c.email.map(e => `<div class="info-value">${escapeHtml(e)}</div>`).join("")}
        </div>
      ` : ""}
      
      ${c.phone && c.phone.length ? `
        <div class="info-row">
          <div class="info-label">Phone</div>
          ${c.phone.map(p => `<div class="info-value">${escapeHtml(p)}</div>`).join("")}
        </div>
      ` : ""}
    </div>
    
    <div class="info-group">
      <div class="info-row">
        <div class="info-label">Company</div>
        <div class="info-value plain">${escapeHtml(c.company)}</div>
      </div>
      <div class="info-row">
        <div class="info-label">Title</div>
        <div class="info-value plain">${escapeHtml(c.title)}</div>
      </div>
      ${c.department ? `
        <div class="info-row">
          <div class="info-label">Department</div>
          <div class="info-value plain">${escapeHtml(c.department)}</div>
        </div>
      ` : ""}
      ${c.address ? `
        <div class="info-row">
          <div class="info-label">Address</div>
          <div class="info-value plain">${escapeHtml(c.address)}</div>
        </div>
      ` : ""}
      ${c.website ? `
        <div class="info-row">
          <div class="info-label">Website</div>
          <div class="info-value">${escapeHtml(c.website)}</div>
        </div>
      ` : ""}
    </div>
    
    ${c.tags && c.tags.length ? `
      <div class="info-section">
        <div class="info-label">Tags</div>
        <div class="contact-tags">
          ${c.tags.map(t => `<span class="contact-tag">${escapeHtml(t)}</span>`).join("")}
        </div>
      </div>
    ` : ""}
  `;
  
  openModal(el.contactModal);
  
  // Bind quick actions
  $$("[data-action]", el.contactDetailBody).forEach((btn) => {
    btn.onclick = () => showToast(`${btn.dataset.action} (prototype)`, null);
  });
}

// ============================================
// Person Modal (Multi-select)
// ============================================

function openPersonPicker() {
  state.ui.selectedPersonIds = [...state.scope.personIds];
  el.personSearch.value = "";
  renderPersonList("");
  openModal(el.personModal);
}

function renderPersonList(query) {
  const q = (query || "").toLowerCase().trim();
  const filtered = DATA.CONTACTS.filter((c) => {
    if (!q) return true;
    return `${c.name} ${c.title}`.toLowerCase().includes(q);
  });
  
  // Build add new contact button
  const addNewHtml = `
    <div class="person-add-new" id="btnAddNewContact">
      <div class="person-add-icon">+</div>
      <span>Add New Contact</span>
    </div>
  `;
  
  // Build contact rows with stats
  const rowsHtml = filtered
    .map((c) => {
      const selected = state.ui.selectedPersonIds.includes(c.id);
      const stats = getContactStats(c.id);
      let statsHtml = "";
      if (stats.pendingActions > 0 || stats.meetings > 0 || stats.calls > 0) {
        const parts = [];
        if (stats.pendingActions > 0) parts.push(`<span class="stat-badge action">${stats.pendingActions}</span>`);
        if (stats.meetings > 0) parts.push(`<span class="stat-badge meeting">${stats.meetings}</span>`);
        if (stats.calls > 0) parts.push(`<span class="stat-badge call">${stats.calls}</span>`);
        statsHtml = `<div class="person-stats">${parts.join("")}</div>`;
      }
      
      return `
        <div class="person-item ${selected ? "selected" : ""}" data-person-id="${escapeHtml(c.id)}">
          <div class="person-checkbox">${selected ? "✓" : ""}</div>
          <div class="person-avatar">${escapeHtml(c.initials)}</div>
          <div class="person-info">
            <div class="person-name">${escapeHtml(c.name)}</div>
            <div class="person-title">${escapeHtml(c.title)}</div>
            ${statsHtml}
          </div>
          <button class="person-detail-btn" data-person-detail="${escapeHtml(c.id)}">›</button>
        </div>
      `;
    })
    .join("");
  
  el.personList.innerHTML = addNewHtml + rowsHtml;
  
  // Bind add new contact
  const btnAddNew = $("#btnAddNewContact", el.personList);
  if (btnAddNew) {
    btnAddNew.onclick = () => {
      closeModal(el.personModal);
      showAddContactModal();
    };
  }
  
  // Bind row toggle (multi-select)
  $$("[data-person-id]", el.personList).forEach((row) => {
    row.onclick = (e) => {
      if (e.target.classList.contains("person-detail-btn")) return;
      const id = row.dataset.personId;
      if (state.ui.selectedPersonIds.includes(id)) {
        state.ui.selectedPersonIds = state.ui.selectedPersonIds.filter((x) => x !== id);
      } else {
        state.ui.selectedPersonIds.push(id);
      }
      renderPersonList(el.personSearch.value);
    };
  });
  
  // Bind detail button -> open contact detail
  $$("[data-person-detail]", el.personList).forEach((btn) => {
    btn.onclick = (e) => {
      e.stopPropagation();
      closeModal(el.personModal);
      setTimeout(() => openContactDetail(btn.dataset.personDetail), 100);
    };
  });
}

function showAddContactModal() {
  // For demo, just show a toast - in real app would open add contact form
  showToast("Add Contact (Coming Soon)", null);
}

function applyPersonSelection() {
  // Check if we're in linking mode (adding contacts to a meeting)
  if (state.ui.linkingToMeetingId) {
    const meetingId = state.ui.linkingToMeetingId;
    const item = getTimelineItem(meetingId);
    if (item) {
      item.contactIds = [...state.ui.selectedPersonIds];
    }
    state.ui.linkingToMeetingId = null;
    closeModal(el.personModal);
    // Re-render timeline to reflect changes, then open meeting detail
    render();
    setTimeout(() => openMeetingDetail(meetingId), 50);
    return;
  }
  
  // Normal filter mode
  state.scope.personIds = [...state.ui.selectedPersonIds];
  closeModal(el.personModal);
  render();
}

// ============================================
// Date Modal
// ============================================

function openDatePicker() {
  // Set current values in inputs
  if (el.dateFrom) {
    el.dateFrom.value = state.scope.dateFrom ? formatDateForInput(state.scope.dateFrom) : "";
  }
  if (el.dateTo) {
    el.dateTo.value = state.scope.dateTo ? formatDateForInput(state.scope.dateTo) : "";
  }
  
  // Clear preset highlights
  $$(".date-preset").forEach((btn) => btn.classList.remove("active"));
  
  openModal(el.dateModal);
}

function formatDateForInput(date) {
  if (!date) return "";
  const d = new Date(date);
  const year = d.getFullYear();
  const month = (d.getMonth() + 1).toString().padStart(2, "0");
  const day = d.getDate().toString().padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function applyDatePreset(preset) {
  const today = new Date("2026-01-08"); // Demo date
  let from = null;
  let to = null;
  
  switch (preset) {
    case "today":
      from = to = today;
      break;
    case "yesterday":
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      from = to = yesterday;
      break;
    case "week":
      // This week (Sunday to today)
      const weekStart = new Date(today);
      weekStart.setDate(today.getDate() - today.getDay());
      from = weekStart;
      to = today;
      break;
    case "month":
      // This month
      from = new Date(today.getFullYear(), today.getMonth(), 1);
      to = today;
      break;
  }
  
  state.scope.dateFrom = from;
  state.scope.dateTo = to;
  
  // Highlight the clicked preset button
  $$(".date-preset", el.dateModal).forEach((btn) => {
    const isActive = btn.dataset.preset === preset;
    btn.classList.toggle("active", isActive);
  });
  
  // Update input fields to show selected dates
  if (el.dateFrom) {
    el.dateFrom.value = formatDateForInput(from);
  }
  if (el.dateTo) {
    el.dateTo.value = formatDateForInput(to);
  }
}

function applyDateRange() {
  const fromVal = el.dateFrom ? el.dateFrom.value : "";
  const toVal = el.dateTo ? el.dateTo.value : "";
  
  state.scope.dateFrom = fromVal ? new Date(fromVal) : null;
  state.scope.dateTo = toVal ? new Date(toVal) : null;
  
  closeModal(el.dateModal);
  render();
}

// Apply date preset to search temp state (not directly to scope)
function applySearchDatePreset(preset) {
  const today = new Date("2026-01-08"); // Demo date
  let from = null;
  let to = null;
  
  switch (preset) {
    case "today":
      from = to = today;
      break;
    case "week":
      const weekStart = new Date(today);
      weekStart.setDate(today.getDate() - today.getDay());
      from = weekStart;
      to = today;
      break;
    case "month":
      from = new Date(today.getFullYear(), today.getMonth(), 1);
      to = today;
      break;
  }
  
  state.searchTemp.dateFrom = from;
  state.searchTemp.dateTo = to;
  
  // Update button states
  $$("[data-sdate]").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.sdate === preset);
  });
}

// ============================================
// FAB Actions
// ============================================

function addProcessing(kind) {
  const id = "proc_" + Date.now();
  
  if (kind === "task") {
    // Open note modal with action type pre-selected
    el.noteInput.value = "";
    const actionRadio = document.querySelector('input[name="noteType"][value="action"]');
    if (actionRadio) actionRadio.checked = true;
    openModal(el.noteModal);
    return;
  }
  
  if (kind === "voice") {
    // Quick record -> creates a meeting after processing
    const item = {
      id,
      type: "processing",
      timestamp: new Date().toISOString(),
      source: "hardware",
      title: "Recording...",
      summary: "",
      contactIds: [],
      status: "processing",
      actions: [],
      meta: { kind },
    };
    state.timeline.unshift(item);
    render();
    
    setTimeout(() => {
      const idx = state.timeline.findIndex((t) => t.id === id);
      if (idx < 0) return;
      state.timeline[idx] = {
        ...state.timeline[idx],
        type: "meeting",
        status: "ready",
        title: "New Recording",
        summary: "Voice recording processed. Summary is ready.",
        meta: { place: "Voice Recording" },
      };
      showToast("Recording saved!", null);
      render();
    }, 2000);
    
  } else if (kind === "scan") {
    // Scan business card -> creates a contact card
    const item = {
      id,
      type: "processing",
      timestamp: new Date().toISOString(),
      source: "manual",
      title: "Scanning...",
      summary: "",
      contactIds: [],
      status: "processing",
      actions: [],
      meta: { kind, place: "Camera Scan", source: "scan" },
    };
    state.timeline.unshift(item);
    render();
    
    setTimeout(() => {
      const idx = state.timeline.findIndex((t) => t.id === id);
      if (idx < 0) return;
      
      // Create a new contact (simulating a scanned business card)
      const newContactId = "c_" + Date.now();
      const newContact = {
        id: newContactId,
        name: "Alex Turner",
        initials: "AT",
        title: "VP of Sales",
        company: "Acme Corp",
        department: "Sales",
        email: ["alex.turner@acmecorp.com"],
        phone: ["+1 555 123 4567"],
        address: "Seattle, WA",
        website: "www.acmecorp.com",
        tags: ["Sales", "Enterprise"],
        notes: ""
      };
      DATA.CONTACTS.push(newContact);
      
      state.timeline[idx] = {
        ...state.timeline[idx],
        type: "card",
        status: "ready",
        title: newContact.name,
        summary: `${newContact.title} @ ${newContact.company}`,
        contactIds: [newContactId],
        meta: { place: "Camera Scan", source: "scan", isBizCardUser: false },
      };
      showToast("Card scanned!", null);
      render();
    }, 1500);
    
  } else if (kind === "note") {
    // Open note input modal
    el.noteInput.value = "";
    // Reset to default selection (Note)
    const noteRadio = document.querySelector('input[name="noteType"][value="note"]');
    if (noteRadio) noteRadio.checked = true;
    openModal(el.noteModal);
  }
}

function addNewNote() {
  const content = el.noteInput.value.trim();
  if (!content) return;
  
  const noteType = document.querySelector('input[name="noteType"]:checked')?.value || "note";
  const id = Date.now();
  const location = "Current Location"; // In real app, would get from GPS/user input
  
  if (noteType === "action") {
    // Create action item
    const newAction = {
      id: "a_" + id,
      title: content,
      status: "pending",
      relatedContactIds: [],
      relatedTimelineItemId: "action_note_" + id,
      relatedMeetingTitle: "",
      relatedDate: new Date().toISOString().split("T")[0],
      createdAt: new Date().toISOString(),
    };
    state.actions.unshift(newAction);
    
    // Also create a timeline card for the action
    const newActionNote = {
      id: "action_note_" + id,
      type: "action_note",
      timestamp: new Date().toISOString(),
      source: "manual",
      title: content,
      summary: "",
      contactIds: [],
      status: "ready",
      actions: ["a_" + id],
      meta: { place: location },
    };
    state.timeline.unshift(newActionNote);
    closeModal(el.noteModal);
    showToast("Action added!", null);
  } else {
    // Add as note to timeline
    const newNote = {
      id: "note_" + id,
      type: "note",
      timestamp: new Date().toISOString(),
      source: "manual",
      title: "Quick Note",
      summary: content,
      contactIds: [],
      status: "ready",
      actions: [],
      meta: { place: location },
    };
    state.timeline.unshift(newNote);
    closeModal(el.noteModal);
    showToast("Note saved!", null);
  }
  
  render();
}

// ============================================
// Main Render
// ============================================

function render() {
  renderActiveFiltersBar();
  updateViewSwitcher();
  
  if (state.ui.currentPage === "timeline") {
    renderStream();
  } else {
    renderActionsPage();
  }
}

function switchPage(page) {
  state.ui.currentPage = page;
  
  // Update page visibility with animation
  el.pageTimeline.classList.toggle("active", page === "timeline");
  el.pageActions.classList.toggle("active", page === "actions");
  
  // Update view switcher indicator
  if (el.viewSwitcher) {
    el.viewSwitcher.dataset.active = page;
  }
  
  // Update view tabs
  $$("[data-page]", el.viewSwitcher).forEach((tab) => {
    tab.classList.toggle("active", tab.dataset.page === page);
  });
  
  render();
}

function updateViewSwitcher() {
  // Only count pending actions for the badge
  const pendingActions = getFilteredActions(true);
  if (el.actionsBadge) {
    el.actionsBadge.textContent = pendingActions.length;
    el.actionsBadge.hidden = pendingActions.length === 0;
  }
}

// ============================================
// Event Bindings
// ============================================

function init() {
  // Drawer
  el.btnDrawer.onclick = openDrawer;
  el.btnCloseDrawer.onclick = closeDrawer;
  el.backdrop.onclick = closeAllOverlays;
  
  // Share QR
  el.btnShare.onclick = () => showToast("Share QR Code", null);
  
  // Hardware status bar -> open hardware modal
  if (el.hwStatusBar) {
    el.hwStatusBar.onclick = () => {
      openModal(el.hardwareModal);
    };
  }
  
  // Drawer navigation
  if (el.btnHardwareSettings) {
    el.btnHardwareSettings.onclick = () => {
      closeDrawer();
      setTimeout(() => openModal(el.hardwareModal), 150);
    };
  }
  
  // Hardware connect/disconnect buttons
  if (el.btnConnectHw) {
    el.btnConnectHw.onclick = () => {
      connectHardware();
    };
  }
  
  if (el.btnDisconnectHw) {
    el.btnDisconnectHw.onclick = () => {
      disconnectHardware();
    };
  }
  
  if (el.btnAgentSettings) {
    el.btnAgentSettings.onclick = () => {
      closeDrawer();
      showToast("Agent Settings (Coming Soon)", null);
    };
  }
  
  if (el.btnAccountSettings) {
    el.btnAccountSettings.onclick = () => {
      closeDrawer();
      showToast("Account Settings (Coming Soon)", null);
    };
  }
  
  if (el.btnEditProfile) {
    el.btnEditProfile.onclick = () => {
      closeDrawer();
      showToast("Edit Profile (Coming Soon)", null);
    };
  }
  
  // Filter tabs (All / Meetings / Calls)
  $$("[data-view]").forEach((tab) => {
    tab.onclick = () => {
      state.scope.view = tab.dataset.view;
      render();
    };
  });
  
  // Date filter button
  if (el.btnDate) {
    el.btnDate.onclick = () => openModal(el.dateModal);
  }
  
  // Person filter button
  if (el.btnPerson) {
    el.btnPerson.onclick = openPersonPicker;
  }
  
  // Clear filters button
  if (el.btnClearFilters) {
    el.btnClearFilters.onclick = () => {
      clearScope();
      render();
    };
  }
  
  // Search button -> open search modal
  if (el.btnSearch) {
    el.btnSearch.onclick = openSearchModal;
  }
  
  // Search modal cancel
  if (el.btnSearchCancel) {
    el.btnSearchCancel.onclick = closeSearchModal;
  }
  
  // Search modal apply
  if (el.btnSearchApply) {
    el.btnSearchApply.onclick = applySearch;
  }
  
  // Search modal input (updates temp state)
  if (el.searchModalInput) {
    el.searchModalInput.oninput = () => {
      state.searchTemp.q = el.searchModalInput.value;
      updateSearchInputClear();
    };
  }
  
  // Search input clear
  if (el.searchInputClear) {
    el.searchInputClear.onclick = () => {
      state.searchTemp.q = "";
      el.searchModalInput.value = "";
      updateSearchInputClear();
    };
  }
  
  // Search modal filter options (updates temp state)
  $$("[data-sfilter]").forEach((btn) => {
    btn.onclick = () => {
      const filter = btn.dataset.sfilter;
      if (filter === "meetings") {
        state.searchTemp.view = state.searchTemp.view === "meetings" ? "all" : "meetings";
      } else if (filter === "calls") {
        state.searchTemp.view = state.searchTemp.view === "calls" ? "all" : "calls";
      }
      updateSearchModalFilters();
    };
  });
  
  // Search modal date options (updates temp state)
  $$("[data-sdate]").forEach((btn) => {
    btn.onclick = () => {
      applySearchDatePreset(btn.dataset.sdate);
    };
  });
  
  // Custom date picker
  if (el.btnCustomDate) {
    el.btnCustomDate.onclick = () => {
      closeSearchModal();
      setTimeout(() => openModal(el.dateModal), 150);
    };
  }
  
  // Show all people -> switch to inline all contacts view
  if (el.btnShowAllPeople) {
    el.btnShowAllPeople.onclick = () => {
      showAllContactsView();
    };
  }
  
  // Hide all people -> back to quick list view
  if (el.btnHideAllPeople) {
    el.btnHideAllPeople.onclick = () => {
      showPeopleQuickView();
      renderPeopleQuickList();
    };
  }
  
  // All Contacts search input
  if (el.allContactsSearchInput) {
    el.allContactsSearchInput.oninput = () => {
      renderAllContactsList(el.allContactsSearchInput.value);
    };
  }
  
  // All Contacts confirm button
  if (el.btnConfirmAllContacts) {
    el.btnConfirmAllContacts.onclick = confirmAllContactsSelection;
  }
  
  // Date presets (Today, Yesterday, etc.)
  $$(".date-preset").forEach((btn) => {
    btn.onclick = () => {
      applyDatePreset(btn.dataset.preset);
    };
  });
  
  // Date picker apply
  if (el.btnApplyDate) {
    el.btnApplyDate.onclick = applyDateRange;
  }
  
  // Person modal apply
  if (el.btnApplyPersons) {
    el.btnApplyPersons.onclick = applyPersonSelection;
  }
  
  // Person search
  if (el.personSearch) {
    el.personSearch.oninput = () => renderPersonList(el.personSearch.value);
  }
  
  // View Switcher (Timeline / Actions)
  $$("[data-page]", el.viewSwitcher).forEach((tab) => {
    tab.onclick = () => switchPage(tab.dataset.page);
  });
  
  // FAB
  el.fabMain.onclick = toggleFab;
  
  $$(".fab-item").forEach((btn) => {
    btn.onclick = () => {
      const kind = btn.dataset.create;
      closeFab();
      addProcessing(kind);
    };
  });
  
  el.app.addEventListener("click", (e) => {
    if (!e.target.closest(".fab") && state.ui.fabOpen) {
      closeFab();
    }
  });
  
  // Modal close buttons
  $$("[data-close-modal]").forEach((btn) => {
    btn.onclick = () => {
      const id = btn.dataset.closeModal;
      const modal = document.getElementById(id);
      if (modal) closeModal(modal);
    };
  });
  
  // Click outside modal to close
  [el.personModal, el.dateModal, el.noteModal, el.contactModal, el.meetingModal, el.hardwareModal].forEach((modal) => {
    if (!modal) return;
    modal.addEventListener("click", (e) => {
      if (e.target === modal) closeModal(modal);
    });
  });
  
  // Add note
  el.btnAddNote.onclick = addNewNote;
  
  // Edit action modal
  if (el.btnSaveEditAction) {
    el.btnSaveEditAction.onclick = saveEditAction;
  }
  if (el.btnCancelEditAction) {
    el.btnCancelEditAction.onclick = () => closeModal(el.editActionModal);
  }
  if (el.editActionInput) {
    el.editActionInput.onkeydown = (e) => {
      if (e.key === "Enter") saveEditAction();
      if (e.key === "Escape") closeModal(el.editActionModal);
    };
  }
  
  // Settings items
  const settingsItems = ["btnBindNfc", "btnBlocklist", "btnAccount", "btnAbout"];
  settingsItems.forEach((id) => {
    const btn = document.getElementById(id);
    if (btn) {
      btn.onclick = () => showToast(`${btn.textContent.trim()} (prototype)`, null);
    }
  });
  
  // Toast undo
  el.toastAction.onclick = () => {
    if (state.toast.undoFn) state.toast.undoFn();
    hideToast();
  };
  
  // Escape key
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      closeAllOverlays();
      hideToast();
    }
  });
  
  // Initial render
  updateHardwareUI();
  render();
}

init();
