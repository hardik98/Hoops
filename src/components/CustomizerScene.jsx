import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { DEFAULT_CONFIG, applyConfigToRefs } from '../store/ballConfig';
import { createBallTextures } from './ThreeScene';

const makeTimer = () => (THREE.Timer ? new THREE.Timer() : new THREE.Clock());
const getElapsed = (t) => (THREE.Timer ? t.getElapsed() : t.getElapsedTime());
const tickTimer  = (t) => { if (THREE.Timer) t.update(); };

class SphericalCircle extends THREE.Curve {
  constructor(sphereRadius, offsetDistance, rx, ry, rz) {
    super();
    this.sphereRadius = sphereRadius;
    this.d = offsetDistance;
    this.r = Math.sqrt(Math.max(0.1, sphereRadius * sphereRadius - offsetDistance * offsetDistance));
    this.euler = new THREE.Euler(rx, ry, rz);
  }
  getPoint(t, optionalTarget = new THREE.Vector3()) {
    const angle = t * Math.PI * 2;
    const p = optionalTarget.set(
      Math.cos(angle) * this.r,
      Math.sin(angle) * this.r,
      this.d
    );
    p.applyEuler(this.euler);
    return p;
  }
}

export default function CustomizerScene({ config = DEFAULT_CONFIG }) {
  const canvasRef = useRef(null);
  const ballRefs  = useRef(null);

  // React to config changes without rebuilding the scene
  useEffect(() => {
    applyConfigToRefs(ballRefs.current, config);
  }, [config]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const cw = canvas.clientWidth  || 600;
    const ch = canvas.clientHeight || 600;

    // ── Renderer ──────────────────────────────────────────────────────────────
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setSize(cw, ch);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type    = THREE.PCFShadowMap;
    renderer.toneMapping       = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.4;

    // ── Scene ─────────────────────────────────────────────────────────────────
    const scene  = new THREE.Scene();
    scene.fog    = new THREE.FogExp2(0x050505, 0.025);
    const camera = new THREE.PerspectiveCamera(38, cw/ch, 0.1, 100);
    camera.position.set(0, 0, 9);

    // ── Lights (studio defaults; overridden by config) ────────────────────────
    const hemi = new THREE.HemisphereLight(0xffffff, 0x080808, 0.15);
    scene.add(hemi);

    // Strong white key from top-left
    const mainLight = new THREE.DirectionalLight(0xffffff, 5.5);
    mainLight.position.set(-5, 8, 5);
    mainLight.castShadow = true;
    mainLight.shadow.mapSize.width = mainLight.shadow.mapSize.height = 1024;
    mainLight.shadow.bias = -0.001;
    scene.add(mainLight);

    // Rim from right-back
    const rimLight = new THREE.SpotLight(0x4488ff, 3.5, 30, Math.PI/5, 0.3, 1.5);
    rimLight.position.set(6, 1, -8);
    scene.add(rimLight);

    const fillLight  = new THREE.PointLight(0xffeedd, 0.6, 25);
    fillLight.position.set(2, -3, 5);
    scene.add(fillLight);

    const fillLight2 = new THREE.PointLight(0x001133, 0.2, 20);
    fillLight2.position.set(-3, 3, 3);
    scene.add(fillLight2);

    // ── Textures ──────────────────────────────────────────────────────────────
    const { albedoTex, normalTex, roughTex, circleTex } = createBallTextures();

    // ── Ball ──────────────────────────────────────────────────────────────────
    const ballGroup  = new THREE.Group();
    const ballRadius = 2;

    const sphereGeo = new THREE.SphereGeometry(ballRadius, 96, 96);
    const sphereMat = new THREE.MeshPhysicalMaterial({
      map:              albedoTex,
      normalMap:        normalTex,
      normalScale:      new THREE.Vector2(0.85, 0.85), // matched to main scene for high-fidelity realism
      roughnessMap:     roughTex,
      roughness:        0.52,
      metalness:        0.0,
      clearcoat:        0.25,
      clearcoatRoughness: 0.25,
    });
    const sphere = new THREE.Mesh(sphereGeo, sphereMat);
    sphere.castShadow = sphere.receiveShadow = true;
    ballGroup.add(sphere);

    const seamMat = new THREE.MeshStandardMaterial({ color: 0x1a0800, roughness: 1.0, metalness: 0.0 });
    const ST = 0.026, SR = ballRadius + 0.005;

    function makeSeam(offsetDist, rx=0, ry=0, rz=0) {
      const curve = new SphericalCircle(SR, offsetDist, rx, ry, rz);
      const geo   = new THREE.TubeGeometry(curve, 64, ST, 8, true);
      const m     = new THREE.Mesh(geo, seamMat);
      ballGroup.add(m);
      return { mesh: m, geo };
    }
    const offset = SR * 0.42;
    const seamEq = makeSeam(0, Math.PI/2, 0, 0);
    const seamV1 = makeSeam(0, 0, 0, 0);
    const seamV2 = makeSeam(0, 0, Math.PI/2, 0);
    const seamC1 = makeSeam(offset,  Math.PI/4, 0,         Math.PI/6);
    const seamC2 = makeSeam(offset, -Math.PI/4, 0,        -Math.PI/6);
    const seamC3 = makeSeam(offset,  Math.PI/4, Math.PI/2,-Math.PI/6);
    const seamC4 = makeSeam(offset, -Math.PI/4, Math.PI/2, Math.PI/6);

    ballGroup.rotation.set(Math.PI/6, Math.PI/4, 0);
    scene.add(ballGroup);

    // Expose refs
    ballRefs.current = {
      sphereMat, seamMat, scene,
      seams: { eq:seamEq.mesh, v1:seamV1.mesh, v2:seamV2.mesh,
               c1:seamC1.mesh, c2:seamC2.mesh, c3:seamC3.mesh, c4:seamC4.mesh },
      hemi, mainLight, rimLight, fillLight, fillLight2,
    };
    applyConfigToRefs(ballRefs.current, config);

    // ── Resize observer ───────────────────────────────────────────────────────
    const ro = new ResizeObserver(() => {
      const w = canvas.clientWidth, h = canvas.clientHeight;
      if (!w || !h) return;
      camera.aspect = w/h; camera.updateProjectionMatrix();
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
      [sphereGeo, ...[seamEq,seamV1,seamV2,seamC1,seamC2,seamC3,seamC4].map(s=>s.geo)]
        .forEach(g => g.dispose());
      [sphereMat, seamMat].forEach(m => m.dispose());
      [albedoTex, normalTex, roughTex, circleTex].forEach(t => t.dispose());
      renderer.dispose();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return <canvas ref={canvasRef} style={{ width:'100%', height:'100%', display:'block' }} />;
}
