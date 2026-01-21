// ========================================
// BizCard Phase 1 Demo - Mock Data
// ========================================

const AppData = {
    // Current user
    user: {
        id: 'user_001',
        name: 'Ethan Carter',
        role: 'Product Designer',
        email: 'ethan.carter@bizcard.com',
        avatar: 'E',
        plan: 'Free',
        points: 2500,
        stats: {
            visits: 1543,
            clicks: 89,
            calls: 2131,
            leads: 973
        }
    },

    // Contacts
    contacts: [
        {
            id: 'contact_kevin',
            name: 'Kevin Chen',
            role: 'Product Manager',
            company: 'Acme Corp',
            avatar: 'K',
            avatarColor: '#667eea',
            phone: '+1 234-567-8901',
            email: 'kevin@acme.com',
            pendingActions: 2,
            firstContact: {
                date: '2026-01-14',
                source: 'exchange',
                location: 'CES Las Vegas'
            }
        },
        {
            id: 'contact_alice',
            name: 'Alice Wang',
            role: 'Designer',
            company: 'TechCorp',
            avatar: 'A',
            avatarColor: '#f093fb',
            phone: '+1 234-567-8902',
            email: 'alice@techcorp.com',
            pendingActions: 1,
            firstContact: {
                date: '2026-01-10',
                source: 'scan',
                location: 'Tech Summit'
            }
        },
        {
            id: 'contact_bob',
            name: 'Bob Smith',
            role: 'Sales Director',
            company: 'Acme Corp',
            avatar: 'B',
            avatarColor: '#11998e',
            pendingActions: 1
        },
        {
            id: 'contact_charlie',
            name: 'Charlie Brown',
            role: 'Legal Counsel',
            company: 'LawFirm Inc',
            avatar: 'C',
            avatarColor: '#f5576c',
            pendingActions: 1
        }
    ],

    // Meetings
    meetings: [
        {
            id: 'meeting_001',
            title: 'Product Design Sync',
            date: '2026-01-15',
            time: '11:30',
            duration: 45,
            type: 'meeting',
            template: '通用',
            language: 'Chinese',
            contactIds: ['contact_kevin', 'contact_alice'],
            // Detailed summary structure (matching screenshot)
            summaryData: {
                overview: '此次会议主要讨论了 Contact 页面的设计，重点在于如何将 meeting summary 与人名关联，以便于检索。',
                background: {
                    participants: 'Kevin Chen, Alice Wang 及其他相关人员',
                    roles: 'Kevin (决策者)、Alice (讨论者)',
                    purpose: '讨论 Contact 页面的设计方案'
                },
                keyConclusions: [
                    '将 meeting summary 与 Contact 页面的人名关联',
                    '需要 UI 设计和 PD 描述支持'
                ],
                topics: [
                    {
                        title: 'Contact 页面设计',
                        opinion: '将 meeting summary 与人名关联，方便检索',
                        detail: '"我觉得这里应该把所有的 meeting summary 和 contact 页面的人名关联在一起，然后方便我们以后的检索。"'
                    },
                    {
                        title: '下一步行动',
                        opinion: '需要 UI 设计和 PD 描述',
                        detail: '"我觉得接下来就是让 UI rux 的小伙伴一起设计一下，然后让 PD 同学出一份 PRD 关于这个东西的描述。"',
                        conclusion: '明确了下一步的具体行动'
                    }
                ],
                risks: [],
                highlights: [
                    '"我觉得这里应该把所有的 meeting summary 和 contact 页面的人名关联在一起，然后方便我们以后的检索。"',
                    '"我完全同意你的观点，那接下来我该怎么做呢？"',
                    '"我觉得接下来就是让 UI rux 的小伙伴一起设计一下，然后让 PD 同学出一份 PRD 关于这个东西的描述。"'
                ],
                nextActions: [
                    'UI 设计团队进行设计',
                    'PD 团队撰写 PRD 描述'
                ]
            },
            summary: 'Discussed the product roadmap for Q1 2026. Key focus areas include RWA compliance requirements, demo scheduling for enterprise clients, integration timeline with partner platforms, and budget allocation for marketing initiatives.',
            transcript: '[00:00] Kevin: Thanks for joining...\n[00:15] Alice: Let\'s discuss the roadmap...',
            actionIds: ['action_001', 'action_002']
        },
        {
            id: 'meeting_002',
            title: 'Sales Review Call',
            date: '2026-01-15',
            time: '10:00',
            duration: 30,
            type: 'voice',
            contactIds: ['contact_bob'],
            summary: 'Reviewed Q4 sales performance and discussed targets for Q1.',
            actionIds: []
        },
        {
            id: 'meeting_003',
            title: 'Agent Call - Partnership Inquiry',
            date: '2026-01-15',
            time: '09:30',
            duration: 5,
            type: 'call',
            contactIds: [],
            summary: 'Incoming call asking about partnership opportunities.',
            voicemail: 'Hi, this is John from ABC Corp. Please call me back regarding potential partnership.',
            actionIds: ['action_004']
        },
        {
            id: 'meeting_004',
            title: 'Legal Review',
            date: '2026-01-10',
            time: '14:00',
            duration: 60,
            type: 'meeting',
            contactIds: ['contact_charlie'],
            summary: 'Reviewed contract terms and compliance requirements.',
            actionIds: ['action_005']
        },
        {
            id: 'meeting_005',
            title: 'Strategy Meeting',
            date: '2026-01-14',
            time: '16:00',
            duration: 90,
            type: 'meeting',
            contactIds: [],
            summary: 'Internal strategy discussion for Q1 planning.',
            actionIds: ['action_006']
        }
    ],

    // Actions
    actions: [
        {
            id: 'action_001',
            title: 'Follow up with Kevin and Alice on RWA compliance',
            status: 'pending',
            contactIds: ['contact_kevin', 'contact_alice'],  // 多联系人
            meetingId: 'meeting_001',
            dueDate: '2026-01-17',
            createdAt: '2026-01-15T11:30:00',
            source: 'ai_extracted',
            aiSuggested: true
        },
        {
            id: 'action_002',
            title: 'Send updated proposal to team',
            status: 'pending',
            contactIds: ['contact_alice', 'contact_bob', 'contact_charlie'],  // 多联系人 (3人)
            meetingId: 'meeting_001',
            dueDate: '2026-01-15', // Today
            createdAt: '2026-01-15T11:30:00',
            source: 'ai_extracted',
            aiSuggested: true
        },
        {
            id: 'action_003',
            title: 'Schedule demo for Acme Corp',
            status: 'pending',
            contactIds: ['contact_bob', 'contact_kevin'],  // 多联系人
            meetingId: 'meeting_002',
            dueDate: '2026-01-18',
            createdAt: '2026-01-15T10:00:00',
            source: 'manual'
        },
        {
            id: 'action_004',
            title: 'Call back regarding partnership inquiry',
            status: 'pending',
            contactIds: [],
            meetingId: 'meeting_003',
            dueDate: null,
            createdAt: '2026-01-15T09:30:00',
            source: 'ai_extracted',  // Auto-generated follow up
            aiSuggested: true
        },
        {
            id: 'action_005',
            title: 'Reply to legal team about contract terms',
            status: 'pending',
            contactIds: ['contact_charlie'],
            meetingId: 'meeting_004',
            dueDate: '2026-01-13', // Overdue
            createdAt: '2026-01-10T14:00:00',
            source: 'ai_extracted',
            aiSuggested: true
        },
        {
            id: 'action_006',
            title: 'Research competitor pricing strategy',
            status: 'pending',
            contactIds: [],
            meetingId: 'meeting_005',
            dueDate: null,
            createdAt: '2026-01-14T16:00:00',
            source: 'manual'
        },
        {
            id: 'action_010',
            title: 'Contact investor for Q1 planning',
            status: 'pending',
            contactIds: [],
            meetingId: null,
            dueDate: '2026-01-14', // Overdue
            createdAt: '2026-01-12T09:00:00',
            source: 'manual'
        },
        // Completed actions
        {
            id: 'action_007',
            title: 'Send meeting notes to team',
            status: 'completed',
            contactIds: [],
            meetingId: 'meeting_001',
            dueDate: '2026-01-15',
            createdAt: '2026-01-15T11:30:00',
            completedAt: '2026-01-15T14:00:00',
            source: 'manual'
        },
        {
            id: 'action_008',
            title: 'Prepare Q4 presentation',
            status: 'completed',
            contactIds: [],
            meetingId: null,
            dueDate: '2026-01-14',
            createdAt: '2026-01-12T09:00:00',
            completedAt: '2026-01-14T15:30:00',
            source: 'manual'
        },
        {
            id: 'action_009',
            title: 'Review budget proposal',
            status: 'completed',
            contactIds: [],
            meetingId: null,
            dueDate: '2026-01-14',
            createdAt: '2026-01-13T10:00:00',
            completedAt: '2026-01-14T10:15:00',
            source: 'manual'
        }
    ],

    // Helper functions
    getContact(id) {
        return this.contacts.find(c => c.id === id);
    },

    getMeeting(id) {
        return this.meetings.find(m => m.id === id);
    },

    getAction(id) {
        return this.actions.find(a => a.id === id);
    },

    getPendingActions() {
        return this.actions.filter(a => a.status === 'pending');
    },

    getCompletedActions() {
        return this.actions.filter(a => a.status === 'completed');
    },

    getActionsForContact(contactId) {
        return this.actions.filter(a => a.contactIds.includes(contactId));
    },

    getActionsForMeeting(meetingId) {
        return this.actions.filter(a => a.meetingId === meetingId);
    },

    getTodayMeetings() {
        const today = '2026-01-15'; // Mock today
        return this.meetings.filter(m => m.date === today);
    },

    // Action operations
    completeAction(actionId) {
        const action = this.getAction(actionId);
        if (action) {
            action.status = 'completed';
            action.completedAt = new Date().toISOString();
        }
        return action;
    },

    addAction(data) {
        const newAction = {
            id: 'action_' + Date.now(),
            title: data.title,
            status: 'pending',
            contactIds: data.contactIds || [],
            meetingId: data.meetingId || null,
            dueDate: data.dueDate || null,
            createdAt: new Date().toISOString(),
            source: 'manual'
        };
        this.actions.unshift(newAction);
        return newAction;
    },

    updateActionDueDate(actionId, dueDate) {
        const action = this.getAction(actionId);
        if (action) {
            action.dueDate = dueDate;
        }
        return action;
    }
};

