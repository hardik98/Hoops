import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { DEFAULT_CONFIG, applyConfigToRefs } from '../store/ballConfig';
import { createBallTextures } from './ThreeScene';

const makeTimer = () => (THREE.Timer ? new THREE.Timer() : new THREE.Clock());
const getElapsed = (t) => (THREE.Timer ? t.getElapsed() : t.getElapsedTime());
const tickTimer = (t) => { if (THREE.Timer) t.update(); };

export default function CustomizerScene({ config = DEFAULT_CONFIG }) {
  const canvasRef = useRef(null);
  const ballRefs = useRef(null);

  // React to config changes without rebuilding the scene
  useEffect(() => {
    applyConfigToRefs(ballRefs.current, config);
  }, [config]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const cw = canvas.clientWidth || 600;
    const ch = canvas.clientHeight || 600;

    // ── Renderer ──────────────────────────────────────────────────────────────
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setSize(cw, ch);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.4;

    // ── Scene ─────────────────────────────────────────────────────────────────
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x050505, 0.025);
    const camera = new THREE.PerspectiveCamera(38, cw / ch, 0.1, 100);
    camera.position.set(0, 0, 9);

    // ── Lights — matches ThreeScene dramatic studio setup ─────────────────────
    const hemi = new THREE.HemisphereLight(0xffeedd, 0x111111, 0.8); // Boosted ambient fill
    scene.add(hemi);

    // PRIMARY LEFT KEY LIGHT: powerful DirectionalLight from upper-left-front
    const mainLight = new THREE.DirectionalLight(0xffffff, 11.5); // Left key light
    mainLight.position.set(-6, 8, 6);
    mainLight.castShadow = true;
    mainLight.shadow.mapSize.width = mainLight.shadow.mapSize.height = 1024;
    mainLight.shadow.bias = -0.001;
    scene.add(mainLight);

    // PRIMARY RIGHT KEY LIGHT: powerful DirectionalLight from upper-right-front
    const mainLightR = new THREE.DirectionalLight(0xffffff, 1.5); // Right key light, soft fill by default
    mainLightR.position.set(6, 8, 6);
    mainLightR.castShadow = true;
    mainLightR.shadow.mapSize.width = mainLightR.shadow.mapSize.height = 1024;
    mainLightR.shadow.bias = -0.001;
    scene.add(mainLightR);

    // DUAL RIM LIGHTS: warm amber from right & left — recovers shadow sides beautifully
    const rimLight = new THREE.PointLight(0xff7733, 4.5, 22); // Right rim
    rimLight.position.set(6, -2, 4);
    scene.add(rimLight);

    const rimLightL = new THREE.PointLight(0xff7733, 4.5, 22); // Left rim
    rimLightL.position.set(-6, -2, 4);
    scene.add(rimLightL);

    // DUAL BACK RIMS: cool blue from rear-right & rear-left for incredible edge separation
    const fillLight = new THREE.SpotLight(0x3366ff, 5.0, 30, Math.PI / 4, 0.4, 1.2); // Right back rim
    fillLight.position.set(5, 3, -10);
    scene.add(fillLight);

    const fillLightL = new THREE.SpotLight(0x3366ff, 5.0, 30, Math.PI / 4, 0.4, 1.2); // Left back rim
    fillLightL.position.set(-5, 3, -10);
    scene.add(fillLightL);

    // SUBTLE FRONT FILL: soft warm bounce
    const fillLight2 = new THREE.PointLight(0xffe8cc, 1.8, 18); // Boosted front fill
    fillLight2.position.set(0, -2, 7);
    scene.add(fillLight2);

    // ── Textures ──────────────────────────────────────────────────────────────
    const { albedoTex, normalTex, roughTex, circleTex } = createBallTextures();

    // ── Ball ──────────────────────────────────────────────────────────────────
    const ballGroup = new THREE.Group();
    const ballRadius = 2;

    const sphereGeo = new THREE.SphereGeometry(ballRadius, 96, 96);
    const sphereMat = new THREE.MeshPhysicalMaterial({
      map: albedoTex,
      normalMap: normalTex,
      normalScale: new THREE.Vector2(1.8, 1.8), // strong bump
      roughnessMap: roughTex,
      roughness: 0.46, // polished genuine leather sheen
      metalness: 0.0,
      clearcoat: 0.35,
      clearcoatRoughness: 0.18,
    });
    const sphere = new THREE.Mesh(sphereGeo, sphereMat);
    sphere.castShadow = sphere.receiveShadow = true;
    ballGroup.add(sphere);

    // Seam lines — flat 2D lines that do not react to lighting (perfect matte flat vector look)
    const seamMat = new THREE.MeshBasicMaterial({ color: 0x111111 });
    const ST = 0.016; // Slightly thinner line for a more premium, flush inlay look
    const SR = ballRadius + 0.001; // Extremely flush to avoid wire/tube look and look inlaid

    function makeSeam(radius, thick, rx = 0, ry = 0, rz = 0) {
      const geo = new THREE.TorusGeometry(radius, thick, 16, 96);
      const m = new THREE.Mesh(geo, seamMat);
      m.rotation.set(rx, ry, rz);
      m.castShadow = m.receiveShadow = true;
      ballGroup.add(m);
      return { mesh: m, geo };
    }

    // Helper to create mathematically perfect, flush curved seams by translating on Z then rotating
    function makeCurveSeam(radius, thick, offset, rx, ry, rz) {
      const group = new THREE.Group();
      const geo = new THREE.TorusGeometry(radius, thick, 16, 96);
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
    scene.add(ballGroup);

    // Expose refs
    ballRefs.current = {
      sphereMat, seamMat, scene,
      seams: {
        eq: seamEq.mesh, v1: seamV1.mesh, v2: seamV2.mesh,
        c1: seamC1.mesh, c2: seamC1.mesh, c3: seamC2.mesh, c4: seamC2.mesh
      },
      hemi, mainLight, mainLightR, rimLight, rimLightL, fillLight, fillLightL, fillLight2,
    };
    applyConfigToRefs(ballRefs.current, config);

    // ── Resize observer ───────────────────────────────────────────────────────
    const ro = new ResizeObserver(() => {
      const w = canvas.clientWidth, h = canvas.clientHeight;
      if (!w || !h) return;
      camera.aspect = w / h; camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    });
    ro.observe(canvas.parentElement || canvas);

    // ── Render loop ───────────────────────────────────────────────────────────
    const timer = makeTimer();
    let raf;
    function animate() {
      raf = requestAnimationFrame(animate);
      tickTimer(timer);
      ballGroup.rotation.y += 0.008;
      ballGroup.rotation.x += 0.003;
      renderer.render(scene, camera);
    }
    animate();

    return () => {
      ro.disconnect();
      cancelAnimationFrame(raf);
      ballRefs.current = null;
      [sphereGeo, ...[seamEq, seamV1, seamV2, seamC1, seamC2].map(s => s.geo)]
        .forEach(g => g.dispose());
      [sphereMat, seamMat].forEach(m => m.dispose());
      [albedoTex, normalTex, roughTex, circleTex].forEach(t => t.dispose());
      renderer.dispose();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />;
}
