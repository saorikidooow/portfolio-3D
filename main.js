/**
 * Galerie de la Verrière — point d'entrée.
 * Rendu, éclairage, boucle d'animation et enchaînement des écrans.
 */
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';

import { createMaterials } from './js/materials.js';
import { buildMuseum, DIM } from './js/museum.js';
import { hangArtworks, artworkImageURL } from './js/paintings.js';
import { loadContent, resolveAsset } from './js/content.js';
import { Controller } from './js/controls.js';
import { UI } from './js/ui.js';
import { yieldFrame } from './js/utils.js';

const ui = new UI();
const canvas = document.getElementById('scene');

/* ---------- Qualité adaptative ---------- */
const isTouch = matchMedia('(pointer: coarse)').matches;
const isMobile = isTouch || /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
const QUALITY = [
  { pr: 1.0, ao: false, shadow: 2048 },
  { pr: 1.25, ao: false, shadow: 4096 },
  { pr: 1.5, ao: true, shadow: 4096 },
];
let quality = isMobile ? 0 : 2;

let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
} catch (err) {
  ui.fatal("Votre navigateur ne prend pas en charge WebGL : la visite 3D n'est pas disponible.");
  throw err;
}
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.NeutralToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.shadowMap.autoUpdate = false; // scène statique : ombres calculées une seule fois

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xe9e4da);
scene.fog = new THREE.Fog(0xe9e3d8, 30, 95);

const camera = new THREE.PerspectiveCamera(68, innerWidth / innerHeight, 0.05, 150);

let composer = null, gtaoPass = null, useComposer = false;
let controller, pickables = [];
let state = 'loading';
let lockEverWorked = false;
let hovered = null;
let ARTWORKS = [];
let CONTENT = null;
let FILES = {};

function applyQuality() {
  const q = QUALITY[quality];
  const pr = Math.min(window.devicePixelRatio || 1, q.pr);
  renderer.setPixelRatio(pr);
  renderer.setSize(innerWidth, innerHeight);
  useComposer = q.ao && !!composer;
  if (composer) {
    composer.setPixelRatio(pr);
    composer.setSize(innerWidth, innerHeight);
  }
}

function setupComposer() {
  try {
    const rt = new THREE.WebGLRenderTarget(innerWidth, innerHeight, { type: THREE.HalfFloatType, samples: 4 });
    composer = new EffectComposer(renderer, rt);
    composer.addPass(new RenderPass(scene, camera));
    gtaoPass = new GTAOPass(scene, camera, innerWidth, innerHeight);
    gtaoPass.updateGtaoMaterial({
      radius: 0.55, distanceExponent: 1.6, thickness: 1.2, scale: 1.15, samples: 12, distanceFallOff: 1, screenSpaceRadius: false,
    });
    gtaoPass.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 5, rings: 2, samples: 12 });
    gtaoPass.blendIntensity = 0.8;
    composer.addPass(gtaoPass);
    composer.addPass(new OutputPass());
  } catch (e) {
    console.warn('Post-traitement indisponible', e);
    composer = null;
  }
}

/* ---------- Lumière ---------- */
function setupLights(museum, theme) {
  const hemi = new THREE.HemisphereLight(0xf5f1ea, 0x9c8668, 1.15);
  scene.add(hemi);

  const sun = new THREE.DirectionalLight(0xfff0da, 3.4 * theme.sunlight);
  const dir = new THREE.Vector3(0.3, 1, 0.22).normalize();
  sun.target.position.set(0, 0, -DIM.L / 2);
  sun.position.copy(sun.target.position).addScaledVector(dir, 40);
  sun.castShadow = true;
  const q = QUALITY[quality];
  sun.shadow.mapSize.set(q.shadow, q.shadow);
  const sc = sun.shadow.camera;
  sc.left = -28; sc.right = 28; sc.top = 28; sc.bottom = -28; sc.near = 5; sc.far = 80;
  sun.shadow.bias = -0.0003;
  sun.shadow.normalBias = 0.025;
  scene.add(sun, sun.target);

  RectAreaLightUniformsLib.init();
  const skyLight = new THREE.RectAreaLight(0xf2f5fa, 2.6, 2 * DIM.SKY, DIM.L - 1);
  skyLight.position.set(0, DIM.GLASS_Y - 0.15, -DIM.L / 2);
  skyLight.rotation.x = -Math.PI / 2;
  scene.add(skyLight);

  const backLight = new THREE.RectAreaLight(0xfff3e2, 5, 2.9, 2.9);
  backLight.position.copy(museum.backRoomCenter);
  backLight.rotation.x = -Math.PI / 2;
  scene.add(backLight);

  const vest = new THREE.PointLight(0xffdcb0, 7, 9, 1.6);
  vest.position.copy(museum.vestibuleLight);
  scene.add(vest);
}

