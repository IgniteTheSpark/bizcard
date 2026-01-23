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
    renderTodayMeetings();
    renderRemindersHub();
    renderContactList();
    setupEventListeners();
}

function renderHomePage() {
    // Update user profile - support both old and new structure
    const user = AppData.user;
    
    // 新的统一卡片结构
    const avatarLgEl = document.querySelector('.profile-avatar-lg');
    const nameInDetailsEl = document.querySelector('.profile-details .profile-name');
    const roleInDetailsEl = document.querySelector('.profile-details .profile-role');
    const companyEl = document.querySelector('.profile-details .profile-company');
    
    if (avatarLgEl) avatarLgEl.textContent = user.avatar;
    if (nameInDetailsEl) nameInDetailsEl.textContent = user.name;
    if (roleInDetailsEl) roleInDetailsEl.textContent = user.role;
    if (companyEl) companyEl.textContent = `@ ${user.company || 'Bitflux Insurance'}`;
    
    // Legacy support
    const nameEl = document.querySelector('.profile-name');
    const roleEl = document.querySelector('.profile-role');
    const avatarEl = document.querySelector('.profile-avatar');
    
    if (nameEl && !nameInDetailsEl) nameEl.textContent = user.name;
    if (roleEl && !roleInDetailsEl) roleEl.textContent = user.role;
    if (avatarEl && !avatarLgEl) avatarEl.textContent = user.avatar;
}

// Stats 数据（模拟不同时间范围的数据）
const StatsData = {
    today: { visits: 12, cards: 3, meetings: 2, calls: 1 },
    week: { visits: 87, cards: 15, meetings: 8, calls: 5 },
    overall: { visits: 1543, cards: 89, meetings: 2131, calls: 973 }
};

let currentStatsRange = 'today';

function renderUserStats() {
    updateStatsDisplay(currentStatsRange);
}

function switchStatsRange(range) {
    currentStatsRange = range;
    
    // 更新 Toggle 按钮状态
    document.querySelectorAll('.stats-toggle-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.range === range) {
            btn.classList.add('active');
        }
    });
    
    // 更新数据显示
    updateStatsDisplay(range);
}

function updateStatsDisplay(range) {
    const stats = StatsData[range];
    
    const visitsEl = document.getElementById('stat-visits');
    const cardsEl = document.getElementById('stat-cards');
    const meetingsEl = document.getElementById('stat-meetings');
    const callsEl = document.getElementById('stat-calls');
    
    if (visitsEl) visitsEl.textContent = stats.visits.toLocaleString();
    if (cardsEl) cardsEl.textContent = stats.cards.toLocaleString();
    if (meetingsEl) meetingsEl.textContent = stats.meetings.toLocaleString();
    if (callsEl) callsEl.textContent = stats.calls.toLocaleString();
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
        
        // Close any open swipe actions when clicking elsewhere
        closeAllSwipeActions(e.target);
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            closeAllModals();
            closeAllSwipeActions();
        }
    });
    
    // Setup swipe gesture handling
    setupSwipeHandlers();
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
    const pages = ['home-page', 'calendar-page', 'meeting-list-page', 'contacts-list-page', 'contact-page', 'me-page', 'meeting-detail-page'];
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

    // Tab order: [0]=Home, [1]=Calendar, [2]=Contacts, [3]=Notifications, [4]=Me
    // Show selected page
    switch(page) {
        case 'home':
            document.getElementById('home-page').style.display = 'block';
            document.querySelectorAll('.tab-item')[0].classList.add('active');
            renderRemindersHub();
            renderTodayMeetings();
            break;
        case 'calendar':
            document.getElementById('calendar-page').style.display = 'block';
            document.getElementById('calendar-page').classList.add('active');
            document.querySelectorAll('.tab-item')[1].classList.add('active');
            if (stickyBar) stickyBar.style.display = 'none';
            // Tab bar 保持显示
            renderCalendar();
            break;
        case 'meetingList':
            document.getElementById('meeting-list-page').style.display = 'block';
            document.getElementById('meeting-list-page').classList.add('active');
            if (stickyBar) stickyBar.style.display = 'none';
            if (tabBar) tabBar.style.display = 'none';
            renderMeetingList();
            break;
        case 'contacts':
            document.getElementById('contacts-list-page').style.display = 'block';
            document.getElementById('contacts-list-page').classList.add('active');
            document.querySelectorAll('.tab-item')[2].classList.add('active');
            renderContactList();
            break;
        case 'contact':
            document.getElementById('contact-page').style.display = 'block';
            document.getElementById('contact-page').classList.add('active');
            document.querySelectorAll('.tab-item')[2].classList.add('active');
            if (stickyBar) stickyBar.style.display = 'none';
            if (tabBar) tabBar.style.display = 'none';
            renderContactDetail();
            break;
        case 'me':
            document.getElementById('me-page').style.display = 'block';
            document.getElementById('me-page').classList.add('active');
            document.querySelectorAll('.tab-item')[4].classList.add('active');
            if (stickyBar) stickyBar.style.display = 'none';
            break;
    }
}

// ========================================
// Reminders Hub (Home Page) - 轻量化设计
// ========================================

function renderRemindersHub() {
    const allReminders = AppData.getPendingActions();
    
    // 计算今天和未来7天的日期范围
    const today = DateHelper.today;
    const next7Days = [];
    for (let i = 1; i <= 7; i++) {
        const d = new Date(today);
        d.setDate(d.getDate() + i);
        next7Days.push(formatDateStr(d));
    }
    
    // 分类：今天的 vs 未来7天的
    const todayReminders = allReminders.filter(r => r.dueDate === today);
    const upcomingReminders = allReminders.filter(r => r.dueDate && next7Days.includes(r.dueDate));
    
    // 更新总数（今天的数量）
    const countEl = document.getElementById('reminder-count');
    if (countEl) {
        countEl.textContent = todayReminders.length;
    }
    
    // 渲染列表
    const listEl = document.getElementById('reminder-items');
    if (!listEl) return;
    
    let html = '';
    
    // 今天的 Reminders
    if (todayReminders.length > 0) {
        html += `
            <div class="reminders-group">
                <div class="reminders-group-header">
                    <span class="reminders-group-title today">📅 Today</span>
                    <span class="reminders-group-count">${todayReminders.length}</span>
                </div>
                ${todayReminders.slice(0, 3).map(r => renderReminderCard(r, 'home')).join('')}
                ${todayReminders.length > 3 ? `<div class="reminders-more" onclick="showPage('calendar')">+${todayReminders.length - 3} more</div>` : ''}
            </div>
        `;
    } else {
        html += `
            <div class="reminders-group">
                <div class="reminders-group-header">
                    <span class="reminders-group-title today">📅 Today</span>
                </div>
                <div class="reminders-empty-inline">✨ No reminders for today</div>
            </div>
        `;
    }
    
    // 未来7天的 Reminders
    if (upcomingReminders.length > 0) {
        // 按日期排序
        upcomingReminders.sort((a, b) => (a.dueDate || '').localeCompare(b.dueDate || ''));
        
        html += `
            <div class="reminders-group upcoming">
                <div class="reminders-group-header">
                    <span class="reminders-group-title">📆 Next 7 Days</span>
                    <span class="reminders-group-count">${upcomingReminders.length}</span>
                </div>
                ${upcomingReminders.slice(0, 3).map(r => renderReminderCard(r, 'home')).join('')}
                ${upcomingReminders.length > 3 ? `<div class="reminders-more" onclick="showPage('calendar')">+${upcomingReminders.length - 3} more</div>` : ''}
            </div>
        `;
    }
    
    // 如果都没有
    if (todayReminders.length === 0 && upcomingReminders.length === 0) {
        html = `
            <div class="reminders-empty">
                ✨ No upcoming reminders
            </div>
        `;
    }
    
    listEl.innerHTML = html;
}

// ========================================
// 通用 Reminder 卡片渲染 - 统一规范设计
// ========================================
function renderReminderCard(reminder, context = 'calendar', groupDateKey = null) {
    const contacts = reminder.contactIds.map(id => AppData.getContact(id)).filter(c => c);
    const meeting = reminder.meetingId ? AppData.getMeeting(reminder.meetingId) : null;
    const isCompleted = reminder.status === 'completed';
    
    // 联系人显示和点击处理
    let contactName = 'Self';
    let contactExtra = '';
    let contactClickHandler = '';
    const contactIdsStr = contacts.map(c => `'${c.id}'`).join(',');
    if (contacts.length === 1) {
        contactName = contacts[0].name;
        contactClickHandler = `event.stopPropagation(); showContactPopover([${contactIdsStr}], 'reminder', '${reminder.id}')`;
    } else if (contacts.length > 1) {
        contactName = contacts[0].name;
        contactExtra = `+${contacts.length - 1}`;
        contactClickHandler = `event.stopPropagation(); showContactPopover([${contactIdsStr}], 'reminder', '${reminder.id}')`;
    }
    
    // 来源显示
    const sourceTitle = meeting ? meeting.title : 'Manual';
    const sourceClickHandler = meeting ? `event.stopPropagation(); showMeetingDetail('${meeting.id}')` : '';
    
    // 日期处理
    const isToday = reminder.dueDate && DateHelper.isToday(reminder.dueDate);
    
    // 基于星期的颜色 (与日历分组一致)
    const weekdayGradients = {
        0: 'linear-gradient(135deg, #EC4899 0%, #F43F5E 100%)', // Sun - 粉
        1: 'linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%)', // Mon - 紫
        2: 'linear-gradient(135deg, #F59E0B 0%, #EAB308 100%)', // Tue - 橙
        3: 'linear-gradient(135deg, #22C55E 0%, #10B981 100%)', // Wed - 绿
        4: 'linear-gradient(135deg, #0EA5E9 0%, #06B6D4 100%)', // Thu - 蓝
        5: 'linear-gradient(135deg, #A855F7 0%, #8B5CF6 100%)', // Fri - 浅紫
        6: 'linear-gradient(135deg, #EF4444 0%, #F97316 100%)', // Sat - 红
    };
    const noDateGradient = 'linear-gradient(135deg, #94A3B8 0%, #64748B 100%)';
    
    // 计算日期列颜色
    let dateColGradient = noDateGradient;
    if (reminder.dueDate) {
        const dayOfWeek = new Date(reminder.dueDate).getDay();
        dateColGradient = weekdayGradients[dayOfWeek];
    }
    
    // 统一的卡片内容（三行布局）- 更紧凑
    const cardContent = `
        <div class="rc-title ${isCompleted ? 'completed' : ''}">${reminder.title}</div>
        <div class="rc-row">
            <span class="rc-icon">👤</span>
            <span class="rc-text clickable" onclick="${contactClickHandler}">${contactName}</span>
            ${contactExtra ? `<span class="rc-badge" onclick="${contactClickHandler}">${contactExtra}</span>` : ''}
        </div>
        <div class="rc-row">
            <span class="rc-icon">📝</span>
            <span class="rc-text ${sourceClickHandler ? 'clickable' : ''}" onclick="${sourceClickHandler}">${sourceTitle}</span>
        </div>
    `;
    
    // 首页卡片 - 更紧凑设计
    // 日期列可点击修改日期，其他区域点击跳转 Calendar
    if (context === 'home') {
        return `
            <div class="reminder-card home-card ${isCompleted ? 'completed' : ''}" onclick="showPage('calendar')">
                <div class="rc-date-col-mini clickable" style="background: ${dateColGradient}" 
                     onclick="event.stopPropagation(); editDueDate('${reminder.id}')" title="Change date">
                    ${reminder.dueDate ? `
                        <span class="rc-date-month">${getMonthShort(reminder.dueDate)}</span>
                        <span class="rc-date-day">${new Date(reminder.dueDate).getDate()}</span>
                    ` : `
                        <span class="rc-date-day">--</span>
                    `}
                </div>
                <div class="rc-main">
                    <div class="rc-checkbox ${isCompleted ? 'checked' : ''}" 
                         onclick="event.stopPropagation(); toggleReminderComplete('${reminder.id}', this)"></div>
                    <div class="rc-content">${cardContent}</div>
                    <span class="rc-arrow">›</span>
                </div>
            </div>
        `;
    }
    
    // 日历页面卡片（含左滑操作）
    // 日期列可点击修改日期
    return `
        <div class="reminder-card-wrapper" id="rcw-${reminder.id}">
            <div class="reminder-card ${isCompleted ? 'completed' : ''}" id="rc-${reminder.id}">
                <div class="rc-date-col clickable" style="background: ${dateColGradient}" 
                     onclick="event.stopPropagation(); editDueDate('${reminder.id}')" title="Change date">
                    ${reminder.dueDate ? `
                        <span class="rc-date-month">${getMonthShort(reminder.dueDate)}</span>
                        <span class="rc-date-day">${new Date(reminder.dueDate).getDate()}</span>
                        <span class="rc-date-weekday">${getWeekdayShort(reminder.dueDate)}</span>
                    ` : `
                        <span class="rc-date-day">--</span>
                    `}
                </div>
                <div class="rc-main">
                    <div class="rc-checkbox ${isCompleted ? 'checked' : ''}" 
                         onclick="event.stopPropagation(); toggleReminderComplete('${reminder.id}', this)"></div>
                    <div class="rc-content">${cardContent}</div>
                </div>
            </div>
            <div class="rc-swipe-actions">
                <button class="rc-swipe-btn snooze" onclick="snoozeReminder('${reminder.id}')">⏰ Snooze</button>
                <button class="rc-swipe-btn delete" onclick="deleteReminder('${reminder.id}')">🗑 Delete</button>
            </div>
        </div>
    `;
}

