/* 成绩只保存在本机（localStorage） */
(function () {
  'use strict';
  const KEY = 'hb-records';
  const SET_KEY = 'hb-settings';
  const MAX = 1000;

  function read(key, def) {
    try { const v = JSON.parse(localStorage.getItem(key)); return v == null ? def : v; }
    catch (e) { return def; }
  }
  function write(key, v) {
    try { localStorage.setItem(key, JSON.stringify(v)); } catch (e) { /* 存不了就算了 */ }
  }

  const Store = {
    records: () => read(KEY, []),
    addRecord(r) {
      const list = Store.records();
      list.unshift(r);
      write(KEY, list.slice(0, MAX));
      return list;
    },
    clearRecords() { write(KEY, []); },
    best() {
      return Store.records().reduce((m, r) => (m == null || r.score > m.score ? r : m), null);
    },
    bestFor(count) {
      return Store.records().filter(r => r.count === count)
        .reduce((m, r) => (m == null || r.score > m.score ? r : m), null);
    },
    settings: () => read(SET_KEY, { grade: 'all', lesson: 'all', count: 15 }),
    saveSettings: s => write(SET_KEY, s)
  };
  window.Store = Store;
})();
