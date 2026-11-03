/* Busolya network API client. Vanilla JS, no build step.
   Posts demand / supply / linkage submissions, contact messages, and fetches
   reference data from the live backend. Falls back to localStorage when the
   API is unreachable so a dead network never loses an entry at the desk. */

(function () {
  var API = (location.hostname === 'localhost' || location.hostname === '127.0.0.1' || location.protocol === 'file:')
    ? ''
    : 'https://busolya-api.onrender.com';

  var LS_KEYS = {
    demand: 'baf-demand',
    supply: 'baf-supply',
    contact: 'baf-contact'
  };

  function ls(kind) {
    try { return JSON.parse(localStorage.getItem(LS_KEYS[kind]) || '[]'); } catch (e) { return []; }
  }
  function lsSave(kind, arr) {
    try { localStorage.setItem(LS_KEYS[kind], JSON.stringify(arr)); } catch (e) {}
  }

  function postJson(path, body) {
    return fetch(API + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    }).then(function (res) {
      if (!res.ok) return res.text().then(function (t) { throw new Error(res.status + ' ' + t); });
      return res.json();
    });
  }

  window.BUSOLYA = {
    apiBase: API,
    post: function (path, body) { return postJson(path, body).then(function (r) {
      return { ok: true, ref: r.ref, id: r.id, source: 'api' };
    }); },

    /* Submit a questionnaire lead (demand / supply / linkage). Tries the API
       first, falls back to localStorage, and returns { ref, id } or a local ref. */
    submit: function (kind, body) {
      return postJson('/api/submissions', body).then(function (r) {
        return { ok: true, ref: r.ref, id: r.id, source: 'api' };
      }).catch(function (err) {
        var rec = JSON.parse(JSON.stringify(body));
        rec.localRef = 'BAE-' + kind.slice(0,1).toUpperCase() + '-' + String(Date.now()).slice(-6);
        rec.source = rec.source || 'offline';
        var arr = ls(kind);
        arr.push(rec);
        lsSave(kind, arr);
        return { ok: false, ref: rec.localRef, id: null, source: 'local', error: err.message };
      });
    },

    contact: function (body) {
      return postJson('/api/contact', body).then(function () {
        return { ok: true, source: 'api' };
      }).catch(function (err) {
        var arr = ls('contact');
        arr.push(body);
        lsSave('contact', arr);
        return { ok: false, source: 'local', error: err.message };
      });
    },

    /* Public read-only endpoints. Return [] on failure so pages stay usable. */
    get: function (path) {
      return fetch(API + path, { headers: { 'Accept': 'application/json' } })
        .then(function (res) { if (!res.ok) throw new Error(res.status); return res.json(); })
        .catch(function () { return { ok: false, entries: [], questions: [], subjects: [], networks: [], stats: {} }; });
    },

    questions: function (kind) { return this.get('/api/questions/' + kind); },
    directory: function (q, sector) {
      var url = '/api/directory' + (q ? '?q=' + encodeURIComponent(q) : '') + (sector ? '&sector=' + encodeURIComponent(sector) : '');
      return this.get(url);
    },
    subjects: function () { return this.get('/api/subjects'); },
    networks: function () { return this.get('/api/networks'); },
    stats: function () { return this.get('/api/stats'); },
    governance: function () { return this.get('/api/governance'); }
  };
})();