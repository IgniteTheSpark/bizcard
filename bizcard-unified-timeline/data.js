/* global window */
// Mock data for the Unified Timeline prototype

window.__PROTO_DATA__ = {
  // Contacts with full details
  CONTACTS: [
    { 
      id: "c1", 
      name: "John Mitchell", 
      initials: "JM", 
      title: "CEO", 
      company: "TechVentures Inc.",
      department: "Executive",
      email: ["john.mitchell@techventures.com"],
      phone: ["+1 415 555 0101"],
      address: "San Francisco, CA",
      website: "www.techventures.com",
      tags: ["Investor", "Tech"],
      notes: ""
    },
    { 
      id: "c2", 
      name: "Kevin Du", 
      initials: "KD", 
      title: "CTO", 
      company: "Fintech Labs",
      department: "Engineering",
      email: ["kevin.du@fintechlabs.io"],
      phone: ["+1 650 555 0202"],
      address: "Palo Alto, CA",
      website: "www.fintechlabs.io",
      tags: ["Tech", "Blockchain"],
      notes: ""
    },
    { 
      id: "c3", 
      name: "Nancy Chen", 
      initials: "NC", 
      title: "Product Manager", 
      company: "BizCard Inc.",
      department: "Product",
      email: ["nancy.chen@bizcard.app"],
      phone: ["+1 408 555 0303"],
      address: "Cupertino, CA",
      website: "www.bizcard.app",
      tags: ["Product", "UX"],
      notes: ""
    },
    { 
      id: "c4", 
      name: "Sarah Williams", 
      initials: "SW", 
      title: "Partner", 
      company: "VC Capital",
      department: "Investment",
      email: ["sarah@vccapital.com", "sarah.w@gmail.com"],
      phone: ["+1 212 555 0404", "+1 917 555 0405"],
      address: "Manhattan, NY",
      website: "www.vccapital.com",
      tags: ["Investor", "Series A"],
      notes: ""
    },
    { 
      id: "c5", 
      name: "Mike Johnson", 
      initials: "MJ", 
      title: "Sales Director", 
      company: "DataCorp",
      department: "Sales",
      email: ["mike.j@datacorp.com"],
      phone: ["+1 310 555 0505"],
      address: "Los Angeles, CA",
      website: "www.datacorp.com",
      tags: ["B2B", "Enterprise"],
      notes: ""
    },
    { 
      id: "c6", 
      name: "Emily Zhang", 
      initials: "EZ", 
      title: "Lead Designer", 
      company: "CreativeCo",
      department: "Design",
      email: ["emily@creativeco.design"],
      phone: ["+1 415 555 0606"],
      address: "San Francisco, CA",
      website: "www.creativeco.design",
      tags: ["Design", "UI/UX"],
      notes: ""
    },
  ],
  
  // Pending actions with meeting and date associations
  ACTIONS: [
    { 
      id: "a1", 
      title: "Send follow-up email to John", 
      status: "pending", 
      source: "meeting", // meeting, call, manual
      relatedContactIds: ["c1"], 
      relatedTimelineItemId: "t1",
      relatedMeetingTitle: "Contact Exchange @ CES",
      relatedDate: "2026-01-08",
      createdAt: "2026-01-08T10:00:00.000Z" 
    },
    { 
      id: "a2", 
      title: "Prepare Q4 deck for Kevin", 
      status: "pending", 
      source: "meeting",
      relatedContactIds: ["c2"], 
      relatedTimelineItemId: "t4",
      relatedMeetingTitle: "Q4 Strategy Review",
      relatedDate: "2026-01-07",
      createdAt: "2026-01-07T15:00:00.000Z" 
    },
    { 
      id: "a3", 
      title: "Schedule demo with Sarah", 
      status: "pending", 
      source: "call",
      relatedContactIds: ["c4"], 
      relatedTimelineItemId: "t6",
      relatedMeetingTitle: "Investor Intro Call",
      relatedDate: "2026-01-06",
      createdAt: "2026-01-06T09:00:00.000Z" 
    },
    { 
      id: "a4", 
      title: "Review partnership contract", 
      status: "pending", 
      source: "call",
      relatedContactIds: ["c4", "c5"], 
      relatedTimelineItemId: "t2",
      relatedMeetingTitle: "Follow-up Call",
      relatedDate: "2026-01-08",
      createdAt: "2026-01-08T14:30:00.000Z" 
    },
    { 
      id: "a5", 
      title: "Share product roadmap with Nancy", 
      status: "pending", 
      source: "meeting",
      relatedContactIds: ["c3"], 
      relatedTimelineItemId: "t4",
      relatedMeetingTitle: "Q4 Strategy Review",
      relatedDate: "2026-01-07",
      createdAt: "2026-01-07T13:00:00.000Z" 
    },
    { 
      id: "a6", 
      title: "Draft proposal for new feature", 
      status: "pending", 
      source: "manual",
      relatedContactIds: [], 
      relatedTimelineItemId: null,
      relatedMeetingTitle: "",
      relatedDate: "2026-01-08",
      createdAt: "2026-01-08T09:00:00.000Z" 
    },
    { 
      id: "a7", 
      title: "Sync with Mike on enterprise deal", 
      status: "pending", 
      source: "manual",
      relatedContactIds: ["c5"], 
      relatedTimelineItemId: null,
      relatedMeetingTitle: "",
      relatedDate: "2026-01-09",
      createdAt: "2026-01-08T16:00:00.000Z" 
    },
    { 
      id: "a8", 
      title: "Review UI mockups", 
      status: "done", 
      source: "meeting",
      relatedContactIds: ["c6"], 
      relatedTimelineItemId: null,
      relatedMeetingTitle: "Design Review",
      relatedDate: "2026-01-05",
      createdAt: "2026-01-05T10:00:00.000Z" 
    },
    // System-generated reminders (relationship maintenance)
    { 
      id: "sys1", 
      title: "Reconnect with Emily", 
      status: "pending", 
      source: "system",
      relatedContactIds: ["c6"], 
      relatedTimelineItemId: null,
      relatedMeetingTitle: "",
      relatedDate: "2026-01-08",
      createdAt: "2026-01-08T08:00:00.000Z",
      systemMeta: {
        type: "reconnect",
        reason: "No contact in 30 days",
        lastContactDate: "2025-12-09",
        daysSinceContact: 30
      }
    },
    { 
      id: "sys2", 
      title: "Follow up with Kevin", 
      status: "pending", 
      source: "system",
      relatedContactIds: ["c2"], 
      relatedTimelineItemId: null,
      relatedMeetingTitle: "",
      relatedDate: "2026-01-08",
      createdAt: "2026-01-08T08:00:00.000Z",
      systemMeta: {
        type: "follow_up",
        reason: "2 weeks since last meeting",
        lastContactDate: "2025-12-25",
        daysSinceContact: 14
      }
    },
    { 
      id: "sys3", 
      title: "Check in with Sarah", 
      status: "pending", 
      source: "system",
      relatedContactIds: ["c4"], 
      relatedTimelineItemId: null,
      relatedMeetingTitle: "",
      relatedDate: "2026-01-07",
      createdAt: "2026-01-07T08:00:00.000Z",
      systemMeta: {
        type: "check_in",
        reason: "Important investor contact",
        priority: "high"
      }
    },
  ],
  
  // Timeline items
  TIMELINE: [
    // Today (Jan 8, 2026)
    {
      id: "t1",
      type: "card",
      timestamp: "2026-01-08T19:30:00.000Z",
      source: "hardware",
      title: "John Mitchell",
      summary: "CEO @ TechVentures Inc.",
      contactIds: ["c1"],
      status: "ready",
      actions: [],
      meta: { place: "CES Main Hall, Las Vegas", source: "nfc", isBizCardUser: true },
    },
    {
      id: "t2",
      type: "call",
      timestamp: "2026-01-08T14:00:00.000Z",
      source: "agent",
      title: "Follow-up Call",
      summary: "Discussed partnership terms. Need to review contract by Friday.",
      contactIds: ["c4", "c5"],
      status: "ready",
      actions: [],
      meta: { direction: "OUT", durationMin: 23 },
    },
    
    // Jan 7, 2026
    {
      id: "t4",
      type: "meeting",
      timestamp: "2026-01-07T12:00:00.000Z",
      source: "hardware",
      title: "Q4 Strategy Review",
      summary: "Discussed API integration, RWA compliance, and next demo schedule.",
      contactIds: ["c2", "c3"],
      status: "ready",
      actions: ["a2"],
      meta: { place: "Starbucks, Shibuya", durationMin: 45 },
    },
    {
      id: "t5",
      type: "cluster",
      timestamp: "2026-01-07T09:00:00.000Z",
      source: "system",
      title: "4 Quick Activities",
      summary: "",
      contactIds: ["c3", "c6"],
      status: "ready",
      actions: [],
      microMeta: {
        items: [
          { timestamp: "2026-01-07T09:15:00.000Z", who: "Emily", verb: "viewed your profile", color: "blue" },
          { timestamp: "2026-01-07T09:30:00.000Z", who: "Nancy", verb: "clicked on your deck", color: "purple" },
          { timestamp: "2026-01-07T09:45:00.000Z", who: "Kevin", verb: "sent contact request", color: "yellow" },
          { timestamp: "2026-01-07T10:00:00.000Z", who: "Emily", verb: "clicked on your LinkedIn", color: "purple" },
        ],
      },
    },
    
    // Jan 6, 2026
    {
      id: "t6",
      type: "call",
      timestamp: "2026-01-06T16:30:00.000Z",
      source: "agent",
      title: "Investor Intro Call",
      summary: "Initial call with Sarah about the Series A. Positive feedback overall.",
      contactIds: ["c4"],
      status: "ready",
      actions: ["a3"],
      meta: { direction: "IN", durationMin: 18 },
    },
    {
      id: "t7",
      type: "note",
      timestamp: "2026-01-06T11:00:00.000Z",
      source: "manual",
      title: "Product Roadmap Notes",
      summary: "Key features for v2.0: Unified Timeline, Action Hub, Hardware Sync.",
      contactIds: [],
      status: "ready",
      actions: [],
    },
    
    // Jan 5, 2026
    {
      id: "t8",
      type: "card",
      timestamp: "2026-01-05T14:00:00.000Z",
      source: "hardware",
      title: "Mike Johnson",
      summary: "Sales Director @ DataCorp",
      contactIds: ["c5"],
      status: "ready",
      actions: [],
      meta: { place: "CES Tech East Hall", source: "nfc", isBizCardUser: true },
    },
    {
      id: "t9",
      type: "card",
      timestamp: "2026-01-05T10:00:00.000Z",
      source: "manual",
      title: "Emily Zhang",
      summary: "Lead Designer @ CreativeCo",
      contactIds: ["c6"],
      status: "ready",
      actions: [],
      meta: { place: "Conference Lobby", source: "scan", isBizCardUser: false },
    },
  ],
  
  // Hardware state (initially disconnected for demo)
  HARDWARE: {
    connected: false,
    deviceName: "BizCard Pro",
    batteryPercent: 85,
    signalStrength: "strong", // strong | medium | weak
    nfcUrl: "bizcard.app/u/brian-roberts",
    nfcNote: "Opens my digital business card",
  },
  
  // User profile
  PROFILE: {
    name: "Brian Roberts",
    initials: "BR",
    title: "Product Lead",
    company: "BizCard",
    skills: ["Product Strategy", "UX Design", "AI/ML"],
    needs: ["Investors", "Partnerships"],
  },
};
