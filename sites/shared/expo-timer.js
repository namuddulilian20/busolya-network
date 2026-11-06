/* ── Busolya Expo timer ────────────────────────────────────────────
   The physical expo runs 4–8 November each year (EAT). The online
   marketplace continues all year round.

   Modes (choose by the clock, rolling to next year automatically):
   • pre    — inside the 4 months before 4 Nov: countdown to gates opening
   • live   — 4 Nov 08:00 → 8 Nov 18:00: LIVE, counting up run-time
   • online — the rest of the year: counting the time the expo has run for
              (elapsed since the last physical opening)                        */
(function () {
  'use strict';

  function expoTimes (y) {
    return {
      start: new Date(y + '-11-04T08:00:00+03:00').getTime(),
      end:   new Date(y + '-11-08T18:00:00+03:00').getTime()
    };
  }

  var FOUR_MONTHS = 122 * 86400000; /* physical expo activates ~4 Jul */

  var box = document.getElementById('countdown');
  if (!box) return;
  var cells = {
    d: box.querySelector('[data-cd="d"]'),
    h: box.querySelector('[data-cd="h"]'),
    m: box.querySelector('[data-cd="m"]'),
    s: box.querySelector('[data-cd="s"]')
  };
  if (!cells.d || !cells.h || !cells.m || !cells.s) return;
  var label = document.getElementById('cdLabel');
  var venue = document.getElementById('cdVenue');
  var yearEl = document.getElementById('expoYear');
  var tickerItems = document.querySelectorAll('.tickerStatus');
  var venueDefault = venue ? venue.textContent : '';

  function pad (n) { return (n < 10 ? '0' : '') + n; }

  function render (mode, anchorMs, expoYear) {
    var now = Date.now();
    var i;
    if (mode === 'pre') {
      var diff = Math.max(0, anchorMs - now);
      cells.d.textContent = Math.floor(diff / 86400000);
      cells.h.textContent = pad(Math.floor(diff / 3600000) % 24);
      cells.m.textContent = pad(Math.floor(diff / 60000) % 60);
      cells.s.textContent = pad(Math.floor(diff / 1000) % 60);
      if (label) label.textContent = 'Physical expo opens in';
      if (venue) venue.textContent = venueDefault;
      if (yearEl) yearEl.textContent = expoYear;
      for (i = 0; i < tickerItems.length; i++) {
        tickerItems[i].textContent = '🟡 Physical expo in ' + cells.d.textContent +
          ' days · online marketplace open all year';
      }
      return;
    }
    var run = Math.max(0, now - anchorMs);
    cells.d.textContent = Math.floor(run / 86400000);
    cells.h.textContent = pad(Math.floor(run / 3600000) % 24);
    cells.m.textContent = pad(Math.floor(run / 60000) % 60);
    cells.s.textContent = pad(Math.floor(run / 1000) % 60);
    if (yearEl) yearEl.textContent = expoYear;
    if (mode === 'live') {
      if (label) label.textContent = 'Expo is LIVE';
      if (venue) venue.textContent = venueDefault;
      for (i = 0; i < tickerItems.length; i++) {
        tickerItems[i].textContent = '🟡 Expo LIVE now · day ' +
          cells.d.textContent + ' at Lwatamu Gardens, Mengo';
      }
    } else {
      if (label) label.textContent = 'Online expo continues';
      if (venue) venue.textContent = 'Online marketplace open all year round';
      for (i = 0; i < tickerItems.length; i++) {
        tickerItems[i].textContent = '🟢 Online expo running · ' +
          cells.d.textContent + ' days since the last physical expo opened';
      }
    }
  }

  function pick () {
    var now = Date.now();
    var y = new Date(now).getFullYear();
    var t = expoTimes(y);
    if (now < t.start) {
      if (t.start - now <= FOUR_MONTHS) {
        render('pre', t.start, y);
      } else {
        var last = expoTimes(y - 1);
        render('online', last.start, y - 1);
      }
    } else if (now <= t.end) {
      render('live', t.start, y);
    } else {
      render('online', t.start, y);
    }
  }

  pick(); setInterval(pick, 1000);
})();
