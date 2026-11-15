/**
 * MANGALNAUTS — Radial Warp Starfield Engine
 * Pure CSS GPU-composited radial star warp expanding from center coordinates behind Mars.
 * 360 radiant star streams with multi-duration animations, distance translations, and glow.
 */
(function (global) {
  "use strict";

  let sky = null;
  let center = { x: 0, y: 0 };
  let resizeObserver = null;

  function dot(i) {
    const size = Math.round(Math.random() + 1);
    const root = document.createElement("span");
    root.style.top = center.y + "px";
    root.style.left = center.x + "px";
    // Axis class index 1 to 360
    const axisIndex = (i % 360) + 1;
    root.classList.add("star", "size-" + size, "axis-" + axisIndex);
    return root;
  }

  function clear() {
    if (sky) {
      sky.innerHTML = "";
    }
  }

  function onResize() {
    if (!sky) {
      sky = document.querySelector("#sky");
    }
    if (!sky) return;

    const newX = sky.clientWidth / 2;
    const newY = sky.clientHeight / 2;

    if (newX <= 0 || newY <= 0) return;

    center = { x: newX, y: newY };
    const stars = sky.querySelectorAll(".star");
    if (stars.length === 0) {
      // Re-populate if empty
      const frag = document.createDocumentFragment();
      for (let i = 0; i < 360; i++) {
        frag.appendChild(dot(i));
      }
      sky.appendChild(frag);
    } else {
      // Update origin centers smoothly without resetting animation timeline
      for (let i = 0; i < stars.length; i++) {
        stars[i].style.top = center.y + "px";
        stars[i].style.left = center.x + "px";
      }
    }
  }

  function init() {
    sky = document.querySelector("#sky");
    if (!sky) {
      const globePane = document.getElementById("globe-pane");
      if (globePane) {
        sky = document.createElement("div");
        sky.id = "sky";
        globePane.insertBefore(sky, globePane.firstChild);
      } else {
        return;
      }
    }

    center = {
      x: sky.clientWidth / 2,
      y: sky.clientHeight / 2,
    };

    clear();
    const frag = document.createDocumentFragment();
    for (let i = 0; i < 360; i++) {
      frag.appendChild(dot(i));
    }
    sky.appendChild(frag);

    if (window.ResizeObserver && sky.parentElement) {
      try {
        if (resizeObserver) resizeObserver.disconnect();
        resizeObserver = new ResizeObserver(() => {
          onResize();
        });
        resizeObserver.observe(sky.parentElement);
      } catch (e) {
        console.warn("[MarsStarfield] ResizeObserver error:", e);
      }
    }

    window.addEventListener("resize", onResize);

    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        pause();
      } else {
        resume();
      }
    });
  }

  function pause() {
    if (sky) {
      sky.style.display = "none";
    }
  }

  function resume() {
    if (sky) {
      sky.style.display = "block";
      onResize();
    }
  }

  global.MarsStarfield = {
    init: init,
    clear: clear,
    dot: dot,
    resize: onResize,
    pause: pause,
    resume: resume,
  };

  // Run on window load / DOMContentLoaded
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  // Also bind to window.onload as in reference snippet
  window.addEventListener("load", function () {
    if (!sky || sky.children.length === 0) {
      init();
    } else {
      onResize();
    }
  });
})(typeof window !== "undefined" ? window : this);
