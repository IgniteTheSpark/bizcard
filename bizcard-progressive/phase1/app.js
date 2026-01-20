// ========================================
// BizCard Phase 1 Demo - Application Logic
// ========================================

// State management
const AppState = {
    currentPage: 'home',
    currentActionTab: 'pending',
    currentSort: 'due',
    actionHubExpanded: false,
    selectedContact: 'contact_kevin',
    selectedMeeting: 'meeting_001',
    contactActivityTab: 'activities'
};

// ========================================
// Initialization
// ========================================

document.addEventListener('DOMContentLoaded', function() {
    initApp();
});

function initApp() {
    console.log('🚀 BizCard Demo Initialized');
    renderHomePage();
    renderActionHub();
    renderTodayMeetings();
    renderContactList();
    renderUserStats();
    setupEventListeners();
}

function renderHomePage() {
    // Update user profile
    const user = AppData.user;
    const nameEl = document.querySelector('.profile-name');
    const roleEl = document.querySelector('.profile-role');
    const avatarEl = document.querySelector('.profile-avatar');
    
    if (nameEl) nameEl.textContent = user.name;
    if (roleEl) roleEl.textContent = user.role;
    if (avatarEl) avatarEl.textContent = user.avatar;
}

function renderUserStats() {
    const stats = AppData.user.stats;
    const statsEls = document.querySelectorAll('.stat-item');
    
    if (statsEls.length >= 4) {
        statsEls[0].querySelector('.stat-value').textContent = stats.visits.toLocaleString();
        statsEls[1].querySelector('.stat-value').textContent = stats.clicks;
        statsEls[2].querySelector('.stat-value').textContent = stats.calls.toLocaleString();
        statsEls[3].querySelector('.stat-value').textContent = stats.leads;
    }
}

function setupEventListeners() {
    // Close modals on overlay click
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
        overlay.addEventListener('click', function(e) {
            if (e.target === this) {
                closeAllModals();
            }
        });
    });

    // Close sort menu on outside click
    document.addEventListener('click', function(e) {
        const sortMenu = document.getElementById('sort-menu');
        const sortBtn = document.querySelector('.action-sort');
        if (sortMenu && sortBtn && !sortMenu.contains(e.target) && !sortBtn.contains(e.target)) {
            sortMenu.classList.remove('show');
        }
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            closeAllModals();
        }
    });
}

// ========================================
// Contact List
// ========================================

function renderContactList() {
    const container = document.getElementById('contact-list');
    if (!container) return;

    const contacts = AppData.contacts;
    
    container.innerHTML = contacts.map(contact => {
        const pendingActions = AppData.getActionsForContact(contact.id).filter(a => a.status === 'pending');
        const hasPending = pendingActions.length > 0;
        
        return `
            <div class="contact-card" onclick="showContactDetail('${contact.id}')">
                <div class="contact-avatar-wrapper">
                    <div class="contact-avatar" style="background: ${contact.avatarColor}">${contact.avatar}</div>
                    ${hasPending ? `<span class="contact-action-badge">${pendingActions.length}</span>` : ''}
                </div>
                <div class="contact-info">
                    <div class="contact-name">${contact.name}</div>
                    <div class="contact-role-small">${contact.role} @ ${contact.company}</div>
                </div>
                <div class="contact-arrow">›</div>
            </div>
        `;
    }).join('');
}

// ========================================
// Navigation
// ========================================

function showPage(page) {
    AppState.currentPage = page;

    // Update nav buttons
    document.querySelectorAll('.page-nav-btn').forEach(btn => btn.classList.remove('active'));
    if (event && event.target && event.target.classList.contains('page-nav-btn')) {
        event.target.classList.add('active');
    }

    // Hide all pages
    const pages = ['home-page', 'action-list-page', 'meeting-list-page', 'contacts-list-page', 'contact-page', 'me-page', 'meeting-detail-page'];
    pages.forEach(p => {
        const el = document.getElementById(p);
        if (el) {
            el.style.display = 'none';
            el.classList.remove('active');
        }
    });

    // Show sticky bar and tab bar by default
    const stickyBar = document.querySelector('.sticky-bar');
    const tabBar = document.querySelector('.tab-bar');
    if (stickyBar) stickyBar.style.display = 'flex';
    if (tabBar) tabBar.style.display = 'flex';

    // Update tab bar
    document.querySelectorAll('.tab-item').forEach(tab => tab.classList.remove('active'));

    // Show selected page
    switch(page) {
        case 'home':
            document.getElementById('home-page').style.display = 'block';
            document.querySelectorAll('.tab-item')[0].classList.add('active');
            renderActionHub();
            renderTodayMeetings();
            break;
        case 'actionList':
            document.getElementById('action-list-page').style.display = 'block';
            document.getElementById('action-list-page').classList.add('active');
            if (stickyBar) stickyBar.style.display = 'none';
            renderActionList();
            break;
        case 'meetingList':
            document.getElementById('meeting-list-page').style.display = 'block';
            document.getElementById('meeting-list-page').classList.add('active');
            if (stickyBar) stickyBar.style.display = 'none';
            renderMeetingList();
            break;
        case 'contacts':
            document.getElementById('contacts-list-page').style.display = 'block';
            document.getElementById('contacts-list-page').classList.add('active');
            document.querySelectorAll('.tab-item')[1].classList.add('active');
            renderContactList();
            break;
        case 'contact':
            document.getElementById('contact-page').style.display = 'block';
            document.getElementById('contact-page').classList.add('active');
            document.querySelectorAll('.tab-item')[1].classList.add('active');
            renderContactDetail();
            break;
        case 'me':
            document.getElementById('me-page').style.display = 'block';
            document.getElementById('me-page').classList.add('active');
            document.querySelectorAll('.tab-item')[3].classList.add('active');
            if (stickyBar) stickyBar.style.display = 'none';
            break;
    }
}

// ========================================
// Action Hub (Home Page)
// ========================================