// Date helpers
const DateHelper = {
    today: '2026-01-15', // Mock today for demo

    isToday(dateStr) {
        return dateStr === this.today;
    },

    isOverdue(dateStr) {
        if (!dateStr) return false;
        return dateStr < this.today;
    },

    isThisWeek(dateStr) {
        if (!dateStr) return false;
        // Simplified: within 7 days
        const date = new Date(dateStr);
        const today = new Date(this.today);
        const diff = (date - today) / (1000 * 60 * 60 * 24);
        return diff > 0 && diff <= 7;
    },

    formatDate(dateStr) {
        if (!dateStr) return '';
        const date = new Date(dateStr);
        const options = { month: 'short', day: 'numeric' };
        return date.toLocaleDateString('en-US', options);
    },

    formatDateTime(dateTimeStr) {
        if (!dateTimeStr) return '';
        const date = new Date(dateTimeStr);
        const options = { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' };
        return date.toLocaleDateString('en-US', options);
    },

    getDayOfWeek(dateStr) {
        if (!dateStr) return '';
        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const date = new Date(dateStr);
        return days[date.getDay()];
    },

    getRelativeTime(dateTimeStr) {
        if (!dateTimeStr) return '';
        const date = new Date(dateTimeStr);
        const now = new Date(this.today + 'T16:00:00'); // Mock current time
        const diff = (now - date) / 1000; // seconds

        if (diff < 3600) return Math.floor(diff / 60) + 'm ago';
        if (diff < 86400) return Math.floor(diff / 3600) + 'h ago';
        return this.formatDate(dateTimeStr);
    }
};
