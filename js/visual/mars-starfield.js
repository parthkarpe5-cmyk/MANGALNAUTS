/**
 * MANGALNAUTS — Planetary Deep Space Starfield Engine
 * Jack Rugile-inspired celestial concentric orbital starfield with cached radial gradient
 * sprites, Keplerian orbital velocities, organic stellar twinkling, and motion trail blur.
 * Runs on a dedicated 2D background canvas directly behind the 3D Cesium Mars globe.
 */
(function (global) {
  "use strict";

  let canvas = null;
  let ctx = null;
  let w = 0;
  let h = 0;
  let animId = null;
  let isRunning = false;
  let resizeObserver = null;

  const stars = [];
  let count = 0;
  const maxStars = 1400;

  // Cached radial gradient particle sprite canvas (Jack Rugile performance optimization)
  let canvas2 = null;
  let ctx2 = null;

  function initCache() {
    canvas2 = document.createElement("canvas");
    ctx2 = canvas2.getContext("2d");
    canvas2.width = 100;
    canvas2.height = 100;

    const half = canvas2.width / 2;
    const gradient2 = ctx2.createRadialGradient(half, half, 0, half, half, half);
    gradient2.addColorStop(0.025, "#ffffff");
    gradient2.addColorStop(0.08, "rgba(255, 255, 255, 0.95)");
    gradient2.addColorStop(0.22, "rgba(240, 240, 245, 0.22)");
    gradient2.addColorStop(0.5, "rgba(200, 200, 210, 0.04)");
    gradient2.addColorStop(1, "transparent");

    ctx2.fillStyle = gradient2;
    ctx2.beginPath();
    ctx2.arc(half, half, half, 0, Math.PI * 2);
    ctx2.fill();
  }

  function random(min, max) {
    if (arguments.length < 2) {
      max = min;
      min = 0;
    }
    if (min > max) {
      const hold = max;
      max = min;
      min = hold;
    }
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  function maxOrbit(x, y) {
    const max = Math.max(x, y);
    const diameter = Math.round(Math.sqrt(max * max + max * max));
    return diameter / 2;
  }

  const Star = function () {
    this.orbitRadius = random(maxOrbit(w, h));
    this.radius = random(60, this.orbitRadius) / 12;
    this.orbitX = w / 2;
    this.orbitY = h / 2;
    this.timePassed = random(0, maxStars);
    this.speed = Math.max(0.00004, random(this.orbitRadius) / 50000);
    this.alpha = random(2, 10) / 10;

    count++;
    stars[count] = this;
  };

  Star.prototype.draw = function () {
    const x = Math.sin(this.timePassed) * this.orbitRadius + (w / 2);
    const y = Math.cos(this.timePassed) * this.orbitRadius + (h / 2);
    const twinkle = random(10);

    if (twinkle === 1 && this.alpha > 0) {
      this.alpha -= 0.05;
    } else if (twinkle === 2 && this.alpha < 1) {
      this.alpha += 0.05;
    }

    ctx.globalAlpha = this.alpha;
    ctx.drawImage(
      canvas2,
      x - this.radius / 2,
      y - this.radius / 2,
      this.radius,
      this.radius
    );
    this.timePassed += this.speed;
  };

  function updateDimensions() {
    if (!canvas) return false;
    const parent = canvas.parentElement || document.body;
    const newW = parent.clientWidth || window.innerWidth;
    const newH = parent.clientHeight || window.innerHeight;

    if (newW <= 0 || newH <= 0) return false;

    if (w !== newW || h !== newH || canvas.width !== newW || canvas.height !== newH) {
      w = canvas.width = newW;
      h = canvas.height = newH;
      for (let i = 1, l = stars.length; i < l; i++) {
        if (stars[i]) {
          stars[i].orbitX = w / 2;
          stars[i].orbitY = h / 2;
        }
      }
      return true;
    }
    return false;
  }

  function animationLoop() {
    if (!isRunning) return;

    if (w <= 0 || h <= 0) {
      updateDimensions();
    }

    if (w > 0 && h > 0) {
      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = 0.8;
      ctx.fillStyle = "#000000";
      ctx.fillRect(0, 0, w, h);

      ctx.globalCompositeOperation = "lighter";
      for (let i = 1, l = stars.length; i < l; i++) {
        if (stars[i]) {
          stars[i].draw();
        }
      }
    }

    animId = window.requestAnimationFrame(animationLoop);
  }

  function init(canvasId) {
    if (canvas && isRunning) return;

    canvas =
      document.getElementById(canvasId || "mars-starfield-canvas") ||
      document.getElementById("canvas") ||
      document.querySelector(".mars-starfield-canvas");

    if (!canvas) {
      // Auto-create canvas inside #globe-pane if missing
      const globePane = document.getElementById("globe-pane");
      if (globePane) {
        canvas = document.createElement("canvas");
        canvas.id = "mars-starfield-canvas";
        canvas.className = "mars-starfield-canvas";
        globePane.insertBefore(canvas, globePane.firstChild);
      } else {
        return;
      }
    }

    ctx = canvas.getContext("2d");
    initCache();
    updateDimensions();

    // Populate stars
    stars.length = 0;
    count = 0;
    for (let i = 0; i < maxStars; i++) {
      new Star();
    }

    // Warm-up buffer so the celestial deep space background has pure black motion-blur trails
    if (w > 0 && h > 0) {
      ctx.fillStyle = "#000000";
      ctx.fillRect(0, 0, w, h);
      for (let warmup = 0; warmup < 10; warmup++) {
        ctx.globalCompositeOperation = "source-over";
        ctx.globalAlpha = 0.8;
        ctx.fillStyle = "#000000";
        ctx.fillRect(0, 0, w, h);
        ctx.globalCompositeOperation = "lighter";
        for (let i = 1, l = stars.length; i < l; i++) {
          if (stars[i]) stars[i].draw();
        }
      }
    }

    // Bind resize observer on parent container for instantaneous 반응 upon dragging divider
    if (window.ResizeObserver && canvas.parentElement) {
      try {
        if (resizeObserver) resizeObserver.disconnect();
        resizeObserver = new ResizeObserver(() => {
          resize();
        });
        resizeObserver.observe(canvas.parentElement);
      } catch (e) {
        console.warn("[MarsStarfield] ResizeObserver error:", e);
      }
    }

    window.addEventListener("resize", resize);

    // Pause on tab visibility change to conserve GPU / CPU
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        pause();
      } else {
        resume();
      }
    });

    resume();
  }

  function start() {
    resume();
  }

  function resume() {
    if (isRunning) return;
    isRunning = true;
    updateDimensions();
    animId = window.requestAnimationFrame(animationLoop);
  }

  function pause() {
    isRunning = false;
    if (animId) {
      window.cancelAnimationFrame(animId);
      animId = null;
    }
  }

  function resize() {
    const changed = updateDimensions();
    if (changed && isRunning && ctx) {
      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = 0.8;
      ctx.fillStyle = "#000000";
      ctx.fillRect(0, 0, w, h);
    }
  }

  // Public API
  global.MarsStarfield = {
    init: init,
    start: start,
    resume: resume,
    pause: pause,
    resize: resize,
    isRunning: function () {
      return isRunning;
    },
  };

  // Auto-initialize as soon as DOM is ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () {
      init();
    });
  } else {
    init();
  }
})(typeof window !== "undefined" ? window : this);