function renderActionHub() {
    const pendingActions = AppData.getPendingActions();
    const count = pendingActions.length;
    
    // Filter urgent actions (overdue + due today)
    const urgentActions = pendingActions.filter(a => 
        DateHelper.isOverdue(a.dueDate) || DateHelper.isToday(a.dueDate)
    );
    const otherActions = pendingActions.filter(a => 
        !DateHelper.isOverdue(a.dueDate) && !DateHelper.isToday(a.dueDate)
    );
    
    // Update count badge
    const countEl = document.getElementById('action-count');
    if (countEl) {
        countEl.textContent = count;
        countEl.style.background = count > 0 ? 'var(--primary-red)' : 'var(--primary-green)';
    }

    // Update subtitle based on urgency
    const subtitleEl = document.getElementById('action-subtitle');
    if (subtitleEl) {
        if (urgentActions.length > 0) {
            const overdueCount = pendingActions.filter(a => DateHelper.isOverdue(a.dueDate)).length;
            const todayCount = pendingActions.filter(a => DateHelper.isToday(a.dueDate)).length;
            let urgentText = [];
            if (overdueCount > 0) urgentText.push(`${overdueCount} overdue`);
            if (todayCount > 0) urgentText.push(`${todayCount} due today`);
            subtitleEl.textContent = '⚠️ ' + urgentText.join(', ');
            subtitleEl.classList.add('urgent');
        } else if (count > 0) {
            subtitleEl.textContent = 'Next: ' + pendingActions[0].title;
            subtitleEl.classList.remove('urgent');
        } else {
            subtitleEl.textContent = 'All caught up! Great job!';
            subtitleEl.classList.remove('urgent');
        }
    }

    // Render action items - show all urgent first, then others
    const contentEl = document.getElementById('action-hub-items');
    if (contentEl) {
        // Show all urgent actions + up to 2 others
        const displayActions = [...urgentActions, ...otherActions.slice(0, Math.max(0, 3 - urgentActions.length))];
        
        if (urgentActions.length > 3) {
            // If many urgent items, make scrollable
            contentEl.classList.add('scrollable');
        } else {
            contentEl.classList.remove('scrollable');
        }
        
        contentEl.innerHTML = displayActions.map(action => renderActionHubItem(action)).join('');
    }

    // Update view all link
    const footerEl = document.querySelector('.action-hub-footer a');
    if (footerEl) {
        footerEl.textContent = `View all ${count} actions →`;
    }
}

function renderActionHubItem(action) {
    const contacts = action.contactIds.map(id => AppData.getContact(id)).filter(c => c);
    const meeting = action.meetingId ? AppData.getMeeting(action.meetingId) : null;
    const contactName = contacts.length > 0 ? contacts[0].name : 'Self';
    const meetingTitle = meeting ? meeting.title : 'Manual';
    
    // Determine urgency status
    const isOverdue = DateHelper.isOverdue(action.dueDate);
    const isToday = DateHelper.isToday(action.dueDate);
    let statusTag = '';
    let itemClass = 'action-item';
    
    if (isOverdue) {
        statusTag = '<span class="action-status-tag overdue">Overdue</span>';
        itemClass += ' overdue';
    } else if (isToday) {
        statusTag = '<span class="action-status-tag today">Due Today</span>';
        itemClass += ' today';
    }

    return `
        <div class="${itemClass}" id="action-hub-${action.id}">
            <div class="action-checkbox" onclick="completeActionFromHub('${action.id}', event)"></div>
            <div class="action-details">
                <div class="action-title-row">
                    <span class="action-title" onclick="showMeetingDetail('${action.meetingId}')">${action.title}</span>
                    ${statusTag}
                </div>
                <div class="action-meta">
                    <span class="action-meta-item action-contact" onclick="event.stopPropagation(); showContactDetail('${contacts[0]?.id}')">👤 ${contactName}</span>
                    <span class="action-meta-item">📝 ${meetingTitle}</span>
                </div>
            </div>
        </div>
    `;
}

function toggleActionHub() {
    const hub = document.getElementById('action-hub');
    hub.classList.toggle('expanded');
    AppState.actionHubExpanded = hub.classList.contains('expanded');
}

function completeActionFromHub(actionId, event) {
    event.stopPropagation();
    const checkbox = event.target;
    const actionItem = document.getElementById(`action-hub-${actionId}`);

    // Visual feedback
    checkbox.classList.add('checked');
    actionItem.classList.add('completing');

    // Update data
    AppData.completeAction(actionId);

    // Show toast
    showToast('Action completed! ✓');

    // Remove after animation
    setTimeout(() => {
        actionItem.classList.add('removed');
        setTimeout(() => {
            renderActionHub();
        }, 300);
    }, 500);
}

// ========================================
// Today's Meetings (Home Page)
// ========================================

function renderTodayMeetings() {
    const meetings = AppData.getTodayMeetings();
    const container = document.getElementById('today-meetings');
    if (!container) return;

    container.innerHTML = meetings.map(meeting => {
        const pendingActions = AppData.getActionsForMeeting(meeting.id).filter(a => a.status === 'pending');
        const completedActions = AppData.getActionsForMeeting(meeting.id).filter(a => a.status === 'completed');
        const contacts = meeting.contactIds.map(id => AppData.getContact(id)).filter(c => c);
        const contactNames = contacts.map(c => c.name).join(', ') || 'Unknown';

        let actionStatus = '';
        if (pendingActions.length > 0) {
            actionStatus = `<div class="meeting-actions-preview pending">${pendingActions.length} pending</div>`;
        } else if (completedActions.length > 0) {
            actionStatus = `<div class="meeting-actions-preview done">✅ All done</div>`;
        }

        const iconClass = meeting.type === 'call' ? 'call' : meeting.type === 'voice' ? 'voice' : 'chat';
        const icon = meeting.type === 'call' ? '📞' : meeting.type === 'voice' ? '🎙' : '💬';

        return `
            <div class="meeting-card" onclick="showMeetingDetail('${meeting.id}')">
                <div class="meeting-top">
                    <div class="meeting-icon ${iconClass}">${icon}</div>
                    <div class="meeting-info">
                        <div class="meeting-title">${meeting.title}</div>
                        <div class="meeting-subtitle">with ${contactNames}</div>
                    </div>
                    <div class="meeting-time">${meeting.time}</div>
                </div>
                ${actionStatus}
            </div>
        `;
    }).join('');
}

// ========================================
// Action List Page
// ========================================

function renderActionList() {
    renderPendingActions();
    renderCompletedActions();
    updateActionTabCounts();
}

