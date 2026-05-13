import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { DEFAULT_CONFIG, applyConfigToRefs } from '../store/ballConfig';

gsap.registerPlugin(ScrollTrigger);

const makeTimer = () => (THREE.Timer ? new THREE.Timer() : new THREE.Clock());
const getElapsed = (t) => (THREE.Timer ? t.getElapsed() : t.getElapsedTime());
const tickTimer = (t) => { if (THREE.Timer) t.update(); };

// ── Shared texture factory (called once, reused by both scenes) ───────────────
export function createBallTextures() {
  const SIZE = 512; // 512px with high repetition is perfect for dense, powdery stipple texture
  const heights = new Float32Array(SIZE * SIZE).fill(40); // baseline groove height

  // Jittered grid: ensures perfectly even density with zero clustering, patterns, or gaps
  const cellSize = 5; // 5x5 pixels cells
  const numCells = Math.floor(SIZE / cellSize);

  for (let cy = 0; cy < numCells; cy++) {
    for (let cx = 0; cx < numCells; cx++) {
      const bx = cx * cellSize;
      const by = cy * cellSize;

      // Center of the cell with organic jitter
      const jX = bx + cellSize / 2 + (Math.random() - 0.5) * 2.2;
      const jY = by + cellSize / 2 + (Math.random() - 0.5) * 2.2;

      const pr = 1.9 + Math.random() * 0.7; // ultra-fine pebble radius
      const peakH = 180 + Math.random() * 60;

      // Draw smooth dome for each pebble
      const x0 = Math.max(0, Math.floor(jX - pr - 1));
      const x1 = Math.min(SIZE - 1, Math.ceil(jX + pr + 1));
      const y0 = Math.max(0, Math.floor(jY - pr - 1));
      const y1 = Math.min(SIZE - 1, Math.ceil(jY + pr + 1));

      for (let py = y0; py <= y1; py++) {
        for (let px = x0; px <= x1; px++) {
          const dx = px - jX;
          const dy = py - jY;
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d < pr) {
            const t = Math.cos((d / pr) * Math.PI * 0.5);
            const h = peakH * t * t;
            const idx = py * SIZE + px;
            if (h > heights[idx]) heights[idx] = h;
          }
        }
      }
    }
  }

  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = SIZE;
  const ctx = canvas.getContext('2d');

  // 1. Albedo texture
  const albedoCanvas = document.createElement('canvas');
  albedoCanvas.width = albedoCanvas.height = SIZE;
  const actx = albedoCanvas.getContext('2d');
  const albedoImg = actx.createImageData(SIZE, SIZE);
  for (let i = 0; i < heights.length; i++) {
    const h = heights[i];
    let v;
    if (h <= 40) {
      v = 60 + Math.random() * 12; // groove dark micro-noise
    } else if (h >= 180) {
      v = 190 + (h - 180) * 0.25; // bright pebble top
    } else {
      v = 60 + ((h - 40) / 140) * 130; // smooth gradient
    }
    v = Math.min(245, Math.max(50, Math.round(v)));
    albedoImg.data[i * 4]     = v;
    albedoImg.data[i * 4 + 1] = v;
    albedoImg.data[i * 4 + 2] = v;
    albedoImg.data[i * 4 + 3] = 255;
  }
  actx.putImageData(albedoImg, 0, 0);
  const albedoTex = new THREE.CanvasTexture(albedoCanvas);
  albedoTex.wrapS = albedoTex.wrapT = THREE.RepeatWrapping;
  albedoTex.repeat.set(6, 6); // ultra-fine repeat for genuine stipple grain look
  albedoTex.colorSpace = THREE.SRGBColorSpace; // CRITICAL: required for base color multiplication

  // 2. Normal map
  const normalCanvas = document.createElement('canvas');
  normalCanvas.width = normalCanvas.height = SIZE;
  const nctx = normalCanvas.getContext('2d');
  const normalImg = nctx.createImageData(SIZE, SIZE);
  const STR = 5.0; // bump strength
  for (let py = 0; py < SIZE; py++) {
    for (let px = 0; px < SIZE; px++) {
      const i = py * SIZE + px;
      const hL = heights[py * SIZE + Math.max(0, px - 1)];
      const hR = heights[py * SIZE + Math.min(SIZE - 1, px + 1)];
      const hD = heights[Math.max(0, py - 1) * SIZE + px];
      const hU = heights[Math.min(SIZE - 1, py + 1) * SIZE + px];
      const dx = (hR - hL) * STR / 255;
      const dy = (hU - hD) * STR / 255;
      const len = Math.sqrt(dx * dx + dy * dy + 1);
      normalImg.data[i * 4]     = Math.round((-dx / len * 0.5 + 0.5) * 255);
      normalImg.data[i * 4 + 1] = Math.round((-dy / len * 0.5 + 0.5) * 255);
      normalImg.data[i * 4 + 2] = Math.round((1 / len * 0.5 + 0.5) * 255);
      normalImg.data[i * 4 + 3] = 255;
    }
  }
  nctx.putImageData(normalImg, 0, 0);
  const normalTex = new THREE.CanvasTexture(normalCanvas);
  normalTex.wrapS = normalTex.wrapT = THREE.RepeatWrapping;
  normalTex.repeat.set(6, 6);

  // 3. Roughness map
  const roughCanvas = document.createElement('canvas');
  roughCanvas.width = roughCanvas.height = SIZE;
  const rctx = roughCanvas.getContext('2d');
  const roughImg = rctx.createImageData(SIZE, SIZE);
  for (let i = 0; i < heights.length; i++) {
    const h = heights[i];
    const v = h <= 40 ? 230 : Math.round(230 - ((h - 40) / 200) * 90);
    roughImg.data[i * 4]     = v;
    roughImg.data[i * 4 + 1] = v;
    roughImg.data[i * 4 + 2] = v;
    roughImg.data[i * 4 + 3] = 255;
  }
  rctx.putImageData(roughImg, 0, 0);
  const roughTex = new THREE.CanvasTexture(roughCanvas);
  roughTex.wrapS = roughTex.wrapT = THREE.RepeatWrapping;
  roughTex.repeat.set(6, 6);

  // 4. Circle sprite
  const circEl = document.createElement('canvas'); circEl.width = circEl.height = 64;
  const circCtx = circEl.getContext('2d');
  const g = circCtx.createRadialGradient(32, 32, 0, 32, 32, 30);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.5, 'rgba(255,255,255,0.8)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  circCtx.fillStyle = g;
  circCtx.beginPath(); circCtx.arc(32, 32, 30, 0, Math.PI * 2); circCtx.fill();
  const circleTex = new THREE.CanvasTexture(circEl);

  return { albedoTex, normalTex, roughTex, circleTex };
}

