/* Finance: what the brain spends, read from the world's ops/finance/finance.json. Created 2026-10-25.
   Read-only: no memory writes, no model calls, no permissions. Fixed per month, this week per post
   against its cap (HALT states), running compute by the hour, the last ten ledger lines, harmonics. */
(function () {
  'use strict'
  var h = BF.h
  // Where the file is. The world's copy is served by the console's raw file route on the same host
  // (the app shim sends the login). Consoles since 2026-10-16 refuse app frames on /cc, so the app
  // tries a copy beside itself first (brain-apps/finance/finance.json, which the app lane allows),
  // then the console route, then the last copy kept on this device, then a file dropped by hand.
  var WORLD = '/home/hands/world/ops/finance/finance.json'
  var SOURCES = [
    { name: 'the copy beside the app', url: './finance.json' },
    { name: 'the console', url: '/cc/files/raw' + WORLD },
  ]
  var KEY = 'finance.data'

  // ---- numbers and words ----
  function num(x) { var n = Number(x); return isFinite(n) && x !== null && x !== '' ? n : null }
  function eur(x) { var n = num(x); return n === null ? '–' : 'EUR ' + n.toFixed(2) }
  function hours(x) { var n = num(x); return n === null ? '' : n.toFixed(1) + ' h' }
  function sum(list, key) { return (list || []).reduce(function (a, r) { return a + (num(r[key]) || 0) }, 0) }
  function isHalt(row) { return /^halt/i.test(String(row.state || '')) }
  function shape(d) { return d && typeof d === 'object' && Array.isArray(d.fixed) && Array.isArray(d.variable_by_post) }

  // ---- fetch: first source that answers with the right shape ----
  function fetchFirst(list, errs) {
    errs = errs || []
    if (!list.length) return Promise.reject(errs)
    var s = list.shift()
    return fetch(s.url, { cache: 'no-store' })
      .then(function (res) { if (!res.ok) throw new Error(s.name + ' answered ' + res.status); return res.json() })
      .then(function (data) { if (!shape(data)) throw new Error(s.name + ' gave a file of another shape'); return { data: data, from: s.name } })
      .catch(function (e) { errs.push(e.message || String(e)); return fetchFirst(list, errs) })
  }

  // ---- the views ----
  function section(label, body) { return h('div.bf-section', h('p.bf-label', label), body) }

  function fixedView(d) {
    var rows = d.fixed || []
    if (!rows.length) return BF.empty('No fixed lines. Monthly rent for boxes and storage appears here.')
    var total = num((d.totals || {}).fixed_month_eur); if (total === null) total = sum(rows, 'eur_month')
    return h('table.fin-table',
      h('thead', h('tr', h('th', 'Item'), h('th', 'Provider'), h('th', 'Rate'), h('th', 'Since'), h('th.num', 'EUR / month'))),
      h('tbody', rows.map(function (r) {
        return h('tr', h('td', r.item || ''), h('td.dim', r.provider || ''), h('td.dim', r.rate || ''), h('td.dim.when', r.since || ''), h('td.num', eur(r.eur_month)))
      })),
      h('tfoot', h('tr', h('td', { colspan: 4 }, 'Total per month'), h('td.num', eur(total)))))
  }

  function postsView(d) {
    var rows = d.variable_by_post || []
    var t = d.totals || {}
    if (!rows.length) return BF.empty('No posts with a weekly cap yet.')
    var halted = rows.filter(isHalt).length
    var list = h('ul.bf-list', rows.map(function (r) {
      var cap = num(r.cap_eur), spent = num(r.spent_week_eur) || 0, last = num(r.spent_last_week_eur)
      var halt = isHalt(r)
      var pct = cap ? Math.min(100, spent / cap * 100) : 0
      var bar = cap ? h('div.fin-bar', h('div.fin-fill', { style: { width: pct.toFixed(1) + '%' } }),
        last !== null && last <= cap ? h('div.fin-mark', { style: { left: (last / cap * 100).toFixed(1) + '%' }, title: 'last week ' + eur(last) }) : null) : null
      return h('li.bf-item' + (halt ? '.halt' : ''),
        h('div.bf-item-main',
          h('div.bf-row.between', h('p.bf-item-title', r.post || ''), h('span.bf-item-side', cap === null ? eur(spent) + ' / no cap' : eur(spent) + ' / ' + eur(cap))),
          bar,
          h('p.bf-item-meta', last === null ? 'no figure for last week' : 'last week ' + eur(last))),
        h('span.bf-tag' + (halt ? '.halt' : ''), String(r.state || (cap === null ? 'no cap' : 'OK'))))
    }))
    var week = num(t.variable_week_eur), lastWeek = num(t.variable_last_week_eur)
    var line = 'This week ' + eur(week === null ? sum(rows, 'spent_week_eur') : week) + ', last week ' + eur(lastWeek === null ? sum(rows, 'spent_last_week_eur') : lastWeek) + '.'
    if (halted) line += ' ' + halted + (halted === 1 ? ' post is' : ' posts are') + ' at HALT: their agents and jobs stop until the week turns or hbar raises the cap.'
    return h('div', list, BF.lines(line, 'fin-total'))
  }

  function runningView(d) {
    var rows = d.running || []
    if (!rows.length) return BF.empty('Nothing is running by the hour. Hourly compute never outlives a sitting.')
    return h('ul.bf-list', rows.map(function (r) {
      return h('li.bf-item', h('div.bf-item-main', h('p.bf-item-title', r.item || ''), h('p.bf-item-meta', [r.rate, hours(r.hours)].filter(Boolean).join(' · '))),
        h('span.bf-item-side', eur(r.eur_so_far) + ' so far'))
    }))
  }

  function lastView(d) {
    var rows = d.last10 || []
    if (!rows.length) return BF.empty('No ledger lines yet.')
    return h('ul.bf-list', rows.map(function (r) {
      return h('li.bf-item', h('div.bf-item-main', h('p.bf-item-title', r.item || ''),
        h('p.bf-item-meta', [r.date, r.kind, r.note].filter(Boolean).join(' · '))), h('span.bf-item-side', eur(r.eur)))
    }))
  }

  // Harmonics are measured, never bought: the ledger carries them beside the euros, so the app only counts.
  function harmonicsView(d) {
    var t = d.totals || {}, rows = d.last10 || []
    var total = num(t.harmonics_week), carried = rows.filter(function (r) { return num(r.harmonics) !== null || /harmonic/i.test(String(r.kind || '')) })
    var s = total !== null ? 'Harmonics this week: ' + total + '.' : 'Harmonics: ' + carried.length + ' of the last ' + rows.length + ' lines carry a harmonics figure' + (carried.length ? ', sum ' + sum(carried, 'harmonics') : '') + '.'
    return BF.note(s + ' Harmonics are measured, never bought, so no euro stands beside them.')
  }

  function dropZone(after) {
    return BF.drop({ accept: '.json,application/json', title: 'Drop finance.json here', hint: 'or click to choose it; kept on this device until the next load', onFiles: function (files) {
      files[0].text().then(function (txt) { return JSON.parse(txt) }).then(function (data) {
        if (!shape(data)) throw new Error('shape')
        BF.keep(KEY, { data: data, from: 'a dropped file', at: Date.now() }); after(data, 'from a dropped file')
      }).catch(function () { BF.toast('That file is not the finance JSON (it needs fixed and variable_by_post).', true) })
    } })
  }

  // ---- the page ----
  var root, body, foot
  function render(d, from) {
    BF.clear(body)
    var halted = (d.variable_by_post || []).filter(isHalt).length
    body.appendChild(h('div.bf-fade',
      section('Fixed per month', fixedView(d)),
      section('This week per post' + (halted ? ' (' + halted + ' halted)' : ''), postsView(d)),
      section('Running compute', runningView(d)),
      section('Last lines', lastView(d)),
      h('div.bf-section', harmonicsView(d))))
    BF.clear(foot)
    var gen = d.generated_at ? 'Generated ' + BF.when(d.generated_at) + ' (' + d.generated_at + ').' : 'No generated_at in the file.'
    foot.appendChild(BF.lines(gen + ' Loaded ' + from + '. Source ' + WORLD + '.', 'fin-foot'))
  }
  function renderEmpty(errs) {
    BF.clear(body); BF.clear(foot)
    body.appendChild(h('div.bf-stack',
      BF.note('The finance file did not load: ' + (errs || []).join('; ') + '. Drop it below, or put a copy beside the app as brain-apps/finance/finance.json.', true),
      dropZone(render)))
    foot.appendChild(BF.lines('Source ' + WORLD + ', written every 10 minutes by the finance agent in the world.', 'fin-foot'))
  }
  function load() {
    return fetchFirst(SOURCES.slice()).then(function (r) {
      BF.keep(KEY, { data: r.data, from: r.from, at: Date.now() }); render(r.data, 'from ' + r.from)
    }, function (errs) {
      var kept = BF.store(KEY, null)
      if (kept && shape(kept.data)) { render(kept.data, 'from the copy kept here ' + BF.when(kept.at) + ' (live file: ' + errs.join('; ') + ')'); return }
      renderEmpty(errs)
    })
  }

  BF.mount(function (el) {
    root = el
    body = h('div'); foot = h('div')
    var dropWrap = h('div.bf-section.bf-hidden', dropZone(function (d, from) { dropWrap.classList.add('bf-hidden'); render(d, from) }))
    root.appendChild(h('div.bf-page',
      h('div.bf-head', h('h1.bf-title', 'Finance'),
        BF.lines('What the brain spends. Fixed lines per month, this week per post against its cap, compute running by the hour, the last ledger lines. It reads one file and writes nothing.', 'bf-sub')),
      h('div.bf-row', BF.button('Refresh', load, { primary: true }), BF.button('Load a file', function () { dropWrap.classList.toggle('bf-hidden') }, { ghost: true })),
      dropWrap, body, foot))
    body.appendChild(BF.skeleton(4))
    load()
  })
})()
