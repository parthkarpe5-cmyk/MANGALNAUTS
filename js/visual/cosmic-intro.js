/* global THREE, window, document, requestAnimationFrame, cancelAnimationFrame */
window.MarsCosmicIntro = (function () {
  let overlayEl = null;
  let canvas = null;
  let renderer = null;
  let scene = null;
  let camera = null;
  let animId = null;
  let fadeTimeout = null;

  let skyDome = null;
  let galaxyPlane = null;
  let solarSystemGroup = null;

  let sunMesh = null;
  let sunCorona = null;
  let mercuryMesh = null;
  let venusMesh = null;
  let earthGroup = null;
  let earthMesh = null;
  let moonMesh = null;

  let hudStage = null;
  let hudTitle = null;
  let hudSub = null;
  let telemetryText = null;
  let progressBar = null;

  let startTime = 0;
  const DURATION_MS = 8500; // 8.5-second cinematic fly-through to Mars
  let isRunning = false;
  let hasSkipped = false;

  const textureLoader = new THREE.TextureLoader();

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
    renderer.setClearColor(0x010103, 1);

    scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x010103, 0.0003);

    camera = new THREE.PerspectiveCamera(54, width / height, 0.1, 6000);

    // 1. Build Photorealistic NASA/Gaia Celestial Sky Dome
    buildRealisticGalaxy();

    // 2. Build Authentic Planetary System (Transit directly into website's 3D Mars)
    buildRealisticSolarSystem();

    window.addEventListener("resize", onWindowResize);
  }

  function createGlowTexture(colorHex) {
    const c = document.createElement("canvas");
    c.width = 128;
    c.height = 128;
    const ctx = c.getContext("2d");
    const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, colorHex || "rgba(255, 255, 255, 1)");
    g.addColorStop(0.3, "rgba(200, 220, 255, 0.5)");
    g.addColorStop(0.7, "rgba(120, 160, 255, 0.15)");
    g.addColorStop(1, "rgba(0, 0, 0, 0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 128);
    return new THREE.CanvasTexture(c);
  }

  function buildRealisticGalaxy() {
    // Official NASA/Gaia Astrometric Celestial Starfield Panorama
    const starsTex = textureLoader.load("assets/textures/stars_milky_way.jpg");
    starsTex.generateMipmaps = true;

    const skyGeom = new THREE.SphereGeometry(3400, 64, 40);
    const skyMat = new THREE.MeshBasicMaterial({
      map: starsTex,
      side: THREE.BackSide,
    });
    skyDome = new THREE.Mesh(skyGeom, skyMat);
    scene.add(skyDome);

    // Distant High-Definition Spiral Galaxy View
    const galaxyTex = textureLoader.load("assets/textures/galaxy.jpg");
    galaxyTex.generateMipmaps = true;

    const galaxyGeom = new THREE.PlaneGeometry(1300, 800);
    const galaxyMat = new THREE.MeshBasicMaterial({
      map: galaxyTex,
      transparent: true,
      opacity: 0.90,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    galaxyPlane = new THREE.Mesh(galaxyGeom, galaxyMat);
    galaxyPlane.position.set(0, 10, -960);
    galaxyPlane.rotation.x = -0.28;
    scene.add(galaxyPlane);
  }

  function buildRealisticSolarSystem() {
    solarSystemGroup = new THREE.Group();

    // 1. The Sun (NASA SDO Photometric Map)
    const sunTex = textureLoader.load("assets/textures/sun.jpg");
    const sunGeom = new THREE.SphereGeometry(44, 48, 48);
    const sunMat = new THREE.MeshBasicMaterial({
      map: sunTex,
    });
    sunMesh = new THREE.Mesh(sunGeom, sunMat);
    sunMesh.position.set(0, 14, -580);
    solarSystemGroup.add(sunMesh);

    // Sun Corona & Radiant Halo
    const coronaMat = new THREE.SpriteMaterial({
      map: createGlowTexture("rgba(255, 200, 100, 1)"),
      color: 0xffbb44,
      transparent: true,
      opacity: 0.82,
      blending: THREE.AdditiveBlending,
    });
    sunCorona = new THREE.Sprite(coronaMat);
    sunCorona.scale.set(220, 220, 1);
    sunMesh.add(sunCorona);

    // Sun Point Light
    const sunLight = new THREE.PointLight(0xfff8ee, 3.5, 3200);
    sunMesh.add(sunLight);

    // Ambient Starlight
    const ambientLight = new THREE.AmbientLight(0x282c3c, 1.4);
    scene.add(ambientLight);

    // Directional Sunlight for crisp realistic shadows
    const dirLight = new THREE.DirectionalLight(0xfff5ea, 2.8);
    dirLight.position.set(0, 14, -580);
    scene.add(dirLight);

    // 2. Mercury (NASA MESSENGER 2K Map)
    const mercTex = textureLoader.load("assets/textures/mercury.jpg");
    const mercGeom = new THREE.SphereGeometry(3.6, 32, 32);
    const mercMat = new THREE.MeshStandardMaterial({
      map: mercTex,
      roughness: 0.92,
      metalness: 0.05,
    });
    mercuryMesh = new THREE.Mesh(mercGeom, mercMat);
    mercuryMesh.position.set(32, -6, -440);
    solarSystemGroup.add(mercuryMesh);

    // 3. Venus (NASA Magellan / Atmosphere 2K Map)
    const venusTex = textureLoader.load("assets/textures/venus.jpg");
    const venusGeom = new THREE.SphereGeometry(7.2, 32, 32);
    const venusMat = new THREE.MeshStandardMaterial({
      map: venusTex,
      roughness: 0.65,
      metalness: 0.02,
    });
    venusMesh = new THREE.Mesh(venusGeom, venusMat);
    venusMesh.position.set(-42, 14, -315);
    solarSystemGroup.add(venusMesh);

    // 4. Earth & Moon System (NASA Blue Marble 2K Map)
    earthGroup = new THREE.Group();
    earthGroup.position.set(46, -10, -165);

    const earthTex = textureLoader.load("assets/textures/earth.jpg");
    const earthGeom = new THREE.SphereGeometry(8.2, 48, 48);
    const earthMat = new THREE.MeshStandardMaterial({
      map: earthTex,
      roughness: 0.55,
      metalness: 0.1,
    });
    earthMesh = new THREE.Mesh(earthGeom, earthMat);
    earthGroup.add(earthMesh);

    // Earth Atmospheric Rayleigh Limb Glow
    const earthAtmoMat = new THREE.SpriteMaterial({
      map: createGlowTexture("rgba(80, 170, 255, 0.8)"),
      color: 0x48a4ff,
      transparent: true,
      opacity: 0.6,
      blending: THREE.AdditiveBlending,
    });
    const earthAtmo = new THREE.Sprite(earthAtmoMat);
    earthAtmo.scale.set(24, 24, 1);
    earthMesh.add(earthAtmo);

    // Moon (NASA LRO 2K Map)
    const moonTex = textureLoader.load("assets/textures/moon.jpg");
    const moonGeom = new THREE.SphereGeometry(2.2, 24, 24);
    const moonMat = new THREE.MeshStandardMaterial({
      map: moonTex,
      roughness: 0.95,
      metalness: 0.05,
    });
    moonMesh = new THREE.Mesh(moonGeom, moonMat);
    moonMesh.position.set(18, 5, 4);
    earthGroup.add(moonMesh);

    solarSystemGroup.add(earthGroup);

    // Note: Mars is rendered directly by our website's Cesium 3D Mars globe.
    // The camera traverses straight past the inner planets and hands off seamlessly
    // into our interactive 3D Mars model!

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

    // 1. Slow, majestic celestial rotations
    if (skyDome) {
      skyDome.rotation.y += 0.00015;
    }
    if (galaxyPlane) {
      galaxyPlane.rotation.z += 0.0004;
    }

    if (sunMesh) sunMesh.rotation.y += 0.0015;
    if (mercuryMesh) mercuryMesh.rotation.y += 0.006;
    if (venusMesh) venusMesh.rotation.y -= 0.004;
    if (earthMesh) earthMesh.rotation.y += 0.010;
    if (moonMesh && earthGroup) {
      moonMesh.position.x = Math.cos(now * 0.0016) * 18;
      moonMesh.position.z = Math.sin(now * 0.0016) * 18;
    }

    // 2. Cinematic Camera Traversal Spline (Hyperspace glide toward Mars)
    updateCameraPath(progress);

    // 3. Update HUD telemetry
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

    // Smooth cubic ease-in-out curve
    const ease = p < 0.5 ? 2 * p * p : -1 + (4 - 2 * p) * p;

    // Camera travels smoothly along Z axis from deep galaxy overview to Mars insertion point
    const startZ = -1180;
    const endZ = -20; // Reaching Mars orbital insertion
    const curZ = startZ + (endZ - startZ) * ease;

    // Natural camera drifting on X and Y, centering to (0, 0) as it arrives at Mars
    const centering = 1 - ease;
    const curX = Math.sin(p * Math.PI * 1.5) * 16 * centering;
    const curY = (Math.cos(p * Math.PI) * 10 + 4) * centering;

    camera.position.set(curX, curY, curZ);

    // Look forward along trajectory
    camera.lookAt(0, 0, curZ + 120);
  }

  function updateHud(p) {
    const pct = Math.round(p * 100);
    if (progressBar) progressBar.style.width = pct + "%";

    if (p < 0.28) {
      if (hudStage) hudStage.textContent = "MILKY WAY GALAXY // 100,000 LIGHT-YEARS";
      if (hudTitle) hudTitle.textContent = "INTERPLANETARY PROLOGUE";
      if (hudSub) hudSub.textContent = "APPROACHING SOLAR SYSTEM COORDINATES";
      if (telemetryText) telemetryText.textContent = "GALACTIC LATITUDE: +12.4° · VELOCITY: 0.85c";
    } else if (p < 0.50) {
      if (hudStage) hudStage.textContent = "SOLAR CORE // 1.00 SOLAR RADIUS";
      if (hudTitle) hudTitle.textContent = "PASSING THE SUN";
      if (hudSub) hudSub.textContent = "NASA SDO OPTICAL/UV · CORONAL MASS EQUILIBRIUM";
      if (telemetryText) telemetryText.textContent = "SOLAR FLUX: 1361 W/m² · TEMP: 5,778 K";
    } else if (p < 0.72) {
      if (hudStage) hudStage.textContent = "INNER PLANETS // MERCURY & VENUS";
      if (hudTitle) hudTitle.textContent = "INNER SYSTEM CRUISE";
      if (hudSub) hudSub.textContent = "NASA MESSENGER & MAGELLAN DATA CORRIDOR";
      if (telemetryText) telemetryText.textContent = "DIST: 0.72 AU · RAD DOSIMETRY: 22.4 uSv/hr";
    } else if (p < 0.88) {
      if (hudStage) hudStage.textContent = "EARTH-MOON SYSTEM // 1.00 AU";
      if (hudTitle) hudTitle.textContent = "TERRESTRIAL RENDEZVOUS";
      if (hudSub) hudSub.textContent = "NASA BLUE MARBLE · DEEP SPACE NETWORK LOCK";
      if (telemetryText) telemetryText.textContent = "HOMELAND TRANSMISSION: 8.4 GHz DSN GOLDSTONE";
    } else {
      if (hudStage) hudStage.textContent = "TARGET ACQUIRED // 1.52 AU";
      if (hudTitle) hudTitle.textContent = "MARS ORBITAL INSERTION";
      if (hudSub) hudSub.textContent = "HANDING OFF TO 3D OPERATIONAL SURFACE COCKPIT";
      if (telemetryText) telemetryText.textContent = "INSERTION COMPLETE · COMMENCING SURFACE TELEMETRY";
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
      }, 900);
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
