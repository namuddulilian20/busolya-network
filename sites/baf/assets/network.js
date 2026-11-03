/* Busolya network link map.
   One place to wire the cross-site links: set a URL here and every
   [data-net] link on the page follows it.
   Production URLs are the Render static-site addresses; when the sites are
   served from a local preview or from one shared host, relative paths are
   used so the network is still navigable. */
const NETWORK = {
  baf: 'https://busolya-agro-farmers.onrender.com',
  bae: 'https://bataka-agro-expo.onrender.com',
  sacco: 'https://abataka-mutindo-sacco.onrender.com'
};

(function () {
  var host = location.hostname;
  var local = /^(localhost|127\.0\.0\.1|\[::1\]|0\.0\.0\.0)$/.test(host) || location.protocol === 'file:';
  if (local) {
    NETWORK.baf = '/baf/';
    NETWORK.bae = '/bae/';
    NETWORK.sacco = '/mutindo/';
  }

  document.querySelectorAll('[data-net]').forEach(function (a) {
    var key = a.getAttribute('data-net');
    var url = NETWORK[key];
    if (url) {
      a.setAttribute('href', url);
      a.removeAttribute('aria-disabled');
    } else {
      if (!a.getAttribute('href')) a.setAttribute('href', '#');
      a.setAttribute('aria-disabled', 'true');
      a.setAttribute('title', 'Link is wired when this site goes live');
    }
  });
})();