// 辅助函数
function getMonthShort(dateStr) {
    const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
    return months[new Date(dateStr).getMonth()];
}

function getWeekdayShort(dateStr) {
    const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return weekdays[new Date(dateStr).getDay()];
}

// 左滑手势处理（支持触摸和鼠标）
let currentSwipedId = null;
let touchStartX = 0;
let touchStartY = 0;
let currentSwipeWrapper = null;
let isMouseDragging = false;

function setupSwipeHandlers() {
    // 触摸事件
    document.addEventListener('touchstart', handleSwipeStart, { passive: true });
    document.addEventListener('touchmove', handleSwipeMove, { passive: false });
    document.addEventListener('touchend', handleSwipeEnd, { passive: true });
    
    // 鼠标事件（用于桌面测试）
    document.addEventListener('mousedown', handleMouseSwipeStart);
    document.addEventListener('mousemove', handleMouseSwipeMove);
    document.addEventListener('mouseup', handleMouseSwipeEnd);
}

function handleSwipeStart(e) {
    const wrapper = e.target.closest('.reminder-card-wrapper');
    if (!wrapper) return;
    
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
    currentSwipeWrapper = wrapper;
    
    // 关闭其他已打开的
    if (currentSwipedId && currentSwipedId !== wrapper.id) {
        const prevWrapper = document.getElementById(currentSwipedId);
        if (prevWrapper) prevWrapper.classList.remove('swiped');
    }
}

function handleMouseSwipeStart(e) {
    const wrapper = e.target.closest('.reminder-card-wrapper');
    if (!wrapper) return;
    
    // 排除点击按钮
    if (e.target.closest('.rc-swipe-btn') || e.target.closest('.rc-checkbox')) return;
    
    isMouseDragging = true;
    touchStartX = e.clientX;
    touchStartY = e.clientY;
    currentSwipeWrapper = wrapper;
    
    // 关闭其他已打开的
    if (currentSwipedId && currentSwipedId !== wrapper.id) {
        const prevWrapper = document.getElementById(currentSwipedId);
        if (prevWrapper) prevWrapper.classList.remove('swiped');
        currentSwipedId = null;
    }
}

function handleSwipeMove(e) {
    if (!currentSwipeWrapper) return;
    
    const touchX = e.touches[0].clientX;
    const touchY = e.touches[0].clientY;
    processSwipeMove(touchX, touchY, e);
}

function handleMouseSwipeMove(e) {
    if (!isMouseDragging || !currentSwipeWrapper) return;
    processSwipeMove(e.clientX, e.clientY, e);
}

function processSwipeMove(currentX, currentY, e) {
    const diffX = touchStartX - currentX;
    const diffY = Math.abs(touchStartY - currentY);
    
    // 如果垂直滑动更多，忽略
    if (diffY > Math.abs(diffX)) return;
    
    // 阻止默认行为
    if (Math.abs(diffX) > 10 && e.preventDefault) {
        e.preventDefault();
    }
    
    const card = currentSwipeWrapper.querySelector('.reminder-card');
    if (!card) return;
    
    // 左滑展示按钮
    if (diffX > 0) {
        const translateX = Math.min(diffX, 140);
        card.style.transform = `translateX(-${translateX}px)`;
    } else {
        card.style.transform = 'translateX(0)';
    }
}

function handleSwipeEnd(e) {
    processSwipeEnd();
}

function handleMouseSwipeEnd(e) {
    if (!isMouseDragging) return;
    isMouseDragging = false;
    processSwipeEnd();
}

function processSwipeEnd() {
    if (!currentSwipeWrapper) return;
    
    const card = currentSwipeWrapper.querySelector('.reminder-card');
    if (!card) return;
    
    const transform = card.style.transform;
    const match = transform.match(/translateX\(-?(\d+)px\)/);
    const translateX = match ? parseInt(match[1]) : 0;
    
    if (translateX > 70) {
        currentSwipeWrapper.classList.add('swiped');
        currentSwipedId = currentSwipeWrapper.id;
    } else {
        currentSwipeWrapper.classList.remove('swiped');
        currentSwipedId = null;
    }
    
    card.style.transform = '';
    currentSwipeWrapper = null;
}

// 触摸事件的别名（兼容旧代码）
function handleTouchStart(e) { handleSwipeStart(e); }
function handleTouchMove(e) { handleSwipeMove(e); }
function handleTouchEnd(e) { handleSwipeEnd(e); }

// 点击其他地方关闭swipe
function closeAllSwipes(e) {
    if (e && e.target) {
        if (!e.target.closest('.reminder-card-wrapper') && !e.target.closest('.rc-swipe-btn') && currentSwipedId) {
            closeAllSwipeActions();
        }
    }
}

// 关闭所有 swipe 操作
function closeAllSwipeActions(exceptTarget) {
    // 关闭 reminder card swipe
    if (currentSwipedId) {
        const wrapper = document.getElementById(currentSwipedId);
        if (wrapper && (!exceptTarget || !wrapper.contains(exceptTarget))) {
            wrapper.classList.remove('swiped');
        }
        currentSwipedId = null;
    }
    // 关闭旧版 action swipe (兼容)
    document.querySelectorAll('.action-swipe-content.swiped, .action-hub-swipe-content.swiped').forEach(card => {
        if (!exceptTarget || !card.contains(exceptTarget)) {
            card.classList.remove('swiped');
        }
    });
}

// 初始化swipe（在DOM加载后）
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        setupSwipeHandlers();
        document.addEventListener('click', closeAllSwipes);
    });
} else {
    setupSwipeHandlers();
    document.addEventListener('click', closeAllSwipes);
}

function snoozeReminder(reminderId) {
    const choice = prompt('Snooze until:\\n1. Tomorrow\\n2. +3 Days\\n3. +1 Week\\nEnter 1-3:');
    
    if (!choice) return;
    
    const today = new Date(DateHelper.today);
    let newDate;
    
    switch(choice) {
        case '1':
            newDate = new Date(today);
            newDate.setDate(newDate.getDate() + 1);
            break;
        case '2':
            newDate = new Date(today);
            newDate.setDate(newDate.getDate() + 3);
            break;
        case '3':
            newDate = new Date(today);
            newDate.setDate(newDate.getDate() + 7);
            break;
        default:
            return;
    }
    
    const reminder = AppData.actions.find(a => a.id === reminderId);
    if (reminder) {
        reminder.dueDate = formatDateStr(newDate);
        showToast(`Snoozed to ${DateHelper.formatDate(reminder.dueDate)}`);
        renderRemindersHub();
        renderCalendarReminders();
    }
}

function formatReminderDate(dateStr) {
    if (!dateStr) return { day: '--', month: '' };
    const date = new Date(dateStr);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return {
        day: date.getDate(),
        month: months[date.getMonth()]
    };
}

function toggleReminderComplete(reminderId, checkbox) {
    const reminder = AppData.getAction(reminderId);
    if (!reminder) return;
    
    if (reminder.status === 'completed') {
        reminder.status = 'pending';
        reminder.completedAt = null;
        checkbox.classList.remove('checked');
    } else {
        reminder.status = 'completed';
        reminder.completedAt = new Date().toISOString();
        checkbox.classList.add('checked');
    }
    
    showToast(reminder.status === 'completed' ? 'Marked as done ✓' : 'Unmarked');
    
    // 刷新视图
    setTimeout(() => {
        renderRemindersHub();
        if (AppState.currentPage === 'calendar') {
            renderCalendarReminders();
        }
    }, 300);
}

// ========================================
// Calendar Page (Lark-style Design)
// ========================================

const CalendarState = {
    selectedDate: '2026-01-22', // 当前选中的日期（会在 initCalendarWeek 中同步为 DateHelper.today）
    viewMode: 'day', // 'day' or 'month'
    weekStartDate: null, // 当前周的起始日期（周日）
    pickerOpen: false,
    monthExpandedDate: null // 月视图中展开的日期
};

// 初始化周起始日期
function initCalendarWeek() {
    // 同步为当前日期
    if (DateHelper && DateHelper.today) {
        CalendarState.selectedDate = DateHelper.today;
    }
    
    const today = new Date(CalendarState.selectedDate);
    const dayOfWeek = today.getDay();
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - dayOfWeek);
    CalendarState.weekStartDate = weekStart;
}

// 主渲染函数
function renderCalendar() {
    initCalendarWeek();
    updateCalendarHeader();
    
    if (CalendarState.viewMode === 'day') {
        renderDayView();
    } else {
        renderMonthView();
    }
    
    // 设置触摸滑动事件
    setupCalendarSwipe();
}

// 设置周日期条的滑动手势（支持触摸和鼠标拖拽）
function setupCalendarSwipe() {
    const weekStrip = document.getElementById('cal-week-strip');
    const monthView = document.getElementById('cal-month-view');
    
    const minSwipeDistance = 50;
    
    function handleSwipe(element, onLeft, onRight) {
        if (!element) return;
        
        let startX = 0;
        let isDragging = false;
        
        // 触摸事件
        element.addEventListener('touchstart', (e) => {
            startX = e.changedTouches[0].screenX;
        }, { passive: true });
        
        element.addEventListener('touchend', (e) => {
            const endX = e.changedTouches[0].screenX;
            const diff = startX - endX;
            
            if (Math.abs(diff) > minSwipeDistance) {
                if (diff > 0) {
                    onLeft(); // 向左滑 -> 下一周/月
                } else {
                    onRight(); // 向右滑 -> 上一周/月
                }
            }
        }, { passive: true });
        
        // 鼠标拖拽事件
        element.addEventListener('mousedown', (e) => {
            startX = e.screenX;
            isDragging = true;
            element.style.cursor = 'grabbing';
        });
        
        element.addEventListener('mousemove', (e) => {
            if (isDragging) {
                e.preventDefault();
            }
        });
        
        element.addEventListener('mouseup', (e) => {
            if (isDragging) {
                const endX = e.screenX;
                const diff = startX - endX;
                
                if (Math.abs(diff) > minSwipeDistance) {
                    if (diff > 0) {
                        onLeft();
                    } else {
                        onRight();
                    }
                }
                
                isDragging = false;
                element.style.cursor = '';
            }
        });
        
        element.addEventListener('mouseleave', () => {
            isDragging = false;
            element.style.cursor = '';
        });
    }
    
    // 日视图：滑动切换周
    handleSwipe(weekStrip, () => shiftWeek(1), () => shiftWeek(-1));
    
    // 月视图：滑动切换月
    handleSwipe(monthView, () => shiftMonth(1), () => shiftMonth(-1));
}

// 更新头部日期显示
function updateCalendarHeader() {
    const headerDate = document.getElementById('cal-header-date');
    if (!headerDate) return;
    
    const date = new Date(CalendarState.selectedDate);
    const month = date.getMonth() + 1;
    headerDate.textContent = `${month}月`;
}

// 切换视图
function switchCalendarView(view) {
    CalendarState.viewMode = view;
    CalendarState.monthExpandedDate = null;
    
    // 更新按钮状态
    document.querySelectorAll('.cal-view-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.view === view);
    });
    
    // 显示/隐藏对应容器
    const dayView = document.getElementById('cal-day-view');
    const monthView = document.getElementById('cal-month-view');
    
    if (view === 'day') {
        if (dayView) dayView.style.display = 'block';
        if (monthView) monthView.style.display = 'none';
        renderDayView();
    } else {
        if (dayView) dayView.style.display = 'none';
        if (monthView) monthView.style.display = 'block';
        renderMonthView();
    }
    
    updateCalendarHeader();
}