function renderPendingActions() {
    const container = document.getElementById('pending-content');
    if (!container) return;

    const actions = AppData.getPendingActions();
    
    // Group actions by due date status
    const overdue = actions.filter(a => DateHelper.isOverdue(a.dueDate));
    const today = actions.filter(a => DateHelper.isToday(a.dueDate));
    const upcoming = actions.filter(a => a.dueDate && !DateHelper.isOverdue(a.dueDate) && !DateHelper.isToday(a.dueDate));
    const noDue = actions.filter(a => !a.dueDate);

    let html = '';

    // Overdue
    if (overdue.length > 0) {
        html += `
            <div class="action-list-section overdue-section">
                <div class="action-list-date overdue">
                    <span>🔴 Overdue</span>
                    <span class="action-count">${overdue.length}</span>
                </div>
                <div class="action-list-group overdue">
                    ${overdue.map(a => renderActionListItem(a, 'overdue')).join('')}
                </div>
            </div>
        `;
    }

    // Today
    if (today.length > 0) {
        html += `
            <div class="action-list-section">
                <div class="action-list-date today">
                    <span>📅 Today</span>
                    <span class="action-count">${today.length}</span>
                </div>
                <div class="action-list-group">
                    ${today.map(a => renderActionListItem(a, 'today')).join('')}
                </div>
            </div>
        `;
    }

    // Upcoming
    if (upcoming.length > 0) {
        html += `
            <div class="action-list-section">
                <div class="action-list-date upcoming">
                    <span>📆 Upcoming</span>
                    <span class="action-count">${upcoming.length}</span>
                </div>
                <div class="action-list-group">
                    ${upcoming.map(a => renderActionListItem(a, 'upcoming')).join('')}
                </div>
            </div>
        `;
    }

    // No Due Date
    if (noDue.length > 0) {
        html += `
            <div class="action-list-section">
                <div class="action-list-date no-due">
                    <span>📋 No Due Date</span>
                    <span class="action-count">${noDue.length}</span>
                </div>
                <div class="action-list-group">
                    ${noDue.map(a => renderActionListItem(a, 'no-due')).join('')}
                </div>
            </div>
        `;
    }

    container.innerHTML = html || '<div class="empty-state">No pending actions! 🎉</div>';
}

function renderActionListItem(action, type) {
    const contacts = action.contactIds.map(id => AppData.getContact(id)).filter(c => c);
    const meeting = action.meetingId ? AppData.getMeeting(action.meetingId) : null;
    const contactName = contacts.length > 0 ? contacts[0].name : 'Self';
    const meetingTitle = meeting ? meeting.title : 'Manual';
    const createdDate = DateHelper.formatDate(action.createdAt.split('T')[0]);
    
    // Due date with edit capability
    let dueInfo = '';
    if (action.dueDate) {
        const dueText = DateHelper.isToday(action.dueDate) ? 'Today' : 
                       `${DateHelper.formatDate(action.dueDate)} (${DateHelper.getDayOfWeek(action.dueDate)})`;
        const dueClass = type === 'overdue' ? 'overdue' : type === 'today' ? 'today' : '';
        dueInfo = `<span class="action-due ${dueClass}" onclick="event.stopPropagation(); editDueDate('${action.id}')">📅 ${dueText} ✏️</span>`;
        
        if (type === 'overdue') {
            const daysOverdue = Math.ceil((new Date(DateHelper.today) - new Date(action.dueDate)) / (1000 * 60 * 60 * 24));
            dueInfo += `<span class="overdue-badge">${daysOverdue}d overdue</span>`;
        }
    } else {
        dueInfo = `<span class="action-no-due" onclick="event.stopPropagation(); editDueDate('${action.id}')">📅 No due date ✏️</span>`;
    }

    const aiTag = action.aiSuggested ? '<span class="ai-suggested">✨ AI</span>' : '';
    
    // Show "Go to Meeting" if has meeting context (for follow up there)
    const hasMeetingContext = action.meetingId && action.meetingId !== null;

    return `
        <div class="action-list-card" id="action-list-${action.id}">
            <div class="action-list-checkbox" onclick="completeActionFromList('${action.id}', event)"></div>
            <div class="action-list-content">
                <div class="action-list-title" onclick="event.stopPropagation(); enableInlineEdit('${action.id}', this)">${action.title}</div>
                <div class="action-list-meta">
                    <span class="action-list-contact" onclick="event.stopPropagation(); ${contacts[0]?.id ? `showContactDetail('${contacts[0].id}')` : ''}">👤 ${contactName}</span>
                    <span class="action-list-source" onclick="event.stopPropagation(); ${hasMeetingContext ? `showMeetingDetail('${action.meetingId}')` : ''}">📝 ${meetingTitle}</span>
                    ${aiTag}
                </div>
                <div class="action-time-row">
                    ${dueInfo}
                    <span class="action-created">Created: ${createdDate}</span>
                </div>
                <div class="action-list-actions">
                    ${hasMeetingContext ? `<button class="action-quick-btn" onclick="event.stopPropagation(); showMeetingDetail('${action.meetingId}')">📝 View Meeting</button>` : ''}
                    ${type === 'overdue' ? `<button class="action-quick-btn" onclick="event.stopPropagation(); snoozeAction('${action.id}')">⏰ Snooze</button>` : ''}
                    ${type === 'overdue' ? `<button class="action-quick-btn secondary" onclick="event.stopPropagation(); clearDueDate('${action.id}')">Remove Due</button>` : ''}
                </div>
            </div>
        </div>
    `;
}

// Check if action involves communication (kept for future use)
function actionNeedsCommunication(title) {
    const communicationKeywords = ['follow up', 'send', 'email', 'contact', 'reply', 'respond', 'call', 'reach out', 'message', 'notify'];
    const lowerTitle = title.toLowerCase();
    return communicationKeywords.some(keyword => lowerTitle.includes(keyword));
}

// Not currently used - AI Email buttons moved to Meeting Detail as "Quick Follow Up"

function renderCompletedActions() {
    const container = document.getElementById('completed-content');
    if (!container) return;

    const actions = AppData.getCompletedActions();
    
    // Group by completion date
    const todayCompleted = actions.filter(a => a.completedAt && a.completedAt.startsWith(DateHelper.today));
    const yesterdayCompleted = actions.filter(a => a.completedAt && a.completedAt.startsWith('2026-01-14'));
    const earlierCompleted = actions.filter(a => a.completedAt && !a.completedAt.startsWith(DateHelper.today) && !a.completedAt.startsWith('2026-01-14'));

    let html = '';

    if (todayCompleted.length > 0) {
        html += `
            <div class="action-list-section">
                <div class="action-list-date completed-date"><span>Today · Jan 15</span></div>
                <div class="action-list-group">
                    ${todayCompleted.map(a => renderCompletedActionItem(a)).join('')}
                </div>
            </div>
        `;
    }

    if (yesterdayCompleted.length > 0) {
        html += `
            <div class="action-list-section">
                <div class="action-list-date completed-date"><span>Yesterday · Jan 14</span></div>
                <div class="action-list-group">
                    ${yesterdayCompleted.map(a => renderCompletedActionItem(a)).join('')}
                </div>
            </div>
        `;
    }

    if (earlierCompleted.length > 0) {
        html += `
            <div class="action-list-section">
                <div class="action-list-date completed-date"><span>Earlier</span></div>
                <div class="action-list-group">
                    ${earlierCompleted.map(a => renderCompletedActionItem(a)).join('')}
                </div>
            </div>
        `;
    }

    container.innerHTML = html || '<div class="empty-state">No completed actions yet</div>';
}

