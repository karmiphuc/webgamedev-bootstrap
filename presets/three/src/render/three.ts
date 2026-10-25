// three.js renderer (preset "three"): an angled perspective camera over a
// ground plane, with actors as camera-facing pixel sprites. This is the
// starting point for MOBA / ARPG / isometric-3D clones; swap the billboards
// for GLB models (record them in provenance.json) when you have them.
//
// Rules:
// - The sim stays 2D (x, y in tiles). The world maps sim (x, y) -> (x, 0, y).
// - Picking is a ray against the ground plane, never against meshes.
// - Every geometry/material/texture created here is disposed in dispose().
// - Backing resolution is capped at 2x CSS pixels (GPU cost on HiDPI).

import * as THREE from "three";
import { UNITS, WORLD } from "../content/units";
import type { Actor } from "../sim/state";
import { lerp, type CreateRenderer, type Renderer } from "./types";

const MAX_DPR = 2;

export const createRenderer: CreateRenderer = async (host, assets) => {
  const loader = new THREE.TextureLoader();
  const atlasTex = await loader.loadAsync(assets.atlasUrl);
  atlasTex.magFilter = THREE.NearestFilter;
  atlasTex.minFilter = THREE.NearestFilter;
  atlasTex.generateMipmaps = false;
  atlasTex.colorSpace = THREE.SRGBColorSpace;
  const img = atlasTex.image as { width: number; height: number };

  const gl = new THREE.WebGLRenderer({ antialias: false });
  gl.setClearColor(0x12101a);
  gl.domElement.className = "stage-canvas";
  gl.domElement.setAttribute("aria-label", "Game view");
  gl.domElement.dataset.testid = "game-view"; // LOCKED contract: tests find the game view by this
  host.appendChild(gl.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 200);
  const cx = WORLD.width / 2;
  const cz = WORLD.height / 2;
  // Camera looks down at a fixed angle; its distance adapts to the aspect
  // ratio so the whole playfield stays visible (portrait phones included).
  const viewDir = new THREE.Vector3(0, 16, 12).normalize();
  const baseDistance = 20;
  const placeCamera = () => {
    const vHalf = THREE.MathUtils.degToRad(camera.fov / 2);
    const hHalf = Math.atan(Math.tan(vHalf) * camera.aspect);
    const fitWidth = (WORLD.width / 2) * 1.1 / Math.tan(hHalf);
    const fitDepth = (WORLD.height / 2) * 1.25 / Math.tan(vHalf);
    const d = Math.max(baseDistance, fitWidth, fitDepth);
    camera.position.set(cx + viewDir.x * d, viewDir.y * d, cz + viewDir.z * d);
    camera.lookAt(cx, 0, cz);
  };

  scene.add(new THREE.AmbientLight(0xffffff, 1.2));
  const sun = new THREE.DirectionalLight(0xffffff, 1.5);
  sun.position.set(-5, 10, 4);
  scene.add(sun);

  // Ground: the grass frame repeated across the playfield.
  const grassFrame = assets.atlas.frames.grass;
  // Cut the single grass frame out of the atlas into its own repeating texture.
  const tileCanvas = document.createElement("canvas");
  tileCanvas.width = grassFrame.w;
  tileCanvas.height = grassFrame.h;
  tileCanvas.getContext("2d")!.drawImage(atlasTex.image as CanvasImageSource, grassFrame.x, grassFrame.y, grassFrame.w, grassFrame.h, 0, 0, grassFrame.w, grassFrame.h);
  const grass = new THREE.CanvasTexture(tileCanvas);
  grass.magFilter = THREE.NearestFilter;
  grass.minFilter = THREE.NearestFilter;
  grass.wrapS = grass.wrapT = THREE.RepeatWrapping;
  grass.repeat.set(WORLD.width, WORLD.height);
  grass.colorSpace = THREE.SRGBColorSpace;
  const groundGeo = new THREE.PlaneGeometry(WORLD.width, WORLD.height);
  const groundMat = new THREE.MeshLambertMaterial({ map: grass });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(cx, 0, cz);
  scene.add(ground);
  const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

  // One material per sprite frame (shared by every actor using it).
  const materials = new Map<string, THREE.SpriteMaterial>();
  const frameMaterial = (name: string) => {
    let m = materials.get(name);
    if (!m) {
      const f = assets.atlas.frames[name];
      const tex = atlasTex.clone();
      tex.repeat.set(f.w / img.width, f.h / img.height);
      tex.offset.set(f.x / img.width, 1 - (f.y + f.h) / img.height);
      tex.needsUpdate = true;
      m = new THREE.SpriteMaterial({ map: tex, transparent: true, alphaTest: 0.5 });
      materials.set(name, m);
    }
    return m;
  };

  const sprites = new Map<number, THREE.Sprite>();
  const flashes = new Map<number, number>();

  const resize = () => {
    const w = Math.max(1, host.clientWidth);
    const h = Math.max(1, host.clientHeight);
    gl.setPixelRatio(Math.min(MAX_DPR, window.devicePixelRatio || 1));
    gl.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    placeCamera();
  };
  resize();
  const observer = new ResizeObserver(resize);
  observer.observe(host);

  const raycaster = new THREE.Raycaster();
  const hit = new THREE.Vector3();
  const ndc = new THREE.Vector2();

  const renderer: Renderer = {
    kind: "three",
    draw(view) {
      const { state, prev, alpha } = view;
      for (const ev of view.events) if (ev.type === "hit") flashes.set(ev.to, 3);
      const actors: Actor[] = [...state.enemies, state.hero];
      const alive = new Set<number>();
      for (const a of actors) {
        alive.add(a.id);
        const def = UNITS[a.kind];
        let s = sprites.get(a.id);
        if (!s) {
          // Per-actor material clone so flipping/flash never leaks to others.
          s = new THREE.Sprite(frameMaterial(def.sprite).clone());
          s.center.set(0.5, 0);
          s.scale.set(1.25, 1.25, 1);
          sprites.set(a.id, s);
          scene.add(s);
        }
        const p = prev.get(a.id) ?? a;
        s.position.set(lerp(p.x, a.x, alpha), 0, lerp(p.y, a.y, alpha));
        const mat = s.material;
        mat.opacity = (flashes.get(a.id) ?? 0) > 0 ? 0.55 : 1;
        // Mirror by flipping the sprite's horizontal scale.
        s.scale.x = Math.abs(s.scale.x) * (a.facing < 0 ? -1 : 1);
      }
      for (const [id, s] of sprites) {
        if (!alive.has(id)) {
          scene.remove(s);
          s.material.dispose(); // the clone; the shared map texture stays
          sprites.delete(id);
        }
      }
      for (const [id, n] of flashes) {
        if (n <= 1) flashes.delete(id);
        else flashes.set(id, n - 1);
      }
      gl.render(scene, camera);
    },
    pick(clientX, clientY) {
      const r = gl.domElement.getBoundingClientRect();
      ndc.set(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
      raycaster.setFromCamera(ndc, camera);
      if (!raycaster.ray.intersectPlane(groundPlane, hit)) return null;
      if (hit.x < 0 || hit.z < 0 || hit.x > WORLD.width || hit.z > WORLD.height) return null;
      return { x: hit.x, y: hit.z };
    },
    toScreen(x, y) {
      const r = gl.domElement.getBoundingClientRect();
      const v = new THREE.Vector3(x, 0, y).project(camera);
      return { x: r.left + ((v.x + 1) / 2) * r.width, y: r.top + ((1 - v.y) / 2) * r.height };
    },
    resize,
    diagnostics: () => ({
      renderer: "three",
      sprites: sprites.size,
      geometries: gl.info.memory.geometries,
      textures: gl.info.memory.textures,
      drawCalls: gl.info.render.calls,
      pixelRatio: gl.getPixelRatio(),
    }),
    dispose() {
      observer.disconnect();
      for (const s of sprites.values()) s.material.dispose();
      sprites.clear();
      for (const m of materials.values()) {
        m.map?.dispose();
        m.dispose();
      }
      materials.clear();
      groundGeo.dispose();
      groundMat.dispose();
      grass.dispose();
      atlasTex.dispose();
      gl.dispose();
      gl.domElement.remove();
    },
  };
  return renderer;
};
