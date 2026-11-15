/* global window, localStorage, Audio */
window.MarsAudio = (function () {
  let ctx = null;
  let muted = localStorage.getItem("mars_audio_muted") === "true";
  let windAudio = null;
  let isWindPlaying = false;

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

  // --- Real NASA Planetary Soundscapes ---
  function playSuperCamLaser() {
    if (muted) return;
    try {
      const laserAudio = new Audio("audio/nasa_supercam_laser_sol12.mp3");
      laserAudio.volume = 0.45;
      laserAudio.play().catch(function () {});
    } catch (e) {}
  }

  function playMarsquake() {
    if (muted) return;
    try {
      const quakeAudio = new Audio("audio/nasa_insight_marsquake_sol128.mp4");
      quakeAudio.volume = 0.50;
      quakeAudio.play().catch(function () {});
    } catch (e) {}
  }

  function playNasaWind(loop) {
    if (muted) return;
    try {
      if (!windAudio) {
        windAudio = new Audio("audio/nasa_perseverance_wind_sol4.mp3");
        windAudio.volume = 0.25;
        windAudio.loop = loop !== false;
      }
      windAudio.play().then(function () {
        isWindPlaying = true;
      }).catch(function () {});
    } catch (e) {}
  }

  function stopNasaWind() {
    if (windAudio) {
      windAudio.pause();
      windAudio.currentTime = 0;
      isWindPlaying = false;
    }
  }

  function toggleAmbientWind() {
    if (isWindPlaying) {
      stopNasaWind();
      return false;
    } else {
      playNasaWind(true);
      return true;
    }
  }

  function setMuted(isMuted) {
    muted = isMuted;
    localStorage.setItem("mars_audio_muted", String(muted));
    if (muted) {
      stopNasaWind();
    }
  }

  function isMuted() {
    return muted;
  }

  function isAmbientWindActive() {
    return isWindPlaying;
  }

  return {
    playClick,
    playLock,
    playSuccess,
    playSuperCamLaser,
    playMarsquake,
    playNasaWind,
    stopNasaWind,
    toggleAmbientWind,
    isAmbientWindActive,
    setMuted,
    isMuted,
  };
})();
