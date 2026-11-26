/* 汉字对决 主程序 */
(function () {
  'use strict';
  const VERSION = '1.3.0';
  const SPEED_SEC = 5;                          // 快手奖：每题平均 5 秒
  const SPEED_ACC = 0.8;                        // 并且至少答对八成
  const COUNTS = [6, 10, 15, 21];
  const VALUE = { c: 1, l: 4, k: 8 };          // 1🍭 = 4🍬，1🍰 = 8🍬
  const EMOJI = { c: '🍬', l: '🍭', k: '🍰' };
  // 修复连胜的价钱：第 1～4 次（没有第 5 次）
  const REPAIR_COST = [
    [{ c: 1 }],
    [{ c: 2 }],
    [{ l: 1 }, { c: 4 }],
    [{ k: 1 }, { c: 8 }]
  ];
  const GRADE_NAMES = ['', '一年级', '二年级', '三年级', '四年级', '五年级', '六年级'];

  const $ = id => document.getElementById(id);
  let ALL = [];
  let settings = Store.settings();
  let game = null;
  let speedTimer = null;

  /* ---------- 快手时间（只算思考时间） ---------- */
  function usedMs() {
    if (!game) return 0;
    return game.thinkMs + (game.answered || !game.qStart ? 0 : performance.now() - game.qStart);
  }
  function stopClock() {
    if (game && !game.answered && game.qStart) { game.thinkMs += performance.now() - game.qStart; game.qStart = 0; }
  }
  function updateSpeed() {
    if (!game) return;
    const used = usedMs(), left = game.limitMs - used;
    $('speedBar').style.width = Math.max(0, left / game.limitMs * 100) + '%';
    $('speed').classList.toggle('over', left < 0);
    $('speedText').textContent = left >= 0 ? `剩 ${Math.ceil(left / 1000)} 秒` : '没关系～';
  }
  function speedBonus(n) { return Math.round(n / 3); }
  document.addEventListener('visibilitychange', () => {
    if (!game || game.answered) return;
    if (document.hidden) stopClock();
    else game.qStart = performance.now();
  });

  /* ---------- 小工具 ---------- */
  function show(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.toggle('active', s.id === id));
    window.scrollTo(0, 0);
  }
  function chip(label, on, onClick) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'chip' + (on ? ' on' : '');
    b.textContent = label;
    b.addEventListener('click', () => { Sound.play('tap'); onClick(); });
    return b;
  }
  function costText(cost) {
    return Object.keys(cost).map(k => cost[k] + ' ' + EMOJI[k]).join(' ');
  }
  function valueOf(inv) { return inv.c * VALUE.c + inv.l * VALUE.l + inv.k * VALUE.k; }
  function bump(id) {
    const el = $(id);
    el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump');
  }
  function flyEmoji(emoji, fromEl, delay) {
    setTimeout(() => {
      const r = (fromEl || document.body).getBoundingClientRect();
      const s = document.createElement('div');
      s.className = 'fly';
      s.textContent = emoji;
      s.style.left = (r.left + r.width / 2) + 'px';
      s.style.top = (r.top + r.height / 2) + 'px';
      document.body.appendChild(s);
      setTimeout(() => s.remove(), 1100);
    }, delay || 0);
  }
  function confetti(n) {
    const box = $('confetti');
    const items = ['🍬', '🍭', '🍰', '⭐', '✨', '🎈', '💖'];
    for (let i = 0; i < n; i++) {
      const s = document.createElement('span');
      s.textContent = items[i % items.length];
      s.style.left = Math.random() * 100 + 'vw';
      s.style.animationDuration = (2 + Math.random() * 2) + 's';
      s.style.animationDelay = Math.random() * 0.8 + 's';
      box.appendChild(s);
      setTimeout(() => s.remove(), 5000);
    }
  }

  /* ---------- 首页：选择范围 ---------- */
  function grades() {
    return [...new Set(ALL.map(h => h.gradeNo))].filter(Boolean).sort((a, b) => a - b);
  }
  function lessonsOf(g) {
    const m = new Map();
    ALL.filter(h => h.gradeNo === g).forEach(h => m.set(h.lesson, h.lessonNo));
    return [...m.entries()].sort((a, b) => a[1] - b[1]).map(e => e[0]);
  }
  function currentPool() {
    return ALL.filter(h =>
      (settings.grade === 'all' || h.gradeNo === settings.grade) &&
      (settings.grade === 'all' || settings.lesson === 'all' || h.lesson === settings.lesson));
  }
  function scopeLabel() {
    if (settings.grade === 'all') return '所有年级';
    const g = GRADE_NAMES[settings.grade] || settings.grade + '年级';
    return settings.lesson === 'all' ? g + '（全年级）' : g + ' ' + settings.lesson;
  }

  function renderHome() {
    // 设置可能来自旧数据，检查一下还有效
    if (settings.grade !== 'all' && !grades().includes(settings.grade)) settings.grade = 'all';
    if (settings.grade !== 'all' && settings.lesson !== 'all' && !lessonsOf(settings.grade).includes(settings.lesson)) settings.lesson = 'all';
    if (!COUNTS.includes(settings.count)) settings.count = 15;
    Store.saveSettings(settings);

    const gc = $('gradeChips'); gc.innerHTML = '';
    gc.appendChild(chip('所有年级', settings.grade === 'all', () => { settings.grade = 'all'; settings.lesson = 'all'; renderHome(); }));
    grades().forEach(g => gc.appendChild(chip(GRADE_NAMES[g] || g + '年级', settings.grade === g,
      () => { settings.grade = g; settings.lesson = 'all'; renderHome(); })));

    const lw = $('lessonWrap'), lc = $('lessonChips');
    if (settings.grade === 'all') lw.classList.add('hidden');
    else {
      lw.classList.remove('hidden'); lc.innerHTML = '';
      lc.appendChild(chip('全年级', settings.lesson === 'all', () => { settings.lesson = 'all'; renderHome(); }));
      lessonsOf(settings.grade).forEach(l => lc.appendChild(chip(l.replace(/^第|课$/g, ''), settings.lesson === l,
        () => { settings.lesson = l; renderHome(); })));
    }

    const cc = $('countChips'); cc.innerHTML = '';
    COUNTS.forEach(n => cc.appendChild(chip(n + ' 题', settings.count === n, () => { settings.count = n; renderHome(); })));

    const pool = currentPool();
    const ok = Questions.createGenerator(pool).available.length > 0;
    $('poolInfo').textContent = ok
      ? `范围：${scopeLabel()}，共 ${pool.length} 个字`
      : `范围：${scopeLabel()}，字太少了，没办法出题，换个范围吧～`;
    $('startBtn').disabled = !ok;
    renderRecords();
  }

  function renderRecords() {
    const box = $('records');
    const list = Store.records();
    if (!list.length) { box.innerHTML = '<p class="empty">还没有成绩，快来玩第一局吧！</p>'; return; }
    const best = Store.best();
    const rows = list.slice(0, 10).map(r => {
      const d = new Date(r.time);
      const ds = `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
      return `<tr><td>${ds}</td><td>${r.scope}</td><td>${r.correct}/${r.count}</td><td>🔥${r.bestStreak}</td><td><b>${r.score}</b></td></tr>`;
    }).join('');
    box.innerHTML =
      `<p class="best-line">⭐ 最高分：<b>${best.score}</b> 🍬（${best.scope}，${best.count} 题）</p>` +
      `<table><thead><tr><th>时间</th><th>范围</th><th>答对</th><th>最长连对</th><th>得分</th></tr></thead><tbody>${rows}</tbody></table>` +
      '<button id="clearBtn" class="link-btn" type="button">清除成绩</button>';
    let armed = false;
    $('clearBtn').addEventListener('click', e => {
      if (!armed) { armed = true; e.target.textContent = '再点一次确认清除'; return; }
      Store.clearRecords(); renderRecords();
    });
  }

  /* ---------- 游戏 ---------- */
  function startGame() {
    Sound.unlock();
    const pool = currentPool();
    const gen = Questions.createGenerator(pool);
    if (!gen.available.length) return;
    game = {
      gen, total: settings.count, index: 0, correct: 0,
      streak: 0, bestStreak: 0, broken: 0,
      inv: { c: 0, l: 0, k: 0 }, earned: { c: 0, l: 0, k: 0 },
      spentValue: 0, repairs: 0, repaired: 0,
      scope: scopeLabel(), q: null, answered: false,
      thinkMs: 0, qStart: 0, limitMs: settings.count * SPEED_SEC * 1000
    };
    clearInterval(speedTimer);
    speedTimer = setInterval(updateSpeed, 250);
    Sound.play('start');
    show('screenGame');
    nextQuestion();
  }

  function updateStats() {
    $('statCandy').textContent = '🍬 ' + game.inv.c;
    $('statLolly').textContent = '🍭 ' + game.inv.l;
    $('statCake').textContent = '🍰 ' + game.inv.k;
    $('statStreak').textContent = '🔥 ' + game.streak;
    $('progressText').textContent = `第 ${Math.min(game.index, game.total)} / ${game.total} 题`;
    $('progressBar').style.width = (Math.min(game.index, game.total) / game.total * 100) + '%';
  }

  function nextQuestion() {
    if (game.index >= game.total) return finish();
    game.index++;
    game.q = game.gen.next();
    game.answered = false;
    const q = game.q;
    $('qText').innerHTML = q.html;
    [['ansA', q.a], ['ansB', q.b]].forEach(([id, h]) => {
      const el = $(id);
      el.className = 'ans hanzi';
      el.disabled = false;
      el.querySelector('.char').textContent = h.char;
      el.querySelector('.info').textContent = '';
      el.setAttribute('aria-label', h.char);
    });
    const mid = $('ansMid');
    mid.className = 'ans mid'; mid.disabled = false; mid.textContent = q.mid;
    // 读音题（声母、韵母、拼音）不给小喇叭，免得直接听出答案
    const noSpeak = ['sm', 'ym', 'py'].includes(q.type);
    $('spkA').classList.toggle('off', noSpeak);
    $('spkB').classList.toggle('off', noSpeak);
    $('feedback').classList.add('hidden');
    updateStats();
    game.qStart = performance.now();
    updateSpeed();
  }

  function answer(choice) {
    if (!game || game.answered) return;
    stopClock();
    game.answered = true;
    updateSpeed();
    const q = game.q;
    const ids = { A: 'ansA', mid: 'ansMid', B: 'ansB' };
    Object.values(ids).forEach(id => { $(id).disabled = true; });
    $('ansA').querySelector('.info').textContent = q.infoA;
    $('ansB').querySelector('.info').textContent = q.infoB;
    $(ids[q.answer]).classList.add('right');
    Object.keys(ids).forEach(k => { if (k !== q.answer && k !== choice) $(ids[k]).classList.add('dim'); });

    const ok = choice === q.answer;
    const fbText = $('fbText'), fbReward = $('fbReward');
    $('repairBox').classList.add('hidden');
    if (ok) {
      game.correct++;
      game.streak++;
      game.bestStreak = Math.max(game.bestStreak, game.streak);
      const gained = ['c'];
      // 连对 10、20…题送🍰；连对 5、15…题送🍭
      if (game.streak % 10 === 0) gained.push('k');
      else if (game.streak % 5 === 0) gained.push('l');
      gained.forEach(k => { game.inv[k]++; game.earned[k]++; });
      fbText.className = 'fb-text good';
      fbText.textContent = pick(['答对啦！🎉', '真棒！✨', '太厉害了！🌟', '好聪明！💖', '没错！👍']);
      let reward = '+1 🍬';
      if (gained.includes('l')) reward += `　连对 ${game.streak} 题！+1 🍭`;
      if (gained.includes('k')) reward += `　连对 ${game.streak} 题！+1 🍰`;
      fbReward.innerHTML = reward + `<br><small>${q.explain}</small>`;
      Sound.play('correct');
      setTimeout(() => Sound.play('candy'), 280);
      flyEmoji('🍬', $(ids[q.answer]));
      if (gained.includes('l')) { setTimeout(() => Sound.play('lollipop'), 550); flyEmoji('🍭', $(ids[q.answer]), 300); }
      if (gained.includes('k')) { setTimeout(() => Sound.play('cake'), 550); flyEmoji('🍰', $(ids[q.answer]), 300); confetti(24); }
      bump('statCandy'); bump('statStreak');
      if (gained.length > 1) bump(gained.includes('k') ? 'statCake' : 'statLolly');
    } else {
      $(ids[choice]).classList.add('wrong');
      game.broken = game.streak;
      game.streak = 0;
      fbText.className = 'fb-text bad';
      fbText.textContent = '哎呀，答错了～';
      fbReward.innerHTML = `<small>${q.explain}</small>`;
      Sound.play('wrong');
      if (game.broken > 0) showRepair();
    }
    updateStats();
    $('nextBtn').textContent = game.index >= game.total ? '看成绩 🏁' : '下一题 ➜';
    $('feedback').classList.remove('hidden');
    $('feedback').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function pick(a) { return a[Math.floor(Math.random() * a.length)]; }

  function canPay(cost) { return Object.keys(cost).every(k => game.inv[k] >= cost[k]); }

  function showRepair() {
    const box = $('repairBox'), opts = $('repairOptions'), txt = $('repairText');
    box.classList.remove('hidden');
    opts.innerHTML = '';
    if (game.repairs >= REPAIR_COST.length) {
      txt.textContent = `连对 ${game.broken} 题中断了。这局的 4 次修复已经用完，连胜重新开始～`;
      return;
    }
    const costs = REPAIR_COST[game.repairs];
    const affordable = costs.some(canPay);
    txt.textContent = affordable
      ? `连对 ${game.broken} 题中断了！要用糖果修复吗？（第 ${game.repairs + 1} 次修复）`
      : `连对 ${game.broken} 题中断了。第 ${game.repairs + 1} 次修复要 ${costs.map(costText).join(' 或 ')}，糖果不够，连胜重新开始～`;
    if (!affordable) return;
    costs.forEach(cost => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'repair-btn';
      b.textContent = '用 ' + costText(cost) + ' 修复';
      b.disabled = !canPay(cost);
      b.addEventListener('click', () => doRepair(cost));
      opts.appendChild(b);
    });
    const skip = document.createElement('button');
    skip.type = 'button';
    skip.className = 'repair-btn skip';
    skip.textContent = '不用了';
    skip.addEventListener('click', () => {
      Sound.play('tap');
      txt.textContent = '好的，连胜重新开始，加油！💪';
      opts.innerHTML = '';
    });
    opts.appendChild(skip);
  }

  function doRepair(cost) {
    if (!canPay(cost)) return;
    Object.keys(cost).forEach(k => { game.inv[k] -= cost[k]; game.spentValue += cost[k] * VALUE[k]; });
    game.repairs++;
    game.repaired++;
    game.streak = game.broken;
    game.broken = 0;
    Sound.play('repair');
    $('repairText').textContent = `修好啦！🔧✨ 连对继续：${game.streak} 题`;
    $('repairOptions').innerHTML = '';
    updateStats();
    bump('statStreak');
  }

  function finish() {
    clearInterval(speedTimer);
    const secs = game.thinkMs / 1000, limit = game.limitMs / 1000;
    const fast = game.thinkMs <= game.limitMs && game.correct / game.total >= SPEED_ACC;
    const bonus = fast ? speedBonus(game.total) : 0;
    if (bonus) { game.earned.c += bonus; game.inv.c += bonus; }
    const sp = $('resultSpeed');
    sp.className = 'result-speed' + (fast ? ' win' : '');
    if (fast) sp.textContent = `⚡ 快手奖！+${bonus} 🍬　用时 ${secs.toFixed(0)} 秒 / 限时 ${limit} 秒`;
    else if (game.thinkMs <= game.limitMs) sp.textContent = `⏱ 用时 ${secs.toFixed(0)} 秒，够快了！再多答对几题就能拿快手奖～`;
    else sp.textContent = `⏱ 用时 ${secs.toFixed(0)} 秒（快手奖限时 ${limit} 秒）`;
    const earnedValue = valueOf(game.earned);
    const score = earnedValue - game.spentValue;
    const prevBest = Store.bestFor(game.total);
    const record = {
      time: Date.now(), scope: game.scope, count: game.total, correct: game.correct,
      bestStreak: game.bestStreak, earned: earnedValue, spent: game.spentValue, score,
      candies: { ...game.earned }, repairs: game.repairs,
      seconds: Math.round(secs), speedBonus: bonus
    };
    Store.addRecord(record);

    const rate = game.correct / game.total;
    $('resultEmoji').textContent = rate === 1 ? '🏆' : rate >= 0.8 ? '🎉' : rate >= 0.5 ? '😊' : '🌱';
    $('resultTitle').textContent = rate === 1 ? '全部答对！' : rate >= 0.8 ? '太棒了！' : rate >= 0.5 ? '做得不错！' : '继续加油！';
    $('resultSummary').textContent = `${game.scope} · 答对 ${game.correct} / ${game.total} 题 · 最长连对 ${game.bestStreak} 题`;
    $('rEarned').textContent = earnedValue;
    $('rSpent').textContent = game.spentValue;
    $('rScore').textContent = score;
    const e = game.earned;
    $('resultDetail').innerHTML =
      `得到：${e.c} 🍬　${e.l} 🍭　${e.k} 🍰（共值 ${earnedValue} 🍬${bonus ? '，含快手奖 ' + bonus + ' 🍬' : ''}）<br>` +
      `修复连胜 ${game.repaired} 次，用掉 ${game.spentValue} 🍬`;
    $('resultBest').textContent = (!prevBest || score > prevBest.score)
      ? `🌟 新纪录！这是 ${game.total} 题的最高分！`
      : `${game.total} 题最高分：${prevBest.score}`;
    show('screenResult');
    Sound.play('finish');
    confetti(rate >= 0.8 ? 40 : 16);
    game = null;
  }

  /* ---------- 导出成绩（CSV，Excel 可直接打开） ---------- */
  function exportCSV() {
    const list = Store.records();
    if (!list.length) { $('exportBtn').textContent = '还没有成绩可以保存'; setTimeout(() => { $('exportBtn').textContent = '📥 保存成绩为 Excel/CSV'; }, 2000); return; }
    const pad = n => String(n).padStart(2, '0');
    const fmt = t => { const d = new Date(t); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`; };
    const head = ['时间', '范围', '题数', '答对', '最长连对', '糖果🍬', '棒棒糖🍭', '蛋糕🍰', '快手奖🍬', '得到(按🍬)', '修复次数', '用掉(按🍬)', '得分', '思考用时(秒)'];
    const rows = list.slice().reverse().map(r => {
      const c = r.candies || {};
      return [fmt(r.time), r.scope, r.count, r.correct, r.bestStreak, c.c ?? '', c.l ?? '', c.k ?? '',
        r.speedBonus ?? '', r.earned, r.repairs ?? '', r.spent, r.score, r.seconds ?? ''];
    });
    const cell = v => { const s = String(v); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
    const csv = '\uFEFF' + [head, ...rows].map(r => r.map(cell).join(',')).join('\r\n');
    const d = new Date();
    const name = `hanzi-battle-scores-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}.csv`;
    // Safari 对“程序生成的 blob 链接”下载不稳定，改用 data: 链接
    const isSafari = /^((?!chrome|chromium|crios|fxios|android|edg).)*safari/i.test(navigator.userAgent);
    let href;
    if (isSafari) href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv);
    else href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    try {
      const a = document.createElement('a');
      a.href = href; a.download = name; a.rel = 'noopener';
      document.body.appendChild(a);
      a.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
      setTimeout(() => a.remove(), 1000);
    } catch (e) { /* 下面还有备用链接 */ }
    // 备用：如果没有开始下载，可以直接点这个链接
    const box = $('exportFallback');
    box.innerHTML = '';
    const link = document.createElement('a');
    link.href = href; link.download = name; link.textContent = '没有开始下载？点这里保存 ' + name;
    box.appendChild(link);
    box.classList.remove('hidden');
    if (!isSafari) setTimeout(() => URL.revokeObjectURL(href), 60000);
    Sound.play('tap');
  }

  /* ---------- 绑定 ---------- */
  function bind() {
    $('startBtn').addEventListener('click', startGame);
    $('exportBtn').addEventListener('click', exportCSV);
    $('spkA').addEventListener('click', e => { if (game && game.q) Speak.play(game.q.a.py1, e.currentTarget); });
    $('spkB').addEventListener('click', e => { if (game && game.q) Speak.play(game.q.b.py1, e.currentTarget); });
    $('ansA').addEventListener('click', () => answer('A'));
    $('ansB').addEventListener('click', () => answer('B'));
    $('ansMid').addEventListener('click', () => answer('mid'));
    $('nextBtn').addEventListener('click', () => { Sound.play('tap'); nextQuestion(); });
    $('againBtn').addEventListener('click', startGame);
    $('homeBtn').addEventListener('click', () => { Sound.play('tap'); renderHome(); show('screenHome'); });
    let quitArmed = null;
    $('quitBtn').addEventListener('click', () => {
      if (!quitArmed) {
        $('quitBtn').textContent = '确定?';
        $('quitBtn').style.width = '72px';
        quitArmed = setTimeout(() => { quitArmed = null; $('quitBtn').textContent = '🏠'; $('quitBtn').style.width = ''; }, 2500);
        return;
      }
      clearTimeout(quitArmed); quitArmed = null;
      $('quitBtn').textContent = '🏠'; $('quitBtn').style.width = '';
      clearInterval(speedTimer); game = null; renderHome(); show('screenHome');
    });
    const sb = $('soundBtn');
    const paint = () => { sb.textContent = Sound.isMuted() ? '🔇' : '🔊'; };
    sb.addEventListener('click', () => { Sound.setMuted(!Sound.isMuted()); paint(); Sound.play('tap'); });
    paint();
    // 键盘：1 / 2 / 3 选答案，回车下一题
    document.addEventListener('keydown', e => {
      if (!$('screenGame').classList.contains('active') || !game) return;
      if (!game.answered) {
        if (e.key === '1') answer('A');
        else if (e.key === '2') answer('mid');
        else if (e.key === '3') answer('B');
      } else if (e.key === 'Enter') { e.preventDefault(); nextQuestion(); }
    });
  }

  async function init() {
    $('verLabel').textContent = 'v' + VERSION;
    bind();
    try {
      ALL = await HanziData.loadHanzi();
    } catch (err) {
      $('poolInfo').textContent = '读取字表失败，请联网后刷新一次（之后就能离线使用）。';
      $('startBtn').disabled = true;
      return;
    }
    renderHome();
    setTimeout(() => Speak.prefetch(ALL), 3000);
  }

  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
  }
  init();
})();
