import React, {useEffect, useRef, useState} from 'react';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {MeshoptDecoder} from 'three/addons/libs/meshopt_decoder.module.js';
import {MODEL_CONFIG} from './model-config.mjs';
import {prepareCharacter} from './prepare-character.mjs';
import {FOLLOW_CONFIG, targetAngles} from './character-motion.mjs';
import {createHeadRig, updateHeadRig} from './character-rig.mjs';
import {loadModelChunks} from './model-chunks.mjs';

const MODEL_URL = `${import.meta.env.BASE_URL}models/${MODEL_CONFIG.file}`;

export default function Character({menuOpen, active = true}: {menuOpen: boolean; active?: boolean}) {
  const host = useRef<HTMLDivElement>(null);
  const loadingLabel = useRef<HTMLParagraphElement>(null);
  const blocked = useRef(menuOpen);
  const isActive = useRef(active);
  useEffect(() => {isActive.current = active;}, [active]);
  const [failed, setFailed] = useState(false);
  useEffect(() => {blocked.current = menuOpen;}, [menuOpen]);

  useEffect(() => {
    const container = host.current!;
    let disposed = false;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({alpha: true, antialias: true});
    } catch {
      setFailed(true);
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setClearColor(0x000000, 0);
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.01, 20);
    // Soft, warm frontal illumination; imported materials and textures are untouched.
    scene.add(new THREE.HemisphereLight(0xfff3ea, 0x65584e, 2));
    const key = new THREE.DirectionalLight(0xffefe3, 2.7);
    key.position.set(-1.5, 2.5, 4);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0xffffff, 0.5);
    fill.position.set(2, 1, 2);
    scene.add(fill);

    let model: THREE.Group | undefined;
    let modelHeight = .843648;
    let modelBottom = 0;
    let rig: ReturnType<typeof createHeadRig> | undefined;
    let mixer: THREE.AnimationMixer | undefined;
    let target = {yaw: 0, pitch: 0};
    let trackingActive = false;
    const direction = new THREE.Vector3();
    let previousTime = performance.now();
    const reset = () => {trackingActive = false; target = targetAngles(0, 0, false);};

    function resize() {
      const {width, height} = container.getBoundingClientRect();
      if (!width || !height) return;
      renderer.setSize(width, height, false);
      // Keep the existing full-screen character layer and its right-hand composition.
      // Orthographic framing changes the camera only, never the model's proportions.
      const viewHeight = modelHeight * MODEL_CONFIG.framing.heightRatio;
      const viewWidth = viewHeight * width / height;
      const centerX = width < 768 ? MODEL_CONFIG.framing.mobileX : MODEL_CONFIG.framing.desktopX;
      const cameraX = -(centerX - 0.5) * viewWidth;
      camera.left = -viewWidth / 2;
      camera.right = viewWidth / 2;
      camera.top = viewHeight / 2;
      camera.bottom = -viewHeight / 2;
      const cameraY = modelBottom + modelHeight * MODEL_CONFIG.framing.centerRatio;
      camera.position.set(cameraX, cameraY, 3);
      camera.lookAt(cameraX, cameraY, 0);
      camera.updateProjectionMatrix();
      camera.updateMatrixWorld();
      reset();
    }

    const pointer = (event: MouseEvent) => {
      if (!rig || blocked.current || !isActive.current) {
        reset();
        return;
      }
      const rect = container.getBoundingClientRect();
      const x = event.clientX - rect.left, y = event.clientY - rect.top;
      const active = rect.width > 0 && rect.height > 0 && x >= 0 && x <= rect.width && y >= 0 && y <= rect.height;
      trackingActive = active;
      // Input covers the whole page, centered on the viewport. This changes no
      // display bounds or camera framing and removes the old inactive left region.
      // Positive screen Y means looking down; +Z is the model's forward direction.
      target = targetAngles(x / (rect.width / 2) - 1, y / (rect.height / 2) - 1, active);
      if (import.meta.env.DEV) container.dataset.target = JSON.stringify({point: [x, y], min: [0, 0], max: [rect.width, rect.height], active, ...target});
    };

    function release(root: THREE.Object3D) {
      const geometries = new Set<THREE.BufferGeometry>();
      const materials = new Set<THREE.Material>();
      const textures = new Set<THREE.Texture>();
      const skeletons = new Set<THREE.Skeleton>();
      root.traverse(object => {
        if (!(object instanceof THREE.Mesh)) return;
        geometries.add(object.geometry);
        if (object instanceof THREE.SkinnedMesh) skeletons.add(object.skeleton);
        for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
          materials.add(material);
          for (const value of Object.values(material)) if (value instanceof THREE.Texture) textures.add(value);
        }
      });
      geometries.forEach(value => value.dispose());
      materials.forEach(value => value.dispose());
      textures.forEach(value => {value.dispose(); value.source.data?.close?.();});
      skeletons.forEach(value => value.dispose());
    }

    const download = new AbortController();
    const progress = ({loaded, total, attempt}: {loaded: number; total: number; attempt: number}) => {
      if (!disposed && loadingLabel.current) {
        loadingLabel.current.textContent = `人物加载中 ${Math.floor(loaded / total * 100)}%${attempt ? ' · 正在重试连接' : ''}`;
      }
    };
    const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
    const loading = import.meta.env.PROD
      ? loadModelChunks(new URL(`${import.meta.env.BASE_URL}models/character.json`, window.location.href).href, download.signal, progress)
        .then(data => {
          download.signal.throwIfAborted();
          container.dataset.status = 'parsing';
          if (loadingLabel.current) loadingLabel.current.textContent = '人物加载中 · 正在准备画面';
          return loader.parseAsync(data, '');
        })
      : fetch(MODEL_URL, {signal: download.signal}).then(async response => {
          if (!response.ok) throw new Error(`Model HTTP ${response.status}`);
          return loader.parseAsync(await response.arrayBuffer(), '');
        });
    loading.then(gltf => {
      if (disposed) {release(gltf.scene); return;}
      model = gltf.scene;
      scene.add(model);
      prepareCharacter(model);
      model.updateMatrixWorld(true);
      const bounds = new THREE.Box3().setFromObject(model);
      modelHeight = bounds.max.y - bounds.min.y;
      modelBottom = bounds.min.y;
      rig = createHeadRig(model);
      if (!rig) {
        container.dataset.tracking = 'unsupported';
        console.warn('Character skin rig is unavailable; head tracking disabled.');
      } else {
        container.dataset.tracking = 'skinned-neck-head-eyes';
      }
      // No clips in the supplied GLB. Keep a mixer path for any embedded clips
      // and apply tracking additively after animation evaluation.
      if (gltf.animations.length) {
        mixer = new THREE.AnimationMixer(model);
        gltf.animations.forEach(clip => mixer!.clipAction(clip).play());
      }
      container.dataset.status = 'ready';
      if (loadingLabel.current) loadingLabel.current.hidden = true;
      resize();
    }).catch(error => {
      if (!disposed) {
        container.dataset.status = 'error';
        if (loadingLabel.current) loadingLabel.current.hidden = true;
        setFailed(true);
        console.error('Unable to load character model', error);
      }
    });

    const observer = new ResizeObserver(resize);
    observer.observe(container);
    window.addEventListener('mousemove', pointer);
    document.documentElement.addEventListener('pointerleave', reset);
    document.addEventListener('mouseleave', reset);
    window.addEventListener('blur', reset);
    document.addEventListener('visibilitychange', reset);
    resize();
    renderer.setAnimationLoop(time => {
      if (!isActive.current) {previousTime = time; return;}
      const delta = Math.max(0, Math.min((time - previousTime) / 1000, FOLLOW_CONFIG.maxFrameDelta));
      previousTime = time;
      if (blocked.current || document.hidden) reset();
      mixer?.update(delta);
      const pose = rig && updateHeadRig(rig, target, delta, trackingActive);
      if (import.meta.env.DEV && pose) {
        container.dataset.inputActive = String(trackingActive);
        container.dataset.yaw = THREE.MathUtils.radToDeg(pose.yaw).toFixed(3);
        container.dataset.pitch = THREE.MathUtils.radToDeg(pose.pitch).toFixed(3);
        container.dataset.eyeYaw = THREE.MathUtils.radToDeg(pose.eyeYaw).toFixed(3);
        container.dataset.eyePitch = THREE.MathUtils.radToDeg(pose.eyePitch).toFixed(3);
        const body = rig!.body;
        body.getWorldPosition(direction);
        container.dataset.bodyPosition = direction.toArray().join(',');
        container.dataset.bodyQuaternion = body.quaternion.toArray().join(',');
      }
      renderer.render(scene, camera);
    });

    return () => {
      disposed = true;
      download.abort();
      renderer.setAnimationLoop(null);
      observer.disconnect();
      window.removeEventListener('mousemove', pointer);
      document.documentElement.removeEventListener('pointerleave', reset);
      document.removeEventListener('mouseleave', reset);
      window.removeEventListener('blur', reset);
      document.removeEventListener('visibilitychange', reset);
      mixer?.stopAllAction();
      if (model) {mixer?.uncacheRoot(model); release(model);}
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);

  return <div ref={host} className="character-background" data-status="loading" aria-hidden={!failed}>
    {!failed && <p ref={loadingLabel} className="character-error">人物加载中 · 正在连接</p>}
    {failed && <p className="character-error" role="status">人物模型暂时无法加载，请刷新页面重试。</p>}
  </div>;
}
