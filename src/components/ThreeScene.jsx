import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { DEFAULT_CONFIG, applyConfigToRefs } from '../store/ballConfig';

gsap.registerPlugin(ScrollTrigger);

const makeTimer = () => (THREE.Timer ? new THREE.Timer() : new THREE.Clock());
const getElapsed = (t) => (THREE.Timer ? t.getElapsed() : t.getElapsedTime());
const tickTimer  = (t) => { if (THREE.Timer) t.update(); };

// ── Shared texture factory (called once, reused by both scenes) ───────────────
export function createBallTextures() {
  const SIZE = 512;
  const el   = document.createElement('canvas');
  el.width   = el.height = SIZE;

  // ── Build heightfield ─────────────────────────────────────────────────────
  const heights = new Float32Array(SIZE * SIZE);
  function noise(x, y, f, a) {
    return Math.sin(x*f*0.1 + Math.cos(y*f*0.07)) *
           Math.cos(y*f*0.13 + Math.sin(x*f*0.09)) * a;
  }
  for (let py = 0; py < SIZE; py++) {
    for (let px = 0; px < SIZE; px++) {
      let h = noise(px,py,2,80) + noise(px,py,6,45) +
              noise(px,py,15,22) + noise(px,py,32,12) +
              (Math.random()-0.5)*10;
      heights[py*SIZE + px] = Math.max(0, Math.min(255, h + 128));
    }
  }

  const ctx = el.getContext('2d');

  // ── Albedo: neutral grey — pebble tops bright, grooves dark ───────────────
  // (Color property of the material tints this, so ALL base colors work correctly)
  const albedoImg = ctx.createImageData(SIZE, SIZE);
  for (let i = 0; i < heights.length; i++) {
    const h = heights[i];
    // Tops (h>128): 200–240  |  Grooves (h<128): 110–160
    const v = h > 128 ? Math.round(200 + (h-128)*0.31) : Math.round(110 + h*0.39);
    albedoImg.data[i*4] = albedoImg.data[i*4+1] = albedoImg.data[i*4+2] = v;
    albedoImg.data[i*4+3] = 255;
  }
  ctx.putImageData(albedoImg, 0, 0);
  const albedoCanvas = el.cloneNode();
  albedoCanvas.getContext('2d').putImageData(albedoImg, 0, 0);
  const albedoTex = new THREE.CanvasTexture(albedoCanvas);
  albedoTex.wrapS = albedoTex.wrapT = THREE.RepeatWrapping;
  albedoTex.repeat.set(2, 2);  // 2×2 reduces tile seam visibility

  // ── Normal map: derived from height-field gradient ────────────────────────
  const normalImg = ctx.createImageData(SIZE, SIZE);
  const STR = 2.5; // normal strength — reduced to prevent grid seam artifacts
  for (let py = 0; py < SIZE; py++) {
    for (let px = 0; px < SIZE; px++) {
      const i = py*SIZE + px;
      const hL = heights[py*SIZE + Math.max(0, px-1)];
      const hR = heights[py*SIZE + Math.min(SIZE-1, px+1)];
      const hD = heights[Math.max(0, py-1)*SIZE + px];
      const hU = heights[Math.min(SIZE-1, py+1)*SIZE + px];
      const dx = (hR - hL) * STR / 255;
      const dy = (hU - hD) * STR / 255;
      const len = Math.sqrt(dx*dx + dy*dy + 1);
      normalImg.data[i*4]   = Math.round((-dx/len*0.5 + 0.5)*255);
      normalImg.data[i*4+1] = Math.round((-dy/len*0.5 + 0.5)*255);
      normalImg.data[i*4+2] = Math.round((1/len*0.5   + 0.5)*255);
      normalImg.data[i*4+3] = 255;
    }
  }
  const normalCanvas = el.cloneNode();
  normalCanvas.getContext('2d').putImageData(normalImg, 0, 0);
  const normalTex = new THREE.CanvasTexture(normalCanvas);
  normalTex.wrapS = normalTex.wrapT = THREE.RepeatWrapping;
  normalTex.repeat.set(2, 2);

  // ── Roughness: pebble tops slightly glossier, grooves rough ───────────────
  // THREE.js roughness map: darker pixel = smoother (more specular)
  const roughImg = ctx.createImageData(SIZE, SIZE);
  for (let i = 0; i < heights.length; i++) {
    const h = heights[i];
    // Tops (high h): roughness ~0.45 → pixel ~115
    // Grooves (low h): roughness ~0.75 → pixel ~191
    const v = h > 128 ? Math.round(100 + (255-h)*0.25) : Math.round(180 + (128-h)*0.08);
    roughImg.data[i*4] = roughImg.data[i*4+1] = roughImg.data[i*4+2] = v;
    roughImg.data[i*4+3] = 255;
  }
  const roughCanvas = el.cloneNode();
  roughCanvas.getContext('2d').putImageData(roughImg, 0, 0);
  const roughTex = new THREE.CanvasTexture(roughCanvas);
  roughTex.wrapS = roughTex.wrapT = THREE.RepeatWrapping;
  roughTex.repeat.set(2, 2);

  // ── Circle sprite for dots / particles ───────────────────────────────────
  const circEl  = document.createElement('canvas'); circEl.width = circEl.height = 64;
  const circCtx = circEl.getContext('2d');
  const g = circCtx.createRadialGradient(32,32,0,32,32,30);
  g.addColorStop(0,'rgba(255,255,255,1)');
  g.addColorStop(0.5,'rgba(255,255,255,0.8)');
  g.addColorStop(1,'rgba(255,255,255,0)');
  circCtx.fillStyle = g;
  circCtx.beginPath(); circCtx.arc(32,32,30,0,Math.PI*2); circCtx.fill();
  const circleTex = new THREE.CanvasTexture(circEl);

  return { albedoTex, normalTex, roughTex, circleTex };
}

