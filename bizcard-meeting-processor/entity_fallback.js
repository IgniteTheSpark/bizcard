/**
 * Entity Fallback Auto-binding Module
 * 
 * Part of the Meeting Processor pipeline. This module attempts to automatically resolve
 * generic name mentions (like "冯总", "Kevin") extracted by the AI from the meeting transcript.
 * It compares the mentions against the user's personal CRM (Contacts list) and recent interactions.
 */

class EntityFallbackBinder {
    constructor(crmDatabase) {
        this.crm = crmDatabase; // Reference to user's contacts (e.g., AppData.contacts)
    }

    /**
     * Process a list of AI-extracted actions to auto-bind related mentions.
     * @param {Array} extractedActions - Array of action objects output by the LLM
     * @returns {Array} - The modified actions with resolved contact IDs
     */
    process(extractedActions) {
        if (!this.crm || !this.crm.contacts) {
            console.warn("[EntityFallback] CRM database not found. Skipping auto-binding.");
            return extractedActions;
        }

        return extractedActions.map(action => {
            if (action.related_mentions && action.related_mentions.length > 0) {
                // Initialize new arrays for resolved IDs and remaining unresolved mentions
                action.resolvedContactIds = action.resolvedContactIds || [];
                const unresolvedMentions = [];

                action.related_mentions.forEach(mention => {
                    const match = this._findBestMatch(mention);
                    
                    if (match.confidence === 'HIGH') {
                        console.log(`[EntityFallback] Silent binding: "${mention}" -> ${match.contact.name} (${match.contact.id})`);
                        action.resolvedContactIds.push(match.contact.id);
                    } else if (match.confidence === 'MEDIUM') {
                        console.log(`[EntityFallback] Fuzzy recommendation for: "${mention}" -> ${match.contact.name}. Requires user confirmation.`);
                        // Keep as string but append hint for UI to pick up
                        unresolvedMentions.push({
                            original: mention,
                            suggested_id: match.contact.id,
                            suggested_name: match.contact.name
                        });
                    } else {
                        console.log(`[EntityFallback] No match for: "${mention}". Leaving as unresolved.`);
                        unresolvedMentions.push({ original: mention });
                    }
                });

                // Update action with unresolved structure for UI rendering [❓ mention]
                action.unresolved_mentions = unresolvedMentions;
            }
            return action;
        });
    }

    /**
     * Searches the CRM for the best match for a given text mention.
     * @param {string} mention - The name/title mentioned (e.g., "冯总", "Alice")
     * @returns {Object} - Match result containing confidence level and contact object
     */
    _findBestMatch(mention) {
        const normalizedMention = mention.toLowerCase().trim();
        const contacts = this.crm.contacts;
        
        let bestMatch = null;
        let highestScore = 0;

        for (const contact of contacts) {
            const name = contact.name.toLowerCase();
            let score = 0;

            // 1. Exact Name Match
            if (name === normalizedMention) {
                score = 100;
            } 
            // 2. Partial/Surname/Title Match (e.g., "Kevin" -> "Kevin Chen", "冯总" -> "冯建国")
            // Very simplified heuristic for demo:
            else if (name.includes(normalizedMention) || normalizedMention.includes(name.split(' ')[0])) {
                score = 80;
            }
            // Chinese title heuristic: if mention ends with 总/哥 and starts with the same character as name
            else if ((normalizedMention.endsWith('总') || normalizedMention.endsWith('哥')) && 
                     name.charAt(0) === normalizedMention.charAt(0)) {
                score = 75; // e.g., "冯总" matches "冯建国"
            }

            if (score > highestScore) {
                highestScore = score;
                bestMatch = contact;
            }
        }

        if (highestScore >= 90) {
            return { confidence: 'HIGH', contact: bestMatch };
        } else if (highestScore >= 70) {
            // Might have multiple "冯总", or it's a partial match. Return MEDIUM confidence.
            return { confidence: 'MEDIUM', contact: bestMatch };
        }

        return { confidence: 'LOW', contact: null };
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = EntityFallbackBinder;
}