/** Capture l'intérieur de la galerie pour les reflets (sol, cadres dorés). */
function captureEnvironment() {
  const cubeRT = new THREE.WebGLCubeRenderTarget(256, { type: THREE.HalfFloatType });
  const cubeCam = new THREE.CubeCamera(0.1, 120, cubeRT);
  cubeCam.position.set(0, 2.6, -DIM.L / 2);
  scene.add(cubeCam);
  cubeCam.update(renderer, scene);
  scene.remove(cubeCam);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = pmrem.fromCubemap(cubeRT.texture);
  scene.environment = env.texture;
  scene.environmentIntensity = 0.55;
  pmrem.dispose();
  cubeRT.dispose();
}

/* ---------- Interaction ---------- */
const raycaster = new THREE.Raycaster();
raycaster.far = 9;

function pick(ndc) {
  if (!ndc) return null;
  raycaster.setFromCamera(ndc, camera);
  const hits = raycaster.intersectObjects(pickables, false);
  for (const h of hits) {
    const art = h.object.userData.art;
    if (art && raycaster.ray.direction.dot(art._normal) < 0) return art;
  }
  return null;
}

function openArtwork(art) {
  state = 'modal';
  controller.clearInput();
  ui.setHover(null);
  setHighlight(null);
  if (document.pointerLockElement) document.exitPointerLock();
  ui.openModal(art, ARTWORKS.length, (a) => artworkImageURL(a, FILES), resolveAsset(art.document.url, FILES));
}

/** Clic sur une œuvre : fiche, ou ouverture directe d'un lien / document. */
function activateArtwork(art) {
  const direct = art.clickAction === 'link' ? art.link.url
    : art.clickAction === 'document' ? resolveAsset(art.document.url, FILES) : '';
  if (direct) {
    controller.clearInput();
    if (document.pointerLockElement) document.exitPointerLock();
    window.open(direct, '_blank', 'noopener');
    return;
  }
  openArtwork(art);
}

function openMenu() {
  if (state !== 'touring') return;
  state = 'paused';
  controller.clearInput();
  ui.setHover(null);
  if (document.pointerLockElement) document.exitPointerLock();
  ui.showPause(true);
}

function closeArtwork(viaKeyboard = false) {
  if (state !== 'modal') return;
  ui.closeModal();
  if (controller.dragMode) { state = 'touring'; return; }
  if (viaKeyboard) { state = 'paused'; ui.showPause(true); return; }
  state = 'touring';
  requestLock();
}

function setHighlight(art) {
  hovered = art;
}

function animateHighlights(dt) {
  for (const art of ARTWORKS) {
    if (!art._canvasMat) continue;
    const target = art === hovered ? 1 : 0;
    if (art._hover === target) continue;
    art._hover += (target - art._hover) * Math.min(1, dt * 8);
    if (Math.abs(art._hover - target) < 0.01) art._hover = target;
    art._canvasMat.emissiveIntensity = art._hover * 0.1;
    for (const m of art._frameMats) {
      m.emissive.setRGB(1, 0.86, 0.62);
      m.emissiveIntensity = art._hover * 0.16;
    }
  }
}