// ========== 日视图 ==========
function renderDayView() {
    renderWeekStrip();
    renderDayReminders();
}

// 渲染周日期条
function renderWeekStrip() {
    const container = document.getElementById('cal-week-dates');
    if (!container) return;
    
    // 统计每天的 pending reminder 数量
    const reminderCounts = {};
    AppData.actions.filter(a => a.dueDate && a.status !== 'completed').forEach(a => {
        reminderCounts[a.dueDate] = (reminderCounts[a.dueDate] || 0) + 1;
    });
    
    const todayStr = DateHelper.today;
    let html = '';
    
    // 显示7天
    for (let i = 0; i < 7; i++) {
        const date = new Date(CalendarState.weekStartDate);
        date.setDate(date.getDate() + i);
        
        const dateStr = formatDateStr(date);
        const isToday = dateStr === todayStr;
        const isSelected = dateStr === CalendarState.selectedDate;
        const hasReminders = reminderCounts[dateStr] > 0;
        
        // 判断是否是其他月份
        const selectedMonth = new Date(CalendarState.selectedDate).getMonth();
        const dateMonth = date.getMonth();
        const isOtherMonth = dateMonth !== selectedMonth;
        
        let classes = 'cal-week-date';
        if (isToday) classes += ' today';
        if (isSelected) classes += ' selected';
        if (isOtherMonth) classes += ' other-month';
        
        html += `
            <div class="${classes}" onclick="selectCalendarDate('${dateStr}')">
                <span class="date-num">${date.getDate()}</span>
                ${hasReminders ? '<span class="date-dot"></span>' : ''}
            </div>
        `;
    }
    
    container.innerHTML = html;
}

// 渲染选中日期的 Reminders
function renderDayReminders() {
    const titleEl = document.getElementById('cal-day-title');
    const countEl = document.getElementById('cal-day-count');
    const container = document.getElementById('cal-reminders-list');
    
    if (!container) return;
    
    const reminders = AppData.actions.filter(a => a.dueDate === CalendarState.selectedDate);
    const pending = reminders.filter(r => r.status !== 'completed');
    const completed = reminders.filter(r => r.status === 'completed');
    
    // 更新标题
    const date = new Date(CalendarState.selectedDate);
    const weekdaysCN = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    const dateTitle = `${weekdaysCN[date.getDay()]}, ${date.getMonth() + 1}月${date.getDate()}日`;
    
    if (titleEl) titleEl.textContent = dateTitle;
    if (countEl) countEl.textContent = `${pending.length} pending`;
    
    let html = '';
    
    if (pending.length === 0 && completed.length === 0) {
        html = `<div class="cal-no-reminders"><span>📭</span><span>No reminders</span></div>`;
    } else {
        if (pending.length > 0) {
            html += pending.map(r => renderReminderCard(r, 'calendar')).join('');
        }
        if (completed.length > 0) {
            html += renderDoneSection(completed, 'day');
        }
    }
    
    container.innerHTML = html;
}

// 选择日期
function selectCalendarDate(dateStr) {
    CalendarState.selectedDate = dateStr;
    
    // 更新周起始日期，确保选中日期在当前周内
    const selectedDate = new Date(dateStr);
    const dayOfWeek = selectedDate.getDay();
    const weekStart = new Date(selectedDate);
    weekStart.setDate(selectedDate.getDate() - dayOfWeek);
    CalendarState.weekStartDate = weekStart;
    
    updateCalendarHeader();
    renderWeekStrip();
    renderDayReminders();
}

// 切换周
function shiftWeek(delta) {
    CalendarState.weekStartDate.setDate(CalendarState.weekStartDate.getDate() + delta * 7);
    
    // 选中新周的同一天
    const selectedDate = new Date(CalendarState.selectedDate);
    selectedDate.setDate(selectedDate.getDate() + delta * 7);
    CalendarState.selectedDate = formatDateStr(selectedDate);
    
    updateCalendarHeader();
    renderWeekStrip();
    renderDayReminders();
}

// ========== 月视图 ==========
function renderMonthView() {
    const container = document.getElementById('cal-month-view');
    if (!container) return;
    
    const date = new Date(CalendarState.selectedDate);
    const year = date.getFullYear();
    const month = date.getMonth();
    
    // 统计每天的 pending reminder 数量和标题
    const remindersByDate = {};
    AppData.actions.filter(a => a.dueDate && a.status !== 'completed').forEach(a => {
        if (!remindersByDate[a.dueDate]) {
            remindersByDate[a.dueDate] = [];
        }
        remindersByDate[a.dueDate].push(a.title);
    });
    
    // 构建月历 - 固定5行
    const firstDay = new Date(year, month, 1);
    const firstDayOfWeek = firstDay.getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const todayStr = DateHelper.today;
    
    // 构建35个格子（5行 x 7列）
    const allDays = [];
    const prevMonthLastDay = new Date(year, month, 0).getDate();
    
    // 上月填充
    for (let i = firstDayOfWeek - 1; i >= 0; i--) {
        const d = prevMonthLastDay - i;
        const prevMonth = month === 0 ? 12 : month;
        const prevYear = month === 0 ? year - 1 : year;
        allDays.push({ 
            day: d, 
            otherMonth: true, 
            dateStr: `${prevYear}-${String(prevMonth).padStart(2, '0')}-${String(d).padStart(2, '0')}`
        });
    }
    
    // 当月
    for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        allDays.push({ day, otherMonth: false, dateStr });
    }
    
    // 下月填充至35个
    let nextDay = 1;
    while (allDays.length < 35) {
        const nextMonth = month === 11 ? 1 : month + 2;
        const nextYear = month === 11 ? year + 1 : year;
        allDays.push({ 
            day: nextDay, 
            otherMonth: true, 
            dateStr: `${nextYear}-${String(nextMonth).padStart(2, '0')}-${String(nextDay).padStart(2, '0')}`
        });
        nextDay++;
    }
    
    // 计算展开日期所在的行（0-4）
    let expandedRow = -1;
    if (CalendarState.monthExpandedDate) {
        const expandedDate = new Date(CalendarState.monthExpandedDate);
        if (expandedDate.getMonth() === month && expandedDate.getFullYear() === year) {
            const expandedDay = expandedDate.getDate();
            expandedRow = Math.floor((firstDayOfWeek + expandedDay - 1) / 7);
        }
    }
    
    let html = '';
    
    if (expandedRow >= 0) {
        // ===== 展开模式 =====
        html += `<div class="cal-month-expanded-view">`;
        
        // 顶部固定区域
        html += `<div class="cal-month-top-section">`;
        
        // 星期header
        html += `
            <div class="cal-month-weekdays">
                <span>日</span><span>一</span><span>二</span><span>三</span><span>四</span><span>五</span><span>六</span>
            </div>
        `;
        
        // 选中日期所在行
        html += `<div class="cal-month-row selected-row">`;
        for (let col = 0; col < 7; col++) {
            const idx = expandedRow * 7 + col;
            html += renderMonthCell(allDays[idx], remindersByDate, todayStr, true);
        }
        html += `</div>`;
        
        // 收起箭头
        html += `<div class="cal-month-collapse-btn" onclick="closeMonthExpanded()">
            <span class="collapse-arrow">▲</span>
        </div>`;
        
        html += `</div>`; // end top-section
        
        // 中间可滚动的内容区域
        const expandedReminders = AppData.actions.filter(a => a.dueDate === CalendarState.monthExpandedDate);
        const pending = expandedReminders.filter(r => r.status !== 'completed');
        const completed = expandedReminders.filter(r => r.status === 'completed');
        
        html += `<div class="cal-month-content-section">`;
        html += `<div class="cal-month-events-scroll">`;
        
        if (pending.length > 0) {
            html += pending.map(r => renderReminderCard(r, 'calendar')).join('');
        } else {
            html += `<div class="cal-no-events">No reminders</div>`;
        }
        
        if (completed.length > 0) {
            html += renderDoneSection(completed, 'month');
        }
        
        html += `</div></div>`; // end scroll & content-section
        
        // 底部固定的下一行日期
        html += `<div class="cal-month-bottom-section">`;
        if (expandedRow < 4) {
            html += `<div class="cal-month-row next-row">`;
            for (let col = 0; col < 7; col++) {
                const idx = (expandedRow + 1) * 7 + col;
                if (idx < allDays.length) {
                    html += renderMonthCell(allDays[idx], remindersByDate, todayStr, true);
                }
            }
            html += `</div>`;
        }
        html += `</div>`; // end bottom-section
        
        html += `</div>`; // end expanded-view
    } else {
        // ===== 完整月历模式 =====
        html += `<div class="cal-month-full-view">`;
        
        // 月份导航
        const monthNames = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];
        html += `
            <div class="cal-month-nav">
                <button class="cal-month-nav-btn" onclick="shiftMonth(-1)">‹</button>
                <span class="cal-month-nav-title">${year}年${monthNames[month]}</span>
                <button class="cal-month-nav-btn" onclick="shiftMonth(1)">›</button>
            </div>
        `;
        
        // 星期header
        html += `
            <div class="cal-month-weekdays">
                <span>日</span><span>一</span><span>二</span><span>三</span><span>四</span><span>五</span><span>六</span>
            </div>
        `;
        
        // 5行日期
        for (let row = 0; row < 5; row++) {
            html += `<div class="cal-month-row">`;
            for (let col = 0; col < 7; col++) {
                const idx = row * 7 + col;
                html += renderMonthCell(allDays[idx], remindersByDate, todayStr, false);
            }
            html += `</div>`;
        }
        
        html += `</div>`;
    }
    
    container.innerHTML = html;
}

// 渲染单个日期格子
function renderMonthCell(dayData, remindersByDate, todayStr, isCompact) {
    if (!dayData) return '<div class="cal-month-cell"></div>';
    
    const { day, otherMonth, dateStr } = dayData;
    const isToday = dateStr === todayStr;
    const isSelected = dateStr === CalendarState.monthExpandedDate;
    const reminders = dateStr ? (remindersByDate[dateStr] || []) : [];
    
    let classes = 'cal-month-cell';
    if (otherMonth) classes += ' other-month';
    if (isToday) classes += ' today';
    if (isSelected) classes += ' selected';
    
    if (isCompact) {
        // 紧凑模式：只显示日期和小点
        return `
            <div class="${classes}" onclick="selectMonthDate('${dateStr}')">
                <span class="cell-day">${day}</span>
                ${reminders.length > 0 ? '<span class="cell-dot"></span>' : ''}
            </div>
        `;
    }
    
    // 完整模式：显示日期和事件预览
    let eventsHtml = '';
    if (reminders.length > 0) {
        eventsHtml = reminders.slice(0, 2).map(title => 
            `<div class="cell-event">${title.length > 6 ? title.substring(0, 6) + '..' : title}</div>`
        ).join('');
    }
    
    return `
        <div class="${classes}" onclick="selectMonthDate('${dateStr}')">
            <span class="cell-day">${day}</span>
            <div class="cell-events">${eventsHtml}</div>
        </div>
    `;
}

// 月视图：选择日期
function selectMonthDate(dateStr) {
    if (CalendarState.monthExpandedDate === dateStr) {
        CalendarState.monthExpandedDate = null;
    } else {
        CalendarState.monthExpandedDate = dateStr;
    }
    CalendarState.selectedDate = dateStr;
    renderMonthView();
    updateCalendarHeader();
}

// 月视图：关闭展开
function closeMonthExpanded() {
    CalendarState.monthExpandedDate = null;
    renderMonthView();
}

// 月视图：切换月份
function shiftMonth(delta) {
    const date = new Date(CalendarState.selectedDate);
    date.setMonth(date.getMonth() + delta);
    CalendarState.selectedDate = formatDateStr(date);
    CalendarState.monthExpandedDate = null;
    updateCalendarHeader();
    renderMonthView();
}

