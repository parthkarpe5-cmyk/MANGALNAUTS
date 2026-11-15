/* global window, requestAnimationFrame, cancelAnimationFrame */
window.MarsCosmicGalaxy = (function () {
  let canvas = null;
  let ctx = null;
  let animId = null;
  let width = 0;
  let height = 0;
  let stars = [];
  let meteors = [];
  let nebulae = [];
  let bgGrad = null;
  let rotation = 0;
  let isRunning = false;

  const STAR_COLORS = [
    "#ffffff", // Class A white
    "#cce4ff", // Class O/B blue-white
    "#e2f0d9", // Faint celestial
    "#ffeaa7", // Class G yellow
    "#ffc6ac", // Class M reddish
    "#99ccff", // Deep cyan-blue
  ];

  function init(canvasId) {
    canvas = document.getElementById(canvasId || "cosmic-canvas");
    if (!canvas) return;
    ctx = canvas.getContext("2d", { alpha: true });
    resize();
    createCosmos();
    start();

    window.addEventListener("resize", onResize);
  }

  function onResize() {
    bgGrad = null;
    resize();
    createCosmos();
  }

  function resize() {
    if (!canvas) return;
    const rect = canvas.parentElement
      ? canvas.parentElement.getBoundingClientRect()
      : { width: window.innerWidth, height: window.innerHeight };
    width = canvas.width = Math.max(300, Math.floor(rect.width));
    height = canvas.height = Math.max(300, Math.floor(rect.height));
    bgGrad = null;
  }

  function createCosmos() {
    stars = [];
    nebulae = [];

    if (!ctx) return;

    // Cache the radial background void gradient
    bgGrad = ctx.createRadialGradient(
      width * 0.5, height * 0.5, 50,
      width * 0.5, height * 0.5, Math.max(width, height) * 0.8
    );
    bgGrad.addColorStop(0, "#05060b");
    bgGrad.addColorStop(0.6, "#030408");
    bgGrad.addColorStop(1, "#010204");

    // 1. Generate Deep-Space Stars with varied magnitudes (capped at 420 for optimal performance)
    const starCount = Math.floor((width * height) / 2400);
    const count = Math.min(420, Math.max(200, starCount));

    for (let i = 0; i < count; i++) {
      stars.push({
        x: Math.random() * width,
        y: Math.random() * height,
        radius: Math.random() < 0.85 ? Math.random() * 1.1 + 0.3 : Math.random() * 1.9 + 1.1,
        color: STAR_COLORS[Math.floor(Math.random() * STAR_COLORS.length)],
        baseAlpha: Math.random() * 0.7 + 0.25,
        twinkleSpeed: Math.random() * 0.035 + 0.008,
        twinklePhase: Math.random() * Math.PI * 2,
      });
    }

    // 2. Generate Layered Galactic Nebulae and precompute their radial gradients
    const nebulaCount = 5;
    const nebulaColors = [
      { r: 109, g: 40, b: 217, a: 0.12 },  // Deep Purple
      { r: 192, g: 38, b: 211, a: 0.08 },  // Magenta gas
      { r: 14, g: 165, b: 233, a: 0.09 },  // Cyan reflection
      { r: 245, g: 158, b: 11, a: 0.05 },  // Warm cosmic dust
      { r: 79, g: 70, b: 229, a: 0.10 },   // Indigo backdrop
    ];

    for (let i = 0; i < nebulaCount; i++) {
      const x = (width * (i + 1)) / (nebulaCount + 1) + (Math.random() - 0.5) * 150;
      const y = (height * (i % 2 === 0 ? 0.35 : 0.65)) + (Math.random() - 0.5) * 120;
      const radius = Math.max(180, Math.min(width, height) * (0.35 + Math.random() * 0.25));
      const col = nebulaColors[i % nebulaColors.length];

      const g = ctx.createRadialGradient(x, y, 10, x, y, radius);
      g.addColorStop(0, `rgba(${col.r}, ${col.g}, ${col.b}, ${col.a * 1.5})`);
      g.addColorStop(0.5, `rgba(${col.r}, ${col.g}, ${col.b}, ${col.a * 0.6})`);
      g.addColorStop(1, "rgba(0, 0, 0, 0)");

      nebulae.push({ x, y, radius, gradient: g });
    }
  }

  function spawnMeteor() {
    if (Math.random() < 0.004 && meteors.length < 2) {
      const angle = (Math.PI / 4) + (Math.random() - 0.5) * 0.4;
      meteors.push({
        x: Math.random() * width * 0.8,
        y: Math.random() * (height * 0.4),
        length: Math.random() * 90 + 50,
        speed: Math.random() * 8 + 12,
        angle: angle,
        alpha: 1.0,
        life: 1.0,
      });
    }
  }

  function draw(time) {
    if (!ctx || !isRunning) return;

    // Draw cached deep space dark void background
    if (bgGrad) {
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, width, height);
    } else {
      ctx.clearRect(0, 0, width, height);
    }

    // Draw Glowing Cosmic Nebulae with zero per-frame gradient allocation
    for (let i = 0; i < nebulae.length; i++) {
      const neb = nebulae[i];
      ctx.fillStyle = neb.gradient;
      ctx.beginPath();
      ctx.arc(neb.x, neb.y, neb.radius, 0, Math.PI * 2);
      ctx.fill();
    }

    // Draw Twinkling Stars without per-star context save/restore overhead
    const t = time * 0.001;
    for (let i = 0; i < stars.length; i++) {
      const star = stars[i];
      const twinkle = Math.sin(t * star.twinkleSpeed * 100 + star.twinklePhase) * 0.35;
      const alpha = Math.max(0.12, Math.min(1.0, star.baseAlpha + twinkle));

      ctx.globalAlpha = alpha;
      ctx.fillStyle = star.color;
      ctx.beginPath();
      ctx.arc(star.x, star.y, star.radius, 0, Math.PI * 2);
      ctx.fill();

      // Subtle glow for bright stars
      if (star.radius > 1.5) {
        ctx.globalAlpha = alpha * 0.28;
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.radius * 2.8, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1.0;

    // Update & Draw Shooting Meteors
    spawnMeteor();
    for (let i = meteors.length - 1; i >= 0; i--) {
      const m = meteors[i];
      const tailX = m.x - Math.cos(m.angle) * m.length;
      const tailY = m.y - Math.sin(m.angle) * m.length;

      const grad = ctx.createLinearGradient(m.x, m.y, tailX, tailY);
      grad.addColorStop(0, `rgba(255, 255, 255, ${m.alpha})`);
      grad.addColorStop(0.3, `rgba(102, 217, 255, ${m.alpha * 0.8})`);
      grad.addColorStop(1, "rgba(102, 217, 255, 0)");

      ctx.save();
      ctx.strokeStyle = grad;
      ctx.lineWidth = 1.8;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(m.x, m.y);
      ctx.lineTo(tailX, tailY);
      ctx.stroke();
      ctx.restore();

      m.x += Math.cos(m.angle) * m.speed;
      m.y += Math.sin(m.angle) * m.speed;
      m.alpha -= 0.022;

      if (m.alpha <= 0 || m.x > width + 100 || m.y > height + 100) {
        meteors.splice(i, 1);
      }
    }

    animId = requestAnimationFrame(draw);
  }

  function start() {
    if (isRunning) return;
    isRunning = true;
    animId = requestAnimationFrame(draw);
  }

  function stop() {
    isRunning = false;
    if (animId) {
      cancelAnimationFrame(animId);
      animId = null;
    }
  }

  return { init, start, stop, resize: onResize };
})();
