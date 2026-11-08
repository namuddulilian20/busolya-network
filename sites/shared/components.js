/* ============================================================
   Busolya Network — Shared Components  (production)
   Injects header + footer, wires per-site nav, manages auth
   state, and exposes BusolyaAuth for login/register pages.
   Vanilla JS — no build step, no CDN dependency.
============================================================ */
(function () {
  'use strict';

  /* ── Detect site ─────────────────────────────────────────── */
  var SITE_KEY = document.documentElement.getAttribute('data-site') || 'baf';

  /* ── Per-site configuration ──────────────────────────────── */
  var SITE_CONFIG = {
    baf: {
      title:    'Busolya Agro Farmers',
      subtitle: 'Ltd · Buganda, Uganda',
      logo:     'assets/logo.jpg',
      logoAlt:  'Busolya Agro Farmers Ltd',
      cta:      'Join the network',
      ctaHref:  'contact.html',
      footerContactHref: 'contact.html',
      footerContactLabel: 'Send an enquiry',
      /* per-site explore links shown in footer and nav */
      nav: [
        { href: 'index.html',     label: 'Home' },
        { href: 'about.html',     label: 'Abasolya &amp; Bataka' },
        { href: 'programs.html',  label: 'Programs' },
        { href: 'directory.html', label: 'Directory' },
        { href: 'blog.html',      label: 'Blog' },
        { href: 'contact.html',   label: 'Contact' },
        /* visitor requests live on the expo site — one form, one inbox */
        { href: '#', net: 'bae', path: 'questions.html', label: 'Make a request' }
      ],
      /* colour tokens applied inline */
      headerBorder:  '#e2d6c2',
      navActiveBg:   '#4a2311',
      navActiveText: '#ffffff',
      navHoverBg:    '#e6efe0',
      navHoverText:  '#1f5523',
      ctaBg:         '#2f7d32',
      ctaHoverBg:    '#1f5523',
      adminBg:       '#4a2311',
      supplierBg:    '#c68a2e',
      footerBg:      '#2f1a0e',
      footerText:    '#cdb9a5'
    },
    bae: {
      title:    'Bataka Agro Expo',
      subtitle: '4–8 November · Uganda',
      logo:     'assets/mark.svg',
      logoAlt:  'Bataka Agro Expo',
      cta:      'Register interest',
      ctaHref:  'visit.html',
      footerContactHref: 'visit.html',
      footerContactLabel: 'Register as visitor',
      nav: [
        { href: 'index.html',      label: 'Home' },
        { href: 'programme.html',  label: 'Programme' },
        { href: 'exhibitors.html', label: 'Exhibitors' },
        { href: 'questions.html',  label: 'Make a request' },
        { href: 'visit.html',      label: 'Visit' },
        { href: 'register.html',   label: 'Register' }
      ],
      headerBorder:  '#e2d6c2',
      navActiveBg:   '#9a3b2c',
      navActiveText: '#ffffff',
      navHoverBg:    '#fae8e5',
      navHoverText:  '#9a3b2c',
      ctaBg:         '#9a3b2c',
      ctaHoverBg:    '#7a2c1e',
      adminBg:       '#4a2311',
      supplierBg:    '#c68a2e',
      footerBg:      '#2f1a0e',
      footerText:    '#cdb9a5'
    },
    mutindo: {
      title:    'Abataka Mutindo SACCO',
      subtitle: 'Savings · Shares · Credit',
      logo:     'assets/amslogo.jpg',
      logoAlt:  'Abataka Mutindo SACCO',
      cta:      'Join SACCO',
      ctaHref:  '#membership',
      footerContactHref: 'register.html',
      footerContactLabel: 'Become a member',
      nav: [
        { href: 'index.html',    label: 'Home' },
        { href: 'index.html#network',    label: 'Network' },
        { href: 'index.html#membership', label: 'Membership' },
        { href: 'register.html', label: 'Register' },
        { href: 'login.html',    label: 'Member login' },
        { href: 'member-portal.html', label: 'Member portal' },
        /* visitor requests live on the expo site — one form, one inbox */
        { href: '#', net: 'bae', path: 'questions.html', label: 'Make a request' }
      ],
      headerBorder:  '#e6d5c8',
      navActiveBg:   '#8a2f24',
      navActiveText: '#ffffff',
      navHoverBg:    '#f0e2d8',
      navHoverText:  '#5e1f18',
      ctaBg:         '#8a2f24',
      ctaHoverBg:    '#5e1f18',
      adminBg:       '#5e1f18',
      supplierBg:    '#c68a2e',
      footerBg:      '#3a1712',
      footerText:    '#d9bfb4'
    }
  };

  var cfg = SITE_CONFIG[SITE_KEY] || SITE_CONFIG.baf;

  /* ── Cross-site nav links ────────────────────────────────── */
  /* A nav item may carry net + path instead of href, e.g. the BAF and
     SACCO "Make a request" entries that open the expo's request form.
     The absolute URL is the production fallback; wireNetwork() rewrites
     it to the same-origin path when running locally. */
  var NET_DEFAULT = {
    baf:   'https://busolya-agro-farmers.onrender.com',
    bae:   'https://bataka-agro-expo.onrender.com',
    sacco: 'https://abataka-mutindo-sacco.onrender.com'
  };

  function navHref (item) {
    if (!item.net) return item.href;
    var base = NET_DEFAULT[item.net] || '';
    return base + (item.path ? '/' + String(item.path).replace(/^\//, '') : '');
  }

  function navNetAttrs (item) {
    if (!item.net) return '';
    return ' data-net="' + item.net + '" data-net-path="' + (item.path || '') + '"';
  }

  function navActiveHref (item) {
    return (item.path || item.href || '').split('#')[0];
  }

  /* ── Auth helpers ────────────────────────────────────────── */
  function isAuthenticated () {
    try { return sessionStorage.getItem('busolya_auth') === '1'; } catch (e) { return false; }
  }
  function setAuthenticated (val) {
    try { sessionStorage.setItem('busolya_auth', val ? '1' : '0'); } catch (e) {}
  }
  function getUser () {
    try { return JSON.parse(sessionStorage.getItem('busolya_user') || 'null'); } catch (e) { return null; }
  }
  function setUser (u) {
    try { sessionStorage.setItem('busolya_user', u ? JSON.stringify(u) : null); } catch (e) {}
  }
  function isAdmin () {
    var u = getUser();
    return u && (u.role === 'admin' || u.role === 'employee');
  }
  function isSupplier () {
    var u = getUser();
    return u && u.role === 'supplier';
  }

  window.BusolyaAuth = {
    isAuthenticated: isAuthenticated,
    setAuthenticated: setAuthenticated,
    getUser: getUser,
    setUser: setUser,
    isAdmin: isAdmin,
    isSupplier: isSupplier,
    login: function (user, redirect) {
      setAuthenticated(true);
      setUser(user);
      /* Role-based redirect. A `?next=` passed from a public page wins for
         non-admin roles. */
      var nextParam = null;
      try {
        var np = new URLSearchParams(location.search).get('next');
        if (np && /^[A-Za-z0-9._~-]+\.html([?&][A-Za-z0-9._%+=~-]*)?$/.test(np)) nextParam = np;
      } catch (e) {}
      if (user.role === 'admin' || user.role === 'employee') {
        location.href = 'admin.html';
      } else if (user.role === 'supplier') {
        if (nextParam) location.href = nextParam;
        else if (redirect) location.href = redirect;
        else location.href = 'supplier-portal.html';
      } else if (nextParam) {
        location.href = nextParam;
      } else if (redirect) {
        location.href = redirect;
      } else {
        location.href = 'index.html';
      }
    },
    logout: function () {
      var API = (location.hostname === 'localhost' || location.hostname === '127.0.0.1' || location.protocol === 'file:')
        ? '' : 'https://busolya-api.onrender.com';
      fetch(API + '/api/auth/logout', { method: 'POST', credentials: 'include' }).catch(function () {});
      setAuthenticated(false);
      setUser(null);
      location.href = 'index.html';
    }
  };

  /* ── Path helpers ────────────────────────────────────────── */
  /* Each page is served from sites/<site>/*.html
     The shared folder is at sites/shared/ so the relative prefix
     is always '../shared/' from within a site folder.
     When served from file:// or a dev server at the repo root we
     detect the depth and adjust. */
  function sharedPrefix () {
    /* In production each static site is its own Render origin.
       We inline the header/footer at build time to avoid cross-origin
       fetches.  At dev time (same origin, file://) we compute the path. */
    if (location.protocol === 'file:') {
      var parts = location.pathname.replace(/\\/g, '/').split('/').filter(Boolean);
      /* parts looks like [..., 'sites', 'baf', 'index.html'] */
      var depth = parts.length;
      if (depth >= 2) return '../../shared/';
      return '../shared/';
    }
    /* Same-origin dev server (node serve, live-server, etc.) */
    if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
      /* pathname is /baf/index.html or /sites/baf/index.html */
      var p = location.pathname.replace(/\\/g, '/');
      if (p.indexOf('/sites/') === 0) return '../shared/';
      return '/shared/';
    }
    /* Production: each static site has its own Render origin.
       The shared files are NOT available cross-origin, so we
       inline the markup directly in buildHeader() / buildFooter()
       below instead of fetching. */
    return null;
  }

  /* ── Build header HTML inline (used in production) ──────── */
  function buildHeaderHTML () {
    var navItems = cfg.nav.map(function (item) {
      var active = location.pathname.endsWith(navActiveHref(item));
      var style = active
        ? 'background:' + cfg.navActiveBg + ';color:' + cfg.navActiveText
        : '';
      var hover = 'data-hbg="' + cfg.navHoverBg + '" data-htxt="' + cfg.navHoverText + '"';
      return '<li><a class="rounded-full px-3 py-2 text-sm font-semibold transition-colors" ' +
             'style="' + style + '" ' + hover + navNetAttrs(item) + ' href="' + navHref(item) + '">' + item.label + '</a></li>';
    }).join('');

    return '<header class="sticky top-0 z-40 border-b bg-[#fffdf8]/92 backdrop-blur" style="border-color:' + cfg.headerBorder + '">' +
      '<div class="mx-auto flex max-w-6xl flex-wrap items-center gap-2 px-5 py-2.5">' +

      /* Logo */
      '<a href="index.html" class="flex shrink-0 items-center gap-3" id="hdr-home">' +
        '<img src="' + cfg.logo + '" alt="' + cfg.logoAlt + '" class="h-12 w-12 rounded-full ring-2" style="--tw-ring-color:' + cfg.navActiveBg + '" id="hdr-logo">' +
        '<span class="leading-tight">' +
          '<span class="block font-display text-[1.05rem] font-bold" style="color:' + cfg.navActiveBg + '">' + cfg.title + '</span>' +
          '<span class="block text-[.66rem] uppercase tracking-[.18em] opacity-55">' + cfg.subtitle + '</span>' +
        '</span>' +
      '</a>' +

      /* Hamburger */
      '<button id="hdr-burger" aria-label="Open menu" aria-expanded="false" aria-controls="hdr-nav" ' +
        'class="ml-auto flex md:hidden flex-col gap-1.5 px-2 py-2 rounded" style="color:' + cfg.navActiveBg + '">' +
        '<span class="block h-0.5 w-5 bg-current rounded"></span>' +
        '<span class="block h-0.5 w-5 bg-current rounded"></span>' +
        '<span class="block h-0.5 w-5 bg-current rounded"></span>' +
      '</button>' +

      /* Nav */
      '<nav id="hdr-nav" class="hidden w-full order-last md:flex md:w-auto md:order-none md:ml-auto" role="navigation">' +
        '<ul class="flex flex-wrap items-center gap-1" id="hdr-nav-list">' + navItems + '</ul>' +
      '</nav>' +

      /* Account + network links in the mobile menu */
      '<div class="md:hidden border-t border-[#e2d6c2]/40 mt-3 pt-3 space-y-1 text-xs">' +
        '<span class="font-bold uppercase tracking-[.14em] text-ink/40 pl-1 block mb-1">Account</span>' +
        '<a href="login.html" class="block hover:bg-[#e6efe0] px-2 py-1 rounded transition-colors">Sign in</a>' +
        '<a href="supplier-login.html" class="block hover:bg-[#e6efe0] px-2 py-1 rounded transition-colors">Supplier login</a>' +
        '<a href="admin.html" class="block font-bold hover:bg-[#e6efe0] px-2 py-1 rounded transition-colors">Admin portal</a>' +
        '<button type="button" onclick="window.BusolyaAuth&&window.BusolyaAuth.logout()" class="block w-full text-left hover:bg-[#e6efe0] px-2 py-1 rounded transition-colors">Sign out</button>' +
        '<span class="font-bold uppercase tracking-[.14em] text-ink/40 pl-1 block mb-1 pt-2">Network</span>' +
        '<a href="https://busolya-agro-farmers.onrender.com" data-net="baf" class="block hover:bg-[#e6efe0] px-2 py-1 rounded transition-colors">Busolya Farmers</a>' +
        '<a href="https://bataka-agro-expo.onrender.com" data-net="bae" class="block hover:bg-[#fae8e5] px-2 py-1 rounded transition-colors">Bataka Expo</a>' +
        '<a href="https://abataka-mutindo-sacco.onrender.com" data-net="sacco" class="block hover:bg-[#fbe9e7] px-2 py-1 rounded transition-colors">Mutindo SACCO</a>' +
      '</div>' +

      /* Cross-site network links — always visible */
      '<div class="hidden md:flex items-center gap-3 text-xs border-l border-[#e2d6c2]/40 pl-3" id="hdr-network">' +
        '<span class="font-bold uppercase tracking-[.14em] text-ink/40">Network</span>' +
        '<a href="https://busolya-agro-farmers.onrender.com" data-net="baf" class="hover:text-leaf transition-colors">Busolya Farmers</a>' +
        '<a href="https://bataka-agro-expo.onrender.com" data-net="bae" class="hover:text-seal transition-colors">Bataka Expo</a>' +
        '<a href="https://abataka-mutindo-sacco.onrender.com" data-net="sacco" class="hover:text-maroon transition-colors">Mutindo SACCO</a>' +
      '</div>' +

      /* Auth cluster */
      '<div class="hidden md:flex items-center gap-2 shrink-0" id="hdr-auth">' +

        /* Supplier login — always visible when not signed in as supplier */
        '<a href="supplier-login.html" id="hdr-supplier-btn" ' +
          'class="rounded-full px-3 py-1.5 text-xs font-bold border transition-colors" ' +
          'style="color:' + cfg.supplierBg + ';border-color:' + cfg.supplierBg + '">' +
          'Supplier login' +
        '</a>' +

        /* Member login — always visible when not signed in */
        '<a href="login.html" id="hdr-login-btn" ' +
          'class="rounded-full px-3 py-1.5 text-xs font-semibold transition-colors" ' +
          'style="color:' + cfg.navActiveBg + '">' +
          'Sign in' +
        '</a>' +

        /* Signed-in user badge */
        '<span id="hdr-user-name" class="hidden rounded-full px-3 py-1.5 text-xs font-semibold" ' +
          'style="background:' + cfg.navHoverBg + ';color:' + cfg.navActiveBg + '">' +
        '</span>' +

        /* Supplier portal link — shown when supplier is signed in */
        '<a href="supplier-portal.html" id="hdr-supplier-portal" ' +
          'class="hidden rounded-full px-3 py-1.5 text-xs font-bold text-white transition-colors" ' +
          'style="background:' + cfg.supplierBg + '">' +
          'My portal' +
        '</a>' +

        /* Admin link — always visible; admin.html has its own password gate */
        '<a href="admin.html" id="hdr-admin-btn" title="Admin portal" ' +
          'class="rounded-full px-3 py-1.5 text-xs font-bold text-white transition-colors" ' +
          'style="background:' + cfg.adminBg + '">' +
          'Admin' +
        '</a>' +

        /* Sign out */
        '<button onclick="window.BusolyaAuth&&window.BusolyaAuth.logout()" id="hdr-logout-btn" ' +
          'class="hidden rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors" ' +
          'style="color:' + cfg.navActiveBg + ';border-color:' + cfg.navActiveBg + '">' +
          'Sign out' +
        '</button>' +

      '</div>' +

      /* CTA */
      '<a href="' + cfg.ctaHref + '" id="hdr-cta" ' +
        'class="hidden rounded-full px-5 py-2.5 text-sm font-bold text-white md:inline-block" ' +
        'style="background:' + cfg.ctaBg + '">' +
        cfg.cta +
      '</a>' +

    '</div></header>';
  }

  /* ── Build footer HTML inline ────────────────────────────── */
  function buildFooterHTML () {
    var exploreLinks = cfg.nav.map(function (item) {
      return '<li><a class="hover:text-gold transition-colors"' + navNetAttrs(item) + ' href="' + navHref(item) + '">' + item.label + '</a></li>';
    }).join('') +
      '<li><a class="hover:text-gold transition-colors" id="ftr-admin-link" href="admin.html">Admin portal</a></li>';

    return '<footer style="background:' + cfg.footerBg + ';color:' + cfg.footerText + '">' +
      '<div class="mx-auto grid max-w-6xl gap-8 px-5 py-12 md:grid-cols-4">' +

      /* Brand */
      '<div>' +
        '<div class="flex items-center gap-3">' +
          '<img src="' + cfg.logo + '" alt="" class="h-11 w-11 rounded-full">' +
          '<span class="font-display text-base font-bold text-white">' + cfg.title + '</span>' +
        '</div>' +
        '<p class="mt-3 text-sm">' + cfg.subtitle + '</p>' +
      '</div>' +

      /* Explore */
      '<div>' +
        '<h4 class="text-[.68rem] font-bold uppercase tracking-[.16em] text-white">Explore</h4>' +
        '<ul class="mt-3 space-y-2 text-sm">' + exploreLinks + '</ul>' +
      '</div>' +

      /* Network */
      '<div>' +
        '<h4 class="text-[.68rem] font-bold uppercase tracking-[.16em] text-white">Network</h4>' +
        '<ul class="mt-3 space-y-2 text-sm">' +
          '<li><a class="hover:text-gold transition-colors" href="#" data-net="baf">Busolya Agro Farmers</a></li>' +
          '<li><a class="hover:text-gold transition-colors" href="#" data-net="bae">Bataka Agro Expo</a></li>' +
          '<li><a class="hover:text-gold transition-colors" href="#" data-net="sacco">Abataka Mutindo SACCO</a></li>' +
          '<li><a class="hover:text-gold transition-colors" href="programs.html#farmaid">Farm Aid</a></li>' +
        '</ul>' +
      '</div>' +

      /* Portals */
      '<div>' +
        '<h4 class="text-[.68rem] font-bold uppercase tracking-[.16em] text-white">Portals</h4>' +
        '<ul class="mt-3 space-y-2 text-sm">' +
          '<li><a class="hover:text-gold transition-colors" href="login.html">Member sign in</a></li>' +
          '<li><a class="hover:text-gold transition-colors" href="supplier-login.html">Supplier login</a></li>' +
          '<li><a class="hover:text-gold transition-colors" href="register.html">Register</a></li>' +
          '<li><a class="hover:text-gold transition-colors" href="' + cfg.footerContactHref + '">' + cfg.footerContactLabel + '</a></li>' +
        '</ul>' +
      '</div>' +

    '</div>' +

    '<div style="border-top:1px solid rgba(255,255,255,.10)">' +
      '<div class="mx-auto flex max-w-6xl flex-wrap justify-between gap-3 px-5 py-5 text-xs">' +
        '<p id="ftr-copy">© 2026 ' + cfg.title + '</p>' +
        '<p>An annual fixture: Bataka Agro Expo · 4–8 November</p>' +
        '<p>Developed by <a class="hover:text-gold" href="mailto:digidanlpai@gmail.com">digidanlpai@gmail.com</a> · +256 731 235 987 / +256 780 698 353</p>' +
      '</div>' +
    '</div>' +

    '</footer>';
  }

  /* ── Wire hover events on nav items ─────────────────────── */
  function wireNavHover (nav) {
    if (!nav) return;
    nav.querySelectorAll('a[data-hbg]').forEach(function (a) {
      var origBg   = a.style.background || '';
      var origText = a.style.color      || '';
      var hBg      = a.getAttribute('data-hbg');
      var hTxt     = a.getAttribute('data-htxt');
      a.addEventListener('mouseenter', function () {
        if (!origBg) { a.style.background = hBg; a.style.color = hTxt; }
      });
      a.addEventListener('mouseleave', function () {
        if (!origBg) { a.style.background = ''; a.style.color = ''; }
      });
    });
  }

  /* ── Wire hamburger ──────────────────────────────────────── */
  function wireHamburger () {
    var btn = document.getElementById('hdr-burger');
    var nav = document.getElementById('hdr-nav');
    if (!btn || !nav) return;
    btn.addEventListener('click', function () {
      var open = btn.getAttribute('aria-expanded') === 'true';
      btn.setAttribute('aria-expanded', open ? 'false' : 'true');
      if (open) {
        nav.classList.add('hidden');
        nav.classList.remove('flex');
      } else {
        nav.classList.remove('hidden');
        nav.classList.add('flex', 'flex-col', 'pb-3');
      }
    });
  }

  /* ── Apply auth state to header ──────────────────────────── */
  function applyAuthState () {
    var loggedIn   = isAuthenticated();
    var user       = getUser();
    var adminRole  = isAdmin();
    var supplierRole = isSupplier();

    var supplierBtn    = document.getElementById('hdr-supplier-btn');
    var loginBtn       = document.getElementById('hdr-login-btn');
    var userNameEl     = document.getElementById('hdr-user-name');
    var logoutBtn      = document.getElementById('hdr-logout-btn');
    var adminBtn       = document.getElementById('hdr-admin-btn');
    var supplierPortal = document.getElementById('hdr-supplier-portal');
    var ftrAdmin       = document.getElementById('ftr-admin-link');

    /* The admin entry points stay visible at all times; admin.html asks for
       the ADMIN_PASSWORD itself, so hiding the link only hid the way in. */
    if (adminBtn) adminBtn.style.display = 'inline';
    if (ftrAdmin) ftrAdmin.style.display = '';

    if (!loggedIn) {
      if (supplierBtn)    supplierBtn.style.display    = 'inline';
      if (loginBtn)       loginBtn.style.display       = 'inline';
      if (userNameEl)     userNameEl.style.display     = 'none';
      if (logoutBtn)      logoutBtn.style.display      = 'none';
      if (supplierPortal) supplierPortal.style.display = 'none';
    } else {
      if (loginBtn)  loginBtn.style.display  = 'none';
      if (logoutBtn) logoutBtn.style.display = 'inline';
      if (userNameEl) {
        userNameEl.style.display = 'inline';
        userNameEl.textContent = (user && user.name ? user.name : (user && user.phone ? user.phone : 'User'));
      }

      /* supplier: show their portal */
      if (supplierRole) {
        if (supplierBtn)    supplierBtn.style.display    = 'none';
        if (supplierPortal) supplierPortal.style.display = 'inline';
      }

      /* admin / employee: hide the supplier entry points */
      if (adminRole) {
        if (supplierBtn)    supplierBtn.style.display    = 'none';
        if (supplierPortal) supplierPortal.style.display = 'none';
      }

      /* member / customer: just signed-in state */
      if (!adminRole && !supplierRole) {
        if (supplierBtn)    supplierBtn.style.display    = 'none';
        if (supplierPortal) supplierPortal.style.display = 'none';
      }
    }
  }

  /* ── Wire data-net links (cross-site URLs) ───────────────── */
  function wireNetwork () {
    /* NETWORK may already be set by network.js — respect it */
    var NET = window.NETWORK || {
      baf:   'https://busolya-agro-farmers.onrender.com',
      bae:   'https://bataka-agro-expo.onrender.com',
      sacco: 'https://abataka-mutindo-sacco.onrender.com'
    };
    var local = /^(localhost|127\.0\.0\.1|\[::1\]|0\.0\.0\.0)$/.test(location.hostname) || location.protocol === 'file:';
    if (local) { NET.baf = '/baf/'; NET.bae = '/bae/'; NET.sacco = '/mutindo/'; }

    document.querySelectorAll('[data-net]').forEach(function (a) {
      var key  = a.getAttribute('data-net');
      var path = a.getAttribute('data-net-path');
      if (!NET[key]) return;
      a.setAttribute('href', path
        ? NET[key].replace(/\/$/, '') + '/' + String(path).replace(/^\//, '')
        : NET[key]);
    });
  }

  /* ── Fetch from shared folder (dev only) ─────────────────── */
  function fetchShared (prefix) {
    return Promise.all([
      fetch(prefix + 'header.html', { cache: 'no-store' }).then(function (r) { return r.text(); }),
      fetch(prefix + 'footer.html', { cache: 'no-store' }).then(function (r) { return r.text(); })
    ]);
  }

  /* ── Fill the dev-mode fragments from SITE_CONFIG ────────── */
  /* header.html / footer.html are site-agnostic shells. Everything that
     differs per site is applied here, so local pages get the same nav,
     logo, title and CTA as the inlined production markup. */
  function fillFromConfig () {
    var list = document.getElementById('hdr-nav-list');
    if (list && !list.children.length) {
      list.innerHTML = cfg.nav.map(function (item) {
        return '<li><a class="rounded-full px-3 py-2 text-sm font-semibold transition-colors" ' +
          'data-hbg="' + cfg.navHoverBg + '" data-htxt="' + cfg.navHoverText + '"' + navNetAttrs(item) +
          ' href="' + navHref(item) + '">' + item.label + '</a></li>';
      }).join('');
    }

    var title = document.getElementById('hdr-title');
    if (title) title.innerHTML = cfg.title;
    var subtitle = document.getElementById('hdr-subtitle');
    if (subtitle) subtitle.textContent = cfg.subtitle;

    var logo = document.getElementById('hdr-logo');
    if (logo) {
      logo.src = cfg.logo;
      logo.alt = cfg.logoAlt;
      logo.style.setProperty('--tw-ring-color', cfg.navActiveBg);
    }

    var cta = document.getElementById('hdr-cta');
    if (cta) {
      cta.textContent = cfg.cta;
      cta.href = cfg.ctaHref;
      cta.style.background = cfg.ctaBg;
    }

    var ftrLogo = document.getElementById('ftr-logo');
    if (ftrLogo) { ftrLogo.src = cfg.logo; ftrLogo.alt = ''; }
    var ftrBrand = document.getElementById('ftr-brand');
    if (ftrBrand) ftrBrand.textContent = cfg.title;
    var ftrCopy = document.getElementById('ftr-copy');
    if (ftrCopy) ftrCopy.textContent = '\u00A9 2026 ' + cfg.title;

    var explore = document.getElementById('ftr-explore');
    if (explore && !explore.querySelector('[data-ftr-nav]')) {
      explore.insertAdjacentHTML('afterbegin', cfg.nav.map(function (item) {
        return '<li data-ftr-nav><a class="hover:text-gold transition-colors"' + navNetAttrs(item) +
          ' href="' + navHref(item) + '">' + item.label + '</a></li>';
      }).join(''));
    }
  }

  /* ── Inject into placeholders ────────────────────────────── */
  function inject (headerHTML, footerHTML) {
    var hPh = document.getElementById('header-placeholder');
    var fPh = document.getElementById('footer-placeholder');
    if (hPh) hPh.innerHTML = headerHTML;
    if (fPh) fPh.innerHTML = footerHTML;
    fillFromConfig();
    wireHamburger();
    wireNavHover(document.getElementById('hdr-nav'));
    wireNetwork();
    applyAuthState();
  }

  /* ── Embossed visual treatment ───────────────────────────── */
  /* Glossy panels and buttons in the Tmall style: vertical gradient,
     an inner top-left highlight, a shade at the bottom edge and a soft
     outer shadow — built from each site's own palette. */
  function hexMix (hex, target, pct) {
    var h = hex.replace('#', '');
    if (h.length === 3) h = h.split('').map(function (c) { return c + c; }).join('');
    var t = target === 'w' ? [255, 255, 255] : [26, 13, 6];
    var out = '#';
    for (var i = 0; i < 3; i++) {
      var v = parseInt(h.substr(i * 2, 2), 16);
      var m = Math.round(v + (t[i] - v) * pct / 100);
      out += m.toString(16).padStart(2, '0');
    }
    return out;
  }

  function applyEmboss () {
    if (document.getElementById('bsl-emboss')) return;
    var gold = cfg.supplierBg;
    /* Tailwind palettes are configured identically on every page,
       so key the gradients on the class token itself. */
    var COLORS = {
      'bg-leaf':     '#2f7d32',
      'bg-leafdark': '#1f5523',
      'bg-bark':     '#4a2311',
      'bg-bark2':    '#63301a',
      'bg-seal':     '#a8321e',
      'bg-gold':     '#c68a2e',
      'bg-maroon':   '#8a2f24',
      'bg-maroon2':  '#5e1f18'
    };

    var btnSel = [], btnUp = {}, btnDn = {}, btnGlow = {}, sec = [], dark = [];
    Object.keys(COLORS).forEach(function (token) {
      var c = COLORS[token];
      btnUp[token] = hexMix(c, 'w', 24);
      btnDn[token] = hexMix(c, 'd', 32);
      var r = parseInt(c.substr(1, 2), 16), g = parseInt(c.substr(3, 2), 16), b = parseInt(c.substr(5, 2), 16);
      btnGlow[token] = r + ',' + g + ',' + b;
      var sel = 'a[class~="' + token + '"], button[class~="' + token + '"]';
      btnSel.push(sel);
      if (COLORS[token] === c) sec.push('[class~="' + token + '"]');
      dark.push(sel);
    });

    /* Thick Tmall-style buttons: glass gloss on top of a saturated
       brand gradient, a solid darker lip at the bottom for depth,
       then a springy hover that leans forward and pops. */
    var parts = [];
    btnSel.forEach(function (sel) {
      var token = sel.match(/\[class~="([^"]+)"\]/)[1];
      parts.push(sel + ' { background-image:' +
        ' linear-gradient(180deg, rgba(255,255,255,.30) 0%, rgba(255,255,255,.05) 42%, rgba(0,0,0,.16) 100%),' +
        ' linear-gradient(165deg, ' + btnUp[token] + ' 0%, ' + COLORS[token] + ' 45%, ' + btnDn[token] + ' 100%) !important;' +
        ' box-shadow: inset 0 2px 1px rgba(255,255,255,.42), inset 0 -3px 5px rgba(0,0,0,.28),' +
        ' 0 4px 0 rgba(0,0,0,.30), 0 14px 26px -10px rgba(' + btnGlow[token] + ',.55); }');
      parts.push(sel + ':hover { box-shadow: inset 0 2px 1px rgba(255,255,255,.5), inset 0 -3px 5px rgba(0,0,0,.24),' +
        ' 0 7px 0 rgba(0,0,0,.26), 0 20px 34px -10px rgba(' + btnGlow[token] + ',.6); }');
      parts.push(sel + ':active { box-shadow: inset 0 3px 6px rgba(0,0,0,.3),' +
        ' 0 1px 0 rgba(0,0,0,.3), 0 4px 10px -6px rgba(' + btnGlow[token] + ',.5); }');
    });

    var css = [
      '/* Busolya embossed layer - injected by components.js */',
      parts.join('\n'),
      dark.join(',\n') + ' {',
      '  text-shadow: 0 1px 1px rgba(0,0,0,.25);',
      '  border: 1px solid rgba(0,0,0,.22) !important;',
      '  transition: transform .28s cubic-bezier(.3,1.8,.45,1), box-shadow .28s cubic-bezier(.3,1.8,.45,1), filter .2s ease;',
      '  will-change: transform;',
      '}',
      dark.join(':hover,\n') + ':hover {',
      '  transform: translateY(-4px) scale(1.05); filter: brightness(1.08);',
      '}',
      dark.join(':active,\n') + ':active {',
      '  transform: translateY(2px) scale(.97);',
      '}',

      /* cards and paper panels: raised paper with a highlighted rim */
      '[class~="bg-paper"] {',
      '  background-image: linear-gradient(165deg, #fffdfa 0%, #fffdf8 60%, ' + hexMix('#fffdf8', 'd', 4) + ' 100%);',
      '  box-shadow: inset 0 1px 0 rgba(255,255,255,.85), inset 0 0 0 1px rgba(255,255,255,.4),',
      '              0 1px 2px rgba(26,13,6,.06), 0 10px 26px -14px rgba(26,13,6,.28);',
      '  transition: transform .3s cubic-bezier(.3,1.8,.45,1), box-shadow .3s cubic-bezier(.3,1.8,.45,1);',
      '}',
      '[class~="bg-paper"]:hover {',
      '  transform: translateY(-3px);',
      '  box-shadow: inset 0 1px 0 rgba(255,255,255,.85), inset 0 0 0 1px rgba(255,255,255,.4),',
      '              0 2px 3px rgba(26,13,6,.06), 0 18px 34px -14px rgba(26,13,6,.35);',
      '}',

      /* dark section canvases: rich gradient with a warm glow */
      sec.join(',\n') + ' {',
      '  background-image: radial-gradient(1100px 340px at 15% -12%, rgba(' + btnGlow['bg-gold'] + ',.38), transparent 62%),',
      '                    radial-gradient(900px 260px at 90% 110%, rgba(255,255,255,.12), transparent 55%) !important;',
      '  box-shadow: inset 0 1px 0 rgba(255,255,255,.16), inset 0 -18px 40px -20px rgba(0,0,0,.45);',
      '}',

      /* header: cream sheen, brand gradient strip on top, soft drop */
      '#hdr-root {',
      '  background-image: linear-gradient(178deg, rgba(255,255,255,.9), rgba(255,253,248,.65) 60%, rgba(226,214,194,.35)) !important;',
      '  box-shadow: 0 8px 22px -14px rgba(26,13,6,.35) !important;',
      '}',
      '#hdr-root::before {',
      '  content: ""; position: absolute; top: 0; left: 0; right: 0; height: 3px;',
      '  background: linear-gradient(90deg, ' + cfg.ctaBg + ', ' + gold + ', ' + hexMix(cfg.adminBg, 'd', 30) + ');',
      '  box-shadow: 0 1px 2px rgba(26,13,6,.25);',
      '  z-index: 10;',
      '}'
    ].join('\n');

    var st = document.createElement('style');
    st.id = 'bsl-emboss';
    st.textContent = css;
    document.head.appendChild(st);
  }

  /* ── Initialise ──────────────────────────────────────────── */
  function init () {
    applyEmboss();
    var prefix = sharedPrefix();

    if (prefix) {
      /* Dev / same-origin: fetch the HTML fragments */
      fetchShared(prefix).then(function (files) {
        inject(files[0], files[1]);
      }).catch(function () {
        /* Fallback to inline if fetch fails */
        inject(buildHeaderHTML(), buildFooterHTML());
      });
    } else {
      /* Production: each site is its own Render origin — build inline */
      inject(buildHeaderHTML(), buildFooterHTML());
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
