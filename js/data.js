/* 读取 hanzilist.csv，转换成汉字对象列表 */
(function () {
  'use strict';

  // 简单的 CSV 解析（支持引号包住的字段）
  function parseCSV(text) {
    text = text.replace(/^﻿/, '');
    const rows = [];
    let row = [], field = '', inQ = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (inQ) {
        if (c === '"') {
          if (text[i + 1] === '"') { field += '"'; i++; } else inQ = false;
        } else field += c;
      } else if (c === '"') inQ = true;
      else if (c === ',') { row.push(field); field = ''; }
      else if (c === '\n' || c === '\r') {
        if (c === '\r' && text[i + 1] === '\n') i++;
        row.push(field); rows.push(row); row = []; field = '';
      } else field += c;
    }
    if (field !== '' || row.length) { row.push(field); rows.push(row); }
    const head = rows.shift().map(s => s.trim());
    return rows.filter(r => r.length > 1 && r.join('').trim()).map(r => {
      const o = {};
      head.forEach((h, i) => { o[h] = (r[i] || '').trim(); });
      return o;
    });
  }

  const CN_NUM = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10 };
  // “第十七课” → 17
  function cnToInt(s) {
    s = s.replace(/^第|课$/g, '');
    if (/^\d+$/.test(s)) return +s;
    if (s.length === 1) return CN_NUM[s] || 0;
    if (s[0] === '十') return 10 + (CN_NUM[s[1]] || 0);
    if (s[1] === '十') return CN_NUM[s[0]] * 10 + (CN_NUM[s[2]] || 0);
    return 0;
  }

  function toHanzi(r) {
    return {
      char: r['生字'],
      py1: r['拼音1'], py2: r['拼音2'],
      sm1: r['声母1'], sm2: r['声母2'],
      ym1: r['韵母1'], ym2: r['韵母2'],
      radical: r['部首'],
      strokes: parseInt(r['笔画数'], 10) || 0,
      structure: r['汉字结构'],
      lesson: r['课次'],
      lessonNo: cnToInt(r['课次']),
      grade: r['年级'],
      gradeNo: cnToInt(r['年级'].replace('年级', '')),
      // 多音字：有拼音2 / 韵母2 / 声母2 的字
      multi: !!(r['拼音2'] || r['韵母2'] || r['声母2'])
    };
  }

  async function loadHanzi() {
    const res = await fetch('hanzilist.csv');
    if (!res.ok) throw new Error('无法读取 hanzilist.csv');
    const text = await res.text();
    return parseCSV(text).map(toHanzi).filter(h => h.char);
  }

  window.HanziData = { loadHanzi, parseCSV, cnToInt };
})();
