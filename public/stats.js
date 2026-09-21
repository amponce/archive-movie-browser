// The maintainer's stats page. The key is checked by /api/stats; here it is only remembered.
(function () {
  var KEY = 'stats-key';
  var $ = function (id) { return document.getElementById(id); };
  var el = function (tag, props, children) { var n = document.createElement(tag); Object.assign(n, props || {}); (children || []).forEach(function (c) { n.append(c); }); return n; };
  var fmt = function (n) { return Number(n || 0).toLocaleString(); };
  var read = function () { try { return localStorage.getItem(KEY) || ''; } catch (e) { return ''; } };

  var BOARDS = [['played', 'Films played'], ['watched', 'Watched 10+ minutes'], ['opened', 'Films opened'], ['searches', 'Searches'],
    ['filters', 'Filters used'], ['referrers', 'Where visitors came from'], ['pages', 'Pages'], ['players', 'Player used'], ['banner', 'MCP banner']];

  function sum(days, name) { return days.reduce(function (total, d) { return total + (d.events[name] || 0); }, 0); }

  function render(data) {
    var days = data.days, today = days[days.length - 1], week = days.slice(-7);
    var tiles = [[today.visitors, 'visitors today'], [data.visitorsThisMonth, 'visitors this month'], [sum(week, 'Page view'), 'page views, 7 days'],
      [sum(week, 'Film opened'), 'films opened, 7 days'], [sum(week, 'Play'), 'plays, 7 days'], [sum(week, 'Watched 10 minutes'), 'watched 10+ min, 7 days'], [sum(week, 'Search'), 'searches, 7 days']];
    $('tiles').replaceChildren.apply($('tiles'), tiles.map(function (t) { return el('div', { className: 'tile' }, [el('div', { className: 'n', textContent: fmt(t[0]) }), el('div', { className: 'l', textContent: t[1] })]); }));

    var max = Math.max.apply(null, days.map(function (d) { return d.visitors; }).concat(1));
    $('chart').replaceChildren.apply($('chart'), days.map(function (d) {
      var slot = el('div', { className: 'slot', tabIndex: 0 }); slot.dataset.tip = d.day + ': ' + fmt(d.visitors) + ' visitors';
      var bar = el('div', { className: 'bar' }); bar.style.height = (d.visitors / max * 100) + '%'; slot.append(bar); return slot;
    }));
    $('axis-from').textContent = days[0].day; $('axis-to').textContent = today.day + ' (peak ' + fmt(max === 1 && !today.visitors ? 0 : max) + ')';

    var names = ['Page view', 'Film opened', 'Play', 'Watched 10 minutes', 'Search', 'Filter', 'Load more'];
    $('days').replaceChildren(el('tr', {}, ['Day', 'Visitors'].concat(names).map(function (h) { return el('th', { textContent: h }); })));
    days.slice().reverse().forEach(function (d) { $('days').append(el('tr', {}, [d.day, fmt(d.visitors)].concat(names.map(function (n) { return fmt(d.events[n]); })).map(function (v) { return el('td', { textContent: v }); }))); });

    $('boards').replaceChildren.apply($('boards'), BOARDS.map(function (b) {
      var rows = data.boards[b[0]] || [], top = rows.length ? rows[0][1] : 1;
      var table = el('table', {}, rows.map(function (r) { var m = el('div'); m.style.width = (r[1] / top * 100) + '%';
        return el('tr', {}, [el('td', { className: 'k', textContent: r[0], title: r[0] }), el('td', { className: 'm' }, [m]), el('td', { className: 'v', textContent: fmt(r[1]) })]); }));
      return el('section', { className: 'panel' }, [el('h2', { textContent: b[1] }), rows.length ? table : el('p', { className: 'muted', textContent: 'Nothing yet this month.' })]);
    }));
  }

  function load(key) {
    return fetch('/api/stats', { headers: { Authorization: 'Bearer ' + key }, cache: 'no-store' }).then(function (response) {
      if (!response.ok) throw new Error(response.status === 404 ? 'That key was not accepted.' : 'The stats could not be loaded (' + response.status + ').');
      return response.json();
    }).then(function (data) {
      try { localStorage.setItem(KEY, key); } catch (e) { /* private mode */ }
      render(data); $('gate').hidden = true; $('stats').hidden = false; $('forget').hidden = false;
    });
  }

  $('key-form').addEventListener('submit', function (event) { event.preventDefault(); $('gate-error').textContent = '';
    load($('key').value.trim()).catch(function (error) { $('gate-error').textContent = error.message; }); });
  $('forget').addEventListener('click', function () { try { localStorage.removeItem(KEY); } catch (e) { /* private mode */ } location.reload(); });
  if (read()) load(read()).catch(function (error) { $('gate-error').textContent = error.message; });
})();
