/* 出题：先随机选两个汉字，再从其中一个汉字提取信息填空，所以不会出现“都不是” */
(function () {
  'use strict';

  const rand = n => Math.floor(Math.random() * n);
  const pick = arr => arr[rand(arr.length)];
  // 两个字“碰巧一样”的机会太小，所以有一定几率故意挑一样的，让“一样多 / 都是”也会出现
  const SAME_CHANCE = { strokes: 0.2, attr: 0.28 };

  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  const TYPES = {
    more: {
      key: h => h.strokes, strokes: true, mid: '一样多',
      eligible: h => h.strokes > 0,
      text: () => '哪个汉字的笔画<b>多</b>？',
      info: h => h.strokes + ' 画'
    },
    less: {
      key: h => h.strokes, strokes: true, mid: '一样多',
      eligible: h => h.strokes > 0,
      text: () => '哪个汉字的笔画<b>少</b>？',
      info: h => h.strokes + ' 画'
    },
    ym: {
      key: h => h.ym1, mid: '都是',
      eligible: h => !h.multi && !!h.ym1,
      text: v => `哪个汉字的韵母是<span class="blank py">${esc(v)}</span>？`,
      info: h => '韵母 ' + h.ym1,
      label: '韵母'
    },
    sm: {
      key: h => h.sm1, mid: '都是',
      eligible: h => !h.multi,
      source: h => !!h.sm1, // 没有声母（零声母）的字不能拿来出题
      text: v => `哪个汉字的声母是<span class="blank py">${esc(v)}</span>？`,
      info: h => h.sm1 ? '声母 ' + h.sm1 : '没有声母',
      label: '声母'
    },
    struct: {
      key: h => h.structure, mid: '都是',
      eligible: h => !!h.structure,
      text: v => `哪个汉字的结构是<span class="blank">${esc(v)}</span>结构？`,
      info: h => h.structure + '结构',
      label: '结构'
    },
    radical: {
      key: h => h.radical, mid: '都是',
      eligible: h => !!h.radical,
      text: v => `哪个汉字的部首是<span class="blank hz">${esc(v)}</span>？`,
      info: h => '部首 ' + h.radical,
      label: '部首'
    },
    py: {
      key: h => h.py1, mid: '都是',
      eligible: h => !h.multi && !!h.py1,
      text: v => `哪个汉字的拼音是<span class="blank py">${esc(v)}</span>？`,
      info: h => h.py1,
      label: '拼音'
    }
  };

  function createGenerator(pool) {
    const lists = {};
    Object.keys(TYPES).forEach(t => {
      const T = TYPES[t];
      const e = pool.filter(T.eligible);
      const src = T.source ? e.filter(T.source) : e;
      if (e.length >= 2 && src.length >= 1) lists[t] = { e, src };
    });
    const available = Object.keys(lists);
    const recent = [];
    const recentMax = Math.min(8, Math.floor(pool.length / 2));
    let lastType = null;

    function fresh(arr) {
      const f = arr.filter(h => !recent.includes(h.char));
      return f.length ? f : arr;
    }
    function remember(h) {
      recent.push(h.char);
      while (recent.length > recentMax) recent.shift();
    }

    function next() {
      let types = available.filter(t => t !== lastType);
      if (!types.length) types = available;
      const type = pick(types);
      lastType = type;
      const T = TYPES[type];
      const { e, src } = lists[type];

      const a = pick(fresh(src));
      const others = e.filter(h => h.char !== a.char);
      let b;
      const chance = T.strokes ? SAME_CHANCE.strokes : SAME_CHANCE.attr;
      const same = others.filter(h => T.key(h) === T.key(a));
      if (same.length && Math.random() < chance) b = pick(fresh(same));
      else b = pick(fresh(others));
      remember(a); remember(b);

      // 随机左右位置
      let left = a, right = b;
      if (Math.random() < 0.5) { left = b; right = a; }

      let answer, value = null, html;
      if (T.strokes) {
        if (left.strokes === right.strokes) answer = 'mid';
        else if (type === 'more') answer = left.strokes > right.strokes ? 'A' : 'B';
        else answer = left.strokes < right.strokes ? 'A' : 'B';
        html = T.text();
      } else {
        // 从其中一个汉字提取信息
        const srcs = [left, right].filter(h => !T.source || T.source(h));
        const from = pick(srcs);
        value = T.key(from);
        const lHas = T.key(left) === value, rHas = T.key(right) === value;
        answer = lHas && rHas ? 'mid' : (lHas ? 'A' : 'B');
        html = T.text(value);
      }

      return {
        type, html, answer, value,
        a: left, b: right,
        mid: T.mid,
        infoA: T.info(left), infoB: T.info(right),
        explain: explain(type, left, right, answer, value)
      };
    }

    return { next, available, size: pool.length };
  }

  function explain(type, a, b, answer, value) {
    const A = `「${a.char}」`, B = `「${b.char}」`;
    if (type === 'more' || type === 'less') {
      const base = `${A}${a.strokes}画，${B}${b.strokes}画`;
      if (answer === 'mid') return base + '，一样多。';
      const w = answer === 'A' ? A : B;
      return `${base}，${w}的笔画${type === 'more' ? '多' : '少'}。`;
    }
    const T = TYPES[type];
    const sp = type === 'struct' ? '' : ' ';
    const suf = type === 'struct' ? '结构' : '';
    if (answer === 'mid') return `${A}和${B}的${T.label}都是${sp}${value}${suf}。`;
    const w = answer === 'A' ? a : b, o = answer === 'A' ? b : a;
    const other = (type === 'sm' && !o.sm1) ? `「${o.char}」没有声母` : `「${o.char}」的${T.label}是${sp}${T.key(o)}${suf}`;
    return `「${w.char}」的${T.label}是${sp}${value}${suf}，${other}。`;
  }

  window.Questions = { createGenerator, TYPES };
})();