function requestLock() {
  if (controller.dragMode) return;
  try {
    const p = canvas.requestPointerLock();
    if (p && p.catch) p.catch(onLockError);
  } catch (e) {
    onLockError();
  }
}

function onLockError() {
  if (state === 'modal') return;
  if (!lockEverWorked) {
    // navigateur sans verrouillage du pointeur : cliquer-glisser pour regarder
    controller.dragMode = true;
    ui.setDragMode(true);
    ui.showPause(false);
    state = 'touring';
  } else {
    state = 'paused';
    ui.showPause(true);
  }
}

document.addEventListener('pointerlockchange', () => {
  const locked = document.pointerLockElement === canvas;
  controller.locked = locked;
  if (locked) {
    lockEverWorked = true;
    state = 'touring';
    ui.showPause(false);
    ui.activity();
  } else if (state === 'touring') {
    state = 'paused';
    controller.clearInput();
    ui.showPause(true);
  }
});
document.addEventListener('pointerlockerror', onLockError);

function enterMuseum() {
  ui.showWelcome(false);
  ui.setTouring(true);
  controller.enabled = true;
  state = 'touring';
  if (isTouch || !('requestPointerLock' in canvas)) {
    controller.dragMode = true;
    ui.setDragMode(true);
  } else requestLock();
}

function wireUI() {
  ui.el.enter.addEventListener('click', enterMuseum);
  ui.el.resume.addEventListener('click', () => { ui.showPause(false); state = 'touring'; requestLock(); });
  ui.el.menu.addEventListener('click', openMenu);
  ui.el.close.addEventListener('click', () => closeArtwork(false));
  ui.el.back.addEventListener('click', () => closeArtwork(false));
  ui.el.modal.querySelector('[data-close]').addEventListener('click', () => closeArtwork(false));
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && state === 'modal') closeArtwork(true);
  });
  controller.onPick = (ndc) => {
    if (state !== 'touring') return;
    const art = pick(ndc);
    if (art) activateArtwork(art);
  };
  controller.onActivity = () => ui.activity();
}

/* ---------- Boucle ---------- */
const clock = new THREE.Clock();
let cineT = 0;
let perfAcc = 0, perfFrames = 0, perfWarmup = 1.5, lowStreak = 0;

function loop() {
  const dt = Math.min(clock.getDelta(), 0.05);
  if (state === 'modal') return; // rien ne bouge derrière la fiche : on économise le GPU

  if (state === 'welcome') {
    // lente avancée cinématographique derrière l'écran d'accueil
    cineT += dt;
    const t = cineT * 0.05;
    const z = -1.6 - (1 - Math.cos(Math.min(t, Math.PI))) * 3.2;
    controller.setPose(Math.sin(cineT * 0.12) * 0.35, z, Math.sin(cineT * 0.09) * 0.16 - 0.02, -0.02 + Math.sin(cineT * 0.07) * 0.03);
  } else if (state === 'touring') {
    controller.update(dt);
    const art = pick(controller.pointer());
    ui.setHover(art);
    setHighlight(art);
  }
  animateHighlights(dt);

  if (useComposer) composer.render(dt);
  else renderer.render(scene, camera);

  // qualité adaptative : on allège si l'image saccade
  if ((state === 'touring' || state === 'welcome') && !document.hidden) {
    if (perfWarmup > 0) perfWarmup -= dt;
    else {
      perfAcc += dt; perfFrames++;
      if (perfAcc > 2.5) {
        const fps = perfFrames / perfAcc;
        perfAcc = 0; perfFrames = 0;
        lowStreak = fps < 38 ? lowStreak + 1 : 0;
        if (lowStreak >= 2 && quality > 0) {
          lowStreak = 0;
          quality--;
          applyQuality();
          perfWarmup = 1.5;
          console.info(`[galerie] qualité réduite (niveau ${quality}, ${fps.toFixed(0)} i/s)`);
        }
      }
    }
  }
}