function renderCompletedActionItem(action) {
    const contacts = action.contactIds.map(id => AppData.getContact(id)).filter(c => c);
    const meeting = action.meetingId ? AppData.getMeeting(action.meetingId) : null;
    const contactName = contacts.length > 0 ? contacts[0].name : 'Self';
    const meetingTitle = meeting ? meeting.title : 'Manual';
    const completedTime = DateHelper.getRelativeTime(action.completedAt);

    return `
        <div class="action-list-card completed">
            <div class="action-list-checkbox checked"></div>
            <div class="action-list-content">
                <div class="action-list-title completed-title">${action.title}</div>
                <div class="action-list-meta">
                    <span class="action-list-contact">👤 ${contactName}</span>
                    <span class="action-list-source">📝 ${meetingTitle}</span>
                </div>
                <div class="action-time-row">
                    <span class="action-completed-time">✓ Completed ${completedTime}</span>
                </div>
            </div>
        </div>
    `;
}

function updateActionTabCounts() {
    const pendingCount = AppData.getPendingActions().length;
    const completedCount = AppData.getCompletedActions().length;
    
    document.querySelectorAll('.action-tab-count')[0].textContent = pendingCount;
    document.querySelectorAll('.action-tab-count')[1].textContent = completedCount;
}

function switchActionTab(tab, element) {
    AppState.currentActionTab = tab;
    
    document.querySelectorAll('.action-tab').forEach(t => t.classList.remove('active'));
    element.classList.add('active');
    
    document.querySelectorAll('.action-tab-content').forEach(c => c.classList.remove('active'));
    document.getElementById(tab + '-content').classList.add('active');
}

function completeActionFromList(actionId, event) {
    event.stopPropagation();
    const checkbox = event.target;
    const actionItem = document.getElementById(`action-list-${actionId}`);

    checkbox.classList.add('checked');
    actionItem.classList.add('completing');

    AppData.completeAction(actionId);
    showToast('Action completed! ✓');

    setTimeout(() => {
        renderActionList();
        renderActionHub();
    }, 500);
}

// ========================================
// Sort & Filter
// ========================================

function toggleSortMenu() {
    document.getElementById('sort-menu').classList.toggle('show');
}

function changeSortBy(sortType) {
    AppState.currentSort = sortType;
    
    const sortNames = {
        'due': 'Due Date',
        'created': 'Creation Date',
        'contact': 'Contact'
    };
    
    document.getElementById('current-sort').textContent = sortNames[sortType];
    
    document.querySelectorAll('.sort-option').forEach(opt => opt.classList.remove('active'));
    event.target.closest('.sort-option').classList.add('active');
    
    document.getElementById('sort-menu').classList.remove('show');
    
    showToast('Sorted by ' + sortNames[sortType]);
    renderPendingActions();
}

// ========================================
// Meeting List Page
// ========================================

function renderMeetingList() {
    const container = document.getElementById('meeting-list-content');
    if (!container) return;

    const meetings = AppData.meetings;
    
    // Group by date
    const grouped = {};
    meetings.forEach(m => {
        if (!grouped[m.date]) grouped[m.date] = [];
        grouped[m.date].push(m);
    });

    let html = '';
    Object.keys(grouped).sort().reverse().forEach(date => {
        const dateLabel = DateHelper.isToday(date) ? 'Today · Jan 15' : 
                         date === '2026-01-14' ? 'Yesterday · Jan 14' : 
                         DateHelper.formatDate(date);
        
        html += `<div class="meeting-list-date">${dateLabel}</div>`;
        
        grouped[date].forEach(meeting => {
            const contacts = meeting.contactIds.map(id => AppData.getContact(id)).filter(c => c);
            const contactNames = contacts.map(c => c.name).join(', ') || 'Unknown';
            const pendingActions = AppData.getActionsForMeeting(meeting.id).filter(a => a.status === 'pending');
            
            const iconClass = meeting.type === 'call' ? 'call' : meeting.type === 'voice' ? 'voice' : 'chat';
            const icon = meeting.type === 'call' ? '📞' : meeting.type === 'voice' ? '🎙' : '💬';

            let actionPreview = '';
            if (pendingActions.length > 0) {
                actionPreview = `<div class="meeting-list-actions">${pendingActions.length} pending action${pendingActions.length > 1 ? 's' : ''}</div>`;
            }

            html += `
                <div class="meeting-list-card" onclick="showMeetingDetail('${meeting.id}')">
                    <div class="meeting-list-icon ${iconClass}">${icon}</div>
                    <div class="meeting-list-info">
                        <div class="meeting-list-title">${meeting.title}</div>
                        <div class="meeting-list-subtitle">with ${contactNames} · ${meeting.duration}min</div>
                        <div class="meeting-list-summary">${meeting.summary.substring(0, 80)}...</div>
                        ${actionPreview}
                    </div>
                    <div class="meeting-list-time">${meeting.time}</div>
                </div>
            `;
        });
    });

    container.innerHTML = html;
}

// ========================================
// Meeting Detail Page (Full Screen)
// ========================================

