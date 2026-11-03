/* Busolya API client.
   One small helper used by the public forms. The API base is the Render service;
   on a local preview (or when window.BUSOLYA_API_URL is set) it points at the
   local server instead. Every call fails softly: pages keep working offline. */
(function () {
  var host = location.hostname;
  var local = host === 'localhost' || host === '127.0.0.1' || host === '' || host === '0.0.0.0';
  var base = window.BUSOLYA_API_URL || (local ? 'http://localhost:10000' : 'https://busolya-api.onrender.com');

  function parse(res) {
    return res.text().then(function (text) {
      var data = null;
      try { data = text ? JSON.parse(text) : null; } catch (e) { data = null; }
      if (!res.ok) {
        var message = (data && data.error) || ('HTTP ' + res.status);
        throw new Error(message);
      }
      return data;
    });
  }

  window.BUSOLYA = {
    url: base,
    get: function (path) {
      return fetch(base + path, { headers: { Accept: 'application/json' } }).then(parse);
    },
    post: function (path, body) {
      return fetch(base + path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(body)
      }).then(parse);
    }
  };
})();
