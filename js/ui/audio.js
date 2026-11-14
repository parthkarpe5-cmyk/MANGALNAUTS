/* global window, localStorage */
window.MarsAudio = (function () {
  let ctx = null;
  let muted = localStorage.getItem("mars_audio_muted") === "true";

  function getCtx() {
    if (!ctx && typeof window.AudioContext !== "undefined") {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (ctx && ctx.state === "suspended") {
      ctx.resume().catch(function () {});
    }
    return ctx;
  }

  function playTone(freq, type, duration, gainVal) {
    if (muted) return;
    try {
      const audioCtx = getCtx();
      if (!audioCtx) return;
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();

      osc.type = type || "sine";
      osc.frequency.setValueAtTime(freq, audioCtx.currentTime);

      gain.gain.setValueAtTime(gainVal || 0.05, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + duration);

      osc.connect(gain);
      gain.connect(audioCtx.destination);

      osc.start();
      osc.stop(audioCtx.currentTime + duration);
    } catch (e) {
      // Audio not permitted or supported
    }
  }

  function playClick() {
    playTone(900, "triangle", 0.04, 0.03);
  }

  function playLock() {
    if (muted) return;
    playTone(620, "sine", 0.06, 0.04);
    setTimeout(function () {
      playTone(940, "sine", 0.08, 0.05);
    }, 60);
  }

  function playSuccess() {
    if (muted) return;
    playTone(520, "triangle", 0.08, 0.04);
    setTimeout(function () {
      playTone(780, "triangle", 0.08, 0.04);
    }, 70);
    setTimeout(function () {
      playTone(1040, "sine", 0.14, 0.05);
    }, 140);
  }

  function setMuted(isMuted) {
    muted = isMuted;
    localStorage.setItem("mars_audio_muted", String(muted));
  }

  function isMuted() {
    return muted;
  }

  return { playClick, playLock, playSuccess, setMuted, isMuted };
})();
