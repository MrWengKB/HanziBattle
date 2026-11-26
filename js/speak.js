/* 小喇叭：读出汉字的拼音1。音频来自 HanziQuery（hugolpz/audio-cmn，CC-BY-SA），轻声按第一声处理 */
(function () {
  'use strict';
  const TONE_MARKS = 'āáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ';
  const TONE_BASE = 'aaaaeeeeiiiioooouuuuvvvv';
  const NEUTRAL_TONE = 1;

  // cháng → audio/cmn-chang2.mp3，lǜ → audio/cmn-lv4.mp3
  function fileOf(py) {
    let tone = NEUTRAL_TONE, base = '';
    for (const c of py.normalize('NFC').toLowerCase()) {
      const i = TONE_MARKS.indexOf(c);
      if (i !== -1) { tone = (i % 4) + 1; base += TONE_BASE[i]; }
      else base += (c === 'ü' ? 'v' : c);
    }
    return 'audio/cmn-' + base + tone + '.mp3';
  }

  const buffers = new Map();
  let current = null;

  function decode(ctx, data) {
    return new Promise((resolve, reject) => ctx.decodeAudioData(data, resolve, reject));
  }

  async function play(py, btn) {
    const ctx = Sound.unlock();
    if (!ctx || !py) return;
    const url = fileOf(py);
    if (current) { try { current.stop(); } catch (e) { /* 已停止 */ } current = null; }
    document.querySelectorAll('.speaker.playing').forEach(el => el.classList.remove('playing'));
    if (btn) btn.classList.add('playing');
    try {
      let buf = buffers.get(url);
      if (!buf) {
        const res = await fetch(url);
        if (!res.ok) throw new Error('no audio');
        buf = await decode(ctx, await res.arrayBuffer());
        buffers.set(url, buf);
      }
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.connect(ctx.destination);
      src.onended = () => { if (btn) btn.classList.remove('playing'); if (current === src) current = null; };
      current = src;
      src.start();
    } catch (e) {
      if (btn) btn.classList.remove('playing');
    }
  }

  // 后台把当前字表要用到的读音都下载一遍（经过 Service Worker 存进缓存），之后离线也能听
  async function prefetch(list) {
    if (!('serviceWorker' in navigator) || !navigator.onLine) return;
    await navigator.serviceWorker.ready;
    const urls = [...new Set(list.map(h => h.py1).filter(Boolean).map(fileOf))];
    let i = 0;
    const worker = async () => {
      while (i < urls.length) {
        const u = urls[i++];
        try { await fetch(u); } catch (e) { /* 忽略 */ }
      }
    };
    await Promise.all([worker(), worker(), worker()]);
  }

  window.Speak = { play, prefetch, fileOf };
})();
