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
  let starPoints = null;
  let galaxyGroup = null;
  let galaxyCoreSprite = null;
  let galaxyNebulaPlane = null;
  let galaxyArmPoints = null;
  let galaxyCorePoints = null;
  let solarSystemGroup = null;

  let sunMesh = null;
  let sunCorona = null;
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

  const DURATION_MS = 8400; // Cinematic 8.4-second balanced interplanetary traversal
  let isRunning = false;
  let isFadingOut = false;
  let hasSkipped = false;
  let hasPoppedCockpitUI = false;

  let lastTimestamp = 0;
  let virtualElapsed = 0;

  const textureLoader = new THREE.TextureLoader();

  function isIntroRunning() {
    return isRunning && !isFadingOut;
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

    // Keyboard shortcut to skip intro
    window.addEventListener("keydown", function (e) {
      if (!isRunning || isFadingOut) return;
      if (e.key === "Escape" || e.key === " " || e.key === "Enter") {
        skip();
      }
    });

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
    // Cap pixel ratio at 1.25 to prevent fill-rate lag on high-DPI screens
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.25));
    renderer.setClearColor(0x010103, 1);

    scene = new THREE.Scene();

    camera = new THREE.PerspectiveCamera(50, width / height, 1.0, 8000);

    // 1. Build Photorealistic NASA Astrometry & 3D Spiral Galaxy
    buildRealisticGalaxy();

    // 2. Build Authentic Planetary System (Sun, Mercury, Venus, Earth-Moon, and Seamless Mars)
    buildRealisticSolarSystem();

    window.addEventListener("resize", onWindowResize);
  }

  // Realistic Airy-disk Gaussian point sprite for real astronomical stars
  function createPinprickStarTexture() {
    const c = document.createElement("canvas");
    c.width = 64;
    c.height = 64;
    const ctx = c.getContext("2d");
    const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, "rgba(255, 255, 255, 1)");
    g.addColorStop(0.12, "rgba(255, 255, 255, 0.95)");
    g.addColorStop(0.35, "rgba(225, 238, 255, 0.50)");
    g.addColorStop(0.70, "rgba(160, 200, 255, 0.10)");
    g.addColorStop(1, "rgba(0, 0, 0, 0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(c);
  }

  // Radiant core glow sprite for the galaxy nucleus
  function createGalaxyCoreTexture() {
    const c = document.createElement("canvas");
    c.width = 128;
    c.height = 128;
    const ctx = c.getContext("2d");
    const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, "rgba(255, 255, 255, 1)");
    g.addColorStop(0.15, "rgba(250, 235, 255, 0.92)");
    g.addColorStop(0.40, "rgba(216, 180, 254, 0.45)");
    g.addColorStop(0.70, "rgba(147, 51, 234, 0.12)");
    g.addColorStop(1, "rgba(0, 0, 0, 0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 128);
    return new THREE.CanvasTexture(c);
  }

  function createCoronaGlowTexture() {
    const c = document.createElement("canvas");
    c.width = 128;
    c.height = 128;
    const ctx = c.getContext("2d");
    const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, "rgba(255, 255, 240, 1)");
    g.addColorStop(0.20, "rgba(255, 200, 100, 0.85)");
    g.addColorStop(0.50, "rgba(255, 120, 40, 0.25)");
    g.addColorStop(1, "rgba(0, 0, 0, 0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 128);
    return new THREE.CanvasTexture(c);
  }

  function buildRealisticGalaxy() {
    const starSprite = createPinprickStarTexture();

    // A. NASA/Gaia Deep Sky Astrometric Celestial Panorama (360° celestial sphere)
    const starsTex = textureLoader.load("assets/textures/stars_milky_way.jpg");
    starsTex.generateMipmaps = true;

    const skyGeom = new THREE.SphereGeometry(4500, 48, 32);
    const skyMat = new THREE.MeshBasicMaterial({
      map: starsTex,
      side: THREE.BackSide,
      depthWrite: false,
    });
    skyDome = new THREE.Mesh(skyGeom, skyMat);
    scene.add(skyDome);

    // B. High-Precision 3D Astrometric Starfield (16,000 points - optimized for rock-solid 60 FPS)
    const starCount = 16000;
    const starGeom = new THREE.BufferGeometry();
    const starPos = new Float32Array(starCount * 3);
    const starColors = new Float32Array(starCount * 3);

    for (let i = 0; i < starCount; i++) {
      const i3 = i * 3;
      const radius = 650 + Math.random() * 3200;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(Math.random() * 2 - 1);

      let x = radius * Math.sin(phi) * Math.cos(theta);
      let y = radius * Math.sin(phi) * Math.sin(theta);
      let z = radius * Math.cos(phi) - 500;

      // Clear central camera flight corridor so stars never collide with viewport
      const rDist = Math.hypot(x, y);
      if (rDist < 42) {
        const boost = 42 / Math.max(1, rDist);
        x *= boost;
        y *= boost;
      }

      starPos[i3] = x;
      starPos[i3 + 1] = y;
      starPos[i3 + 2] = z;

      // Astronomical Planck blackbody temperature spectrum
      const rVal = Math.random();
      if (rVal < 0.52) {
        // Pure Brilliant White (A-class stars, Vega/Sirius)
        starColors[i3] = 1.0; starColors[i3 + 1] = 1.0; starColors[i3 + 2] = 1.0;
      } else if (rVal < 0.78) {
        // Diamond Blue-White (Hot O/B stars)
        starColors[i3] = 0.85; starColors[i3 + 1] = 0.92; starColors[i3 + 2] = 1.0;
      } else if (rVal < 0.93) {
        // Warm Sol-type (G-class stars, Sun/Alpha Centauri)
        starColors[i3] = 1.0; starColors[i3 + 1] = 0.96; starColors[i3 + 2] = 0.88;
      } else {
        // Soft Amber/Orange Giant (K/M-class, Arcturus/Betelgeuse)
        starColors[i3] = 1.0; starColors[i3 + 1] = 0.78; starColors[i3 + 2] = 0.62;
      }
    }

    starGeom.setAttribute("position", new THREE.BufferAttribute(starPos, 3));
    starGeom.setAttribute("color", new THREE.BufferAttribute(starColors, 3));

    const starPointMat = new THREE.PointsMaterial({
      size: 1.8,
      map: starSprite,
      vertexColors: true,
      transparent: true,
      opacity: 0.92,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    starPoints = new THREE.Points(starGeom, starPointMat);
    scene.add(starPoints);

    // C. TRUE 3D SPIRAL GALAXY (Matching user's purple, lilac & white sparkling galaxy)
    galaxyGroup = new THREE.Group();
    galaxyGroup.position.set(0, 20, -820);
    // Tilted disk orientation: ~24° forward tilt and ~10° roll, framing the galaxy gracefully
    galaxyGroup.rotation.x = -0.42;
    galaxyGroup.rotation.z = -0.16;

    // 1. Central Bulge Particles (8,000 dense, luminous nucleus stars)
    const coreCount = 8000;
    const coreGeom = new THREE.BufferGeometry();
    const corePos = new Float32Array(coreCount * 3);
    const coreColors = new Float32Array(coreCount * 3);

    for (let i = 0; i < coreCount; i++) {
      const i3 = i * 3;
      const r = Math.pow(Math.random(), 2.2) * 85;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(Math.random() * 2 - 1);

      corePos[i3] = r * Math.sin(phi) * Math.cos(theta);
      corePos[i3 + 1] = (r * 0.42) * Math.cos(phi); // Oblate spheroid bulge
      corePos[i3 + 2] = r * Math.sin(phi) * Math.sin(theta);

      // Core colors: Brilliant pure white and soft rose/lavender glow
      const t = r / 85;
      if (t < 0.35) {
        coreColors[i3] = 1.0; coreColors[i3 + 1] = 1.0; coreColors[i3 + 2] = 1.0;
      } else {
        coreColors[i3] = 0.96; coreColors[i3 + 1] = 0.88; coreColors[i3 + 2] = 1.0;
      }
    }
    coreGeom.setAttribute("position", new THREE.BufferAttribute(corePos, 3));
    coreGeom.setAttribute("color", new THREE.BufferAttribute(coreColors, 3));

    const corePointMat = new THREE.PointsMaterial({
      size: 2.4,
      map: starSprite,
      vertexColors: true,
      transparent: true,
      opacity: 0.96,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    galaxyCorePoints = new THREE.Points(coreGeom, corePointMat);
    galaxyGroup.add(galaxyCorePoints);

    // 2. Central Core Glow Halo Sprite
    const coreHaloMat = new THREE.SpriteMaterial({
      map: createGalaxyCoreTexture(),
      color: 0xf5d0fe,
      transparent: true,
      opacity: 0.82,
      blending: THREE.AdditiveBlending,
    });
    galaxyCoreSprite = new THREE.Sprite(coreHaloMat);
    galaxyCoreSprite.scale.set(150, 150, 1);
    galaxyGroup.add(galaxyCoreSprite);

    // 3. Logarithmic Spiral Arms (16,000 sparkling purple & lilac stars)
    const armCount = 16000;
    const armGeom = new THREE.BufferGeometry();
    const armPos = new Float32Array(armCount * 3);
    const armColors = new Float32Array(armCount * 3);

    for (let i = 0; i < armCount; i++) {
      const i3 = i * 3;
      const r = 30 + Math.pow(Math.random(), 1.4) * 280;
      const armIndex = i % 2; // 2 major logarithmic spiral arms
      const baseAngle = armIndex * Math.PI + (r / 82);
      const angleSpread = (Math.random() - 0.5) * (0.32 + (r / 280) * 0.40);
      const radSpread = (Math.random() - 0.5) * 20;

      const currentAngle = baseAngle + angleSpread;
      const currentRadius = r + radSpread;

      armPos[i3] = Math.cos(currentAngle) * currentRadius;
      // Exponential disk scale height (thicker near center, thin at rim)
      armPos[i3 + 1] = (Math.random() - 0.5) * 26 * Math.exp(-r / 150);
      armPos[i3 + 2] = Math.sin(currentAngle) * currentRadius;

      // Colors matching user's image: Radiant lilac/lavender -> deep royal purple
      const normR = r / 310;
      const isSparkleCluster = Math.random() < 0.08;

      if (isSparkleCluster) {
        // Bright diamond white star cluster along the spiral arm
        armColors[i3] = 1.0; armColors[i3 + 1] = 1.0; armColors[i3 + 2] = 1.0;
      } else if (normR < 0.40) {
        // Inner arms: Luminous lilac / lavender (#d8b4fe)
        armColors[i3] = 0.85; armColors[i3 + 1] = 0.70; armColors[i3 + 2] = 1.0;
      } else if (normR < 0.75) {
        // Mid arms: Vivid cosmic violet (#c084fc / #a855f7)
        armColors[i3] = 0.72; armColors[i3 + 1] = 0.45; armColors[i3 + 2] = 0.98;
      } else {
        // Outer arms: Deep galactic purple / indigo (#818cf8 / #6366f1)
        armColors[i3] = 0.52; armColors[i3 + 1] = 0.38; armColors[i3 + 2] = 0.95;
      }
    }
    armGeom.setAttribute("position", new THREE.BufferAttribute(armPos, 3));
    armGeom.setAttribute("color", new THREE.BufferAttribute(armColors, 3));

    const armPointMat = new THREE.PointsMaterial({
      size: 1.9,
      map: starSprite,
      vertexColors: true,
      transparent: true,
      opacity: 0.90,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    galaxyArmPoints = new THREE.Points(armGeom, armPointMat);
    galaxyGroup.add(galaxyArmPoints);

    // 4. Feathered Nebular Backdrop (Provides soft interstellar dust haze)
    const galaxyTex = textureLoader.load("assets/textures/galaxy_alpha.png");
    galaxyTex.generateMipmaps = true;

    const nebulaGeom = new THREE.PlaneGeometry(540, 310);
    const nebulaMat = new THREE.MeshBasicMaterial({
      map: galaxyTex,
      transparent: true,
      opacity: 0.42,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    galaxyNebulaPlane = new THREE.Mesh(nebulaGeom, nebulaMat);
    galaxyNebulaPlane.position.set(0, 0, -2);
    galaxyGroup.add(galaxyNebulaPlane);

    scene.add(galaxyGroup);
  }

  function buildRealisticSolarSystem() {
    solarSystemGroup = new THREE.Group();

    // 1. The Sun (NASA SDO Photometric Map)
    const sunTex = textureLoader.load("assets/textures/sun.jpg");
    const sunGeom = new THREE.SphereGeometry(38, 48, 48);
    const sunMat = new THREE.MeshBasicMaterial({
      map: sunTex,
    });
    sunMesh = new THREE.Mesh(sunGeom, sunMat);
    sunMesh.position.set(0, 10, -520);
    solarSystemGroup.add(sunMesh);

    // Sun Corona & Radiant Halo
    const coronaMat = new THREE.SpriteMaterial({
      map: createCoronaGlowTexture(),
      color: 0xffbb44,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
    });
    sunCorona = new THREE.Sprite(coronaMat);
    sunCorona.scale.set(220, 220, 1);
    sunMesh.add(sunCorona);

    // Sun Point Light
    const sunLight = new THREE.PointLight(0xfff8ee, 3.8, 3500);
    sunMesh.add(sunLight);

    // Ambient Starlight
    const ambientLight = new THREE.AmbientLight(0x282c3c, 1.4);
    scene.add(ambientLight);

    // Directional Sunlight for crisp shadows on inner planets
    const dirLight = new THREE.DirectionalLight(0xfff5ea, 2.8);
    dirLight.position.set(0, 10, -520);
    scene.add(dirLight);

    // 2. Mercury (NASA MESSENGER 2K Map)
    const mercTex = textureLoader.load("assets/textures/mercury.jpg");
    const mercGeom = new THREE.SphereGeometry(3.5, 32, 32);
    const mercMat = new THREE.MeshStandardMaterial({
      map: mercTex,
      roughness: 0.92,
      metalness: 0.05,
    });
    mercuryMesh = new THREE.Mesh(mercGeom, mercMat);
    mercuryMesh.position.set(24, -4, -410);
    solarSystemGroup.add(mercuryMesh);

    // 3. Venus (NASA Magellan / Atmosphere 2K Map)
    const venusTex = textureLoader.load("assets/textures/venus.jpg");
    const venusGeom = new THREE.SphereGeometry(7.0, 32, 32);
    const venusMat = new THREE.MeshStandardMaterial({
      map: venusTex,
      roughness: 0.65,
      metalness: 0.02,
    });
    venusMesh = new THREE.Mesh(venusGeom, venusMat);
    venusMesh.position.set(-28, 6, -300);
    solarSystemGroup.add(venusMesh);

    // 4. Earth & Moon System (NASA Blue Marble 2K Map)
    earthGroup = new THREE.Group();
    earthGroup.position.set(32, -5, -170);

    const earthTex = textureLoader.load("assets/textures/earth.jpg");
    const earthGeom = new THREE.SphereGeometry(8.0, 48, 48);
    const earthMat = new THREE.MeshStandardMaterial({
      map: earthTex,
      roughness: 0.55,
      metalness: 0.1,
    });
    earthMesh = new THREE.Mesh(earthGeom, earthMat);
    earthGroup.add(earthMesh);

    // Earth Atmospheric Rayleigh Limb Glow
    const earthAtmoMat = new THREE.SpriteMaterial({
      map: createCoronaGlowTexture(),
      color: 0x48a4ff,
      transparent: true,
      opacity: 0.65,
      blending: THREE.AdditiveBlending,
    });
    const earthAtmo = new THREE.Sprite(earthAtmoMat);
    earthAtmo.scale.set(23, 23, 1);
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
    moonMesh.position.set(16, 4, 3);
    earthGroup.add(moonMesh);

    solarSystemGroup.add(earthGroup);

    // 5. Seamless Mars Model (100% matched to website Cesium model)
    // Uses authentic NASA Viking 2K map with subtle crescent terminator shadow.
    // Clamped strictly to max 1.0 brightness so it is NEVER overexposed or washed out.
    // Sized to radius 18.5 at distance 80, smoothly enlarging to fill cockpit scale.
    // Oriented to Longitude 35.0°E, Latitude 10.0°N (matching Cesium exactly).
    const marsTex = textureLoader.load("assets/textures/mars.jpg");
    marsTex.generateMipmaps = true;
    const marsGeom = new THREE.SphereGeometry(18.5, 64, 64);

    // ShaderMaterial delivers authentic, rich NASA Viking texture colors (strictly max 1.0)
    // while casting the elegant crescent terminator shadow matching the Cesium 3D cockpit
    const marsMat = new THREE.ShaderMaterial({
      uniforms: {
        marsTexture: { value: marsTex },
        // Sun vector matching Cesium's Sun orientation (JulianDate 2026-11-15T16:00:00Z)
        // Illuminates from the front-left, casting the crescent shadow along the right limb
        sunDir: { value: new THREE.Vector3(-0.75, 0.25, 0.62).normalize() },
      },
      vertexShader: [
        "varying vec3 vNormal;",
        "varying vec2 vUv;",
        "void main() {",
        "  vUv = uv;",
        "  vNormal = normalize(normalMatrix * normal);",
        "  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);",
        "}",
      ].join("\n"),
      fragmentShader: [
        "uniform sampler2D marsTexture;",
        "uniform vec3 sunDir;",
        "varying vec3 vNormal;",
        "varying vec2 vUv;",
        "void main() {",
        "  vec4 texColor = texture2D(marsTexture, vUv);",
        "  float nDotL = dot(vNormal, sunDir);",
        "  // Soft planetary terminator gradient matching Cesium shadow in uploaded screenshot",
        "  float terminator = smoothstep(-0.06, 0.22, nDotL);",
        "  // Factor is strictly between 0.02 (deep dark shadow) and 1.0 (pure raw texture daylight)",
        "  // NEVER exceeds 1.0 - preserves rich NASA Viking contrast with zero bleached highlights",
        "  float factor = mix(0.02, 1.0, terminator);",
        "  gl_FragColor = vec4(texColor.rgb * factor, 1.0);",
        "}",
      ].join("\n"),
    });

    marsMesh = new THREE.Mesh(marsGeom, marsMat);
    marsMesh.position.set(0, 0, 80);
    // Align face directly to Cesium target coordinates: 20.0°E, 5.0°N (matching screenshot)
    marsMesh.rotation.y = 0.35;
    marsMesh.rotation.x = -0.09;
    solarSystemGroup.add(marsMesh);

    // Subtle atmospheric peach-orange limb haze
    const marsGlowMat = new THREE.SpriteMaterial({
      map: createCoronaGlowTexture(),
      color: 0xef7a5d,
      transparent: true,
      opacity: 0.16,
      blending: THREE.AdditiveBlending,
    });
    marsAtmosphere = new THREE.Sprite(marsGlowMat);
    marsAtmosphere.scale.set(40, 40, 1);
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
    hasPoppedCockpitUI = false;
    isFadingOut = false;
    isRunning = true;
    lastTimestamp = 0;
    virtualElapsed = 0;

    // Set initial entrance state: hide all bars during prologue
    document.body.classList.add("cockpit-intro-active");
    document.body.classList.remove("cockpit-ready");

    if (window.MarsGlobe && window.MarsGlobe.prepareForCosmicIntro) {
      window.MarsGlobe.prepareForCosmicIntro();
    }

    if (overlayEl) {
      overlayEl.style.transition = "";
      overlayEl.style.display = "block";
      overlayEl.style.opacity = "1";
      overlayEl.classList.remove("fading-out");
    }
    animId = requestAnimationFrame(loop);
  }

  function loop(timestamp) {
    if (!isRunning) return;

    if (!lastTimestamp) lastTimestamp = timestamp;
    // Delta-time smoothing: clamp delta to max 33.3ms to prevent camera jumping if GC pauses
    const delta = Math.min(timestamp - lastTimestamp, 33.3);
    lastTimestamp = timestamp;

    virtualElapsed += delta;
    const progress = Math.min(1.0, virtualElapsed / DURATION_MS);

    // 1. Slow, majestic celestial rotations
    if (skyDome) skyDome.rotation.y += 0.00006;
    if (starPoints) starPoints.rotation.y += 0.00009;

    // 3D Spiral Galaxy graceful rotation around galactic axis
    if (galaxyGroup) {
      galaxyGroup.rotation.y += 0.0006;
      galaxyGroup.rotation.z += 0.0003;
    }

    // Nebular plane fades out gracefully as camera approaches the Sun
    if (galaxyNebulaPlane) {
      const nebFade = Math.max(0, 1 - progress * 2.2);
      galaxyNebulaPlane.material.opacity = 0.42 * nebFade;
    }

    if (sunMesh) sunMesh.rotation.y += 0.0012;
    if (mercuryMesh) mercuryMesh.rotation.y += 0.005;
    if (venusMesh) venusMesh.rotation.y -= 0.004;
    if (earthMesh) earthMesh.rotation.y += 0.008;
    if (moonMesh && earthGroup) {
      moonMesh.position.x = Math.cos(virtualElapsed * 0.0015) * 16;
      moonMesh.position.z = Math.sin(virtualElapsed * 0.0015) * 16;
    }

    // Mars orientation stays locked to Cesium coordinates: 20.0°E, 5.0°N
    // Smoothly and dramatically enlarges as camera enters planetary orbit (scale 1.0 -> 1.76)
    if (marsMesh) {
      const approachDrift = Math.max(0, 1 - progress) * 0.008;
      marsMesh.rotation.y = 0.35 + Math.sin(virtualElapsed * 0.0005) * approachDrift;
      marsMesh.rotation.x = -0.09;

      if (progress > 0.60) {
        // Smooth enlargement progress from 0 to 1 between 0.60 and 0.85
        const normEnlarge = Math.min(1.0, (progress - 0.60) / 0.25);
        // Smooth quintic ease: continuous acceleration and deceleration, zero jerk
        const easeEnlarge = normEnlarge * normEnlarge * normEnlarge * (normEnlarge * (normEnlarge * 6 - 15) + 10);
        // Scale smoothly enlarges from 1.0 to 1.76, filling the cockpit view
        const currentScale = 1.0 + easeEnlarge * 0.76;
        marsMesh.scale.set(currentScale, currentScale, currentScale);
      } else {
        marsMesh.scale.set(1.0, 1.0, 1.0);
      }
    }

    // 2. Continuous Silky-Smooth Camera Traversal Spline
    // Continues smooth forward momentum even during fadeout so there is zero abrupt stop
    const effectiveProgress = isFadingOut ? Math.min(1.18, virtualElapsed / DURATION_MS) : progress;
    updateCameraPath(effectiveProgress);

    // 3. Update HUD telemetry
    updateHud(progress);

    renderer.render(scene, camera);

    // At 85% progress (~7.4s), Mars has finished enlarging: navigation bars and stars POP into view!
    if (progress >= 0.85 && !hasPoppedCockpitUI) {
      hasPoppedCockpitUI = true;
      popCockpitUI();
    }

    // At 92% progress (~8.0s), seamlessly dissolve the intro overlay into the live Cesium globe
    if (progress >= 0.92 && !isFadingOut) {
      completeIntro();
    }

    animId = requestAnimationFrame(loop);
  }

  function updateCameraPath(p) {
    if (!camera) return;

    // Smooth quintic ease curve (continuous acceleration and deceleration, zero jerk)
    const normP = Math.min(1.0, p);
    const ease = normP * normP * normP * (normP * (normP * 6 - 15) + 10);

    // Forward glide from deep galaxy view (-1340) directly to Mars arrival point (0)
    const startZ = -1340;
    const endZ = 0;
    // For p > 1.0 during fadeout, keep drifting smoothly forward at constant speed
    const extraDrift = p > 1.0 ? (p - 1.0) * 90 : 0;
    const curZ = startZ + (endZ - startZ) * ease + extraDrift;

    // Gentle, monotonic cinematic descent from Y = 4 to Y = 0 (NO sine oscillations)
    const curY = 4 * (1 - ease);
    const curX = 0;

    camera.position.set(curX, curY, curZ);

    // Steady forward look target directly along Z toward Mars at (0, 0, 80)
    // Ensures completely stable horizon with zero pitch/yaw jerking
    const lookZ = Math.max(curZ + 120, 80);
    camera.lookAt(0, 0, lookZ);
  }

  function updateHud(p) {
    const pct = Math.round(Math.min(1.0, p) * 100);
    if (progressBar) progressBar.style.width = pct + "%";

    // As Mars arrives and enlarges, gently fade out the center text so Mars is cleanly showcased
    const hudCenter = document.querySelector(".cosmic-hud-center");
    if (hudCenter) {
      if (p >= 0.64) {
        const fadeRatio = Math.max(0, 1 - (p - 0.64) / 0.14);
        hudCenter.style.opacity = fadeRatio.toFixed(3);
      } else {
        hudCenter.style.opacity = "1";
      }
    }

    if (p < 0.24) {
      if (hudStage) hudStage.textContent = "DEEP COSMOS // INTERPLANETARY PROLOGUE";
      if (hudTitle) hudTitle.textContent = "MILKY WAY GALAXY";
      if (hudSub) hudSub.textContent = "APPROACHING SOLAR SYSTEM COORDINATES · WARP 0.92c";
      if (telemetryText) telemetryText.textContent = "SPECTRAL CLASS: SBb · 100,000 LIGHT-YEARS · 0.92c";
    } else if (p < 0.46) {
      if (hudStage) hudStage.textContent = "SOLAR CORE // 1.00 SOLAR RADIUS";
      if (hudTitle) hudTitle.textContent = "PASSING THE SUN";
      if (hudSub) hudSub.textContent = "NASA SDO OPTICAL/UV · CORONAL MASS EQUILIBRIUM";
      if (telemetryText) telemetryText.textContent = "SOLAR FLUX: 1361 W/m² · GRAVITY ASSIST LOCK";
    } else if (p < 0.60) {
      if (hudStage) hudStage.textContent = "INNER PLANETS // MERCURY & VENUS";
      if (hudTitle) hudTitle.textContent = "INNER SYSTEM CRUISE";
      if (hudSub) hudSub.textContent = "NASA MESSENGER & MAGELLAN DATA LOCK";
      if (telemetryText) telemetryText.textContent = "DIST: 0.72 AU · RAD DOSIMETRY: 22.4 uSv/hr";
    } else if (p < 0.74) {
      if (hudStage) hudStage.textContent = "TERRESTRIAL TRANSIT // 1.00 AU";
      if (hudTitle) hudTitle.textContent = "EARTH-MOON SYSTEM";
      if (hudSub) hudSub.textContent = "DSN GOLDSTONE 8.4 GHz · OUTBOUND TO MARS";
      if (telemetryText) telemetryText.textContent = "TRANS-MARS INJECTION NOMINAL · TARGET ACQUIRED";
    } else {
      if (hudStage) hudStage.textContent = "MARS ORBITAL INSERTION // 8,600 KM";
      if (hudTitle) hudTitle.textContent = "ARRIVING AT MARS";
      if (hudSub) hudSub.textContent = "ENLARGING PLANETARY GLOBE · SYNCHRONIZING WITH COCKPIT";
      if (telemetryText) telemetryText.textContent = "ALTITUDE: 8,600 KM · HDG: 000° · 20.0°E, 5.0°N";
    }
  }

  function popCockpitUI() {
    // 1. Reveal navigation and telemetry bars (slides in with smooth 0.75s transition)
    document.body.classList.remove("cockpit-intro-active");
    document.body.classList.add("cockpit-ready");

    // 2. Resume radial warp starfield backdrop behind Mars globe so stars pop into view
    if (window.MarsStarfield) {
      window.MarsStarfield.resume();
      window.MarsStarfield.resize();
    }

    // 3. Play audio chime
    if (window.MarsAudio && window.MarsAudio.playSuccess) {
      try {
        window.MarsAudio.playSuccess();
      } catch (e) {
        // audio optional
      }
    }

    // 4. Request Cesium render frame
    if (window.MarsGlobe && window.MarsGlobe.requestRender) {
      window.MarsGlobe.requestRender();
    }
  }

  function completeIntro() {
    if (isFadingOut) return;
    isFadingOut = true;

    if (!hasPoppedCockpitUI) {
      hasPoppedCockpitUI = true;
      popCockpitUI();
    }

    if (overlayEl) {
      overlayEl.classList.add("fading-out");
      if (fadeTimeout) clearTimeout(fadeTimeout);
      fadeTimeout = setTimeout(() => {
        isRunning = false;
        if (animId) {
          cancelAnimationFrame(animId);
          animId = null;
        }
        overlayEl.style.display = "none";
        overlayEl.style.opacity = "0";

        // Request final render for interactive Cesium cockpit
        if (window.MarsGlobe && window.MarsGlobe.requestRender) {
          window.MarsGlobe.requestRender();
        }
      }, 850);
    }
  }

  function skip() {
    if (hasSkipped) return;
    hasSkipped = true;

    if (!hasPoppedCockpitUI) {
      hasPoppedCockpitUI = true;
      popCockpitUI();
    }

    if (window.MarsGlobe && window.MarsGlobe.flyTo) {
      try {
        window.MarsGlobe.flyTo(10, 35, 9200000, 0.4);
      } catch (e) {
        console.warn("MarsGlobe flyTo error:", e);
      }
    }

    if (overlayEl) {
      overlayEl.style.transition = "opacity 0.3s ease-out";
      overlayEl.classList.add("fading-out");
      if (fadeTimeout) clearTimeout(fadeTimeout);
      fadeTimeout = setTimeout(() => {
        isRunning = false;
        if (animId) {
          cancelAnimationFrame(animId);
          animId = null;
        }
        overlayEl.style.display = "none";
        overlayEl.style.opacity = "0";
      }, 300);
    }
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
    hasPoppedCockpitUI = false;
    isRunning = false;
    isFadingOut = false;

    document.body.classList.add("cockpit-intro-active");
    document.body.classList.remove("cockpit-ready");

    if (window.MarsGlobe && window.MarsGlobe.prepareForCosmicIntro) {
      window.MarsGlobe.prepareForCosmicIntro();
    }

    if (overlayEl) {
      overlayEl.style.transition = "";
      overlayEl.style.display = "block";
      overlayEl.style.opacity = "1";
      overlayEl.classList.remove("fading-out");
    }
    start();
  }

  return { init, start, skip, replay, isRunning: isIntroRunning };
})();