// ========== Date Picker ==========
function openCalendarPicker() {
    const overlay = document.getElementById('cal-picker-overlay');
    const dropdown = document.getElementById('cal-picker-dropdown');
    const trigger = document.querySelector('.cal-date-trigger');
    
    if (overlay) overlay.classList.add('show');
    if (dropdown) dropdown.classList.add('show');
    if (trigger) trigger.classList.add('open');
    
    CalendarState.pickerOpen = true;
    
    // 重置 picker 显示的月份为当前选中日期所在月
    pickerViewDate = new Date(CalendarState.selectedDate);
    
    // 根据当前视图模式渲染不同的 picker
    if (CalendarState.viewMode === 'day') {
        renderDayPicker();
    } else {
        renderMonthPicker();
    }
}

function closeCalendarPicker() {
    const overlay = document.getElementById('cal-picker-overlay');
    const dropdown = document.getElementById('cal-picker-dropdown');
    const trigger = document.querySelector('.cal-date-trigger');
    
    if (overlay) overlay.classList.remove('show');
    if (dropdown) dropdown.classList.remove('show');
    if (trigger) trigger.classList.remove('open');
    
    CalendarState.pickerOpen = false;
}

// 日视图的 Picker：月历选择
function renderDayPicker() {
    const dayPicker = document.getElementById('cal-picker-day');
    const monthPicker = document.getElementById('cal-picker-month-view');
    
    if (dayPicker) dayPicker.style.display = 'block';
    if (monthPicker) monthPicker.style.display = 'none';
    
    // 使用 pickerViewDate 来显示月份（允许独立切换月份）
    if (!pickerViewDate) {
        pickerViewDate = new Date(CalendarState.selectedDate);
    }
    
    const year = pickerViewDate.getFullYear();
    const month = pickerViewDate.getMonth();
    
    // 更新月份标签
    const monthLabel = document.getElementById('cal-picker-month-label');
    if (monthLabel) {
        monthLabel.textContent = `${year}年${month + 1}月`;
    }
    
    // 渲染日期网格
    const grid = document.getElementById('cal-picker-days');
    if (!grid) return;
    
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const firstDayOfWeek = firstDay.getDay();
    const daysInMonth = lastDay.getDate();
    const todayStr = DateHelper.today;
    
    let html = '';
    
    // 上月填充
    const prevMonthLastDay = new Date(year, month, 0).getDate();
    for (let i = firstDayOfWeek - 1; i >= 0; i--) {
        html += `<div class="cal-picker-date other">${prevMonthLastDay - i}</div>`;
    }
    
    // 当月日期
    for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const isToday = dateStr === todayStr;
        const isSelected = dateStr === CalendarState.selectedDate;
        
        let classes = 'cal-picker-date';
        if (isToday) classes += ' today';
        if (isSelected) classes += ' selected';
        
        html += `<div class="${classes}" onclick="pickDate('${dateStr}')">${day}</div>`;
    }
    
    // 下月填充
    const totalCells = Math.ceil((firstDayOfWeek + daysInMonth) / 7) * 7;
    const remainingCells = totalCells - (firstDayOfWeek + daysInMonth);
    for (let day = 1; day <= remainingCells; day++) {
        html += `<div class="cal-picker-date other">${day}</div>`;
    }
    
    grid.innerHTML = html;
}

// 月视图的 Picker：年月滚轮
function renderMonthPicker() {
    const dayPicker = document.getElementById('cal-picker-day');
    const monthPicker = document.getElementById('cal-picker-month-view');
    
    if (dayPicker) dayPicker.style.display = 'none';
    if (monthPicker) monthPicker.style.display = 'block';
    
    const date = new Date(CalendarState.selectedDate);
    const currentYear = date.getFullYear();
    const currentMonth = date.getMonth();
    
    // 渲染年份滚动
    const yearScroll = document.getElementById('cal-picker-year-scroll');
    if (yearScroll) {
        let yearHtml = '';
        for (let y = currentYear - 2; y <= currentYear + 2; y++) {
            const selected = y === currentYear ? 'selected' : '';
            yearHtml += `<div class="cal-picker-scroll-item ${selected}" onclick="pickYear(${y})">${y}年</div>`;
        }
        yearScroll.innerHTML = yearHtml;
    }
    
    // 渲染月份滚动
    const monthScroll = document.getElementById('cal-picker-month-scroll');
    if (monthScroll) {
        let monthHtml = '';
        for (let m = 0; m < 12; m++) {
            const selected = m === currentMonth ? 'selected' : '';
            monthHtml += `<div class="cal-picker-scroll-item ${selected}" onclick="pickMonth(${m})">${m + 1}月</div>`;
        }
        monthScroll.innerHTML = monthHtml;
    }
}

// Picker 选择日期
function pickDate(dateStr) {
    CalendarState.selectedDate = dateStr;
    
    // 更新周起始日期
    const selectedDate = new Date(dateStr);
    const dayOfWeek = selectedDate.getDay();
    const weekStart = new Date(selectedDate);
    weekStart.setDate(selectedDate.getDate() - dayOfWeek);
    CalendarState.weekStartDate = weekStart;
    
    closeCalendarPicker();
    renderDayView();
    updateCalendarHeader();
}

// Picker 切换月份（用于新的 Lark-style picker）
// 使用单独的 pickerViewDate 来跟踪 picker 中显示的月份
let pickerViewDate = null;

function changePickerMonth(delta) {
    if (!pickerViewDate) {
        pickerViewDate = new Date(CalendarState.selectedDate);
    }
    pickerViewDate.setMonth(pickerViewDate.getMonth() + delta);
    renderDayPicker();
}

// Picker 选择年份（月视图）
function pickYear(year) {
    const date = new Date(CalendarState.selectedDate);
    date.setFullYear(year);
    CalendarState.selectedDate = formatDateStr(date);
    closeCalendarPicker();
    renderMonthView();
    updateCalendarHeader();
}

// Picker 选择月份（月视图）
function pickMonth(month) {
    const date = new Date(CalendarState.selectedDate);
    date.setMonth(month);
    CalendarState.selectedDate = formatDateStr(date);
    closeCalendarPicker();
    renderMonthView();
    updateCalendarHeader();
}

// ========== 通用函数 ==========
// 渲染 Done 区域（默认折叠）
function renderDoneSection(completed, viewMode) {
    const isListView = viewMode === 'list';
    const sectionClass = isListView ? 'cal-done-section-list' : 'cal-done-section';
    const headerText = isListView ? '✅ Recently Done' : `✅ Done (${completed.length})`;
    
    return `
        <div class="${sectionClass} collapsed" id="done-section">
            <div class="cal-done-header" onclick="toggleDoneSection()">
                <span class="cal-done-title">${headerText}</span>
                <span class="cal-done-toggle">▼</span>
            </div>
            <div class="cal-done-content">
                ${completed.slice(0, 10).map(r => `
                    <div class="cal-done-item">
                        <span class="cal-done-check">✓</span>
                        <span class="cal-done-text">${r.title}</span>
                        ${isListView && r.dueDate ? `<span class="cal-done-date">${DateHelper.formatDate(r.dueDate)}</span>` : ''}
                    </div>
                `).join('')}
                ${completed.length > 10 ? `<div class="cal-done-more">+${completed.length - 10} more</div>` : ''}
            </div>
        </div>
    `;
}

// 切换 Done 区域折叠状态
function toggleDoneSection() {
    const section = document.getElementById('done-section');
    if (section) {
        section.classList.toggle('collapsed');
    }
}

// 获取明天的日期字符串
function getTomorrowStr() {
    const tomorrow = new Date(DateHelper.today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    return formatDateStr(tomorrow);
}

function formatDateStr(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function deleteReminder(reminderId) {
    if (!confirm('Delete this reminder?')) return;
    
    const index = AppData.actions.findIndex(a => a.id === reminderId);
    if (index !== -1) {
        AppData.actions.splice(index, 1);
        renderCalendarReminders();
        renderRemindersHub();
        showToast('Reminder deleted');
    }
}

// Date Picker Modal
function toggleCalendarPicker() {
    const overlay = document.getElementById('cal-picker-overlay');
    const modal = document.getElementById('cal-picker-modal');
    
    if (modal.classList.contains('show')) {
        overlay.classList.remove('show');
        modal.classList.remove('show');
    } else {
        overlay.classList.add('show');
        modal.classList.add('show');
        // 默认使用当前的viewMode
        CalendarState.pickerMode = CalendarState.viewMode;
        updatePickerTabs();
        renderPickerGrid();
    }
}

function switchPickerTab(mode, element) {
    CalendarState.pickerMode = mode;
    updatePickerTabs();
    renderPickerGrid();
}

function updatePickerTabs() {
    document.querySelectorAll('.cal-picker-tab').forEach(tab => {
        tab.classList.toggle('active', tab.dataset.type === CalendarState.pickerMode);
    });
}

// 旧版 changePickerMonth 已删除，使用新的 Lark-style picker 逻辑

function renderPickerGrid() {
    if (CalendarState.pickerMode === 'day') {
        renderPickerDayGrid();
    } else if (CalendarState.pickerMode === 'week') {
        renderPickerWeekGrid();
    } else {
        renderPickerMonthGrid();
    }
}

// Day模式：按月选日
function renderPickerDayGrid() {
    const monthLabel = document.getElementById('cal-picker-month');
    const grid = document.getElementById('cal-picker-grid');
    
    const year = CalendarState.pickerMonth.getFullYear();
    const month = CalendarState.pickerMonth.getMonth();
    
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                        'July', 'August', 'September', 'October', 'November', 'December'];
    
    if (monthLabel) {
        monthLabel.textContent = `${monthNames[month]} ${year}`;
    }
    
    if (!grid) return;
    
    grid.className = 'cal-picker-grid';
    
    // 统计每天的reminder数量
    const reminderCounts = {};
    AppData.actions.filter(a => a.dueDate).forEach(a => {
        reminderCounts[a.dueDate] = (reminderCounts[a.dueDate] || 0) + 1;
    });
    
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDayOfWeek = firstDay.getDay();
    
    // Weekday headers
    let html = ['S', 'M', 'T', 'W', 'T', 'F', 'S'].map(d => 
        `<div class="cal-picker-day" style="font-weight: 600; color: var(--text-secondary); cursor: default;">${d}</div>`
    ).join('');
    
    // Previous month
    const prevMonthLastDay = new Date(year, month, 0).getDate();
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
        html += `<div class="cal-picker-day other">${prevMonthLastDay - i}</div>`;
    }
    
    // Current month
    const todayStr = DateHelper.today;
    
    for (let day = 1; day <= lastDay.getDate(); day++) {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const isToday = dateStr === todayStr;
        const isSelected = dateStr === CalendarState.selectedDate;
        const count = reminderCounts[dateStr] || 0;
        
        let classes = 'cal-picker-day';
        if (isToday) classes += ' today';
        if (isSelected) classes += ' selected';
        
        html += `<div class="${classes}" onclick="selectPickerDate('${dateStr}')">${day}${count > 0 ? `<span class="cal-picker-day-badge">${count}</span>` : ''}</div>`;
    }
    
    grid.innerHTML = html;
}

// Week模式：按月选周
function renderPickerWeekGrid() {
    const monthLabel = document.getElementById('cal-picker-month');
    const grid = document.getElementById('cal-picker-grid');
    
    const year = CalendarState.pickerMonth.getFullYear();
    const month = CalendarState.pickerMonth.getMonth();
    
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                        'July', 'August', 'September', 'October', 'November', 'December'];
    const shortMonths = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    
    if (monthLabel) {
        monthLabel.textContent = `${monthNames[month]} ${year}`;
    }
    
    if (!grid) return;
    
    grid.className = 'cal-picker-grid week-grid';
    
    // 获取当月的所有周
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    
    let html = '';
    let weekNum = 1;
    let currentWeekStart = new Date(firstDay);
    currentWeekStart.setDate(currentWeekStart.getDate() - currentWeekStart.getDay());
    
    while (currentWeekStart <= lastDay && weekNum <= 6) {
        const weekEnd = new Date(currentWeekStart);
        weekEnd.setDate(weekEnd.getDate() + 6);
        
        const weekStartStr = formatDateStr(currentWeekStart);
        const weekEndStr = formatDateStr(weekEnd);
        const isSelected = CalendarState.selectedWeek === weekStartStr;
        
        // 统计这周的reminder数量
        const count = AppData.actions.filter(a => {
            if (!a.dueDate) return false;
            return a.dueDate >= weekStartStr && a.dueDate <= weekEndStr;
        }).length;
        
        let classes = 'cal-picker-item';
        if (isSelected) classes += ' selected';
        
        // 格式化日期范围
        const startMonth = currentWeekStart.getMonth();
        const endMonth = weekEnd.getMonth();
        let rangeLabel = '';
        if (startMonth === endMonth) {
            rangeLabel = `${currentWeekStart.getDate()} - ${weekEnd.getDate()}`;
        } else {
            rangeLabel = `${shortMonths[startMonth]} ${currentWeekStart.getDate()} - ${shortMonths[endMonth]} ${weekEnd.getDate()}`;
        }
        
        html += `
            <div class="${classes}" onclick="selectPickerWeek('${weekStartStr}')">
                <div class="cal-picker-item-title">Week ${weekNum}</div>
                <div class="cal-picker-item-range">${rangeLabel}</div>
                ${count > 0 ? `<div class="cal-picker-item-badge">${count}</div>` : ''}
            </div>
        `;
        
        currentWeekStart.setDate(currentWeekStart.getDate() + 7);
        weekNum++;
    }
    
    grid.innerHTML = html;
}

