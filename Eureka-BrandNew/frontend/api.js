/**
 * Eureka API client — attached to window.API
 * Override backend URL: localStorage.setItem('EUREKA_API', 'http://localhost:8000')
 */
(function () {
  const BASE = () => localStorage.getItem('EUREKA_API') || 'http://localhost:8000';

  async function _post(path, body) {
    const res = await fetch(`${BASE()}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  }

  async function _get(path, params = {}) {
    const filtered = Object.fromEntries(
      Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '')
    );
    const qs = new URLSearchParams(filtered).toString();
    const res = await fetch(`${BASE()}${path}${qs ? '?' + qs : ''}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  }

  window.API = {
    // Flash note → agent pipeline
    sendFlash: (text, sessionId = '') =>
      _post('/api/flash', { text, session_id: sessionId }),

    // Assets
    getAssets: ({ type, field, op, value, contains, limit } = {}) =>
      _get('/api/assets', { type, field, op, value, contains, limit }),
    getAsset: (id) => _get(`/api/assets/${id}`),
    createAsset: (assetType, payload, sessionId = '') =>
      _post('/api/assets', { asset_type: assetType, payload, session_id: sessionId }),

    // Sessions
    getSessions: ({ date, sessionType, limit } = {}) =>
      _get('/api/sessions', { date, session_type: sessionType, limit }),
    getSession: (id) => _get(`/api/sessions/${id}`),
    getTodaySessions: () => {
      const today = new Date().toISOString().slice(0, 10);
      return _get('/api/sessions', { date: today, session_type: 'daily' });
    },

    // Global Q&A
    askAgent: (question) => _post('/api/query', { question }),

    // Health check
    ping: () => _get('/health'),
  };
})();
