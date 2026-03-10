/**
 * Intent Router for BizCard 2.0 (Post-ASR Processing)
 * 
 * This module is responsible for analyzing the ASR transcript from the E-ink hardware's
 * long-press voice input. It determines whether the user's intent is to save a voice memo 
 * (content precipitation) or execute a command (Ask Agent intent).
 */

class IntentRouter {
    constructor(agent, database) {
        this.agent = agent; // Ask Agent system
        this.db = database; // Local or remote database (AppData in demo)
    }

    /**
     * Process the incoming ASR transcript.
     * @param {string} transcript - The text from speech recognition.
     * @param {string} userId - The current user's ID.
     * @returns {Promise<Object>} - The routing result and action taken.
     */
    async route(transcript, userId) {
        console.log(`[Intent Router] Received ASR transcript: "${transcript}"`);
        
        // 1. Analyze Intent using a lightweight LLM prompt or heuristics
        const intent = await this._analyzeIntent(transcript);
        
        console.log(`[Intent Router] Detected Intent: ${intent.type}`);

        // 2. Route to appropriate pipeline
        if (intent.type === 'COMMAND') {
            return await this._handleCommandIntent(transcript, userId);
        } else {
            return await this._handleMemoIntent(transcript, userId);
        }
    }

    /**
     * Determine intent type based on transcript content.
     * In a real implementation, this would call an LLM with a specific prompt.
     * @param {string} text 
     * @returns {Promise<Object>}
     */
    async _analyzeIntent(text) {
        // Mock heuristics for demo purposes
        const commandKeywords = ['帮我', '查询', '发邮件', '提醒我', '寻找', '找一下', '告诉我', '调用'];
        const isCommand = commandKeywords.some(keyword => text.includes(keyword));

        if (isCommand) {
            return { type: 'COMMAND' };
        } else {
            return { type: 'MEMO' };
        }
    }

    /**
     * Pipeline A: Memo Intent (Content Precipitation)
     * Drops a VOICE_MEMO note into the database and generates reminders.
     */
    async _handleMemoIntent(transcript, userId) {
        // 1. Generate summary and extract reminders via LLM
        const summary = `Generated summary for: ${transcript.substring(0, 30)}...`;
        const extractedReminders = [
            { title: 'Follow up on the new idea', type: 'auto-extracted' }
        ];

        // 2. Save as Note in database
        const newNote = {
            id: `note_${Date.now()}`,
            title: `Voice Memo: ${transcript.substring(0, 15)}...`,
            date: new Date().toISOString().split('T')[0],
            time: new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' }),
            type: 'VOICE_MEMO',
            contactIds: ['self'],
            summary: summary,
            transcript: transcript,
            actionIds: []
        };

        // Mock DB save
        if (this.db && this.db.notes) {
            this.db.notes.unshift(newNote);
        }

        return {
            status: 'success',
            routedTo: 'MEMO_PIPELINE',
            note: newNote,
            message: 'Voice memo saved successfully.'
        };
    }

    /**
     * Pipeline B: Command Intent (Ask Agent)
     * Passes the transcript to the Ask Agent for execution and logs history.
     */
    async _handleCommandIntent(transcript, userId) {
        // 1. Pass to Agent to execute Skills (e.g., bizcard-search)
        let agentResponse;
        if (this.agent && typeof this.agent.execute === 'function') {
            agentResponse = await this.agent.execute(transcript);
        } else {
            agentResponse = { result: `Mock agent execution for: ${transcript}` };
        }

        // 2. Save to Command History for traceability in App
        const historyRecord = {
            id: `cmd_${Date.now()}`,
            timestamp: new Date().toISOString(),
            query: transcript,
            response: agentResponse,
            userId: userId
        };

        // Mock history save
        if (this.db && !this.db.commandHistory) {
            this.db.commandHistory = [];
        }
        if (this.db) {
            this.db.commandHistory.unshift(historyRecord);
        }

        return {
            status: 'success',
            routedTo: 'COMMAND_PIPELINE',
            historyRecord: historyRecord,
            agentResponse: agentResponse,
            message: 'Command executed by Ask Agent.'
        };
    }
}

// Export for module usage (CommonJS/ES6)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = IntentRouter;
}