// Month模式：按年选月
function renderPickerMonthGrid() {
    const monthLabel = document.getElementById('cal-picker-month');
    const grid = document.getElementById('cal-picker-grid');
    
    const year = CalendarState.pickerMonth.getFullYear();
    
    if (monthLabel) {
        monthLabel.textContent = `${year}`;
    }
    
    if (!grid) return;
    
    grid.className = 'cal-picker-grid month-grid';
    
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const todayMonth = new Date(DateHelper.today).getMonth();
    const todayYear = new Date(DateHelper.today).getFullYear();
    
    let html = '';
    
    for (let i = 0; i < 12; i++) {
        const monthStr = `${year}-${String(i + 1).padStart(2, '0')}`;
        const isSelected = CalendarState.selectedMonth === monthStr;
        const isCurrentMonth = (i === todayMonth && year === todayYear);
        
        // 统计这月的reminder数量
        const count = AppData.actions.filter(a => {
            if (!a.dueDate) return false;
            return a.dueDate.startsWith(monthStr);
        }).length;
        
        let classes = 'cal-picker-item';
        if (isSelected) classes += ' selected';
        if (isCurrentMonth) classes += ' today';
        
        html += `
            <div class="${classes}" onclick="selectPickerMonth('${monthStr}')">
                <div class="cal-picker-item-title">${monthNames[i]}</div>
                ${count > 0 ? `<div class="cal-picker-item-badge">${count}</div>` : ''}
            </div>
        `;
    }
    
    grid.innerHTML = html;
}

function selectPickerDate(dateStr) {
    CalendarState.selectedDate = dateStr;
    CalendarState.viewMode = 'day'; // 切换外层Tab到Day
    
    // 更新日期范围以包含选中的日期
    const selectedDate = new Date(dateStr);
    const dayOfWeek = selectedDate.getDay();
    CalendarState.dateRangeStart = new Date(selectedDate);
    CalendarState.dateRangeStart.setDate(selectedDate.getDate() - dayOfWeek);
    
    toggleCalendarPicker();
    updateCalendarViewTabs();
    renderCalendar();
}

function selectPickerWeek(weekStartStr) {
    CalendarState.selectedWeek = weekStartStr;
    CalendarState.selectedDate = weekStartStr;
    CalendarState.viewMode = 'week'; // 切换外层Tab到Week
    
    const selectedDate = new Date(weekStartStr);
    CalendarState.dateRangeStart = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
    
    toggleCalendarPicker();
    updateCalendarViewTabs();
    renderCalendar();
}

function selectPickerMonth(monthStr) {
    CalendarState.selectedMonth = monthStr;
    CalendarState.selectedDate = monthStr + '-01';
    CalendarState.viewMode = 'month'; // 切换外层Tab到Month
    
    CalendarState.dateRangeStart = new Date(parseInt(monthStr.split('-')[0]), 0, 1);
    
    toggleCalendarPicker();
    updateCalendarViewTabs();
    renderCalendar();
}