export default function ThreeScene({ config = DEFAULT_CONFIG }) {
  const canvasRef = useRef(null);
  const ballRefs  = useRef(null);

  // Reactive config updates (no scene rebuild)
  useEffect(() => {
    applyConfigToRefs(ballRefs.current, config);
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
    const scene  = new THREE.Scene();
    scene.fog    = new THREE.FogExp2(0x050505, 0.018);
    const camera = new THREE.PerspectiveCamera(45, window.innerWidth/window.innerHeight, 0.1, 100);
    let cameraZ  = window.innerWidth < 768 ? 22 : 15;
    camera.position.set(0, 0, cameraZ);

    // ── Lighting (studio defaults; overridden by config) ──────────────────────
    const hemi = new THREE.HemisphereLight(0xffffff, 0x080808, 0.15);
    scene.add(hemi);

    // Primary key — strong white from top-LEFT → creates the reference bright spot
    const mainLight = new THREE.DirectionalLight(0xffffff, 5.5);
    mainLight.position.set(-5, 8, 5);  // top-left
    mainLight.castShadow = true;
    mainLight.shadow.mapSize.width = mainLight.shadow.mapSize.height = 2048;
    mainLight.shadow.camera.near = 0.5;
    mainLight.shadow.camera.far  = 50;
    mainLight.shadow.bias = -0.001;
    scene.add(mainLight);

    // Rim — blue from right-back for edge separation
    const rimLight = new THREE.SpotLight(0x4488ff, 3.5, 30, Math.PI/5, 0.3, 1.5);
    rimLight.position.set(6, 1, -8);   // right-back
    scene.add(rimLight);

    // Fill — warm very soft from front-bottom
    const fillLight = new THREE.PointLight(0xffeedd, 0.6, 25);
    fillLight.position.set(2, -3, 5);
    scene.add(fillLight);

    // Dark fill 2
    const fillLight2 = new THREE.PointLight(0x001133, 0.2, 20);
    fillLight2.position.set(-3, 3, 3);
    scene.add(fillLight2);

    // ── Textures ──────────────────────────────────────────────────────────────
    const { albedoTex, normalTex, roughTex, circleTex } = createBallTextures();

    // ── Basketball ────────────────────────────────────────────────────────────
    const ballGroup  = new THREE.Group();
    const ballRadius = 2;

    const sphereGeo = new THREE.SphereGeometry(ballRadius, 128, 128);
    // MeshPhysicalMaterial — clearcoat simulates the rubber coating on real balls
    const sphereMat = new THREE.MeshPhysicalMaterial({
      map:              albedoTex,
      normalMap:        normalTex,
      normalScale:      new THREE.Vector2(0.85, 0.85),  // lower = cleaner pebbles, no tile seams
      roughnessMap:     roughTex,
      roughness:        0.52,   // low enough to show clear specular highlight
      metalness:        0.0,
      clearcoat:        0.25,   // thin rubber coating layer
      clearcoatRoughness: 0.25,
    });
    const sphere = new THREE.Mesh(sphereGeo, sphereMat);
    sphere.castShadow = sphere.receiveShadow = true;
    ballGroup.add(sphere);

    // Seam lines
    const seamMat = new THREE.MeshStandardMaterial({ color: 0x1a0800, roughness: 1.0, metalness: 0.0 });
    const ST = 0.028, SR = ballRadius + 0.005;

    function makeSeam(radius, thick, rx=0, ry=0, rz=0) {
      const geo = new THREE.TorusGeometry(radius, thick, 20, 128);
      const m   = new THREE.Mesh(geo, seamMat);
      m.rotation.set(rx, ry, rz);
      ballGroup.add(m);
      return { mesh: m, geo };
    }
    const r85    = ballRadius * 0.82;
    const seamEq = makeSeam(SR, ST, Math.PI/2);
    const seamV1 = makeSeam(SR, ST);
    const seamV2 = makeSeam(SR, ST, 0, Math.PI/2);
    const seamC1 = makeSeam(r85, ST,  Math.PI/4, 0,         Math.PI/6);
    const seamC2 = makeSeam(r85, ST, -Math.PI/4, 0,        -Math.PI/6);
    const seamC3 = makeSeam(r85, ST,  Math.PI/4, Math.PI/2,-Math.PI/6);
    const seamC4 = makeSeam(r85, ST, -Math.PI/4, Math.PI/2, Math.PI/6);

    ballGroup.rotation.set(Math.PI/6, Math.PI/4, 0);
    scene.add(ballGroup);

    // Shadow catcher
    const shadowPlaneGeo = new THREE.PlaneGeometry(20, 20);
    const shadowPlaneMat = new THREE.ShadowMaterial({ opacity: 0.4 });
    const shadowPlane    = new THREE.Mesh(shadowPlaneGeo, shadowPlaneMat);
    shadowPlane.rotation.x = -Math.PI/2;
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
        pts[i*3]   = Math.cos(θ) * radius;
        pts[i*3+1] = Math.sin(θ) * radius;
        pts[i*3+2] = 0;
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
          cx*(radius - innerExt), cy*(radius - innerExt), 0,
          cx*(radius + outerExt), cy*(radius + outerExt), 0,
        ]);
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(pts, 3));
        group.add(new THREE.Line(geo, mat.clone()));
      }
      return group;
    }

    // Crosshair lines — from just outside ball to just inside inner ring
    const crosshairMat = new THREE.LineBasicMaterial({ color: 0x333333, transparent: true, opacity: 0.5 });
    const innerR = 3.0, outerR = 4.6;
    for (let i = 0; i < 4; i++) {
      const θ = (i / 4) * Math.PI * 2;
      const pts = new Float32Array([
        Math.cos(θ) * 2.25, Math.sin(θ) * 2.25, 0,
        Math.cos(θ) * outerR, Math.sin(θ) * outerR, 0,
      ]);
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pts, 3));
      ringsGroup.add(new THREE.Line(geo, crosshairMat));
    }

    // Inner ring — rotates clockwise (Z-)
    const innerRingGroup = new THREE.Group();
    const innerCircleGeo = makeCircleGeo(innerR);
    const innerLineMat   = new THREE.LineBasicMaterial({ color: 0x888888, transparent: true, opacity: 0.35 });
    innerRingGroup.add(new THREE.Line(innerCircleGeo, innerLineMat));
    innerRingGroup.add(makeTickGroup(innerR, 0.38, 0.12, 0xff6600, 4, 0.95));  // orange cardinal ticks
    innerRingGroup.add(makeTickGroup(innerR, 0.14, 0.04, 0x777777, 8, 0.5));  // small white sub-ticks
    ringsGroup.add(innerRingGroup);

    // Outer ring — rotates counter-clockwise (Z+), offset 45°
    const outerRingGroup = new THREE.Group();
    const outerCircleGeo = makeCircleGeo(outerR);
    const outerLineMat   = new THREE.LineBasicMaterial({ color: 0x666666, transparent: true, opacity: 0.25 });
    outerRingGroup.add(new THREE.Line(outerCircleGeo, outerLineMat));
    outerRingGroup.add(makeTickGroup(outerR, 0.45, 0.18, 0xff6600, 4, 0.85));  // orange ticks offset
    outerRingGroup.add(makeTickGroup(outerR, 0.16, 0.05, 0x555555, 12, 0.35)); // many small sub-ticks
    outerRingGroup.rotation.z = Math.PI / 4; // start 45° offset from inner
    ringsGroup.add(outerRingGroup);

    // Tilt rings 18° on X so they look 3D perspective (like reference) and
    // the bottom arc stays well above the shadow plane
    ringsGroup.rotation.x = Math.PI / 10;
    ringsGroup.scale.set(0, 0, 0);
    scene.add(ringsGroup);


    // ── Multi-tier Championship Podium (reference SS2) ────────────────────
    const podiumGroup = new THREE.Group();
    const podiumMat   = new THREE.MeshStandardMaterial({
      color: 0x191919, metalness: 0.92, roughness: 0.08,
    });

    // Base tier — widest, flat disc
    const baseTierGeo  = new THREE.CylinderGeometry(3.8, 4.0, 0.45, 128);
    const baseTier     = new THREE.Mesh(baseTierGeo, podiumMat);
    baseTier.position.y = -1.775; baseTier.receiveShadow = true;
    podiumGroup.add(baseTier);

    // Middle tier — main column
    const midTierGeo = new THREE.CylinderGeometry(2.5, 3.0, 1.5, 128);
    const midTier    = new THREE.Mesh(midTierGeo, podiumMat);
    midTier.position.y = -0.8; midTier.receiveShadow = true;
    podiumGroup.add(midTier);

    // Top platform — narrowest
    const topTierGeo = new THREE.CylinderGeometry(1.75, 2.0, 0.38, 128);
    const topTier    = new THREE.Mesh(topTierGeo, podiumMat);
    topTier.position.y = 0.0; topTier.receiveShadow = true; topTier.castShadow = true;
    podiumGroup.add(topTier);

    // White glowing ring on top edge of top platform
    const topRingGeo = new THREE.TorusGeometry(1.76, 0.022, 16, 200);
    const topRingMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const topRingMesh = new THREE.Mesh(topRingGeo, topRingMat);
    topRingMesh.rotation.x = Math.PI/2;
    topRingMesh.position.y = 0.192; // top edge of top tier
    podiumGroup.add(topRingMesh);

    // Inner accent ring (slightly smaller)
    const innerRingGeoP = new THREE.TorusGeometry(1.6, 0.01, 16, 200);
    const innerRingMatP = new THREE.MeshBasicMaterial({ color: 0x888888 });
    const innerRingMeshP = new THREE.Mesh(innerRingGeoP, innerRingMatP);
    innerRingMeshP.rotation.x = Math.PI/2;
    innerRingMeshP.position.y = 0.192;
    podiumGroup.add(innerRingMeshP);

    // Edge glow on middle tier
    const midEdgeGeo = new THREE.TorusGeometry(2.52, 0.012, 16, 200);
    const midEdgeMat = new THREE.MeshBasicMaterial({ color: 0x333333 });
    const midEdgeMesh = new THREE.Mesh(midEdgeGeo, midEdgeMat);
    midEdgeMesh.rotation.x = Math.PI/2;
    midEdgeMesh.position.y = 0.74; // top edge of mid tier
    podiumGroup.add(midEdgeMesh);

    podiumGroup.position.y = -12;
    scene.add(podiumGroup);


    // Particles
    const particleCount = 1200;
    const particleGeo   = new THREE.BufferGeometry();
    const particlePos   = new Float32Array(particleCount * 3);
    const particleSpeeds = [];
    for (let i = 0; i < particleCount; i++) {
      const r=Math.random()*9+2, θ=Math.random()*Math.PI*2, y=(Math.random()-0.5)*22;
      particlePos[i*3]=r*Math.cos(θ); particlePos[i*3+1]=y; particlePos[i*3+2]=r*Math.sin(θ);
      particleSpeeds.push(Math.random()*0.04+0.008);
    }
    particleGeo.setAttribute('position', new THREE.BufferAttribute(particlePos, 3));
    const particleMat = new THREE.PointsMaterial({
      color:0xffaa44, size:0.09, transparent:true, opacity:0,
      blending:THREE.AdditiveBlending, map:circleTex, depthWrite:false,
    });
    const particleSystem = new THREE.Points(particleGeo, particleMat);
    scene.add(particleSystem);

    // Expose refs for reactive config
    ballRefs.current = {
      sphereMat, seamMat, scene,
      seams: { eq:seamEq.mesh, v1:seamV1.mesh, v2:seamV2.mesh,
               c1:seamC1.mesh, c2:seamC2.mesh, c3:seamC3.mesh, c4:seamC4.mesh },
      hemi, mainLight, rimLight, fillLight, fillLight2,
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
        ((rect.left+rect.width/2)/window.innerWidth)*2-1,
        -(((rect.top+rect.height/2)/window.innerHeight)*2-1),
        0.5
      );
      vec.unproject(camera).sub(camera.position).normalize();
      pos.copy(camera.position).add(vec.multiplyScalar(-camera.position.z/vec.z));
      ballGroup.position.copy(pos);
      const vFov = (camera.fov*Math.PI)/180;
      const vH = 2*Math.tan(vFov/2)*camera.position.z, vW = vH*camera.aspect;
      const sc = ((rect.width/window.innerWidth)*vW/4)*1.1;  // 1.1 = correct match to 0.85em placeholder
      ballGroup.scale.set(sc,sc,sc);
    }

    function onWindowResize() {
      camera.aspect = window.innerWidth/window.innerHeight;
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
    window.addEventListener('mouseup',   onMouseUp);
    window.addEventListener('scroll',    onScroll, { passive:true });

    // Set initial grab cursor for hero section
    document.body.style.cursor = 'grab';

    // GSAP scroll timeline
    const mob = window.innerWidth < 768;
    const sidOff = mob ? 3 : 5, zoomZ = mob ? 8 : 5;
    const tl = gsap.timeline({
      scrollTrigger: { trigger:'body', start:'top top', end:'bottom bottom', scrub:0.7 },
    });
    tl.to(ballGroup.position, { x:-sidOff, y:0, z:zoomZ, ease:'none' }, 0);
    tl.to(ballGroup.scale,    { x:1.5, y:1.5, z:1.5, ease:'none' }, 0);
    tl.to(ballGroup.rotation, { x:'+=3.14', y:'+=6.28', ease:'none' }, 0);
    tl.to(ballGroup.position, { x:sidOff, z:zoomZ+2, ease:'none' }, 1);
    tl.to(ballGroup.rotation, { x:'+=3.14', y:'+=6.28', ease:'none' }, 1);
    tl.to(ballGroup.position, { x:0, y:0, z:0, ease:'none' }, 2);
    tl.to(ballGroup.scale,    { x:1.2, y:1.2, z:1.2, ease:'none' }, 2);
    tl.to(ringsGroup.scale,   { x:1, y:1, z:1, ease:'none' }, 2.2);
    tl.to(ballGroup.position,   { y:1.3, ease:'none' }, 3);
    tl.to(podiumGroup.position, { y:-1.6, ease:'none' }, 3);
    tl.to(ringsGroup.scale,     { x:0, y:0, z:0, ease:'none' }, 3);
    tl.to(mainLight, { intensity:1.5 }, 3);
    tl.to(rimLight,  { intensity:6 }, 3);
    tl.to(fillLight, { intensity:1.5, distance:12 }, 3);
    tl.to(particleMat, { opacity:0.85, ease:'none' }, 3.2);


    const cardTrigger = ScrollTrigger.create({
      trigger:'#finale', start:'top 20%',
      onEnter:     () => gsap.to('#finale-card', { y:0, opacity:1, duration:1, ease:'power3.out' }),
      onLeaveBack: () => gsap.to('#finale-card', { y:40, opacity:0, duration:0.5 }),
    });

    // Spin speed (y starts at 0 so GSAP can control the initial 3.5 fast rounds cleanly)
    const spin = { y: 0, x: 0.002, z: 0.001 };

    // Render loop
    const timer = makeTimer();
    let raf;
    function animate() {
      raf = requestAnimationFrame(animate);
      tickTimer(timer);
      const time = getElapsed(timer);
      // Ball rotation: drag > momentum > auto-spin
      if (isDragging) {
        // controlled by mousemove handler
        ballGroup.rotation.z += spin.z;
      } else if (hasDragMomentum) {
        dragVX *= 0.93; dragVY *= 0.93;
        ballGroup.rotation.y += dragVX;
        ballGroup.rotation.x += dragVY;
        ballGroup.rotation.z += spin.z;
        if (Math.abs(dragVX) < 0.0005 && Math.abs(dragVY) < 0.0005) hasDragMomentum = false;
      } else {
        // normal auto-spin
        ballGroup.rotation.y += spin.y;
        ballGroup.rotation.x += spin.x;
        ballGroup.rotation.z += spin.z;
      }
      if (ringsGroup.scale.x > 0.01) {
        innerRingGroup.rotation.z -= 0.006; // clockwise
        outerRingGroup.rotation.z += 0.004; // counter-clockwise
      }
      if (particleMat.opacity > 0) {
        const pa = particleSystem.geometry.attributes.position.array;
        for (let i = 0; i < particleCount; i++) {
          pa[i*3+1] += particleSpeeds[i];
          const x=pa[i*3], z=pa[i*3+2];
          pa[i*3]=x*Math.cos(0.008)-z*Math.sin(0.008);
          pa[i*3+2]=x*Math.sin(0.008)+z*Math.cos(0.008);
          if (pa[i*3+1] > 10) {
            pa[i*3+1]=-5;
            const r=Math.random()*9+2, θ=Math.random()*Math.PI*2;
            pa[i*3]=r*Math.cos(θ); pa[i*3+2]=r*Math.sin(θ);
          }
        }
        particleSystem.geometry.attributes.position.needsUpdate = true;
      }
      if (podiumGroup.position.y > -5)
        ballGroup.position.y += Math.sin(time*1.8)*0.0015; // gentle float
      renderer.render(scene, camera);
    }

    // Intro animation
    let intro;
    const initTimeout = setTimeout(() => {
      matchBallToPlaceholder();
      ScrollTrigger.refresh();
      const { x:rx, y:ry, z:rz } = ballGroup.position;
      const rSc = ballGroup.scale.x;
      
      // Start EXACTLY in place (no position offset) and flash/scale up
      ballGroup.position.set(rx, ry, rz);
      ballGroup.scale.set(0, 0, 0);
      animate();
      
      intro = gsap.timeline();
      // Flash in quickly
      intro.to(ballGroup.scale,    { x:rSc, y:rSc, z:rSc, duration:0.75, ease:'back.out(1.5)' }, 0);
      // Fast spin 3.5 full rounds
      intro.to(ballGroup.rotation, { y:`+=${Math.PI * 2 * 3.5}`, duration:2.2, ease:'power3.out' }, 0);
      // Smoothly transition into the slow continuous spin
      intro.to(spin,               { y:0.005, duration:2.2, ease:'power2.out' }, 0);
    }, 150);

    return () => {
      clearTimeout(initTimeout);
      window.removeEventListener('resize', onWindowResize);
      window.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup',   onMouseUp);
      window.removeEventListener('scroll',    onScroll);
      document.body.style.cursor = '';
      cancelAnimationFrame(raf);
      intro?.kill(); tl.scrollTrigger?.kill(); tl.kill();
      cardTrigger.kill();
      ScrollTrigger.getAll().forEach(st => st.kill());
      ballRefs.current = null;

      [sphereGeo, shadowPlaneGeo,
       baseTierGeo, midTierGeo, topTierGeo, topRingGeo, innerRingGeoP, midEdgeGeo,
       particleGeo,
       ...[seamEq,seamV1,seamV2,seamC1,seamC2,seamC3,seamC4].map(s=>s.geo)]
        .forEach(g => g.dispose());
      [sphereMat, seamMat, shadowPlaneMat, podiumMat, topRingMat, innerRingMatP, midEdgeMat, particleMat]
        .forEach(m => m.dispose());
      [albedoTex, normalTex, roughTex, circleTex].forEach(t => t.dispose());
      renderer.dispose();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <canvas ref={canvasRef} id="webgl-canvas" style={{
      position:'fixed', top:0, left:0,
      width:'100vw', height:'100vh',
      zIndex:-1, pointerEvents:'none', display:'block',
    }}/>
  );
}
