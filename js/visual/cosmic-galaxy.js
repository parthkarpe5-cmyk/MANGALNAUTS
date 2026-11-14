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
  }

  function createCosmos() {
    stars = [];
    nebulae = [];

    // 1. Generate 850 Deep-Space Stars with varied magnitudes and spectral classes
    const starCount = Math.floor((width * height) / 1600);
    const count = Math.min(1000, Math.max(450, starCount));

    for (let i = 0; i < count; i++) {
      stars.push({
        x: Math.random() * width,
        y: Math.random() * height,
        radius: Math.random() < 0.85 ? Math.random() * 1.2 + 0.3 : Math.random() * 2.0 + 1.2,
        color: STAR_COLORS[Math.floor(Math.random() * STAR_COLORS.length)],
        baseAlpha: Math.random() * 0.7 + 0.25,
        twinkleSpeed: Math.random() * 0.035 + 0.008,
        twinklePhase: Math.random() * Math.PI * 2,
      });
    }

    // 2. Generate Layered Galactic Nebulae (Milky Way / Deep Space gas clouds)
    const nebulaCount = 5;
    const nebulaColors = [
      { r: 109, g: 40, b: 217, a: 0.12 },  // Deep Purple
      { r: 192, g: 38, b: 211, a: 0.08 },  // Magenta gas
      { r: 14, g: 165, b: 233, a: 0.09 },  // Cyan reflection
      { r: 245, g: 158, b: 11, a: 0.05 },  // Warm cosmic dust
      { r: 79, g: 70, b: 229, a: 0.10 },   // Indigo backdrop
    ];

    for (let i = 0; i < nebulaCount; i++) {
      nebulae.push({
        x: (width * (i + 1)) / (nebulaCount + 1) + (Math.random() - 0.5) * 150,
        y: (height * (i % 2 === 0 ? 0.35 : 0.65)) + (Math.random() - 0.5) * 120,
        radius: Math.max(180, Math.min(width, height) * (0.35 + Math.random() * 0.25)),
        color: nebulaColors[i % nebulaColors.length],
      });
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

    ctx.clearRect(0, 0, width, height);

    // Deep space dark void background
    const bgGrad = ctx.createRadialGradient(
      width * 0.5, height * 0.5, 50,
      width * 0.5, height * 0.5, Math.max(width, height) * 0.8
    );
    bgGrad.addColorStop(0, "#05060b");
    bgGrad.addColorStop(0.6, "#030408");
    bgGrad.addColorStop(1, "#010204");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // Draw Glowing Cosmic Nebulae
    ctx.save();
    nebulae.forEach(function (neb) {
      const g = ctx.createRadialGradient(neb.x, neb.y, 10, neb.x, neb.y, neb.radius);
      g.addColorStop(0, `rgba(${neb.color.r}, ${neb.color.g}, ${neb.color.b}, ${neb.color.a * 1.5})`);
      g.addColorStop(0.5, `rgba(${neb.color.r}, ${neb.color.g}, ${neb.color.b}, ${neb.color.a * 0.6})`);
      g.addColorStop(1, "rgba(0, 0, 0, 0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(neb.x, neb.y, neb.radius, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.restore();

    // Draw Twinkling Stars
    const t = time * 0.001;
    stars.forEach(function (star) {
      const twinkle = Math.sin(t * star.twinkleSpeed * 100 + star.twinklePhase) * 0.35;
      const alpha = Math.max(0.12, Math.min(1.0, star.baseAlpha + twinkle));

      ctx.save();
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
      ctx.restore();
    });

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