function selectQuickDate(type) {
    if (type === 'today') {
        CalendarState.viewMode = 'day';
        selectPickerDate(DateHelper.today);
    } else if (type === 'tomorrow') {
        CalendarState.viewMode = 'day';
        const tomorrow = new Date(DateHelper.today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        selectPickerDate(formatDateStr(tomorrow));
    } else if (type === 'thisWeek') {
        CalendarState.viewMode = 'week';
        const today = new Date(DateHelper.today);
        const dayOfWeek = today.getDay();
        const weekStart = new Date(today);
        weekStart.setDate(today.getDate() - dayOfWeek);
        selectPickerWeek(formatDateStr(weekStart));
    }
}

// 更新外层Calendar视图的Tab
function updateCalendarViewTabs() {
    document.querySelectorAll('.cal-view-tab').forEach(tab => {
        tab.classList.toggle('active', tab.dataset.view === CalendarState.viewMode);
    });
}

function showAddReminderModal() {
    // 使用现有的添加Action模态框
    showAddActionModal();
}

// ========================================
// Reminder Accept/Dismiss Logic
// ========================================

function dismissAISuggestion(meetingId, actionTitle, button) {
    // 保存到localStorage以记住已dismiss的建议
    const dismissedKey = `dismissed_${meetingId}`;
    const dismissedList = JSON.parse(localStorage.getItem(dismissedKey) || '[]');
    if (!dismissedList.includes(actionTitle)) {
        dismissedList.push(actionTitle);
        localStorage.setItem(dismissedKey, JSON.stringify(dismissedList));
    }
    
    // 动画效果：淡出
    const suggestionItem = button ? button.closest('.md-suggestion-item') : null;
    if (suggestionItem) {
        suggestionItem.style.opacity = '0';
        suggestionItem.style.transform = 'translateX(-20px)';
        suggestionItem.style.transition = 'all 0.3s ease';
    }
    
    // 重新渲染 Meeting Detail
    setTimeout(() => {
        showMeetingDetail(meetingId);
    }, suggestionItem ? 300 : 0);
    
    showToast('Dismissed');
}

function acceptAISuggestion(meetingId, index, actionTitle, button) {
    const meeting = AppData.getMeeting(meetingId);
    if (!meeting) {
        console.error('Meeting not found:', meetingId);
        return;
    }
    
    // 检查是否已存在
    const existingAction = AppData.actions.find(a => 
        a.meetingId === meetingId && a.title === actionTitle
    );
    
    if (existingAction) {
        showToast('Already in My Calendar');
        return;
    }
    
    // AI suggested 的 reminder 默认日期为今天
    // TODO: 如果从会议中提取出时间字段则把 reminder 设在那天
    const defaultDate = DateHelper.today;
    
    // Accept - 添加到 My Calendar，默认日期为今天
    const newAction = {
        id: 'action_' + Date.now(),
        title: actionTitle,
        status: 'pending',
        contactIds: meeting.contactIds || [],
        meetingId: meetingId,
        dueDate: defaultDate, // 默认今天（如果AI提取出时间则用提取的时间）
        createdAt: new Date().toISOString(),
        source: 'ai_extracted',
        aiSuggested: true
    };
    AppData.actions.unshift(newAction);
    
    console.log('Added action:', newAction);
    console.log('Total actions now:', AppData.actions.length);
    
    // 动画效果：条目移动到 My Calendar
    const suggestionItem = button ? button.closest('.md-suggestion-item') : null;
    if (suggestionItem) {
        suggestionItem.classList.add('accepting');
    }
    
    // 无论动画是否存在，都重新渲染 Meeting Detail
    setTimeout(() => {
        showMeetingDetail(meetingId);
    }, suggestionItem ? 300 : 0);
    
    showToast('Added to My Calendar ✓');
    
    // 刷新其他视图
    renderRemindersHub();
    if (AppState.currentPage === 'calendar') {
        renderCalendar();
    }
}

function renderActionHubItem(action) {
    const contacts = action.contactIds.map(id => AppData.getContact(id)).filter(c => c);
    const meeting = action.meetingId ? AppData.getMeeting(action.meetingId) : null;
    const contactInfo = formatContactsDisplay(contacts, action.id);
    
    // Build contact display with click handler - pass only IDs, lookup in function
    let contactDisplay, contactClickHandler;
    if (contactInfo.hasContacts) {
        contactDisplay = contactInfo.extra > 0 
            ? `${contactInfo.display} <span class="contact-extra">+${contactInfo.extra}</span>` 
            : contactInfo.display;
    } else {
        contactDisplay = contactInfo.display;
    }
    contactClickHandler = `event.stopPropagation(); showContactPopoverForAction('${action.id}')`;
    
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
        <div class="action-hub-swipe-container" id="action-hub-swipe-${action.id}">
            <div class="action-hub-swipe-content">
                <div class="${itemClass}" id="action-hub-${action.id}">
                    <div class="action-checkbox" onclick="completeActionFromHub('${action.id}', event)"></div>
                    <div class="action-details">
                        <div class="action-title-row">
                            <span class="action-title" onclick="showMeetingDetail('${action.meetingId}')">${action.title}</span>
                            ${statusTag}
                        </div>
                        <div class="action-meta">
                            <span class="action-meta-item action-contact" onclick="${contactClickHandler}">👤 ${contactDisplay}</span>
                            <span class="action-meta-item">📝 ${meetingTitle}</span>
                        </div>
                    </div>
                </div>
            </div>
            <div class="action-hub-swipe-actions">
                ${action.dueDate ? `<button class="swipe-btn swipe-btn-snooze" onclick="snoozeAction('${action.id}')"><span>⏰</span>Snooze</button>` : ''}
                <button class="swipe-btn swipe-btn-delete" onclick="deleteAction('${action.id}')"><span>🗑️</span>Delete</button>
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
            renderRemindersHub();
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
        
        // Format contacts display with popover support - use wrapper function
        let contactDisplay;
        if (contacts.length === 0) {
            contactDisplay = '<span class="action-add-contact">+ Add contact</span>';
        } else if (contacts.length === 1) {
            contactDisplay = contacts[0].name;
        } else {
            contactDisplay = `${contacts[0].name} <span class="contact-extra">+${contacts.length - 1}</span>`;
        }
        const contactClickHandler = `event.stopPropagation(); showContactPopoverForMeeting('${meeting.id}')`;

        let actionStatus = '';
        if (pendingActions.length > 0) {
            actionStatus = `<div class="meeting-actions-preview pending">${pendingActions.length} reminder${pendingActions.length > 1 ? 's' : ''}</div>`;
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
                        <div class="meeting-subtitle meeting-contacts" onclick="${contactClickHandler}">with ${contactDisplay}</div>
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

// Helper function to format multiple contacts display
function formatContactsDisplay(contacts, actionId) {
    if (contacts.length === 0) {
        return { 
            display: '<span class="action-add-contact">+ Add contact</span>', 
            extra: 0, 
            hasContacts: false,
            ids: []
        };
    } else if (contacts.length === 1) {
        return { 
            display: contacts[0].name, 
            extra: 0, 
            hasContacts: true,
            ids: [contacts[0].id]
        };
    } else {
        return { 
            display: contacts[0].name, 
            extra: contacts.length - 1, 
            hasContacts: true,
            ids: contacts.map(c => c.id)
        };
    }
}

function renderActionListItem(action, type) {
    const contacts = action.contactIds.map(id => AppData.getContact(id)).filter(c => c);
    const meeting = action.meetingId ? AppData.getMeeting(action.meetingId) : null;
    const contactInfo = formatContactsDisplay(contacts, action.id);
    
    // Build contact display with click handler - pass only IDs, lookup in function
    let contactDisplay;
    if (contactInfo.hasContacts) {
        contactDisplay = contactInfo.extra > 0 
            ? `${contactInfo.display} <span class="contact-extra">+${contactInfo.extra}</span>` 
            : contactInfo.display;
    } else {
        contactDisplay = contactInfo.display;
    }
    const contactClickHandler = `event.stopPropagation(); showContactPopoverForAction('${action.id}')`;
    
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

    // Overdue badge for display
    const overdueTag = type === 'overdue' ? 
        `<span class="overdue-tag">⚠️ Overdue</span>` : '';

    return `
        <div class="action-swipe-container" id="action-swipe-${action.id}">
            <div class="action-swipe-content">
                <div class="action-list-card" id="action-list-${action.id}">
                    <div class="action-list-checkbox" onclick="completeActionFromList('${action.id}', event)"></div>
                    <div class="action-list-content">
                        <div class="action-list-title" onclick="event.stopPropagation(); enableInlineEdit('${action.id}', this)">${action.title}</div>
                        <div class="action-list-meta">
                            <span class="action-list-contact" onclick="${contactClickHandler}">👤 ${contactDisplay}</span>
                            <span class="action-list-source" onclick="event.stopPropagation(); ${hasMeetingContext ? `showMeetingDetail('${action.meetingId}')` : ''}">📝 ${meetingTitle}</span>
                            ${aiTag}
                        </div>
                        <div class="action-time-row">
                            ${dueInfo}
                            <span class="action-created">Created: ${createdDate}</span>
                        </div>
                    </div>
                </div>
            </div>
            <div class="action-swipe-actions">
                ${action.dueDate ? `<button class="swipe-btn swipe-btn-snooze" onclick="snoozeAction('${action.id}')"><span>⏰</span>Snooze</button>` : ''}
                <button class="swipe-btn swipe-btn-delete" onclick="deleteAction('${action.id}')"><span>🗑️</span>Delete</button>
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
        renderRemindersHub();
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
                actionPreview = `<div class="meeting-list-actions">${pendingActions.length} reminder${pendingActions.length > 1 ? 's' : ''}</div>`;
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

        <!-- 📅 Reminders Section -->
        <div class="md-followups-section">
            <div class="md-followups-header">
                <div class="md-followups-title">
                    <span>📅</span>
                    <span>Reminders</span>
                </div>
                <button class="md-add-btn" onclick="showAddActionForMeeting('${meetingId}')" title="Add Reminder">+</button>
            </div>
            
            <!-- AI 建议的 Reminders（只显示未处理的） -->
            ${(() => {
                const allSuggestions = summaryData.nextActions || [];
                // 过滤掉已accept的和已dismiss的
                const dismissedKey = `dismissed_${meetingId}`;
                const dismissedList = JSON.parse(localStorage.getItem(dismissedKey) || '[]');
                const unprocessedSuggestions = allSuggestions.filter(action => 
                    !meetingActions.some(a => a.title === action) && !dismissedList.includes(action)
                );
                
                // 如果有AI建议
                if (allSuggestions.length > 0) {
                    if (unprocessedSuggestions.length > 0) {
                        // 还有未处理的
                        return `
                        <div class="md-ai-suggestions">
                            <div class="md-ai-label">
                                <span>✨</span> AI Suggested
                            </div>
                            ${unprocessedSuggestions.map((action, i) => `
                                <div class="md-suggestion-item" id="suggestion-${meetingId}-${i}">
                                    <div class="md-suggestion-text">${action}</div>
                                    <div class="md-suggestion-actions">
                                        <button class="md-suggestion-dismiss-btn" 
                                                onclick="dismissAISuggestion('${meetingId}', '${action.replace(/'/g, "\\'")}', this)">
                                            ✗ Dismiss
                                        </button>
                                        <button class="md-suggestion-accept-btn" 
                                                onclick="acceptAISuggestion('${meetingId}', ${i}, '${action.replace(/'/g, "\\'")}', this)">
                                            ✓ Accept
                                        </button>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                        `;
                    } else {
                        // 全部已处理
                        return `
                        <div class="md-ai-suggestions-empty">
                            <span>✨</span> All AI suggestions processed
                        </div>
                        `;
                    }
                }
                return '';
            })()}
            
            <!-- My Calendar（已accept的 + 手动添加的） -->
            ${pendingActions.length > 0 ? `
                <div class="md-reminders-list">
                    <div class="md-reminders-label">📋 My Calendar</div>
                    ${pendingActions.map(a => {
                        // 获取联系人名字
                        const contactIds = a.contactIds || [];
                        const contactNames = contactIds.map(id => {
                            const contact = AppData.contacts.find(c => c.id === id);
                            return contact ? contact.name.split(' ')[0] : null;
                        }).filter(Boolean);
                        const contactDisplay = contactNames.length > 0 
                            ? contactNames.slice(0, 2).join(', ') + (contactNames.length > 2 ? ` +${contactNames.length - 2}` : '')
                            : '';
                        
                        // 日期和颜色
                        const dueDate = a.dueDate || DateHelper.today;
                        const weekdayGradients = {
                            0: 'linear-gradient(135deg, #EC4899 0%, #F43F5E 100%)',
                            1: 'linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%)',
                            2: 'linear-gradient(135deg, #F59E0B 0%, #EAB308 100%)',
                            3: 'linear-gradient(135deg, #22C55E 0%, #10B981 100%)',
                            4: 'linear-gradient(135deg, #0EA5E9 0%, #06B6D4 100%)',
                            5: 'linear-gradient(135deg, #A855F7 0%, #8B5CF6 100%)',
                            6: 'linear-gradient(135deg, #EF4444 0%, #F97316 100%)',
                        };
                        const dayOfWeek = new Date(dueDate).getDay();
                        const dateGradient = weekdayGradients[dayOfWeek];
                        
                        return `
                        <div class="md-reminder-card">
                            <div class="md-rc-date-col clickable" style="background: ${dateGradient}" 
                                 onclick="event.stopPropagation(); editDueDate('${a.id}')" title="Change date">
                                <span class="md-rc-month">${getMonthShort(dueDate)}</span>
                                <span class="md-rc-day">${new Date(dueDate).getDate()}</span>
                            </div>
                            <div class="md-rc-main">
                                <div class="md-reminder-checkbox ${a.status === 'completed' ? 'checked' : ''}" 
                                     onclick="toggleReminderComplete('${a.id}', this)"></div>
                                <div class="md-rc-content">
                                    <div class="md-rc-title" onclick="event.stopPropagation(); enableInlineEdit('${a.id}', this)">${a.title}</div>
                                    <div class="md-rc-row">
                                        <span class="md-rc-icon">👤</span>
                                        ${contactDisplay 
                                            ? `<span class="md-rc-text">${contactDisplay}</span>` 
                                            : `<span class="md-rc-add" onclick="event.stopPropagation(); addContactToReminder('${a.id}')">Add contact</span>`}
                                    </div>
                                </div>
                            </div>
                        </div>
                    `;}).join('')}
                </div>
            ` : ''}
            
            <!-- 已完成的 -->
            ${completedActions.length > 0 ? `
                <div class="md-completed-list">
                    <div class="md-completed-label">✅ Done (${completedActions.length})</div>
                    ${completedActions.slice(0, 2).map(a => `
                        <div class="md-reminder-item completed">
                            <div class="md-reminder-checkbox checked"></div>
                            <div class="md-reminder-content">
                                <div class="md-reminder-text">${a.title}</div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            ` : ''}
            
        </div>

        <!-- 总结 / 整体总结 -->
        <div class="md-section">
            <h2 class="md-section-title">📝 总结</h2>
            <p class="md-text">${summaryData.overview}</p>
        </div>

        <!-- 会面背景 -->
        <div class="md-section">
            <h2 class="md-section-title">👥 会面背景</h2>
            <ul class="md-list">
                <li><strong>参与者:</strong> ${summaryData.background.participants}</li>
                <li><strong>角色:</strong> ${summaryData.background.roles}</li>
                <li><strong>目的:</strong> ${summaryData.background.purpose}</li>
            </ul>
        </div>

        <!-- 关键结论总结 -->
        <div class="md-section">
            <h2 class="md-section-title">🎯 关键结论</h2>
            <ul class="md-list">
                ${summaryData.keyConclusions.map(c => `<li>${c}</li>`).join('')}
            </ul>
        </div>

        <!-- 核心议题逐条总结 -->
        <div class="md-section">
            <h2 class="md-section-title">💬 核心议题</h2>
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
                <h2 class="md-section-title">⚠️ 风险点</h2>
                <ul class="md-list">
                    ${summaryData.risks.map(r => `<li>${r}</li>`).join('')}
                </ul>
            </div>
        ` : ''}

        <!-- 附录: 高价值原话 / 片段 -->
        ${summaryData.highlights && summaryData.highlights.length > 0 ? `
            <div class="md-section">
                <h2 class="md-section-title">💡 高价值片段</h2>
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

    // Hide tab bar and sticky bar first
    const tabBar = document.querySelector('.tab-bar');
    const stickyBar = document.querySelector('.sticky-bar');
    if (tabBar) tabBar.style.display = 'none';
    if (stickyBar) stickyBar.style.display = 'none';
    
    // Show the meeting detail page
    const meetingDetailPage = document.getElementById('meeting-detail-page');
    if (meetingDetailPage) {
        meetingDetailPage.style.display = 'flex';
        meetingDetailPage.classList.add('active');
    }
}

function closeMeetingDetail() {
    const meetingDetailPage = document.getElementById('meeting-detail-page');
    if (meetingDetailPage) {
        meetingDetailPage.classList.remove('active');
        meetingDetailPage.style.display = 'none';
    }
    
    // Restore tab bar and sticky bar
    const tabBar = document.querySelector('.tab-bar');
    const stickyBar = document.querySelector('.sticky-bar');
    if (tabBar) tabBar.style.display = 'flex';
    if (stickyBar) stickyBar.style.display = 'flex';
    
    // Reset state - don't call showPage to avoid double state changes
    // Just ensure the previous page is visible
    const prevPage = AppState.previousPage || 'home';
    
    // Show the previous page element directly
    const pageId = prevPage === 'home' ? 'home-page' : 
                   prevPage === 'contacts' ? 'contacts-list-page' :
                   prevPage === 'contact' ? 'contact-page' :
                   prevPage === 'calendar' ? 'calendar-page' :
                   prevPage === 'meetingList' ? 'meeting-list-page' :
                   prevPage === 'me' ? 'me-page' : 'home-page';
    
    const prevPageEl = document.getElementById(pageId);
    if (prevPageEl) {
        prevPageEl.style.display = 'block';
    }
    
    // Update current page state
    AppState.currentPage = prevPage;
    AppState.previousPage = null;
}

function completeActionFromMeeting(actionId, checkbox) {
    // Visual feedback
    checkbox.classList.add('checked');
    const actionItem = document.getElementById(`md-action-${actionId}`);
    if (actionItem) {
        actionItem.style.opacity = '0.5';
        actionItem.style.transform = 'translateX(20px)';
    }
    
    // Update data
    AppData.completeAction(actionId);
    showToast('Action completed! ✓');
    
    // Refresh meeting detail to move item to completed section
    setTimeout(() => {
        showMeetingDetail(AppState.selectedMeeting);
        refreshAllViews();
    }, 400);
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
        renderRemindersHub();
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

    if (avatarEl) {
        avatarEl.textContent = contact.avatar;
        avatarEl.style.background = contact.avatarColor || '#007AFF';
    }
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
            <div class="contact-pending-actions-right">
                <button class="contact-add-btn" onclick="event.stopPropagation(); showAddActionForContact('${contactId}')" title="Add Reminder">+</button>
                <span class="contact-pending-arrow">▼</span>
            </div>
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
                                ${isOverdue ? `<button class="action-quick-btn" onclick="event.stopPropagation(); snoozeAction('${a.id}')">⏰ Snooze</button>` : ''}
                            </div>
                        </div>
                    </div>
                `;
            }).join('')}
        </div>
    `;
}

function renderContactActivities(contactId) {
    // Get contact info first
    const contact = AppData.getContact(contactId);
    if (!contact) return;
    
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
            // 与首页 meeting-card 样式保持一致
            const pendingActions = AppData.getActionsForMeeting(meeting.id).filter(a => a.status === 'pending');
            const completedActions = AppData.getActionsForMeeting(meeting.id).filter(a => a.status === 'completed');
            
            // Reminder状态展示（与首页一致）
            let actionStatus = '';
            if (pendingActions.length > 0) {
                actionStatus = `<div class="meeting-actions-preview pending">🔴 ${pendingActions.length} reminder${pendingActions.length > 1 ? 's' : ''}</div>`;
            } else if (completedActions.length > 0) {
                actionStatus = `<div class="meeting-actions-preview done">✅ All done</div>`;
            }
            
            const iconClass = meeting.type === 'call' ? 'call' : meeting.type === 'voice' ? 'voice' : 'chat';
            const icon = meeting.type === 'call' ? '📞' : meeting.type === 'voice' ? '🎙' : '💬';

            html += `
                <div class="meeting-card" onclick="showMeetingDetail('${meeting.id}')">
                    <div class="meeting-top">
                        <div class="meeting-icon ${iconClass}">${icon}</div>
                        <div class="meeting-info">
                            <div class="meeting-title">${meeting.title}</div>
                            <div class="meeting-subtitle">with ${contact.name}</div>
                        </div>
                        <div class="meeting-time">${meeting.time}</div>
                    </div>
                    ${actionStatus}
                </div>
            `;
        });
    });

    // Add first contact card
    if (contact.firstContact) {
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
        renderRemindersHub();
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

// ========================================
// Date Picker Modal State
// ========================================
const DatePickerState = {
    actionId: null,
    currentDate: null,
    displayMonth: new Date()
};

function editDueDate(actionId) {
    const action = AppData.getAction(actionId);
    if (!action) return;
    
    DatePickerState.actionId = actionId;
    DatePickerState.currentDate = action.dueDate || DateHelper.today;
    DatePickerState.displayMonth = new Date(DatePickerState.currentDate);
    
    openDatePickerModal();
}

function openDatePickerModal() {
    const modal = document.getElementById('date-picker-modal');
    if (!modal) return;
    
    renderEditDateCalendar();
    modal.classList.add('show');
}

function closeDatePickerModal() {
    const modal = document.getElementById('date-picker-modal');
    if (modal) {
        modal.classList.remove('show');
    }
}

function changeEditMonth(delta) {
    DatePickerState.displayMonth.setMonth(DatePickerState.displayMonth.getMonth() + delta);
    renderEditDateCalendar();
}

function renderEditDateCalendar() {
    const calendar = document.getElementById('edit-date-calendar');
    const monthLabel = document.getElementById('edit-month-label');
    if (!calendar || !monthLabel) return;
    
    const year = DatePickerState.displayMonth.getFullYear();
    const month = DatePickerState.displayMonth.getMonth();
    
    // Update month label
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                        'July', 'August', 'September', 'October', 'November', 'December'];
    monthLabel.textContent = `${monthNames[month]} ${year}`;
    
    // Build calendar
    let html = '';
    
    // Day headers
    const dayNames = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
    dayNames.forEach(d => {
        html += `<div class="dp-day-header">${d}</div>`;
    });
    
    // First day of month and days in month
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();
    
    // Previous month days
    for (let i = firstDay - 1; i >= 0; i--) {
        const day = daysInPrevMonth - i;
        html += `<div class="dp-day other-month">${day}</div>`;
    }
    
    // Current month days
    for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const isToday = dateStr === DateHelper.today;
        const isSelected = dateStr === DatePickerState.currentDate;
        
        let classes = 'dp-day';
        if (isToday) classes += ' today';
        if (isSelected) classes += ' selected';
        
        html += `<div class="${classes}" onclick="selectEditDate('${dateStr}')">${day}</div>`;
    }
    
    // Next month days (fill remaining cells)
    const totalCells = Math.ceil((firstDay + daysInMonth) / 7) * 7;
    const remainingCells = totalCells - (firstDay + daysInMonth);
    for (let day = 1; day <= remainingCells; day++) {
        html += `<div class="dp-day other-month">${day}</div>`;
    }
    
    calendar.innerHTML = html;
    
    // Setup shortcut buttons
    setupDateShortcuts();
}

function setupDateShortcuts() {
    const shortcuts = document.querySelectorAll('.date-shortcut');
    shortcuts.forEach(btn => {
        btn.onclick = () => {
            const days = parseInt(btn.dataset.days);
            const date = new Date(DateHelper.today);
            date.setDate(date.getDate() + days);
            const dateStr = formatDateStr(date);
            selectEditDate(dateStr);
        };
    });
}

function selectEditDate(dateStr) {
    if (!DatePickerState.actionId) return;
    
    AppData.updateActionDueDate(DatePickerState.actionId, dateStr);
    showToast('Date set to ' + DateHelper.formatDate(dateStr));
    closeDatePickerModal();
    refreshAllViews();
}

function clearDueDate(actionId) {
    // Reminder 必须有日期，所以清除时重置为今天
    AppData.updateActionDueDate(actionId, DateHelper.today);
    showToast('Due date reset to today');
    refreshAllViews();
}

function addContactToReminder(actionId) {
    const action = AppData.getAction(actionId);
    if (!action) return;
    
    // 简化版：显示联系人列表让用户选择
    const contacts = AppData.contacts;
    const contactList = contacts.map((c, i) => `${i + 1}. ${c.name}`).join('\n');
    
    const choice = prompt(
        `Add contact to reminder:\n"${action.title.substring(0, 30)}..."\n\n` +
        `Select contact:\n${contactList}\n\n` +
        `Enter number:`
    );
    
    if (!choice) return;
    
    const index = parseInt(choice.trim()) - 1;
    if (index >= 0 && index < contacts.length) {
        const selectedContact = contacts[index];
        // 添加联系人到 action
        if (!action.contactIds) action.contactIds = [];
        if (!action.contactIds.includes(selectedContact.id)) {
            action.contactIds.push(selectedContact.id);
            showToast(`Added ${selectedContact.name}`);
            refreshAllViews();
        } else {
            showToast('Contact already added');
        }
    } else {
        showToast('Invalid selection');
    }
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
    renderRemindersHub();
    renderTodayMeetings();
    if (AppState.currentPage === 'calendar') {
        renderCalendar();
    }
    if (AppState.currentPage === 'contact') {
        renderContactDetail();
    }
    if (AppState.currentPage === 'meetingList') {
        renderMeetingList();
    }
}

// ========================================
// Add Action Modal
// ========================================

const AddActionState = {
    context: null,  // 'home', 'meeting', 'contact'
    meetingId: null,
    contactIds: [],
    selectedDueDate: null,
    currentMonth: new Date(),
    createMore: false
};

function showAddActionModal(contactId) {
    AddActionState.context = 'home';
    AddActionState.meetingId = null;
    AddActionState.contactIds = contactId ? [contactId] : [];
    // 默认日期：今天（用户手动添加的 reminder 必填时间，默认今天）
    AddActionState.selectedDueDate = DateHelper.today;
    openAddActionModal();
}

function showAddActionForMeeting(meetingId) {
    const meeting = AppData.getMeeting(meetingId);
    AddActionState.context = 'meeting';
    AddActionState.meetingId = meetingId;
    AddActionState.contactIds = meeting.contactIds || [];
    // 默认日期：今天（手动添加默认今天）
    AddActionState.selectedDueDate = DateHelper.today;
    openAddActionModal();
}

function showAddActionForContact(contactId) {
    AddActionState.context = 'contact';
    AddActionState.meetingId = null;
    AddActionState.contactIds = [contactId];
    // 默认日期：今天
    AddActionState.selectedDueDate = DateHelper.today;
    openAddActionModal();
}

function openAddActionModal() {
    const modal = document.getElementById('add-action-modal');
    const input = document.getElementById('add-action-input');
    
    // Reset form
    input.value = '';
    // 注意：selectedDueDate 已经在 showAddAction* 函数中设置了默认值（今天）
    // 这里不再重置为 null
    AddActionState.currentMonth = new Date();
    
    // Update displays
    updateDueDateDisplay();
    updateContactDisplay();
    renderDueCalendar();
    
    // Hide date picker
    document.getElementById('due-date-picker').classList.remove('show');
    document.getElementById('due-date-btn').classList.remove('active');
    
    // Show modal
    modal.classList.add('show');
    
    // Focus input
    setTimeout(() => input.focus(), 300);
}

function closeAddActionModal() {
    const modal = document.getElementById('add-action-modal');
    modal.classList.remove('show');
    
    // Refresh views if context was meeting
    if (AddActionState.context === 'meeting' && AddActionState.meetingId) {
        showMeetingDetail(AddActionState.meetingId);
    }
}

function handleAddActionKeydown(event) {
    if (event.key === 'Enter') {
        event.preventDefault();
        submitNewAction();
    } else if (event.key === 'Escape') {
        closeAddActionModal();
    }
}

function submitNewAction() {
    const input = document.getElementById('add-action-input');
    const title = input.value.trim();
    
    if (!title) {
        input.focus();
        return;
    }
    
    // Create the action
    AppData.addAction({
        title: title,
        contactIds: AddActionState.contactIds,
        meetingId: AddActionState.meetingId,
        dueDate: AddActionState.selectedDueDate
    });
    
    showToast('Action created!');
    refreshAllViews();
    
    // Check if Create More is enabled
    const createMore = document.getElementById('create-more-checkbox').checked;
    
    if (createMore) {
        // Clear input and reset due date, keep modal open
        input.value = '';
        AddActionState.selectedDueDate = null;
        updateDueDateDisplay();
        document.getElementById('due-date-picker').classList.remove('show');
        input.focus();
    } else {
        closeAddActionModal();
    }
}

// Due Date Picker functions
function toggleDueDatePicker() {
    const picker = document.getElementById('due-date-picker');
    const btn = document.getElementById('due-date-btn');
    
    if (picker.classList.contains('show')) {
        picker.classList.remove('show');
        btn.classList.remove('active');
    } else {
        picker.classList.add('show');
        btn.classList.add('active');
        renderDueCalendar();
    }
}

function renderDueCalendar() {
    const calendar = document.getElementById('due-calendar');
    const monthLabel = document.getElementById('due-month-label');
    
    const year = AddActionState.currentMonth.getFullYear();
    const month = AddActionState.currentMonth.getMonth();
    
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                        'July', 'August', 'September', 'October', 'November', 'December'];
    monthLabel.textContent = monthNames[month];
    
    // Day headers
    const dayHeaders = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
    let html = dayHeaders.map(d => `<div class="calendar-day-header">${d}</div>`).join('');
    
    // First day of month
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDayOfWeek = firstDay.getDay();
    
    // Previous month days
    const prevMonthLastDay = new Date(year, month, 0).getDate();
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
        const day = prevMonthLastDay - i;
        html += `<div class="calendar-day other-month">${day}</div>`;
    }
    
    // Current month days
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    
    for (let day = 1; day <= lastDay.getDate(); day++) {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const isToday = dateStr === todayStr;
        const isSelected = dateStr === AddActionState.selectedDueDate;
        
        let classes = 'calendar-day';
        if (isToday && !isSelected) classes += ' today';
        if (isSelected) classes += ' selected';
        
        html += `<div class="${classes}" onclick="selectDueDate('${dateStr}')">${day}</div>`;
    }
    
    // Next month days
    const remainingDays = 42 - (startDayOfWeek + lastDay.getDate());
    for (let day = 1; day <= remainingDays && day <= 7; day++) {
        html += `<div class="calendar-day other-month">${day}</div>`;
    }
    
    calendar.innerHTML = html;
}

function changeDueMonth(delta) {
    AddActionState.currentMonth.setMonth(AddActionState.currentMonth.getMonth() + delta);
    renderDueCalendar();
}

function selectDueDate(dateStr) {
    AddActionState.selectedDueDate = dateStr;
    updateDueDateDisplay();
    renderDueCalendar();
    
    // Close picker after selection
    setTimeout(() => {
        document.getElementById('due-date-picker').classList.remove('show');
        document.getElementById('due-date-btn').classList.remove('active');
    }, 200);
}

function setDueDateToday() {
    const today = new Date();
    const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    selectDueDate(dateStr);
}

function clearSelectedDueDate() {
    AddActionState.selectedDueDate = null;
    updateDueDateDisplay();
    renderDueCalendar();
    document.getElementById('due-date-picker').classList.remove('show');
    document.getElementById('due-date-btn').classList.remove('active');
}

function updateDueDateDisplay() {
    const display = document.getElementById('selected-due-display');
    const btn = document.getElementById('due-date-btn');
    
    if (AddActionState.selectedDueDate) {
        const formatted = DateHelper.formatDate(AddActionState.selectedDueDate);
        display.innerHTML = `📅 ${formatted} <span class="remove" onclick="clearSelectedDueDate()">×</span>`;
        display.style.display = 'inline-flex';
        btn.classList.add('has-date');
    } else {
        display.style.display = 'none';
        btn.classList.remove('has-date');
    }
}

function updateContactDisplay() {
    const display = document.getElementById('selected-contact-display');
    
    if (AddActionState.contactIds.length > 0) {
        const contacts = AddActionState.contactIds.map(id => AppData.getContact(id)).filter(c => c);
        if (contacts.length > 0) {
            // Show each contact as a removable tag
            const contactTags = contacts.map(c => 
                `<span class="contact-tag">👤 ${c.name} <span class="remove" onclick="event.stopPropagation(); removeContactFromAction('${c.id}')">×</span></span>`
            ).join('');
            display.innerHTML = contactTags;
            display.style.display = 'flex';
            return;
        }
    }
    display.style.display = 'none';
}

function removeContactFromAction(contactId) {
    const index = AddActionState.contactIds.indexOf(contactId);
    if (index !== -1) {
        AddActionState.contactIds.splice(index, 1);
        updateContactDisplay();
    }
}

// ========================================
// Contact Popover (联系人浮层)
// ========================================

const ContactPopoverState = {
    visible: false,
    contactIds: [],
    context: null,  // 'action' or 'meeting'
    contextId: null  // actionId or meetingId
};

// Wrapper functions for onclick handlers (avoid JSON in HTML attributes)
function showContactPopoverForAction(actionId) {
    const action = AppData.getAction(actionId);
    if (action) {
        showContactPopover(action.contactIds, 'action', actionId);
    }
}

function showContactPopoverForMeeting(meetingId) {
    const meeting = AppData.getMeeting(meetingId);
    if (meeting) {
        showContactPopover(meeting.contactIds, 'meeting', meetingId);
    }
}

function showContactPopover(contactIds, context, contextId) {
    ContactPopoverState.contactIds = contactIds || [];
    ContactPopoverState.context = context;
    ContactPopoverState.contextId = contextId;
    
    // If no contacts, directly open contact picker
    if (!contactIds || contactIds.length === 0) {
        openContactPickerForContext(context, contextId);
        return;
    }
    
    const popover = document.getElementById('contact-popover');
    const overlay = document.getElementById('contact-popover-overlay');
    const content = document.getElementById('contact-popover-content');
    const title = document.getElementById('contact-popover-title');
    const addText = document.getElementById('contact-popover-add-text');
    
    // Render contacts
    const contacts = contactIds.map(id => AppData.getContact(id)).filter(c => c);
    
    title.textContent = contacts.length === 1 ? 'Related Contact' : `Related Contacts (${contacts.length})`;
    addText.textContent = 'Add more contacts';
    
    content.innerHTML = contacts.map(c => `
        <div class="contact-popover-item" onclick="goToContactFromPopover('${c.id}')">
            <div class="contact-popover-avatar" style="background: ${c.avatarColor}">${c.avatar}</div>
            <div class="contact-popover-info">
                <div class="contact-popover-name">${c.name}</div>
                <div class="contact-popover-role">${c.role} @ ${c.company}</div>
            </div>
            <span class="contact-popover-arrow-icon">›</span>
        </div>
    `).join('');
    
    // Show popover with overlay
    overlay.classList.add('show');
    popover.classList.add('show');
    ContactPopoverState.visible = true;
}

function closeContactPopover() {
    const popover = document.getElementById('contact-popover');
    const overlay = document.getElementById('contact-popover-overlay');
    popover.classList.remove('show');
    overlay.classList.remove('show');
    ContactPopoverState.visible = false;
}

function goToContactFromPopover(contactId) {
    closeContactPopover();
    showContactDetail(contactId);
}

function addContactFromPopover() {
    // Save state before closing popover
    const context = ContactPopoverState.context;
    const contextId = ContactPopoverState.contextId;
    
    if (!context || !contextId) {
        console.warn('addContactFromPopover: Missing context or contextId');
        return;
    }
    
    closeContactPopover();
    
    // Open contact picker with saved state (delay for animation)
    setTimeout(() => {
        openContactPickerForContext(context, contextId);
    }, 200);
}

function openContactPickerForContext(context, contextId) {
    if (context === 'action') {
        const action = AppData.getAction(contextId);
        if (action) {
            AddActionState.contactIds = [...action.contactIds];
            AddActionState.context = 'edit';
            AddActionState.editingActionId = contextId;
            showContactPickerForEdit();
        }
    } else if (context === 'meeting') {
        showContactPickerForMeeting(contextId);
    }
}

function showContactPickerForEdit() {
    const modal = document.getElementById('contact-picker-modal');
    const searchInput = document.getElementById('contact-search-input');
    
    ContactPickerState.selectedIds = [...AddActionState.contactIds];
    ContactPickerState.searchQuery = '';
    
    searchInput.value = '';
    renderContactPickerList();
    modal.classList.add('show');
    
    setTimeout(() => searchInput.focus(), 300);
}

function showContactPickerForMeeting(meetingId) {
    // Store meeting context for later update
    ContactPickerState.meetingId = meetingId;
    const meeting = AppData.getMeeting(meetingId);
    
    const modal = document.getElementById('contact-picker-modal');
    const searchInput = document.getElementById('contact-search-input');
    
    ContactPickerState.selectedIds = meeting ? [...meeting.contactIds] : [];
    ContactPickerState.searchQuery = '';
    
    searchInput.value = '';
    renderContactPickerList();
    modal.classList.add('show');
    
    setTimeout(() => searchInput.focus(), 300);
}

// ========================================
// Contact Picker
// ========================================

const ContactPickerState = {
    selectedIds: [],
    searchQuery: '',
    meetingId: null,
    editingActionId: null
};

function showContactPicker() {
    const modal = document.getElementById('contact-picker-modal');
    const searchInput = document.getElementById('contact-search-input');
    
    // Initialize with current selection from AddActionState
    ContactPickerState.selectedIds = [...AddActionState.contactIds];
    ContactPickerState.searchQuery = '';
    
    // Reset search
    searchInput.value = '';
    
    // Render contacts
    renderContactPickerList();
    
    // Show modal
    modal.classList.add('show');
    
    // Focus search
    setTimeout(() => searchInput.focus(), 300);
}

function closeContactPicker() {
    const modal = document.getElementById('contact-picker-modal');
    modal.classList.remove('show');
}

function confirmContactSelection() {
    const selectedIds = [...ContactPickerState.selectedIds];
    
    // Check if we're editing an existing action
    if (AddActionState.context === 'edit' && AddActionState.editingActionId) {
        const action = AppData.getAction(AddActionState.editingActionId);
        if (action) {
            action.contactIds = selectedIds;
            showToast('Contacts updated');
            refreshAllViews();
        }
        AddActionState.editingActionId = null;
        AddActionState.context = null;
    } 
    // Check if we're editing a meeting
    else if (ContactPickerState.meetingId) {
        const meeting = AppData.getMeeting(ContactPickerState.meetingId);
        if (meeting) {
            meeting.contactIds = selectedIds;
            showToast('Contacts updated');
            refreshAllViews();
            // Refresh meeting detail if open
            if (AppState.selectedMeeting === ContactPickerState.meetingId) {
                showMeetingDetail(ContactPickerState.meetingId);
            }
        }
        ContactPickerState.meetingId = null;
    }
    // Normal add action flow
    else {
        AddActionState.contactIds = selectedIds;
        updateContactDisplay();
    }
    
    // Close picker
    closeContactPicker();
}

function filterContacts(query) {
    ContactPickerState.searchQuery = query.toLowerCase();
    renderContactPickerList();
}

function renderContactPickerList() {
    const container = document.getElementById('contact-picker-list');
    const query = ContactPickerState.searchQuery;
    
    // Filter contacts
    let contacts = AppData.contacts;
    if (query) {
        contacts = contacts.filter(c => 
            c.name.toLowerCase().includes(query) ||
            c.company.toLowerCase().includes(query) ||
            c.role.toLowerCase().includes(query)
        );
    }
    
    if (contacts.length === 0) {
        container.innerHTML = `
            <div class="contact-picker-empty">
                ${query ? 'No contacts found' : 'No contacts available'}
            </div>
        `;
        return;
    }
    
    container.innerHTML = contacts.map(contact => {
        const isSelected = ContactPickerState.selectedIds.includes(contact.id);
        return `
            <div class="contact-picker-item ${isSelected ? 'selected' : ''}" 
                 onclick="toggleContactSelection('${contact.id}')">
                <div class="contact-picker-checkbox"></div>
                <div class="contact-picker-avatar" style="background: ${contact.avatarColor}">${contact.avatar}</div>
                <div class="contact-picker-info">
                    <div class="contact-picker-name">${contact.name}</div>
                    <div class="contact-picker-role">${contact.role} @ ${contact.company}</div>
                </div>
            </div>
        `;
    }).join('');
}

function toggleContactSelection(contactId) {
    const index = ContactPickerState.selectedIds.indexOf(contactId);
    
    if (index === -1) {
        // Add to selection
        ContactPickerState.selectedIds.push(contactId);
    } else {
        // Remove from selection
        ContactPickerState.selectedIds.splice(index, 1);
    }
    
    // Re-render list to update visual state
    renderContactPickerList();
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
window.toggleReminderComplete = toggleReminderComplete;
window.renderCalendar = renderCalendar;
window.shiftCalendarDates = shiftCalendarDates;
window.selectCalendarDate = selectCalendarDate;
window.switchCalendarView = switchCalendarView;
window.deleteReminder = deleteReminder;
window.snoozeReminder = snoozeReminder;
window.renderReminderCard = renderReminderCard;
window.getMonthShort = getMonthShort;
window.getWeekdayShort = getWeekdayShort;
window.toggleCalendarPicker = toggleCalendarPicker;
window.switchPickerTab = switchPickerTab;
window.changePickerMonth = changePickerMonth;
window.selectPickerDate = selectPickerDate;
window.selectPickerWeek = selectPickerWeek;
window.selectPickerMonth = selectPickerMonth;
window.selectQuickDate = selectQuickDate;
window.updateCalendarViewTabs = updateCalendarViewTabs;
window.selectCalendarWeek = selectCalendarWeek;
window.selectCalendarMonth = selectCalendarMonth;
window.showAddReminderModal = showAddReminderModal;
window.acceptAISuggestion = acceptAISuggestion;
window.dismissAISuggestion = dismissAISuggestion;
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
window.deleteAction = deleteAction;
window.toggleContactActions = toggleContactActions;
window.completeActionFromList = completeActionFromList;
window.completeActionFromModal = completeActionFromModal;
window.completeActionFromContact = completeActionFromContact;
window.switchContactTab = switchContactTab;
window.filterContacts = filterContacts;
window.renderContactList = renderContactList;
window.editDueDate = editDueDate;
window.clearDueDate = clearDueDate;
window.addContactToReminder = addContactToReminder;
window.closeDatePickerModal = closeDatePickerModal;
window.changeEditMonth = changeEditMonth;
window.selectEditDate = selectEditDate;
window.toggleDoneSection = toggleDoneSection;
window.shiftMonth = shiftMonth;
window.selectMonthDate = selectMonthDate;
window.selectCalendarDate = selectCalendarDate;
window.switchCalendarView = switchCalendarView;
window.openCalendarPicker = openCalendarPicker;
window.closeCalendarPicker = closeCalendarPicker;
window.pickDate = pickDate;
window.changePickerMonth = changePickerMonth;
window.pickYear = pickYear;
window.pickMonth = pickMonth;
window.closeMonthExpanded = closeMonthExpanded;
window.showReminderDetail = function(id) {
    showToast('Opening reminder...');
};
window.shiftWeek = shiftWeek;
window.enableInlineEdit = enableInlineEdit;
window.refreshAllViews = refreshAllViews;
window.showAddActionForMeeting = showAddActionForMeeting;
window.showAddActionForContact = showAddActionForContact;
window.closeAddActionModal = closeAddActionModal;
window.handleAddActionKeydown = handleAddActionKeydown;
window.submitNewAction = submitNewAction;
window.toggleDueDatePicker = toggleDueDatePicker;
window.changeDueMonth = changeDueMonth;
window.selectDueDate = selectDueDate;
window.setDueDateToday = setDueDateToday;
window.clearSelectedDueDate = clearSelectedDueDate;
window.showContactPicker = showContactPicker;
window.closeContactPicker = closeContactPicker;
window.confirmContactSelection = confirmContactSelection;
window.filterContacts = filterContacts;
window.toggleContactSelection = toggleContactSelection;
window.removeContactFromAction = removeContactFromAction;
window.showContactPopover = showContactPopover;
window.showContactPopoverForAction = showContactPopoverForAction;
window.showContactPopoverForMeeting = showContactPopoverForMeeting;
window.closeContactPopover = closeContactPopover;
window.goToContactFromPopover = goToContactFromPopover;
window.addContactFromPopover = addContactFromPopover;
window.generateMeetingFollowUp = generateMeetingFollowUp;
window.completeActionFromMeeting = completeActionFromMeeting;
window.showTranscript = showTranscript;
window.shareMeeting = shareMeeting;
window.copyMeetingSummary = copyMeetingSummary;
window.addMeetingParticipant = addMeetingParticipant;