export default function ThreeScene({ config = DEFAULT_CONFIG }) {
  const canvasRef = useRef(null);
  const ballRefs = useRef(null);

  // Reactive config updates (no scene rebuild)
  const isFirstRender = useRef(true);
  useEffect(() => {
    applyConfigToRefs(ballRefs.current, config);
    // Update ring colors to match new ball accent color
    if (ballRefs.current?.updateRingColors) {
      ballRefs.current.updateRingColors(config.baseColor || '#ea580c');
    }
    // Trigger fast spin on arrow key style changes (skip on first mount)
    if (!isFirstRender.current && ballRefs.current?.triggerSpin) {
      ballRefs.current.triggerSpin();
    }
    isFirstRender.current = false;
  }, [config]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const testCtx = canvas.getContext('webgl2') || canvas.getContext('webgl');
    if (!testCtx) return;

    // ── Renderer ─────────────────────────────────────────────────────────────
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.4;

    // ── Scene ─────────────────────────────────────────────────────────────────
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x050505, 0.018);
    const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
    let cameraZ = window.innerWidth < 768 ? 22 : 15;
    camera.position.set(0, 0, cameraZ);

    // ── Ball & Lights Container (keeps studio lighting perfectly consistent in all positions) ──
    const ballContainer = new THREE.Group();
    scene.add(ballContainer);

    // ── Lighting — dramatic studio setup for photorealistic specular highlight ──
    const hemi = new THREE.HemisphereLight(0xffeedd, 0x111111, 0.8); // Boosted ambient fill
    ballContainer.add(hemi);

    // PRIMARY LEFT KEY LIGHT: powerful DirectionalLight from upper-left-front
    const mainLight = new THREE.DirectionalLight(0xffffff, 11.5); // Left key light
    mainLight.position.set(-6, 8, 6);   // upper-left-front
    mainLight.castShadow = true;
    mainLight.shadow.mapSize.width = mainLight.shadow.mapSize.height = 2048;
    mainLight.shadow.camera.near = 0.5;
    mainLight.shadow.camera.far = 50;
    mainLight.shadow.bias = -0.001;
    ballContainer.add(mainLight);
    ballContainer.add(mainLight.target);

    // PRIMARY RIGHT KEY LIGHT: powerful DirectionalLight from upper-right-front (fades up on left scroll)
    const mainLightR = new THREE.DirectionalLight(0xffffff, 0.0); // Right key light, starts at 0
    mainLightR.position.set(6, 8, 6);   // upper-right-front
    mainLightR.castShadow = true;
    mainLightR.shadow.mapSize.width = mainLightR.shadow.mapSize.height = 2048;
    mainLightR.shadow.camera.near = 0.5;
    mainLightR.shadow.camera.far = 50;
    mainLightR.shadow.bias = -0.001;
    ballContainer.add(mainLightR);
    ballContainer.add(mainLightR.target);

    // DUAL RIM LIGHTS: warm amber from right & left — recovers shadow sides beautifully
    const rimLight = new THREE.PointLight(0xff7733, 4.5, 22); // Right rim
    rimLight.position.set(6, -2, 4);
    ballContainer.add(rimLight);

    const rimLightL = new THREE.PointLight(0xff7733, 4.5, 22); // Left rim
    rimLightL.position.set(-6, -2, 4);
    ballContainer.add(rimLightL);

    // DUAL BACK RIMS: cool blue from rear-right & rear-left for incredible edge separation
    const fillLight = new THREE.SpotLight(0x3366ff, 5.0, 30, Math.PI / 4, 0.4, 1.2); // Right back rim
    fillLight.position.set(5, 3, -10);
    ballContainer.add(fillLight);
    ballContainer.add(fillLight.target);

    const fillLightL = new THREE.SpotLight(0x3366ff, 5.0, 30, Math.PI / 4, 0.4, 1.2); // Left back rim
    fillLightL.position.set(-5, 3, -10);
    ballContainer.add(fillLightL);
    ballContainer.add(fillLightL.target);

    // SUBTLE FRONT FILL: very soft warm bounce
    const fillLight2 = new THREE.PointLight(0xffe8cc, 1.8, 18); // Boosted front fill
    fillLight2.position.set(0, -2, 7);
    ballContainer.add(fillLight2);

    // DEDICATED PODIUM SPOTLIGHT: illuminates the slate titanium-steel curves and laser rings brilliantly
    const podiumSpot = new THREE.SpotLight(0xffffff, 28.0, 18, Math.PI / 4, 0.4, 0.8);
    podiumSpot.position.set(0, -7, 6);
    podiumSpot.target.position.set(0, -1.5, 0); // Targeted directly at the center of the podium
    scene.add(podiumSpot);
    scene.add(podiumSpot.target);

    // ── Textures ──────────────────────────────────────────────────────────────
    const { albedoTex, normalTex, roughTex, circleTex } = createBallTextures();

    // ── Basketball ────────────────────────────────────────────────────────────
    const ballGroup = new THREE.Group();
    const ballRadius = 2;

    const sphereGeo = new THREE.SphereGeometry(ballRadius, 128, 128);
    const sphereMat = new THREE.MeshPhysicalMaterial({
      map: albedoTex,
      normalMap: normalTex,
      normalScale: new THREE.Vector2(1.8, 1.8), // strong bump for visible pebbles
      roughnessMap: roughTex,
      roughness: 0.46,   // slightly polished leather — allows bright specular
      metalness: 0.0,
      clearcoat: 0.35,   // thin rubber/lacquer coating on real basketballs
      clearcoatRoughness: 0.18, // coating is fairly smooth = sharp highlight
    });
    const sphere = new THREE.Mesh(sphereGeo, sphereMat);
    sphere.castShadow = sphere.receiveShadow = true;
    ballGroup.add(sphere);

    // Seam lines — flat 2D lines that do not react to lighting (perfect matte flat vector look)
    const seamMat = new THREE.MeshBasicMaterial({ color: 0x111111 });
    const ST = 0.032; // Bolder width for strong visual definition and legibility
    const SR = ballRadius + 0.001; // Extremely flush to avoid wire/tube look and look inlaid

    function makeSeam(radius, thick, rx = 0, ry = 0, rz = 0) {
      const geo = new THREE.TorusGeometry(radius, thick, 24, 160);
      const m = new THREE.Mesh(geo, seamMat);
      m.rotation.set(rx, ry, rz);
      m.castShadow = m.receiveShadow = true;
      ballGroup.add(m);
      return { mesh: m, geo };
    }

    // Helper to create mathematically perfect, flush curved seams by translating on Z then rotating
    function makeCurveSeam(radius, thick, offset, rx, ry, rz) {
      const group = new THREE.Group();
      const geo = new THREE.TorusGeometry(radius, thick, 24, 160);
      const m = new THREE.Mesh(geo, seamMat);
      m.position.z = offset; // translate along local axis
      m.castShadow = m.receiveShadow = true;
      group.add(m);
      group.rotation.set(rx, ry, rz);
      ballGroup.add(group);
      return { mesh: m, group, geo };
    }

    const d = 1.05; // standard basketball panel offset
    const rCurve = Math.sqrt(SR * SR - d * d); // Torus radius for perfect sphere fit (approx 1.70)

    const seamEq = makeSeam(SR, ST, Math.PI / 2, 0, 0); // Equator
    const seamV1 = makeSeam(SR, ST, 0, Math.PI / 2, 0); // Side Vertical Meridian
    const seamV2 = makeSeam(SR, ST, 0, 0, 0);           // Front Vertical Meridian

    // Left/Right sweeping panels
    const seamC1 = makeCurveSeam(rCurve, ST, d, 0, Math.PI / 4, 0);
    // Front/Back sweeping panels (rotated 90 deg and perpendicular)
    const seamC2 = makeCurveSeam(rCurve, ST, d, Math.PI / 4, 0, Math.PI / 2);

    ballGroup.rotation.set(Math.PI / 6, Math.PI / 4, 0);
    ballContainer.add(ballGroup);

    // Shadow catcher
    const shadowPlaneGeo = new THREE.PlaneGeometry(20, 20);
    const shadowPlaneMat = new THREE.ShadowMaterial({ opacity: 0.4 });
    const shadowPlane = new THREE.Mesh(shadowPlaneGeo, shadowPlaneMat);
    shadowPlane.rotation.x = -Math.PI / 2;
    shadowPlane.position.y = -9;  // far enough below to not clip the radar rings
    shadowPlane.receiveShadow = true;
    scene.add(shadowPlane);

    // ── Technical radar rings (reference image style) ─────────────────────────
    const ringsGroup = new THREE.Group();

    // Helper: smooth circle geometry in the XY plane
    function makeCircleGeo(radius, segs = 200) {
      const pts = new Float32Array((segs + 1) * 3);
      for (let i = 0; i <= segs; i++) {
        const θ = (i / segs) * Math.PI * 2;
        pts[i * 3] = Math.cos(θ) * radius;
        pts[i * 3 + 1] = Math.sin(θ) * radius;
        pts[i * 3 + 2] = 0;
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pts, 3));
      return geo;
    }

    // Helper: tick marks at N evenly-spaced positions on a circle
    function makeTickGroup(radius, outerExt, innerExt, tickColor, count, opacity = 0.9) {
      const group = new THREE.Group();
      const mat = new THREE.LineBasicMaterial({ color: tickColor, transparent: true, opacity });
      for (let i = 0; i < count; i++) {
        const θ = (i / count) * Math.PI * 2;
        const cx = Math.cos(θ), cy = Math.sin(θ);
        const pts = new Float32Array([
          cx * (radius - innerExt), cy * (radius - innerExt), 0,
          cx * (radius + outerExt), cy * (radius + outerExt), 0,
        ]);
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(pts, 3));
        group.add(new THREE.Line(geo, mat.clone()));
      }
      return group;
    }

    // Collect all accent-colored tick materials so we can recolor them to match ball color
    const accentMats = [];

    // Crosshair lines — subtle gray lines from center to outer ring
    // Crosshair lines — subtle white lines from center to outer ring
    const crosshairMat = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.15 });
    const innerR = 2.4, middleR = 3.3, outerR = 4.3;
    for (let i = 0; i < 4; i++) {
      const θ = (i / 4) * Math.PI * 2;
      const pts = new Float32Array([
        Math.cos(θ) * 1.5, Math.sin(θ) * 1.5, 0,
        Math.cos(θ) * outerR, Math.sin(θ) * outerR, 0,
      ]);
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pts, 3));
      ringsGroup.add(new THREE.Line(geo, crosshairMat));
    }

    // Ticks function using clean white
    function makeAccentTickGroup(radius, outerExt, innerExt, count, opacity = 0.7) {
      const group = new THREE.Group();
      for (let i = 0; i < count; i++) {
        const mat = new THREE.LineBasicMaterial({
          color: 0xffffff, transparent: true, opacity
        });
        const θ = (i / count) * Math.PI * 2;
        const cx = Math.cos(θ), cy = Math.sin(θ);
        const pts = new Float32Array([
          cx * (radius - innerExt), cy * (radius - innerExt), 0,
          cx * (radius + outerExt), cy * (radius + outerExt), 0,
        ]);
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(pts, 3));
        group.add(new THREE.Line(geo, mat));
      }
      return group;
    }

    // 1. Inner Ring — rotates counter-clockwise (white only)
    const innerRingGroup = new THREE.Group();
    const innerCircleGeo = makeCircleGeo(innerR);
    const innerLineMat = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.25 });
    innerRingGroup.add(new THREE.Line(innerCircleGeo, innerLineMat));
    innerRingGroup.add(makeAccentTickGroup(innerR, 0.25, 0.08, 4, 0.8));  // cardinal ticks
    innerRingGroup.add(makeTickGroup(innerR, 0.1, 0.03, 0xffffff, 8, 0.15)); // sub-ticks
    ringsGroup.add(innerRingGroup);

    // 2. Middle Ring — rotates clockwise (white only)
    const middleRingGroup = new THREE.Group();
    const middleCircleGeo = makeCircleGeo(middleR);
    const middleLineMat = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.18 });
    middleRingGroup.add(new THREE.Line(middleCircleGeo, middleLineMat));
    middleRingGroup.add(makeAccentTickGroup(middleR, 0.28, 0.09, 6, 0.7)); // ticks
    middleRingGroup.add(makeTickGroup(middleR, 0.1, 0.04, 0xffffff, 12, 0.12));
    middleRingGroup.rotation.z = Math.PI / 6;
    ringsGroup.add(middleRingGroup);

    // 3. Outer Ring — rotates counter-clockwise (white only)
    const outerRingGroup = new THREE.Group();
    const outerCircleGeo = makeCircleGeo(outerR);
    const outerLineMat = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.12 });
    outerRingGroup.add(new THREE.Line(outerCircleGeo, outerLineMat));
    outerRingGroup.add(makeAccentTickGroup(outerR, 0.32, 0.1, 4, 0.6)); // ticks
    outerRingGroup.add(makeTickGroup(outerR, 0.12, 0.04, 0xffffff, 16, 0.1));
    outerRingGroup.rotation.z = Math.PI / 4;
    ringsGroup.add(outerRingGroup);

    // Tilt rings 0° on X for perfect undistorted flat clinical circles
    ringsGroup.rotation.x = 0;
    ringsGroup.scale.set(0, 0, 0); // hidden at start, GSAP brings them in precisely
    scene.add(ringsGroup);


    // ── Multi-tier Championship Podium (reference SS2) ────────────────────
    const podiumGroup = new THREE.Group();
    const podiumMat = new THREE.MeshStandardMaterial({
      color: 0x242831,       // Premium dark slate titanium steel
      metalness: 0.9,       // High metallic shine
      roughness: 0.18,      // Smooth semi-matte finish to reflect lights beautifully
    });

    // Base tier — widest, flat disc
    const baseTierGeo = new THREE.CylinderGeometry(3.8, 4.0, 0.45, 128);
    const baseTier = new THREE.Mesh(baseTierGeo, podiumMat);
    baseTier.position.y = -1.775; baseTier.receiveShadow = true;
    podiumGroup.add(baseTier);

    // Middle tier — main column
    const midTierGeo = new THREE.CylinderGeometry(2.5, 3.0, 1.5, 128);
    const midTier = new THREE.Mesh(midTierGeo, podiumMat);
    midTier.position.y = -0.8; midTier.receiveShadow = true;
    podiumGroup.add(midTier);

    // Top platform — narrowest
    const topTierGeo = new THREE.CylinderGeometry(1.75, 2.0, 0.38, 128);
    const topTier = new THREE.Mesh(topTierGeo, podiumMat);
    topTier.position.y = 0.0; topTier.receiveShadow = true; topTier.castShadow = true;
    podiumGroup.add(topTier);

    // White glowing ring on top edge of top platform — stays clean clinical white
    const topRingGeo = new THREE.TorusGeometry(1.76, 0.022, 16, 200);
    const topRingMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const topRingMesh = new THREE.Mesh(topRingGeo, topRingMat);
    topRingMesh.rotation.x = Math.PI / 2;
    topRingMesh.position.y = 0.192; // top edge of top tier
    podiumGroup.add(topRingMesh);

    // Inner accent laser ring (slightly smaller) — dynamically matches ball color!
    const innerRingGeoP = new THREE.TorusGeometry(1.6, 0.015, 16, 200);
    const innerRingMatP = new THREE.MeshBasicMaterial({ color: 0xff44aa }); // Default pink, updated on preset change
    const innerRingMeshP = new THREE.Mesh(innerRingGeoP, innerRingMatP);
    innerRingMeshP.rotation.x = Math.PI / 2;
    innerRingMeshP.position.y = 0.192;
    podiumGroup.add(innerRingMeshP);

    // Edge glow on middle tier — dynamically matches ball color!
    const midEdgeGeo = new THREE.TorusGeometry(2.52, 0.015, 16, 200);
    const midEdgeMat = new THREE.MeshBasicMaterial({ color: 0xff44aa }); // Default pink, updated on preset change
    const midEdgeMesh = new THREE.Mesh(midEdgeGeo, midEdgeMat);
    midEdgeMesh.rotation.x = Math.PI / 2;
    midEdgeMesh.position.y = -0.04; // top edge of mid tier (since mid is at -0.8 and height 1.5, top is at -0.85 + 0.75 = -0.1)
    podiumGroup.add(midEdgeMesh);

    podiumGroup.position.y = -12;
    scene.add(podiumGroup);


    // Particles
    const particleCount = 1200;
    const particleGeo = new THREE.BufferGeometry();
    const particlePos = new Float32Array(particleCount * 3);
    const particleSpeeds = [];
    for (let i = 0; i < particleCount; i++) {
      const r = Math.random() * 9 + 2, θ = Math.random() * Math.PI * 2, y = (Math.random() - 0.5) * 22;
      particlePos[i * 3] = r * Math.cos(θ); particlePos[i * 3 + 1] = y; particlePos[i * 3 + 2] = r * Math.sin(θ);
      particleSpeeds.push(Math.random() * 0.04 + 0.008);
    }
    particleGeo.setAttribute('position', new THREE.BufferAttribute(particlePos, 3));
    const particleMat = new THREE.PointsMaterial({
      color: 0xffaa44, size: 0.09, transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, map: circleTex, depthWrite: false,
    });
    const particleSystem = new THREE.Points(particleGeo, particleMat);
    scene.add(particleSystem);

    // Expose refs for reactive config & animations
    // triggerSpin will wire itself to the spin object via a ref once spin is defined below
    let spinRef = null;
    function triggerSpin() {
      if (!spinRef) return;
      // Do not kill tweens of spinRef because those are owned by the scroll timeline.
      // Just snappy-spin the ball rotation directly on Y axis
      gsap.killTweensOf(ballGroup.rotation);
      ballGroup.rotation.x = 0;
      ballGroup.rotation.z = 0;
      gsap.to(ballGroup.rotation, { y: `+=${Math.PI * 2 * 3}`, duration: 1.2, ease: 'power3.out' });
      spinRef.y = 0.005; // Set base continuous auto-spin speed
    }

    // Dynamic ring color matching ball accent color (no-op to keep rings white, but colors podium!)
    function updateRingColors(hexColor) {
      const c = new THREE.Color(hexColor);
      innerRingMatP.color.copy(c);
      midEdgeMat.color.copy(c);
    }

    ballRefs.current = {
      sphereMat, seamMat, scene,
      seams: {
        eq: seamEq.mesh, v1: seamV1.mesh, v2: seamV2.mesh,
        c1: seamC1.mesh, c2: seamC1.mesh, c3: seamC2.mesh, c4: seamC2.mesh
      },
      hemi, mainLight, rimLight, fillLight, fillLight2,
      triggerSpin,
      updateRingColors,
    };
    applyConfigToRefs(ballRefs.current, config);

    // Ball → DOM placeholder
    function matchBallToPlaceholder() {
      if (window.scrollY > 100) return;
      const ph = document.getElementById('ball-placeholder');
      if (!ph) return;
      const rect = ph.getBoundingClientRect();
      const vec = new THREE.Vector3(), pos = new THREE.Vector3();
      vec.set(
        ((rect.left + rect.width / 2) / window.innerWidth) * 2 - 1,
        -(((rect.top + rect.height / 2) / window.innerHeight) * 2 - 1),
        0.5
      );
      vec.unproject(camera).sub(camera.position).normalize();
      pos.copy(camera.position).add(vec.multiplyScalar(-camera.position.z / vec.z));
      ballContainer.position.copy(pos);
      const vFov = (camera.fov * Math.PI) / 180;
      const vH = 2 * Math.tan(vFov / 2) * camera.position.z, vW = vH * camera.aspect;
      const sc = ((rect.width / window.innerWidth) * vW / 4) * 1.1;  // 1.1 = correct match to 0.85em placeholder
      ballContainer.scale.set(sc, sc, sc);
    }

    function onWindowResize() {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
      cameraZ = window.innerWidth < 768 ? 22 : 15;
      camera.position.z = cameraZ;
      matchBallToPlaceholder();
      ScrollTrigger.refresh();
    }
    window.addEventListener('resize', onWindowResize);
    onWindowResize();

    // ── Mouse drag to rotate ball ───────────────────────────────────────
    let isDragging = false;
    let lastMX = 0, lastMY = 0;
    let dragVX = 0, dragVY = 0;
    let hasDragMomentum = false;

    function onMouseDown(e) {
      // Only engage when near hero section
      if (window.scrollY > window.innerHeight * 0.6) return;
      isDragging = true;
      hasDragMomentum = true;
      lastMX = e.clientX; lastMY = e.clientY;
      dragVX = 0; dragVY = 0;
      document.body.style.cursor = 'grabbing';
    }
    function onMouseMove(e) {
      if (!isDragging) return;
      const dx = (e.clientX - lastMX) * 0.011;
      const dy = (e.clientY - lastMY) * 0.011;
      lastMX = e.clientX; lastMY = e.clientY;
      dragVX = dx; dragVY = dy;
      ballGroup.rotation.y += dx;
      ballGroup.rotation.x += dy;
    }
    function onMouseUp() {
      isDragging = false;
      document.body.style.cursor = 'grab';
    }
    function onScroll() {
      // Restore default cursor when scrolled past hero
      if (window.scrollY > window.innerHeight * 0.6) {
        document.body.style.cursor = '';
      } else if (!isDragging) {
        document.body.style.cursor = 'grab';
      }
    }
    window.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    window.addEventListener('scroll', onScroll, { passive: true });

    // Set initial grab cursor for hero section
    document.body.style.cursor = 'grab';

    // Spin speed (y starts at 0 so GSAP can control the initial 3.5 fast rounds cleanly)
    const spin = { y: 0, x: 0.002, z: 0.001 };
    spinRef = spin; // wire to triggerSpin closure

    const mob = window.innerWidth < 768;
    const sidOff = mob ? 2.2 : 5.2; // Golden-ratio side offsets to keep center inside on all aspect ratios
    const zoomZ = mob ? 8 : 5;
    const targetScale = mob ? 1.0 : 1.3; // Sized perfectly to fit cleanly beside technical text without overlapping or overwhelming

    // ── STATE-DRIVEN SCROLL ENGINE (NO MORE CONTINOUS SCRUBBING / IN-BETWEEN resting states) ──
    let activeStateIndex = 0;

    function goToState(index) {
      activeStateIndex = index;
      const duration = 0.85;
      const ease = 'power2.out';

      // Cleanly cancel all active animations on any shared Three.js objects to prevent overlap jitter
      gsap.killTweensOf(ballContainer.position);
      gsap.killTweensOf(ballContainer.scale);
      gsap.killTweensOf(podiumGroup.position);
      gsap.killTweensOf(ringsGroup.scale);
      gsap.killTweensOf(mainLight);
      gsap.killTweensOf(mainLightR);
      gsap.killTweensOf(spin);

      if (index === 0) {
        // State 1: HOOPS (Hero)
        gsap.to(ballContainer.position, { x: 0, y: 0, z: 0, duration, ease });
        gsap.to(ballContainer.scale,    { x: 0.82, y: 0.82, z: 0.82, duration, ease });
        gsap.to(podiumGroup.position,   { y: -12, duration, ease });
        gsap.to(ringsGroup.scale,       { x: 0, y: 0, z: 0, duration, ease });
        gsap.to(mainLight,              { intensity: 11.5, duration, ease });
        gsap.to(mainLightR,             { intensity: 1.5, duration, ease });
        gsap.to(spin,                   { y: 0.002, duration, ease });
      }
      else if (index === 1) {
        // State 2: Elite Control / Crossover (Ball goes RIGHT, comfortable size 1.3)
        gsap.to(ballContainer.position, { x: sidOff, y: 0, z: zoomZ, duration, ease });
        gsap.to(ballContainer.scale,    { x: targetScale, y: targetScale, z: targetScale, duration, ease });
        gsap.to(podiumGroup.position,   { y: -12, duration, ease });
        gsap.to(ringsGroup.scale,       { x: 0, y: 0, z: 0, duration, ease });
        gsap.to(mainLight,              { intensity: 11.5, duration, ease });
        gsap.to(mainLightR,             { intensity: 1.5, duration, ease });
        gsap.to(spin,                   { y: 0.12, duration, ease });
      }
      else if (index === 2) {
        // State 3: Perfect Flight / Fast Break (Ball goes LEFT, comfortable size 1.3)
        gsap.to(ballContainer.position, { x: -sidOff, y: 0, z: zoomZ + 2, duration, ease });
        gsap.to(ballContainer.scale,    { x: targetScale, y: targetScale, z: targetScale, duration, ease });
        gsap.to(podiumGroup.position,   { y: -12, duration, ease });
        gsap.to(ringsGroup.scale,       { x: 0, y: 0, z: 0, duration, ease });
        gsap.to(mainLight,              { intensity: 1.5, duration, ease });
        gsap.to(mainLightR,             { intensity: 11.5, duration, ease });
        gsap.to(spin,                   { y: 0.12, duration, ease });
      }
      else if (index === 3) {
        // State 4: The Zone / Center Rings (Ball goes CENTER, scales to 0.78, rings scale to 1)
        gsap.to(ballContainer.position, { x: 0, y: 0, z: 0, duration, ease });
        gsap.to(ballContainer.scale,    { x: 0.78, y: 0.78, z: 0.78, duration, ease });
        gsap.to(podiumGroup.position,   { y: -12, duration, ease });
        gsap.to(ringsGroup.scale,       { x: 1, y: 1, z: 1, duration, ease: 'back.out(1.2)' });
        gsap.to(mainLight,              { intensity: 11.5, duration, ease });
        gsap.to(mainLightR,             { intensity: 1.5, duration, ease });
        gsap.to(spin,                   { y: 0.38, duration, ease });
      }
      else if (index === 4) {
        // State 5: Podium / The Champion (Rings shrink out, ball goes on podium, final lighting activates)
        gsap.to(ballContainer.position, { x: 0, y: 0.4, z: 0, duration, ease });
        gsap.to(ballContainer.scale,    { x: 1.0, y: 1.0, z: 1.0, duration, ease });
        gsap.to(podiumGroup.position,   { y: -1.65, duration, ease });
        gsap.to(ringsGroup.scale,       { x: 0, y: 0, z: 0, duration, ease });
        gsap.to(mainLight,              { intensity: 18.0, duration, ease });
        gsap.to(mainLightR,             { intensity: 0.0, duration, ease });
        gsap.to(rimLight,               { intensity: 8.0, duration, ease });
        gsap.to(rimLightL,              { intensity: 8.0, duration, ease });
        gsap.to(fillLight,              { intensity: 3.5, distance: 12, duration, ease });
        gsap.to(fillLightL,             { intensity: 3.5, distance: 12, duration, ease });
        gsap.to(particleMat,            { opacity: 0.85, duration, ease });
        gsap.to(spin,                   { y: 0.005, duration, ease });
      }

      // Handle finale overlay visibility based on exact Stage 5 activation
      if (index === 4) {
        gsap.to('#finale-subtitle',  { opacity: 1, y: 0, duration: 0.4, delay: 0.3, ease: 'power1.out' });
        gsap.to('#finale-card',      { opacity: 1, y: 0, duration: 0.4, delay: 0.45, ease: 'power1.out' });
        gsap.to('#finale-side-cards', { opacity: 1, y: 0, duration: 0.4, delay: 0.6, ease: 'power1.out' });
      } else {
        gsap.to('#finale-subtitle',  { opacity: 0, y: 20, duration: 0.3, ease: 'power1.out' });
        gsap.to('#finale-card',      { opacity: 0, y: 40, duration: 0.3, ease: 'power1.out' });
        gsap.to('#finale-side-cards', { opacity: 0, y: 30, duration: 0.3, ease: 'power1.out' });
      }
    }

    // Initialize triggers for each of the 5 sections
    const selectors = ['#hero', '#move-left', '#move-right', '#center-rings', '#finale'];
    selectors.forEach((selector, index) => {
      ScrollTrigger.create({
        trigger: selector,
        start: 'top 50%',   // Fire as soon as section center crosses the viewport center
        end: 'bottom 50%',
        onEnter: () => goToState(index),
        onEnterBack: () => goToState(index),
      });
    });

    // Apply initial ring accent color based on loaded config
    updateRingColors(config.baseColor || '#ea580c');

    // Render loop
    const timer = makeTimer();
    let raf;
    function animate() {
      raf = requestAnimationFrame(animate);
      tickTimer(timer);
      const time = getElapsed(timer);
      // Ball rotation: drag > momentum > auto-spin (Y axis = left-to-right only)
      if (isDragging) {
        // controlled by mousemove handler — no auto-spin applied while dragging
      } else if (hasDragMomentum) {
        dragVX *= 0.93; dragVY *= 0.93;
        ballGroup.rotation.y += dragVX;
        ballGroup.rotation.x += dragVY;
        if (Math.abs(dragVX) < 0.0005 && Math.abs(dragVY) < 0.0005) hasDragMomentum = false;
      } else {
        // normal auto-spin — Y axis only (left-to-right)
        ballGroup.rotation.y += spin.y;
      }
      // Continuous multi-directional concentric ring rotations (always spinning, visible only when scale > 0)
      innerRingGroup.rotation.z  += 0.005; // CCW
      middleRingGroup.rotation.z -= 0.008; // CW
      outerRingGroup.rotation.z  += 0.003; // CCW
      if (particleMat.opacity > 0) {
        const pa = particleSystem.geometry.attributes.position.array;
        for (let i = 0; i < particleCount; i++) {
          pa[i * 3 + 1] += particleSpeeds[i];
          const x = pa[i * 3], z = pa[i * 3 + 2];
          pa[i * 3] = x * Math.cos(0.008) - z * Math.sin(0.008);
          pa[i * 3 + 2] = x * Math.sin(0.008) + z * Math.cos(0.008);
          if (pa[i * 3 + 1] > 10) {
            pa[i * 3 + 1] = -5;
            const r = Math.random() * 9 + 2, θ = Math.random() * Math.PI * 2;
            pa[i * 3] = r * Math.cos(θ); pa[i * 3 + 2] = r * Math.sin(θ);
          }
        }
        particleSystem.geometry.attributes.position.needsUpdate = true;
      }
      if (podiumGroup.position.y > -5)
        ballContainer.position.y += Math.sin(time * 1.8) * 0.0015; // gentle float
      renderer.render(scene, camera);
    }

    // Intro animation
    let intro;
    const initTimeout = setTimeout(() => {
      matchBallToPlaceholder();
      ScrollTrigger.refresh();
      const { x: rx, y: ry, z: rz } = ballContainer.position;
      const rSc = ballContainer.scale.x;

      // Start EXACTLY in place (no position offset) and flash/scale up
      ballContainer.position.set(rx, ry, rz);
      ballContainer.scale.set(0, 0, 0);
      animate();

      intro = gsap.timeline();
      // Reset any accumulated X/Z rotation so the ball spins cleanly left-to-right
      ballGroup.rotation.x = 0;
      ballGroup.rotation.z = 0;
      // Flash in quickly
      intro.to(ballContainer.scale, { x: rSc, y: rSc, z: rSc, duration: 0.6, ease: 'back.out(1.8)' }, 0);
      // Fast left-to-right spin 3 full rounds on Y axis ONLY (snappy 1.2s duration)
      intro.to(ballGroup.rotation, { y: `+=${Math.PI * 2 * 3}`, duration: 1.2, ease: 'power3.out' }, 0.1);
      // Smoothly ramp in the slow continuous auto-spin once fast spin is done
      intro.to(spin, { y: 0.005, duration: 1.0, ease: 'power2.inOut' }, 0.6);
    }, 150);

    return () => {
      clearTimeout(initTimeout);
      window.removeEventListener('resize', onWindowResize);
      window.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      window.removeEventListener('scroll', onScroll);
      document.body.style.cursor = '';
      cancelAnimationFrame(raf);
      intro?.kill();
      ScrollTrigger.getAll().forEach(st => st.kill());
      ballRefs.current = null;

      [sphereGeo, shadowPlaneGeo,
        baseTierGeo, midTierGeo, topTierGeo, topRingGeo, innerRingGeoP, midEdgeGeo,
        particleGeo,
        ...[seamEq, seamV1, seamV2, seamC1, seamC2].map(s => s.geo)]
        .forEach(g => g.dispose());
      [sphereMat, seamMat, shadowPlaneMat, podiumMat, topRingMat, innerRingMatP, midEdgeMat, particleMat]
        .forEach(m => m.dispose());
      [albedoTex, normalTex, roughTex, circleTex].forEach(t => t.dispose());
      renderer.dispose();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <canvas ref={canvasRef} id="webgl-canvas" style={{
      position: 'fixed',
      top: '16px', left: '16px',
      width: 'calc(100vw - 32px)', height: 'calc(100vh - 32px)',
      borderRadius: '24px', // Matches the rounded card perfectly
      zIndex: -1, pointerEvents: 'none', display: 'block',
    }} />
  );
}
