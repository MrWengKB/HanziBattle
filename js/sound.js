/* 快乐可爱的音效：全部用 Web Audio 现场合成，不需要音频文件，离线也能用 */
(function () {
  'use strict';
  let ctx = null;
  let master = null;
  let muted = false;
  try { muted = localStorage.getItem('hb-muted') === '1'; } catch (e) { /* 忽略 */ }

  function ac() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  // 一个音符：频率、开始时间(相对现在)、长度、波形、音量、滑音目标
  function tone(freq, start, dur, type, vol, slideTo) {
    const c = ac(); if (!c || muted) return;
    const t0 = c.currentTime + start;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(freq, t0);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol || 0.3, t0 + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(master);
    o.start(t0); o.stop(t0 + dur + 0.05);
  }

  // 铃铛般的音：基音 + 高八度泛音
  function bell(freq, start, dur, vol) {
    tone(freq, start, dur, 'sine', vol || 0.25);
    tone(freq * 2, start, dur * 0.6, 'sine', (vol || 0.25) * 0.35);
    tone(freq * 3, start, dur * 0.3, 'triangle', (vol || 0.25) * 0.12);
  }

  const N = { C5: 523.25, D5: 587.33, E5: 659.25, F5: 698.46, G5: 783.99, A5: 880, B5: 987.77,
              C6: 1046.5, D6: 1174.66, E6: 1318.51, G6: 1567.98, C7: 2093, G4: 392, E4: 329.63, C4: 261.63 };

  const sounds = {
    tap() { tone(880, 0, 0.07, 'sine', 0.18, 1320); },
    start() {
      [N.C5, N.E5, N.G5, N.C6].forEach((f, i) => bell(f, i * 0.09, 0.3, 0.22));
    },
    correct() {
      bell(N.E6, 0, 0.25, 0.25);
      bell(N.G6, 0.1, 0.4, 0.25);
      tone(2600, 0.18, 0.15, 'sine', 0.06, 3400); // 小闪光
    },
    wrong() {
      // 软软的“哎呀”：两个往下滑的三角波
      tone(440, 0, 0.22, 'triangle', 0.25, 330);
      tone(349, 0.2, 0.35, 'triangle', 0.22, 247);
    },
    candy() { // 啵！
      tone(300, 0, 0.12, 'sine', 0.35, 1200);
      tone(1500, 0.06, 0.08, 'sine', 0.1, 2200);
    },
    lollipop() {
      [N.C6, N.E6, N.G6, N.E6, N.G6, N.C7].forEach((f, i) => bell(f, i * 0.07, 0.25, 0.18));
    },
    cake() {
      const mel = [N.C5, N.C5, N.D5, N.C5, N.F5, N.E5];
      const dur = [0.12, 0.12, 0.24, 0.24, 0.24, 0.45];
      let t = 0;
      mel.forEach((f, i) => { bell(f * 2, t, dur[i] + 0.1, 0.2); tone(f / 2, t, dur[i], 'triangle', 0.08); t += dur[i]; });
      tone(2400, t, 0.4, 'sine', 0.05, 4200);
    },
    repair() { // 魔法闪闪：快速上行琶音
      for (let i = 0; i < 9; i++) tone(700 * Math.pow(1.19, i), i * 0.04, 0.18, 'sine', 0.14);
      bell(N.C7, 0.38, 0.5, 0.12);
    },
    finish() {
      const mel = [N.G5, N.C6, N.E6, N.G6, N.E6, N.G6];
      const dur = [0.13, 0.13, 0.13, 0.3, 0.13, 0.55];
      let t = 0;
      mel.forEach((f, i) => { bell(f, t, dur[i] + 0.15, 0.22); t += dur[i]; });
      [N.C4, N.E4, N.G4].forEach(f => tone(f, t - 0.55, 0.7, 'triangle', 0.07));
    }
  };

  function play(name) {
    if (muted) return;
    try { (sounds[name] || (() => {}))(); } catch (e) { /* 某些浏览器不支持时静默 */ }
  }

  function setMuted(m) {
    muted = m;
    try { localStorage.setItem('hb-muted', m ? '1' : '0'); } catch (e) { /* 忽略 */ }
  }

  window.Sound = { play, setMuted, isMuted: () => muted, unlock: ac };
})();
