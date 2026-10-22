/* TT Track & Field: the game's own sounds, built on Kit.sound.tone / hiss (Web Audio, no files). TF.sfx(name, arg)
   plays one of these or, failing that, a kit sound of that name (click, coin, swish, jump, land...). */
(function () {
  'use strict';
  const S = Kit.sound;
  const { tone, hiss } = S;

  const OWN = {
    // the countdown beeps, and GO: the starter's clap (a race) or a whistle (a jump or a throw)
    beep() { tone({ type: 'square', f: 523, dur: 0.14, vol: 0.08, lp: 2200 }); },
    gun() {
      hiss({ filter: 'lowpass', f: 2600, to: 300, dur: 0.35, vol: 0.32 });
      tone({ type: 'square', f: 1046, dur: 0.22, vol: 0.08, lp: 3000 });
    },
    whistle() { [0, 0.07, 0.14].forEach((at) => tone({ type: 'sine', f: 2350, to: 2250, at, dur: 0.06, vol: 0.09 })); tone({ type: 'sine', f: 2400, at: 0.21, dur: 0.3, vol: 0.1 }); },
    // a footstep for every tap (left and right a little different)
    step(foot) { tone({ type: 'sine', f: foot === 'R' ? 170 : 140, to: 70, dur: 0.05, vol: 0.07 }); },
    weak() { tone({ type: 'sine', f: 110, to: 60, dur: 0.05, vol: 0.04 }); },
    hop() { tone({ type: 'triangle', f: 380, to: 760, dur: 0.14, vol: 0.1 }); },
    clatter() {
      hiss({ filter: 'bandpass', f: 1800, q: 3, dur: 0.18, vol: 0.18 });
      tone({ type: 'square', f: 220, to: 120, dur: 0.12, vol: 0.06, lp: 1500 });
      tone({ type: 'square', f: 180, to: 90, at: 0.08, dur: 0.1, vol: 0.05, lp: 1200 });
    },
    leap() { hiss({ filter: 'highpass', f: 900, to: 2600, dur: 0.35, vol: 0.08 }); tone({ type: 'triangle', f: 300, to: 620, dur: 0.25, vol: 0.08 }); },
    sand() { hiss({ filter: 'lowpass', f: 900, to: 300, dur: 0.35, vol: 0.22 }); tone({ type: 'sine', f: 110, to: 60, dur: 0.15, vol: 0.18 }); },
    throw() { hiss({ filter: 'bandpass', f: 600, to: 2400, q: 1.5, dur: 0.45, vol: 0.12 }); tone({ type: 'triangle', f: 200, to: 420, dur: 0.18, vol: 0.08 }); },
    stick() { tone({ type: 'sine', f: 140, to: 55, dur: 0.16, vol: 0.3 }); hiss({ filter: 'lowpass', f: 700, dur: 0.08, vol: 0.12 }); tone({ type: 'triangle', f: 640, to: 600, at: 0.02, dur: 0.25, vol: 0.03 }); },
    foul() { tone({ type: 'sawtooth', f: 330, to: 160, dur: 0.45, vol: 0.08, lp: 1400 }); },
    tape() { hiss({ filter: 'highpass', f: 2000, dur: 0.12, vol: 0.08 }); },
    // the crowd: a swell of noise, bigger for a win
    cheer(big) {
      const v = big ? 0.16 : 0.09;
      hiss({ filter: 'bandpass', f: 900, to: 1300, q: 0.6, dur: big ? 1.8 : 1.1, vol: v });
      hiss({ filter: 'bandpass', f: 2200, to: 1800, q: 1.2, at: 0.1, dur: big ? 1.4 : 0.8, vol: v * 0.5 });
    },
    // a place: 1st a fanfare, then smaller
    fanfare() { [523, 659, 784, 1046].forEach((f, i) => tone({ type: 'square', f, at: i * 0.12, dur: i === 3 ? 0.45 : 0.14, vol: 0.07, lp: 2600 })); },
    medal(place) { const f = place === 1 ? 1568 : place === 2 ? 1318 : 1175; tone({ type: 'sine', f, dur: 0.6, vol: 0.12 }); tone({ type: 'sine', f: f * 2.01, at: 0.01, dur: 0.4, vol: 0.04 }); },
    pop() { tone({ type: 'sine', f: 880, to: 1320, dur: 0.08, vol: 0.06 }); },
    // the brother: a poof in and out, a treat landing, a high five
    poof() { hiss({ filter: 'bandpass', f: 1400, to: 500, q: 1, dur: 0.3, vol: 0.12 }); tone({ type: 'sine', f: 520, to: 880, dur: 0.16, vol: 0.08 }); },
    treat() { [784, 988, 1175].forEach((f, i) => tone({ type: 'triangle', f, at: i * 0.07, dur: 0.12, vol: 0.08 })); },
    five() { hiss({ filter: 'bandpass', f: 2400, q: 0.8, dur: 0.09, vol: 0.3 }); tone({ type: 'triangle', f: 660, to: 990, at: 0.05, dur: 0.15, vol: 0.08 }); },
  };

  window.TF.sfx = function (name, arg) {
    try {
      if (OWN[name]) OWN[name](arg);
      else if (typeof S[name] === 'function') S[name](arg);
    } catch (e) { /* sound is never worth an error */ }
  };
})();