/** Champ de vision : sur un écran en portrait (téléphone), on garde un angle horizontal confortable. */
function updateCamera() {
  const aspect = innerWidth / innerHeight;
  camera.aspect = aspect;
  const minHFov = 72 * Math.PI / 180;
  const vForH = 2 * Math.atan(Math.tan(minHFov / 2) / aspect) * 180 / Math.PI;
  camera.fov = Math.min(100, Math.max(68, vForH));
  camera.updateProjectionMatrix();
}
updateCamera();

window.addEventListener('resize', () => {
  updateCamera();
  applyQuality();
  if (state === 'modal') renderer.render(scene, camera);
});

/* ---------- Construction ---------- */
async function fontsReady() {
  if (!document.fonts) return;
  const loads = Promise.all([
    document.fonts.load('500 46px "Cormorant Garamond"'),
    document.fonts.load('italic 500 46px "Cormorant Garamond"'),
    document.fonts.load('500 26px "Jost"'),
  ]);
  await Promise.race([loads, new Promise((r) => setTimeout(r, 2500))]).catch(() => {});
}

async function init() {
  ui.progress(0.02, 'Lecture du contenu…');
  const preview = new URLSearchParams(location.search).has('apercu');
  const loaded = await loadContent({ preview });
  CONTENT = loaded.content;
  FILES = loaded.files;
  ARTWORKS = CONTENT.artworks;
  ui.applyContent(CONTENT);
  if (loaded.preview) ui.showPreviewBanner();
  const theme = CONTENT.theme;
  renderer.toneMappingExposure = theme.exposure;
  const posterColors = { paper: theme.background, ink: theme.ink, accent: theme.accent };
  ARTWORKS.forEach((a) => (a._poster = posterColors));

  ui.progress(0.05, 'Préparation des matériaux…');
  await fontsReady();
  await yieldFrame();
  const mats = createMaterials(renderer, theme);
  ui.progress(0.2, 'Construction de la galerie…');
  await yieldFrame();

  const museum = buildMuseum(mats, { inscription: CONTENT.site.inscription || CONTENT.site.name });
  scene.add(museum.group);
  controller = new Controller(camera, canvas, museum.colliders);
  controller.apply();
  ui.progress(0.32, 'Accrochage des œuvres…');
  await yieldFrame();

  const hung = await hangArtworks(ARTWORKS, museum.walls, mats, renderer, (i, n) => {
    ui.progress(0.32 + 0.53 * (i / n), `Accrochage des œuvres… ${i} / ${n}`);
  }, FILES);
  scene.add(hung.group);
  pickables = hung.pickables;

  ui.progress(0.88, 'Réglage de la lumière…');
  await yieldFrame();
  setupLights(museum, theme);
  renderer.shadowMap.needsUpdate = true;
  captureEnvironment();
  renderer.shadowMap.needsUpdate = true;

  ui.progress(0.95, 'Préparation du rendu…');
  setupComposer();
  applyQuality();
  if (renderer.compileAsync) {
    try { await renderer.compileAsync(scene, camera); } catch (e) { /* facultatif */ }
  }
  wireUI();

  state = 'welcome';
  renderer.setAnimationLoop(loop);
  ui.progress(1, 'Bienvenue');
  await new Promise((r) => setTimeout(r, 450));
  ui.hideLoader();
  ui.showWelcome(true);

  // accès pour le débogage depuis la console
  window.__galerie = { scene, camera, renderer, controller, ARTWORKS, CONTENT, composer, get quality() { return quality; }, setQuality(q) { quality = q; applyQuality(); } };
}

init().catch((err) => {
  console.error(err);
  ui.fatal(location.protocol === 'file:'
    ? 'Ce site doit être ouvert via un serveur (voir LISEZMOI / README) : double-cliquez sur « demarrer-mac.command » ou « demarrer-windows.bat ».'
    : 'Le chargement de la galerie a échoué. Vérifiez votre connexion puis rechargez la page.');
});
