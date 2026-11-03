/* Busolya network link map — production + local dev.
   components.js reads window.NETWORK to wire [data-net] links. */
var NETWORK = {
  baf:   'https://busolya-agro-farmers.onrender.com',
  bae:   'https://bataka-agro-expo.onrender.com',
  sacco: 'https://abataka-mutindo-sacco.onrender.com',
  biz:   'https://busolya-agro-farmers.onrender.com/directory.html'
};

(function () {
  var host  = location.hostname;
  var local = /^(localhost|127\.0\.0\.1|\[::1\]|0\.0\.0\.0)$/.test(host) || location.protocol === 'file:';
  if (local) {
    NETWORK.baf   = '/baf/';
    NETWORK.bae   = '/bae/';
    NETWORK.sacco = '/mutindo/';
    NETWORK.biz   = '/baf/directory.html';
  }
  document.querySelectorAll('[data-net]').forEach(function (a) {
    var key = a.getAttribute('data-net');
    if (NETWORK[key]) a.setAttribute('href', NETWORK[key]);
  });
})();