function showMeetingDetail(meetingId) {
    if (!meetingId) {
        meetingId = AppState.selectedMeeting;
    }
    AppState.selectedMeeting = meetingId;
    AppState.previousPage = AppState.currentPage;
    
    const meeting = AppData.getMeeting(meetingId);
    if (!meeting) {
        showToast('Meeting not found');
        return;
    }

    const contacts = meeting.contactIds.map(id => AppData.getContact(id)).filter(c => c);
    const meetingActions = AppData.getActionsForMeeting(meetingId);
    const pendingActions = meetingActions.filter(a => a.status === 'pending');
    const completedActions = meetingActions.filter(a => a.status === 'completed');
    
    // Use detailed summary data if available
    const summaryData = meeting.summaryData || {
        overview: meeting.summary,
        background: {
            participants: contacts.map(c => c.name).join(', '),
            roles: 'Participants',
            purpose: `Discussion about ${meeting.title}`
        },
        keyConclusions: ['Key points discussed'],
        topics: [{
            title: 'Main Discussion',
            opinion: meeting.summary,
            detail: ''
        }],
        risks: [],
        highlights: [],
        nextActions: pendingActions.map(a => a.title)
    };

    const contentEl = document.getElementById('md-content');
    
    contentEl.innerHTML = `
        <!-- Hero Section -->
        <div class="md-hero">
            <div class="md-title">${meeting.title}</div>
            <div class="md-meta-row">
                <span class="md-time">${meeting.time}</span>
                <button class="md-add-participant" onclick="addMeetingParticipant('${meetingId}')">+</button>
            </div>
            <div class="md-participants">
                ${contacts.map(c => `
                    <div class="md-avatar" style="background: ${c.avatarColor || 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'}" 
                         onclick="closeMeetingDetail(); setTimeout(() => showContactDetail('${c.id}'), 100)">
                        ${c.avatar}
                    </div>
                `).join('')}
            </div>
            <div class="md-config-row" onclick="showToast('Template settings...')">
                <div class="md-config-item">
                    📋 ${meeting.template || '通用'}
                </div>
                <div class="md-config-item">
                    🌐 ${meeting.language || 'Chinese'} <span class="md-config-arrow">›</span>
                </div>
            </div>
        </div>

        <!-- 总结 / 整体总结 -->
        <div class="md-section">
            <h2 class="md-section-title">总结 / 整体总结</h2>
            <p class="md-text">${summaryData.overview}</p>
        </div>

        <!-- 会面背景 -->
        <div class="md-section">
            <h2 class="md-section-title">会面背景</h2>
            <ul class="md-list">
                <li><strong>参与者:</strong> ${summaryData.background.participants}</li>
                <li><strong>角色:</strong> ${summaryData.background.roles}</li>
                <li><strong>会面目的:</strong> ${summaryData.background.purpose}</li>
            </ul>
        </div>

        <!-- 关键结论总结 -->
        <div class="md-section">
            <h2 class="md-section-title">关键结论总结</h2>
            <ul class="md-list">
                ${summaryData.keyConclusions.map(c => `<li>${c}</li>`).join('')}
            </ul>
        </div>

        <!-- 核心议题逐条总结 -->
        <div class="md-section">
            <h2 class="md-section-title">核心议题逐条总结</h2>
            ${summaryData.topics.map((topic, i) => `
                <div class="md-topic">
                    <div class="md-topic-title">议题 ${i + 1}: ${topic.title}</div>
                    <div class="md-topic-content">
                        <strong>观点:</strong> ${topic.opinion}
                    </div>
                    ${topic.detail ? `
                        <div class="md-topic-detail">
                            <strong>细节:</strong> ${topic.detail}
                        </div>
                    ` : ''}
                    ${topic.conclusion ? `
                        <div class="md-topic-content" style="margin-top: 8px;">
                            <strong>结论:</strong> ${topic.conclusion}
                        </div>
                    ` : ''}
                </div>
            `).join('')}
        </div>

        <!-- 待定问题 / 风险点 -->
        ${summaryData.risks && summaryData.risks.length > 0 ? `
            <div class="md-section">
                <h2 class="md-section-title">待定问题 / 风险点</h2>
                <ul class="md-list">
                    ${summaryData.risks.map(r => `<li>${r}</li>`).join('')}
                </ul>
            </div>
        ` : `
            <div class="md-section">
                <h2 class="md-section-title">待定问题 / 风险点</h2>
                <ul class="md-list">
                    <li>无</li>
                </ul>
            </div>
        `}

        <!-- 下一步行动 (Actions) - More Prominent -->
        <div class="md-actions-section">
            <div class="md-actions-header">
                <div class="md-actions-title">
                    📋 下一步行动
                    <span class="action-badge">${pendingActions.length}</span>
                </div>
            </div>
            
            ${pendingActions.map(a => `
                <div class="md-action-item" id="md-action-${a.id}">
                    <div class="md-action-checkbox" onclick="completeActionFromMeeting('${a.id}', this)"></div>
                    <div class="md-action-content">
                        <div class="md-action-text" onclick="enableInlineEdit('${a.id}', this)">${a.title}</div>
                        <div class="md-action-meta" onclick="editDueDate('${a.id}')">${a.dueDate ? '📅 ' + DateHelper.formatDate(a.dueDate) : '📅 Set due date'}</div>
                    </div>
                </div>
            `).join('')}
            
            ${completedActions.length > 0 ? `
                <div style="margin-top: 16px; padding-top: 12px; border-top: 1px dashed rgba(0,0,0,0.1);">
                    <div style="font-size: 13px; color: var(--text-tertiary); margin-bottom: 8px;">✓ Completed</div>
                    ${completedActions.map(a => `
                        <div class="md-action-item completed">
                            <div class="md-action-checkbox checked"></div>
                            <div class="md-action-content">
                                <div class="md-action-text">${a.title}</div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            ` : ''}
            
            <div class="md-add-action-row" onclick="showAddActionForMeeting('${meetingId}')">
                <span>+</span>
                <span>Add Action</span>
            </div>
        </div>

        <!-- 附录: 高价值原话 / 片段 -->
        ${summaryData.highlights && summaryData.highlights.length > 0 ? `
            <div class="md-section">
                <h2 class="md-section-title">附录: 高价值原话 / 片段</h2>
                <ul class="md-list md-quotes">
                    ${summaryData.highlights.map(h => `<li>${h}</li>`).join('')}
                </ul>
            </div>
        ` : ''}

        <!-- Quick Follow Up -->
        <div class="md-followup-section">
            <button class="md-followup-btn" onclick="generateMeetingFollowUp('${meetingId}')">
                📧 Quick Follow Up Email
            </button>
            <div class="md-followup-hint">AI will draft an email based on this meeting's context</div>
        </div>
    `;

    // Show the page
    const meetingDetailPage = document.getElementById('meeting-detail-page');
    if (meetingDetailPage) {
        meetingDetailPage.style.display = 'flex';
        meetingDetailPage.classList.add('active');
    }
    
    // Hide tab bar and sticky bar
    const tabBar = document.querySelector('.tab-bar');
    const stickyBar = document.querySelector('.sticky-bar');
    if (tabBar) tabBar.style.display = 'none';
    if (stickyBar) stickyBar.style.display = 'none';
}

function closeMeetingDetail() {
    const meetingDetailPage = document.getElementById('meeting-detail-page');
    if (meetingDetailPage) {
        meetingDetailPage.classList.remove('active');
        meetingDetailPage.style.display = 'none';
    }
    
    // Restore tab bar
    const tabBar = document.querySelector('.tab-bar');
    if (tabBar) tabBar.style.display = 'flex';
    
    // Go back to previous page or home
    const prevPage = AppState.previousPage || 'home';
    showPage(prevPage);
}

function completeActionFromMeeting(actionId, checkbox) {
    checkbox.classList.add('checked');
    const actionItem = document.getElementById(`md-action-${actionId}`);
    if (actionItem) {
        actionItem.classList.add('completed');
    }
    
    AppData.completeAction(actionId);
    showToast('Action completed! ✓');
    
    setTimeout(() => {
        refreshAllViews();
    }, 300);
}

function showTranscript() {
    showToast('Opening transcript...');
}

function shareMeeting() {
    showToast('Share options coming soon...');
}

function copyMeetingSummary() {
    const meeting = AppData.getMeeting(AppState.selectedMeeting);
    if (meeting) {
        const text = meeting.summaryData?.overview || meeting.summary;
        navigator.clipboard?.writeText(text).then(() => {
            showToast('Summary copied!');
        }).catch(() => {
            showToast('Summary copied!');
        });
    }
}

function addMeetingParticipant(meetingId) {
    showToast('Add participant...');
}

function completeActionFromModal(actionId, event) {
    event.stopPropagation();
    const checkbox = event.target;
    const actionItem = document.getElementById(`modal-action-${actionId}`);

    checkbox.classList.add('checked');
    actionItem.style.opacity = '0.5';
    actionItem.style.textDecoration = 'line-through';

    AppData.completeAction(actionId);
    showToast('Action completed! ✓');

    setTimeout(() => {
        renderActionHub();
        if (AppState.currentPage === 'actionList') {
            renderActionList();
        }
    }, 300);
}

// ========================================
// Contact Detail
// ========================================

function showContactDetail(contactId) {
    if (!contactId) {
        contactId = AppState.selectedContact;
    }
    AppState.selectedContact = contactId;
    showPage('contact');
}

function renderContactDetail() {
    const contact = AppData.getContact(AppState.selectedContact);
    if (!contact) return;

    // Update header
    const avatarEl = document.querySelector('.contact-avatar-large');
    const nameEl = document.querySelector('.contact-name');
    const roleEl = document.querySelector('.contact-role');
    const badgeEl = document.querySelector('.contact-avatar-badge');

    if (avatarEl) avatarEl.textContent = contact.avatar;
    if (nameEl) nameEl.textContent = contact.name;
    if (roleEl) roleEl.textContent = `${contact.role} @ ${contact.company}`;
    
    const pendingActions = AppData.getActionsForContact(contact.id).filter(a => a.status === 'pending');
    if (badgeEl) {
        if (pendingActions.length > 0) {
            badgeEl.style.display = 'flex';
            badgeEl.textContent = pendingActions.length;
        } else {
            badgeEl.style.display = 'none';
        }
    }

    // Render pending actions
    renderContactPendingActions(contact.id);
    
    // Render activities
    renderContactActivities(contact.id);
}

function renderContactPendingActions(contactId) {
    const container = document.getElementById('contact-pending-actions');
    if (!container) return;

    const actions = AppData.getActionsForContact(contactId).filter(a => a.status === 'pending');
    const contact = AppData.getContact(contactId);

    if (actions.length === 0) {
        container.style.display = 'none';
        return;
    }

    container.style.display = 'block';
    container.innerHTML = `
        <div class="contact-pending-header" onclick="toggleContactActions()">
            <div class="contact-pending-title">
                🔴 ${actions.length} Pending Actions with ${contact.name}
            </div>
            <span class="contact-pending-arrow">▼</span>
        </div>
        <div class="contact-pending-content">
            ${actions.map(a => {
                const meeting = a.meetingId ? AppData.getMeeting(a.meetingId) : null;
                const isOverdue = DateHelper.isOverdue(a.dueDate);
                const isToday = DateHelper.isToday(a.dueDate);
                
                let dueTag = '';
                if (isOverdue) {
                    dueTag = '<span class="action-status-tag overdue">Overdue</span>';
                } else if (isToday) {
                    dueTag = '<span class="action-status-tag today">Today</span>';
                }
                
                return `
                    <div class="contact-action-item ${isOverdue ? 'overdue' : ''} ${isToday ? 'today' : ''}">
                        <div class="action-checkbox" onclick="event.stopPropagation(); completeActionFromContact('${a.id}', this)"></div>
                        <div class="action-details">
                            <div class="action-title-row">
                                <span class="action-title" onclick="event.stopPropagation(); enableInlineEdit('${a.id}', this)">${a.title}</span>
                                ${dueTag}
                            </div>
                            <div class="action-meta">
                                <span onclick="event.stopPropagation(); ${meeting ? `showMeetingDetail('${a.meetingId}')` : ''}">📝 ${meeting ? meeting.title : 'Manual'}</span>
                                <span onclick="event.stopPropagation(); editDueDate('${a.id}')">${a.dueDate ? '📅 ' + DateHelper.formatDate(a.dueDate) : '📅 Set due'}</span>
                            </div>
                            <div class="action-quick-actions">
                                ${meeting ? `<button class="action-quick-btn" onclick="event.stopPropagation(); showMeetingDetail('${a.meetingId}')">📝 View Meeting</button>` : ''}
                                ${isOverdue ? `<button class="action-quick-btn" onclick="event.stopPropagation(); snoozeAction('${a.id}')">⏰ Snooze</button>` : ''}
                            </div>
                        </div>
                    </div>
                `;
            }).join('')}
            <div class="contact-pending-footer">
                <span onclick="showAddActionForContact('${contactId}')">+ Add Action</span>
            </div>
        </div>
    `;
}

function renderContactActivities(contactId) {
    // Get meetings with this contact
    const meetings = AppData.meetings.filter(m => m.contactIds.includes(contactId));
    const container = document.querySelector('.activity-section');
    if (!container) return;

    // Group by date
    const grouped = {};
    meetings.forEach(m => {
        if (!grouped[m.date]) grouped[m.date] = [];
        grouped[m.date].push(m);
    });

    let html = '';
    Object.keys(grouped).sort().reverse().forEach(date => {
        const dateLabel = DateHelper.isToday(date) ? 'Today' : 
                         date === '2026-01-14' ? 'Yesterday' : 
                         DateHelper.formatDate(date);
        
        html += `<div class="activity-date">${dateLabel}</div>`;
        
        grouped[date].forEach(meeting => {
            const pendingActions = AppData.getActionsForMeeting(meeting.id).filter(a => a.status === 'pending');
            const actionHtml = pendingActions.length > 0 ? `
                <div class="activity-card-actions">
                    <div class="activity-actions-title">${pendingActions.length} Actions</div>
                    ${pendingActions.slice(0, 2).map(a => `<div class="activity-action-preview">• ${a.title}</div>`).join('')}
                </div>
            ` : '';

            html += `
                <div class="activity-card" onclick="showMeetingDetail('${meeting.id}')">
                    <div class="activity-card-header">
                        <div class="activity-card-title">📝 ${meeting.title}</div>
                        <div class="activity-card-time">${meeting.time}</div>
                    </div>
                    <div class="activity-card-summary">${meeting.summary.substring(0, 100)}...</div>
                    ${actionHtml}
                    <div class="activity-card-footer">
                        <span class="activity-view-details">View Details →</span>
                    </div>
                </div>
            `;
        });
    });

    // Add first contact
    const contact = AppData.getContact(contactId);
    if (contact && contact.firstContact) {
        html += `
            <div class="activity-date">${DateHelper.formatDate(contact.firstContact.date)}</div>
            <div class="activity-card first-contact">
                <div class="activity-card-header">
                    <div class="activity-card-title">👤 First Contact</div>
                </div>
                <div class="activity-source">Source: ${contact.firstContact.source}</div>
                <div class="activity-location">📍 ${contact.firstContact.location}</div>
            </div>
        `;
    }

    container.innerHTML = html;
}

function completeActionFromContact(actionId, checkbox) {
    checkbox.classList.add('checked');
    AppData.completeAction(actionId);
    showToast('Action completed! ✓');
    
    setTimeout(() => {
        renderContactDetail();
        renderActionHub();
    }, 300);
}

function toggleContactActions() {
    const container = document.getElementById('contact-pending-actions');
    container.classList.toggle('collapsed');
}

// ========================================
// Action Operations
// ========================================

// Deprecated - now using generateMeetingFollowUp from Meeting Detail
function generateAIFollowUp(actionId) {
    const action = AppData.getAction(actionId);
    if (!action) return;
    
    // Guide user to meeting for full context
    if (action.meetingId) {
        showToast('Opening meeting for full context...');
        setTimeout(() => {
            showMeetingDetail(action.meetingId);
        }, 500);
    } else {
        showToast('No meeting context available for this action');
    }
}

function setDueDate(actionId) {
    editDueDate(actionId);
}

function editDueDate(actionId) {
    const action = AppData.getAction(actionId);
    const currentDue = action?.dueDate || '';
    
    // Show date picker modal
    const options = [
        { label: 'Today', value: DateHelper.today },
        { label: 'Tomorrow', value: '2026-01-16' },
        { label: 'This Week', value: '2026-01-19' },
        { label: 'Next Week', value: '2026-01-22' },
        { label: 'No Due Date', value: '' },
        { label: 'Custom...', value: 'custom' }
    ];
    
    const choice = prompt(
        `Set due date for: "${action.title.substring(0, 40)}..."\n\n` +
        `Current: ${currentDue ? DateHelper.formatDate(currentDue) : 'No due date'}\n\n` +
        `Options:\n` +
        `1. Today (Jan 15)\n` +
        `2. Tomorrow (Jan 16)\n` +
        `3. This Week (Jan 19)\n` +
        `4. Next Week (Jan 22)\n` +
        `5. No Due Date\n` +
        `6. Custom (enter YYYY-MM-DD)\n\n` +
        `Enter 1-6 or a date:`
    );
    
    if (!choice) return;
    
    let newDate = null;
    switch(choice.trim()) {
        case '1': newDate = DateHelper.today; break;
        case '2': newDate = '2026-01-16'; break;
        case '3': newDate = '2026-01-19'; break;
        case '4': newDate = '2026-01-22'; break;
        case '5': newDate = null; break;
        case '6': 
            const customDate = prompt('Enter date (YYYY-MM-DD):', DateHelper.today);
            if (customDate) newDate = customDate;
            else return;
            break;
        default:
            // Check if it's a valid date format
            if (/^\d{4}-\d{2}-\d{2}$/.test(choice.trim())) {
                newDate = choice.trim();
            } else {
                showToast('Invalid option');
                return;
            }
    }
    
    AppData.updateActionDueDate(actionId, newDate);
    showToast(newDate ? 'Due date set to ' + DateHelper.formatDate(newDate) : 'Due date removed');
    refreshAllViews();
}

function clearDueDate(actionId) {
    AppData.updateActionDueDate(actionId, null);
    showToast('Due date removed');
    refreshAllViews();
}

function snoozeAction(actionId) {
    const options = [
        { label: 'Tomorrow', days: 1, value: '2026-01-16' },
        { label: '3 Days', days: 3, value: '2026-01-18' },
        { label: '1 Week', days: 7, value: '2026-01-22' }
    ];
    
    const choice = prompt(
        'Snooze until:\n\n' +
        '1. Tomorrow (Jan 16)\n' +
        '2. 3 Days (Jan 18)\n' +
        '3. 1 Week (Jan 22)\n\n' +
        'Enter 1-3:'
    );
    
    if (!choice) return;
    
    let newDate = null;
    switch(choice.trim()) {
        case '1': newDate = '2026-01-16'; break;
        case '2': newDate = '2026-01-18'; break;
        case '3': newDate = '2026-01-22'; break;
        default:
            showToast('Invalid option');
            return;
    }
    
    AppData.updateActionDueDate(actionId, newDate);
    showToast('Snoozed until ' + DateHelper.formatDate(newDate));
    refreshAllViews();
}

// Inline edit for action title
function enableInlineEdit(actionId, element) {
    const action = AppData.getAction(actionId);
    if (!action) return;
    
    const currentTitle = action.title;
    const input = document.createElement('input');
    input.type = 'text';
    input.value = currentTitle;
    input.className = 'inline-edit-input';
    input.style.cssText = 'width: 100%; font-size: inherit; font-weight: inherit; padding: 4px 8px; border: 2px solid #007AFF; border-radius: 6px; outline: none;';
    
    element.innerHTML = '';
    element.appendChild(input);
    input.focus();
    input.select();
    
    const saveEdit = () => {
        const newTitle = input.value.trim();
        if (newTitle && newTitle !== currentTitle) {
            action.title = newTitle;
            showToast('Action updated');
        }
        refreshAllViews();
    };
    
    input.addEventListener('blur', saveEdit);
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            input.blur();
        } else if (e.key === 'Escape') {
            input.value = currentTitle;
            input.blur();
        }
    });
}

// Refresh all views
function refreshAllViews() {
    renderActionHub();
    if (AppState.currentPage === 'actionList') {
        renderActionList();
    }
    if (AppState.currentPage === 'contact') {
        renderContactDetail();
    }
}

// Add Action from different contexts
function showAddActionModal(contactId) {
    // From Home or generic - no association
    const title = prompt('What needs to be done?');
    if (title) {
        AppData.addAction({
            title: title,
            contactIds: contactId ? [contactId] : [],
            meetingId: null  // Manual - no meeting association
        });
        showToast('Action added!');
        refreshAllViews();
    }
}

function showAddActionForMeeting(meetingId) {
    // From Meeting Detail - associate with meeting
    const meeting = AppData.getMeeting(meetingId);
    const title = prompt(`Add action for "${meeting.title}":`);
    if (title) {
        AppData.addAction({
            title: title,
            contactIds: meeting.contactIds || [],  // Associate with meeting's contacts
            meetingId: meetingId
        });
        showToast('Action added to meeting!');
        showMeetingDetail(meetingId);  // Refresh modal
        refreshAllViews();
    }
}

function showAddActionForContact(contactId) {
    // From Contact Detail - associate with contact only
    const contact = AppData.getContact(contactId);
    const title = prompt(`Add action for "${contact.name}":`);
    if (title) {
        AppData.addAction({
            title: title,
            contactIds: [contactId],
            meetingId: null  // Manual - no meeting association
        });
        showToast('Action added!');
        refreshAllViews();
    }
}

// Generate follow up email from Meeting context
function generateMeetingFollowUp(meetingId) {
    const meeting = AppData.getMeeting(meetingId);
    const contacts = meeting.contactIds.map(id => AppData.getContact(id)).filter(c => c);
    const contactNames = contacts.map(c => c.name).join(', ');
    
    showToast(`Drafting follow-up email for "${meeting.title}"...`);
    
    // Simulate AI generation
    setTimeout(() => {
        const emailPreview = `
Hi ${contactNames || 'there'},

Thank you for the meeting today about "${meeting.title}". 

Based on our discussion, I wanted to follow up on the key points we covered:
- ${meeting.summary.substring(0, 100)}...

Please let me know if you have any questions.

Best regards`;
        
        alert(`📧 AI Draft Email:\n${emailPreview}\n\n[Send] [Edit] [Cancel]`);
        showToast('Email draft ready!');
    }, 1000);
}

// ========================================
// Utility Functions
// ========================================

function showToast(message) {
    const toast = document.getElementById('toast');
    document.getElementById('toast-message').textContent = message;
    toast.classList.add('show');
    setTimeout(() => {
        toast.classList.remove('show');
    }, 2000);
}

function closeAllModals() {
    document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('show'));
}

// Make functions globally available
// ========================================
// Contact Activity Tabs
// ========================================

function switchContactTab(tab, element) {
    AppState.contactActivityTab = tab;
    
    document.querySelectorAll('.contact-tab').forEach(t => t.classList.remove('active'));
    element.classList.add('active');
    
    // Update content visibility
    const sections = ['contact-pending-actions', 'contact-activities'];
    if (tab === 'info') {
        // Show info section
        showToast('Info tab coming soon...');
    } else if (tab === 'activities') {
        renderContactPendingActions(AppState.selectedContact);
        renderContactActivities(AppState.selectedContact);
    }
}

// ========================================
// Filter Contacts
// ========================================

function filterContacts(filter) {
    // Update filter tabs
    document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
    event.target.classList.add('active');
    
    const container = document.getElementById('contact-list');
    let contacts = AppData.contacts;
    
    if (filter === 'hasActions') {
        contacts = contacts.filter(c => {
            const actions = AppData.getActionsForContact(c.id).filter(a => a.status === 'pending');
            return actions.length > 0;
        });
    } else if (filter === 'recent') {
        // For demo, just show first 2
        contacts = contacts.slice(0, 2);
    }
    
    container.innerHTML = contacts.map(contact => {
        const pendingActions = AppData.getActionsForContact(contact.id).filter(a => a.status === 'pending');
        const hasPending = pendingActions.length > 0;
        
        return `
            <div class="contact-card" onclick="showContactDetail('${contact.id}')">
                <div class="contact-avatar-wrapper">
                    <div class="contact-avatar" style="background: ${contact.avatarColor}">${contact.avatar}</div>
                    ${hasPending ? `<span class="contact-action-badge">${pendingActions.length}</span>` : ''}
                </div>
                <div class="contact-info">
                    <div class="contact-name">${contact.name}</div>
                    <div class="contact-role-small">${contact.role} @ ${contact.company}</div>
                </div>
                <div class="contact-arrow">›</div>
            </div>
        `;
    }).join('');
    
    if (contacts.length === 0) {
        container.innerHTML = '<div class="empty-state">No contacts found</div>';
    }
}

// ========================================
// Global Functions
// ========================================

// Make functions globally available
window.showPage = showPage;
window.toggleActionHub = toggleActionHub;
window.completeActionFromHub = completeActionFromHub;
window.showMeetingDetail = showMeetingDetail;
window.closeMeetingDetail = closeMeetingDetail;
window.showContactDetail = showContactDetail;
window.switchActionTab = switchActionTab;
window.toggleSortMenu = toggleSortMenu;
window.changeSortBy = changeSortBy;
window.generateAIFollowUp = generateAIFollowUp;
window.setDueDate = setDueDate;
window.snoozeAction = snoozeAction;
window.showAddActionModal = showAddActionModal;
window.showToast = showToast;
window.toggleContactActions = toggleContactActions;
window.completeActionFromList = completeActionFromList;
window.completeActionFromModal = completeActionFromModal;
window.completeActionFromContact = completeActionFromContact;
window.switchContactTab = switchContactTab;
window.filterContacts = filterContacts;
window.renderContactList = renderContactList;
window.editDueDate = editDueDate;
window.clearDueDate = clearDueDate;
window.enableInlineEdit = enableInlineEdit;
window.refreshAllViews = refreshAllViews;
window.showAddActionForMeeting = showAddActionForMeeting;
window.showAddActionForContact = showAddActionForContact;
window.generateMeetingFollowUp = generateMeetingFollowUp;
window.completeActionFromMeeting = completeActionFromMeeting;
window.showTranscript = showTranscript;
window.shareMeeting = shareMeeting;
window.copyMeetingSummary = copyMeetingSummary;
window.addMeetingParticipant = addMeetingParticipant;
