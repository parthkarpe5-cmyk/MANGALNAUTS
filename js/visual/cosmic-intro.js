/* global THREE, Cesium, window, document, requestAnimationFrame, cancelAnimationFrame */
window.MarsCosmicIntro = (function () {
  let overlayEl = null;
  let canvas = null;
  let renderer = null;
  let scene = null;
  let camera = null;
  let animId = null;

  let galaxyPoints = null;
  let galaxyGroup = null;
  let solarSystemGroup = null;

  let sunMesh = null;
  let mercuryMesh = null;
  let venusMesh = null;
  let earthGroup = null;
  let earthMesh = null;
  let moonMesh = null;
  let marsMesh = null;
  let marsAtmosphere = null;

  let hudStage = null;
  let hudTitle = null;
  let hudSub = null;
  let telemetryText = null;
  let progressBar = null;

  let startTime = 0;
  const DURATION_MS = 11000; // 11-second cinematic flight
  let isRunning = false;
  let hasSkipped = false;
  let fadeTimeout = null;

  // Procedural Texture Generators (Zero Network Requests, Instant Load)
  function createSunTexture() {
    const c = document.createElement("canvas");
    c.width = 512;
    c.height = 256;
    const ctx = c.getContext("2d");
    const g = ctx.createLinearGradient(0, 0, 0, 256);
    g.addColorStop(0, "#ffeedd");
    g.addColorStop(0.5, "#ff9900");
    g.addColorStop(1, "#ff3300");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 512, 256);
    // Solar flare granulation
    for (let i = 0; i < 400; i++) {
      ctx.fillStyle = `rgba(255, 255, 200, ${Math.random() * 0.35})`;
      ctx.beginPath();
      ctx.arc(Math.random() * 512, Math.random() * 256, Math.random() * 6 + 2, 0, Math.PI * 2);
      ctx.fill();
    }
    return new THREE.CanvasTexture(c);
  }

  function createMercuryTexture() {
    const c = document.createElement("canvas");
    c.width = 256;
    c.height = 128;
    const ctx = c.getContext("2d");
    ctx.fillStyle = "#8a8682";
    ctx.fillRect(0, 0, 256, 128);
    for (let i = 0; i < 200; i++) {
      ctx.fillStyle = Math.random() > 0.5 ? "rgba(50,50,50,0.3)" : "rgba(180,180,180,0.3)";
      ctx.beginPath();
      ctx.arc(Math.random() * 256, Math.random() * 128, Math.random() * 4 + 1, 0, Math.PI * 2);
      ctx.fill();
    }
    return new THREE.CanvasTexture(c);
  }

  function createVenusTexture() {
    const c = document.createElement("canvas");
    c.width = 256;
    c.height = 128;
    const ctx = c.getContext("2d");
    const g = ctx.createLinearGradient(0, 0, 0, 128);
    g.addColorStop(0, "#e8c99b");
    g.addColorStop(0.3, "#d9a566");
    g.addColorStop(0.6, "#c48843");
    g.addColorStop(1, "#e8c99b");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 256, 128);
    // Cloud bands
    for (let y = 0; y < 128; y += 4) {
      ctx.fillStyle = `rgba(255, 235, 180, ${Math.random() * 0.25})`;
      ctx.fillRect(0, y, 256, Math.random() * 3 + 1);
    }
    return new THREE.CanvasTexture(c);
  }

  function createEarthTexture() {
    const c = document.createElement("canvas");
    c.width = 512;
    c.height = 256;
    const ctx = c.getContext("2d");
    // Deep Ocean Blue
    ctx.fillStyle = "#0c3b6d";
    ctx.fillRect(0, 0, 512, 256);
    // Continents
    ctx.fillStyle = "#2d6a4f";
    const continents = [
      [80, 80, 45], [130, 90, 50], [170, 140, 60], [260, 90, 70],
      [340, 80, 85], [370, 140, 55], [420, 160, 40]
    ];
    continents.forEach(([cx, cy, r]) => {
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
    });
    // Cloud swirls
    ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
    for (let i = 0; i < 50; i++) {
      ctx.beginPath();
      ctx.ellipse(Math.random() * 512, Math.random() * 256, Math.random() * 40 + 10, Math.random() * 12 + 4, Math.random(), 0, Math.PI * 2);
      ctx.fill();
    }
    return new THREE.CanvasTexture(c);
  }

  function createMarsTexture() {
    const c = document.createElement("canvas");
    c.width = 512;
    c.height = 256;
    const ctx = c.getContext("2d");
    // Authentic Martian Rust Red
    const g = ctx.createLinearGradient(0, 0, 0, 256);
    g.addColorStop(0, "#d97746");
    g.addColorStop(0.5, "#c15c2d");
    g.addColorStop(1, "#a8451f");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 512, 256);
    // Darker volcanic maria (Syrtis Major, Acidalia Planitia)
    ctx.fillStyle = "rgba(65, 30, 18, 0.45)";
    const maria = [
      [140, 130, 45, 25], [260, 140, 55, 35], [380, 120, 60, 30],
      [220, 90, 40, 20], [330, 160, 35, 20]
    ];
    maria.forEach(([cx, cy, rx, ry]) => {
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx, ry, 0.3, 0, Math.PI * 2);
      ctx.fill();
    });
    // North and South Polar Ice Caps (pure brilliant white)
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.ellipse(256, 10, 80, 16, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(256, 248, 70, 14, 0, 0, Math.PI * 2);
    ctx.fill();
    return new THREE.CanvasTexture(c);
  }

  function createCircularGlowTexture() {
    const c = document.createElement("canvas");
    c.width = 64;
    c.height = 64;
    const ctx = c.getContext("2d");
    const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, "rgba(255, 255, 255, 1)");
    g.addColorStop(0.2, "rgba(230, 210, 255, 0.8)");
    g.addColorStop(0.6, "rgba(160, 100, 255, 0.2)");
    g.addColorStop(1, "rgba(0, 0, 0, 0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(c);
  }

  function init() {
    overlayEl = document.getElementById("cosmic-intro-overlay");
    canvas = document.getElementById("cosmic-intro-canvas");
    if (!overlayEl || !canvas || typeof THREE === "undefined") return;

    hudStage = document.getElementById("cosmic-hud-stage");
    hudTitle = document.getElementById("cosmic-hud-title");
    hudSub = document.getElementById("cosmic-hud-sub");
    telemetryText = document.getElementById("cosmic-telemetry-text");
    progressBar = document.getElementById("cosmic-progress-fill");

    const skipBtn = document.getElementById("btn-skip-cosmic");
    if (skipBtn) {
      skipBtn.addEventListener("click", skip);
    }

    const replayBtn = document.getElementById("btn-replay-cosmic");
    if (replayBtn) {
      replayBtn.addEventListener("click", replay);
    }

    setupThree();
    start();
  }

  function setupThree() {
    const width = window.innerWidth;
    const height = window.innerHeight;

    renderer = new THREE.WebGLRenderer({
      canvas: canvas,
      alpha: false,
      antialias: true,
      powerPreference: "high-performance",
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearColor(0x020205, 1);

    scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x020205, 0.0006);

    camera = new THREE.PerspectiveCamera(58, width / height, 0.1, 4500);

    // 1. Build Spiral Galaxy (exact match for user's spiral image)
    buildSpiralGalaxy();

    // 2. Build Solar System Planets
    buildSolarSystem();

    window.addEventListener("resize", onWindowResize);
  }

  function buildSpiralGalaxy() {
    galaxyGroup = new THREE.Group();
    // Tilted oblique angle matching the user's uploaded picture
    galaxyGroup.rotation.x = 0.98; // ~56 degrees tilt
    galaxyGroup.rotation.y = 0.22;
    galaxyGroup.position.set(0, 0, -850);

    const particleCount = 42000;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);
    const sizes = new Float32Array(particleCount);

    const arms = 4;
    const maxRadius = 520;
    const colorCore = new THREE.Color(0xfff8ee);      // Brilliant white/cream core
    const colorLavender = new THREE.Color(0xd8b4fe);  // Lavender mid arms
    const colorViolet = new THREE.Color(0xa855f7);    // Violet arms
    const colorBlue = new THREE.Color(0x6366f1);      // Electric indigo
    const colorOuter = new THREE.Color(0x38bdf8);     // Cyan dust rim

    for (let i = 0; i < particleCount; i++) {
      const i3 = i * 3;
      // Radius distribution: denser toward the bright galactic core
      const r = Math.pow(Math.random(), 1.7) * maxRadius;
      const armIndex = i % arms;
      const armAngle = (armIndex * Math.PI * 2) / arms;
      // Logarithmic spiral twist
      const twist = r * 0.0085;
      const angle = armAngle + twist;

      // Random dispersion around arm
      const spread = (r / maxRadius) * 42 + 6;
      const randomX = (Math.random() - 0.5) * spread;
      const randomY = (Math.random() - 0.5) * (spread * 0.45);
      const randomZ = (Math.random() - 0.5) * spread;

      positions[i3] = Math.cos(angle) * r + randomX;
      positions[i3 + 1] = randomY; // vertical thickness
      positions[i3 + 2] = Math.sin(angle) * r + randomZ;

      // Colors matching the photo: White Core -> Lavender/Violet -> Blue/Cyan Rim
      const normR = r / maxRadius;
      let pColor = new THREE.Color();
      if (normR < 0.2) {
        pColor.lerpColors(colorCore, colorLavender, normR / 0.2);
      } else if (normR < 0.55) {
        pColor.lerpColors(colorLavender, colorViolet, (normR - 0.2) / 0.35);
      } else if (normR < 0.82) {
        pColor.lerpColors(colorViolet, colorBlue, (normR - 0.55) / 0.27);
      } else {
        pColor.lerpColors(colorBlue, colorOuter, (normR - 0.82) / 0.18);
      }

      colors[i3] = pColor.r;
      colors[i3 + 1] = pColor.g;
      colors[i3 + 2] = pColor.b;

      // Star sizes: brighter/larger in core
      sizes[i] = (1 - normR * 0.6) * (Math.random() * 2.8 + 1.2);
    }

    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute("size", new THREE.BufferAttribute(sizes, 1));

    const starTexture = createCircularGlowTexture();
    const material = new THREE.PointsMaterial({
      size: 3.2,
      map: starTexture,
      vertexColors: true,
      transparent: true,
      opacity: 0.92,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    galaxyPoints = new THREE.Points(geometry, material);
    galaxyGroup.add(galaxyPoints);

    // Glowing Galactic Core Sprite (intense center like user image)
    const coreMat = new THREE.SpriteMaterial({
      map: starTexture,
      color: 0xfff6ea,
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending,
    });
    const coreSprite = new THREE.Sprite(coreMat);
    coreSprite.scale.set(130, 130, 1);
    galaxyGroup.add(coreSprite);

    scene.add(galaxyGroup);
  }

  function buildSolarSystem() {
    solarSystemGroup = new THREE.Group();

    // The Sun: Glowing celestial sphere with corona
    const sunGeom = new THREE.SphereGeometry(38, 32, 32);
    const sunMat = new THREE.MeshBasicMaterial({
      map: createSunTexture(),
      color: 0xffffff,
    });
    sunMesh = new THREE.Mesh(sunGeom, sunMat);
    sunMesh.position.set(0, 10, -560);
    solarSystemGroup.add(sunMesh);

    // Sun Corona Halo
    const coronaMat = new THREE.SpriteMaterial({
      map: createCircularGlowTexture(),
      color: 0xffaa33,
      transparent: true,
      opacity: 0.75,
      blending: THREE.AdditiveBlending,
    });
    const coronaSprite = new THREE.Sprite(coronaMat);
    coronaSprite.scale.set(180, 180, 1);
    sunMesh.add(coronaSprite);

    // Sun Point Light
    const sunLight = new THREE.PointLight(0xfff7e6, 3.2, 2200);
    sunMesh.add(sunLight);

    // Ambient Starlight
    const ambientLight = new THREE.AmbientLight(0x22263a, 1.2);
    scene.add(ambientLight);

    // Directional Sunlight illuminating inner planets from Sun's direction
    const dirLight = new THREE.DirectionalLight(0xfff5e6, 2.5);
    dirLight.position.set(0, 10, -560);
    scene.add(dirLight);

    // 1. Mercury
    const mercGeom = new THREE.SphereGeometry(3.2, 24, 24);
    const mercMat = new THREE.MeshStandardMaterial({
      map: createMercuryTexture(),
      roughness: 0.9,
    });
    mercuryMesh = new THREE.Mesh(mercGeom, mercMat);
    mercuryMesh.position.set(28, -6, -430);
    solarSystemGroup.add(mercuryMesh);

    // 2. Venus
    const venusGeom = new THREE.SphereGeometry(6.4, 24, 24);
    const venusMat = new THREE.MeshStandardMaterial({
      map: createVenusTexture(),
      roughness: 0.7,
    });
    venusMesh = new THREE.Mesh(venusGeom, venusMat);
    venusMesh.position.set(-36, 12, -310);
    solarSystemGroup.add(venusMesh);

    // 3. Earth & Moon System
    earthGroup = new THREE.Group();
    earthGroup.position.set(42, -8, -170);

    const earthGeom = new THREE.SphereGeometry(7.5, 32, 32);
    const earthMat = new THREE.MeshStandardMaterial({
      map: createEarthTexture(),
      roughness: 0.6,
      metalness: 0.1,
    });
    earthMesh = new THREE.Mesh(earthGeom, earthMat);
    earthGroup.add(earthMesh);

    // Earth Atmosphere Limb Glow
    const earthAtmoMat = new THREE.SpriteMaterial({
      map: createCircularGlowTexture(),
      color: 0x4895ef,
      transparent: true,
      opacity: 0.55,
      blending: THREE.AdditiveBlending,
    });
    const earthAtmo = new THREE.Sprite(earthAtmoMat);
    earthAtmo.scale.set(22, 22, 1);
    earthMesh.add(earthAtmo);

    // Moon
    const moonGeom = new THREE.SphereGeometry(2.0, 16, 16);
    const moonMat = new THREE.MeshStandardMaterial({
      map: createMercuryTexture(),
      roughness: 0.95,
    });
    moonMesh = new THREE.Mesh(moonGeom, moonMat);
    moonMesh.position.set(16, 4, 3);
    earthGroup.add(moonMesh);

    solarSystemGroup.add(earthGroup);

    // 4. Mars (Destination Planet)
    const marsGeom = new THREE.SphereGeometry(18, 48, 48);
    const marsMat = new THREE.MeshStandardMaterial({
      map: createMarsTexture(),
      roughness: 0.75,
      metalness: 0.05,
    });
    marsMesh = new THREE.Mesh(marsGeom, marsMat);
    marsMesh.position.set(0, 0, 70); // Directly in front of camera at arrival
    solarSystemGroup.add(marsMesh);

    // Thin Blue/Amber Martian Atmospheric Limb
    const marsAtmoMat = new THREE.SpriteMaterial({
      map: createCircularGlowTexture(),
      color: 0xef7a5d,
      transparent: true,
      opacity: 0.45,
      blending: THREE.AdditiveBlending,
    });
    marsAtmosphere = new THREE.Sprite(marsAtmoMat);
    marsAtmosphere.scale.set(44, 44, 1);
    marsMesh.add(marsAtmosphere);

    scene.add(solarSystemGroup);
  }

  function onWindowResize() {
    if (!renderer || !camera) return;
    const width = window.innerWidth;
    const height = window.innerHeight;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
  }

  function start() {
    if (isRunning) return;
    hasSkipped = false;
    isRunning = true;
    startTime = performance.now();
    if (overlayEl) {
      overlayEl.style.display = "block";
      overlayEl.style.opacity = "1";
      overlayEl.classList.remove("fading-out");
    }
    loop();
  }

  function loop() {
    if (!isRunning) return;
    const now = performance.now();
    const elapsed = now - startTime;
    const progress = Math.min(1.0, elapsed / DURATION_MS);

    // 1. Slow, majestic galaxy swirl
    if (galaxyGroup) {
      galaxyGroup.rotation.z += 0.0018;
    }

    // 2. Planet self-rotations
    if (sunMesh) sunMesh.rotation.y += 0.002;
    if (mercuryMesh) mercuryMesh.rotation.y += 0.008;
    if (venusMesh) venusMesh.rotation.y -= 0.006;
    if (earthMesh) earthMesh.rotation.y += 0.012;
    if (moonMesh && earthGroup) {
      moonMesh.position.x = Math.cos(now * 0.0015) * 16;
      moonMesh.position.z = Math.sin(now * 0.0015) * 16;
    }
    if (marsMesh) marsMesh.rotation.y += 0.008;

    // 3. Cinematic Camera Traversal Spline
    // Camera moves from deep galactic overview (Z = -1150) -> through Sun/planets -> arriving right at Mars (Z = 32)
    updateCameraPath(progress);

    // 4. Update HUD telemetry
    updateHud(progress);

    renderer.render(scene, camera);

    if (progress >= 1.0) {
      completeIntro();
      return;
    }

    animId = requestAnimationFrame(loop);
  }

  function updateCameraPath(p) {
    if (!camera) return;

    // Smooth easing curve
    const ease = p < 0.5 ? 2 * p * p : -1 + (4 - 2 * p) * p;

    // Camera travels smoothly along Z axis
    const startZ = -1120;
    const endZ = 34; // right above Mars surface
    const curZ = startZ + (endZ - startZ) * ease;

    // Subtle natural cinematic camera drifting on X and Y
    const curX = Math.sin(p * Math.PI * 1.5) * 18;
    const curY = Math.cos(p * Math.PI) * 12 + 6;

    camera.position.set(curX, curY, curZ);

    // Camera points forward toward incoming planets, locking onto Mars in the final approach
    const targetZ = curZ + 90;
    camera.lookAt(0, 0, targetZ);
  }

  function updateHud(p) {
    const pct = Math.round(p * 100);
    if (progressBar) progressBar.style.width = pct + "%";

    if (p < 0.28) {
      if (hudStage) hudStage.textContent = "MILKY WAY GALAXY // ORION SPUR";
      if (hudTitle) hudTitle.textContent = "INTERPLANETARY PROLOGUE";
      if (hudSub) hudSub.textContent = "APPROACHING SOLAR SYSTEM COORDINATES";
      if (telemetryText) telemetryText.textContent = "GALACTIC LATITUDE: +12.4° · VELOCITY: 0.85c";
    } else if (p < 0.48) {
      if (hudStage) hudStage.textContent = "SOLAR CORE // 0.00 AU";
      if (hudTitle) hudTitle.textContent = "PASSING THE SUN";
      if (hudSub) hudSub.textContent = "CORONAL MASS DISCHARGE NOMINAL · GRAVITY ASSIST";
      if (telemetryText) telemetryText.textContent = "DIST: 0.15 AU · FLUX: 1361 W/m²";
    } else if (p < 0.70) {
      if (hudStage) hudStage.textContent = "INNER PLANETS // MERCURY & VENUS";
      if (hudTitle) hudTitle.textContent = "INNER SYSTEM CRUISE";
      if (hudSub) hudSub.textContent = "TRANSIT TRAJECTORY ON SCHEDULE";
      if (telemetryText) telemetryText.textContent = "DIST: 0.72 AU · RAD: 22.4 uSv/hr";
    } else if (p < 0.86) {
      if (hudStage) hudStage.textContent = "EARTH-MOON SYSTEM // 1.00 AU";
      if (hudTitle) hudTitle.textContent = "TERRESTRIAL RENDEZVOUS";
      if (hudSub) hudSub.textContent = "PASSING HOME WORLD · OUTBOUND TO MARS";
      if (telemetryText) telemetryText.textContent = "DIST: 1.00 AU · TELEMETRY LOCK: DSN GOLDSTONE";
    } else {
      if (hudStage) hudStage.textContent = "TARGET ACQUIRED // 1.52 AU";
      if (hudTitle) hudTitle.textContent = "MARS ORBITAL INSERTION";
      if (hudSub) hudSub.textContent = "ENTERING JEZERO & GALE SURFACE CORRIDORS";
      if (telemetryText) telemetryText.textContent = "MARS 0.38g · COMMENCING TACTICAL DESCENT";
    }
  }

  function completeIntro() {
    if (!isRunning) return;
    isRunning = false;
    if (animId) {
      cancelAnimationFrame(animId);
      animId = null;
    }

    if (window.MarsAudio && window.MarsAudio.playSuccess) {
      window.MarsAudio.playSuccess();
    }

    if (overlayEl) {
      overlayEl.classList.add("fading-out");
      if (fadeTimeout) clearTimeout(fadeTimeout);
      fadeTimeout = setTimeout(() => {
        overlayEl.style.display = "none";
        overlayEl.style.opacity = "0";
      }, 1000);
    }
  }

  function skip() {
    if (hasSkipped) return;
    hasSkipped = true;
    completeIntro();
  }

  function replay() {
    if (animId) {
      cancelAnimationFrame(animId);
      animId = null;
    }
    if (fadeTimeout) {
      clearTimeout(fadeTimeout);
      fadeTimeout = null;
    }
    isRunning = false;
    if (overlayEl) {
      overlayEl.style.display = "block";
      overlayEl.style.opacity = "1";
      overlayEl.classList.remove("fading-out");
    }
    start();
  }

  return { init, start, skip, replay };
})();
