// ===========================================================================
// VICE STREETS 3D — original neon-city open-world game built on Three.js
// ===========================================================================

let scene, renderer, camera;
let clock = new THREE.Clock();
let running = false;

const WORLD_SIZE = 1200;
const HOME_POS = new THREE.Vector3(-380, 0, -380);
const AIRPORT_POS = new THREE.Vector3(520, 0, 520);

// ---------------------------------------------------------------
// Renderer / Scene / Camera
// ---------------------------------------------------------------
scene = new THREE.Scene();
camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 4000);

renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
document.body.appendChild(renderer.domElement);
renderer.domElement.style.position = 'fixed';
renderer.domElement.style.inset = '0';
renderer.domElement.style.zIndex = '0';

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ---------------------------------------------------------------
// Procedural textures (canvas based)
// ---------------------------------------------------------------
function makeCanvasTexture(draw, w = 128, h = 128, repeatX = 1, repeatY = 1) {
  const cnv = document.createElement('canvas');
  cnv.width = w; cnv.height = h;
  const c = cnv.getContext('2d');
  draw(c, w, h);
  const tex = new THREE.CanvasTexture(cnv);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  return tex;
}

function brickTexture(baseColor, mortar = '#1a1a1a') {
  return makeCanvasTexture((c, w, h) => {
    c.fillStyle = mortar; c.fillRect(0, 0, w, h);
    const bw = 32, bh = 16;
    c.fillStyle = baseColor;
    for (let y = 0; y < h; y += bh) {
      const offset = (y / bh) % 2 === 0 ? 0 : bw / 2;
      for (let x = -bw; x < w; x += bw) c.fillRect(x + offset + 1, y + 1, bw - 2, bh - 2);
    }
  }, 128, 128, 4, 4);
}

function windowGridTexture(glowColor) {
  return makeCanvasTexture((c, w, h) => {
    c.fillStyle = '#0c0c14'; c.fillRect(0, 0, w, h);
    const cell = 16;
    for (let y = 4; y < h - 4; y += cell) {
      for (let x = 4; x < w - 4; x += cell) {
        c.fillStyle = Math.random() < 0.55 ? glowColor : '#1b1b28';
        c.fillRect(x, y, cell - 6, cell - 8);
      }
    }
  }, 128, 256, 1, 1);
}

function roadTexture() {
  return makeCanvasTexture((c, w, h) => {
    c.fillStyle = '#222229'; c.fillRect(0, 0, w, h);
    c.fillStyle = '#f4d35e';
    c.fillRect(w / 2 - 3, 0, 6, h * 0.4);
    c.fillRect(w / 2 - 3, h * 0.6, 6, h * 0.4);
    c.fillStyle = '#2c2c33';
    for (let i = 0; i < 40; i++) c.fillRect(Math.random() * w, Math.random() * h, 2, 2);
  }, 64, 64, 8, 60);
}

function grassTexture() {
  return makeCanvasTexture((c, w, h) => {
    c.fillStyle = '#16321f'; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 400; i++) {
      c.fillStyle = Math.random() < 0.5 ? '#1d4228' : '#123018';
      c.fillRect(Math.random() * w, Math.random() * h, 2, 2);
    }
  }, 64, 64, 80, 80);
}

function roofTexture() {
  return makeCanvasTexture((c, w, h) => {
    c.fillStyle = '#3a1f3d'; c.fillRect(0, 0, w, h);
    c.strokeStyle = '#22122a';
    for (let y = 0; y < h; y += 8) { c.beginPath(); c.moveTo(0, y); c.lineTo(w, y); c.stroke(); }
  }, 64, 64, 2, 2);
}

function doorWoodTexture() {
  return makeCanvasTexture((c, w, h) => {
    c.fillStyle = '#5a3522'; c.fillRect(0, 0, w, h);
    c.fillStyle = '#46291a';
    for (let x = 4; x < w; x += 10) c.fillRect(x, 0, 2, h);
  }, 64, 128, 1, 1);
}

// realistic-ish skin: base tone + subtle pore/blotch noise + soft shading
function skinTexture(baseColor) {
  return makeCanvasTexture((c, w, h) => {
    c.fillStyle = baseColor; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 900; i++) {
      const shade = Math.random() < 0.5 ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.04)';
      c.fillStyle = shade;
      c.fillRect(Math.random() * w, Math.random() * h, 1, 1);
    }
    c.fillStyle = 'rgba(180,90,90,0.06)';
    for (let i = 0; i < 30; i++) c.fillRect(Math.random() * w, Math.random() * h, 3, 3);
  }, 64, 64, 1, 1);
}

// woven fabric texture for clothes
function fabricTexture(baseColor) {
  return makeCanvasTexture((c, w, h) => {
    c.fillStyle = baseColor; c.fillRect(0, 0, w, h);
    c.strokeStyle = 'rgba(0,0,0,0.08)';
    for (let i = 0; i < w; i += 3) { c.beginPath(); c.moveTo(i, 0); c.lineTo(i, h); c.stroke(); }
    for (let i = 0; i < h; i += 3) { c.beginPath(); c.moveTo(0, i); c.lineTo(w, i); c.stroke(); }
    c.fillStyle = 'rgba(255,255,255,0.05)';
    for (let i = 0; i < 60; i++) c.fillRect(Math.random() * w, Math.random() * h, 2, 2);
  }, 32, 32, 2, 2);
}

// brushed metal for vehicle bodies
function metalTexture(baseColor) {
  return makeCanvasTexture((c, w, h) => {
    c.fillStyle = baseColor; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 200; i++) {
      c.strokeStyle = Math.random() < 0.5 ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';
      const y = Math.random() * h;
      c.beginPath(); c.moveTo(0, y); c.lineTo(w, y); c.stroke();
    }
  }, 64, 64, 1, 1);
}

// fur for animals
function furTexture(c1, c2) {
  return makeCanvasTexture((c, w, h) => {
    c.fillStyle = c1; c.fillRect(0, 0, w, h);
    c.fillStyle = c2;
    for (let i = 0; i < 250; i++) c.fillRect(Math.random() * w, Math.random() * h, 2, 4);
  }, 32, 32, 2, 2);
}

// tarmac for runway
function tarmacTexture() {
  return makeCanvasTexture((c, w, h) => {
    c.fillStyle = '#16161c'; c.fillRect(0, 0, w, h);
    c.fillStyle = '#e8e8e8';
    c.fillRect(w / 2 - 2, 0, 4, h * 0.3);
    c.fillRect(w / 2 - 2, h * 0.4, 4, h * 0.2);
    c.fillRect(w / 2 - 2, h * 0.7, 4, h * 0.3);
  }, 64, 64, 4, 40);
}

function woodFloorTexture() {
  return makeCanvasTexture((c, w, h) => {
    c.fillStyle = '#b58a5e'; c.fillRect(0, 0, w, h);
    const plank = 16;
    for (let y = 0; y < h; y += plank) {
      c.strokeStyle = 'rgba(60,35,15,0.35)';
      c.beginPath(); c.moveTo(0, y); c.lineTo(w, y); c.stroke();
      const offset = (y / plank) % 2 === 0 ? 0 : plank;
      for (let x = -plank; x < w; x += plank * 2) {
        c.strokeStyle = 'rgba(60,35,15,0.25)';
        c.beginPath(); c.moveTo(x + offset, y); c.lineTo(x + offset, y + plank); c.stroke();
      }
    }
    for (let i = 0; i < 80; i++) { c.fillStyle = 'rgba(80,50,20,0.15)'; c.fillRect(Math.random() * w, Math.random() * h, 6, 1); }
  }, 64, 64, 6, 6);
}

function marbleTexture(base = '#f1ede6') {
  return makeCanvasTexture((c, w, h) => {
    c.fillStyle = base; c.fillRect(0, 0, w, h);
    c.strokeStyle = 'rgba(150,150,150,0.4)';
    for (let i = 0; i < 6; i++) {
      c.beginPath();
      let x = Math.random() * w, y = 0;
      c.moveTo(x, y);
      for (let s = 0; s < 6; s++) { x += (Math.random() - 0.5) * 30; y += h / 6; c.lineTo(x, y); }
      c.stroke();
    }
  }, 128, 128, 3, 3);
}

function carpetTexture(color) {
  return makeCanvasTexture((c, w, h) => {
    c.fillStyle = color; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 500; i++) { c.fillStyle = 'rgba(0,0,0,0.04)'; c.fillRect(Math.random() * w, Math.random() * h, 1, 1); }
  }, 32, 32, 6, 6);
}

const TEX = {
  brickPink: brickTexture('#7a3d52'),
  brickBlue: brickTexture('#33455e'),
  brickTeal: brickTexture('#2c4d4a'),
  windowPink: windowGridTexture('#ff7fd0'),
  windowCyan: windowGridTexture('#7ff9ff'),
  windowYellow: windowGridTexture('#ffe27f'),
  road: roadTexture(),
  grass: grassTexture(),
  roof: roofTexture(),
  door: doorWoodTexture(),
  tarmac: tarmacTexture()
};

// shared cosmetic palettes (declared early — used by NPCs, drivers, and the closet menu)
const SHIRT_COLORS = ['#ff2da8', '#00eaff', '#ffd400', '#2dffb0', '#7b2dff', '#ffffff', '#222222', '#ff6b2d'];
const PANTS_COLORS = ['#1c1c2a', '#2b2b40', '#4a3a22', '#222222', '#5a1c3a', '#0f3d3d'];
const SKIN_COLORS = ['#3a2317', '#5c3a23', '#8a5a3a', '#c98552', '#e8b98f', '#f3d4b8'];

// ---------------------------------------------------------------
// Sky / lighting / day-night cycle + starfield
// ---------------------------------------------------------------
let dayTime = 7;
let dayPaused = false;
const sun = new THREE.DirectionalLight(0xffffff, 1.2);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
sun.shadow.camera.left = -400; sun.shadow.camera.right = 400;
sun.shadow.camera.top = 400; sun.shadow.camera.bottom = -400;
sun.shadow.camera.far = 1500;
scene.add(sun);
scene.add(sun.target);

const ambient = new THREE.AmbientLight(0x404060, 0.6);
scene.add(ambient);
const hemi = new THREE.HemisphereLight(0x88aaff, 0x221133, 0.5);
scene.add(hemi);
scene.fog = new THREE.Fog(0x1a0033, 100, 1300);

function lerpColor(a, b, t) { return new THREE.Color(a).lerp(new THREE.Color(b), t); }

const skyKeys = [
  { h: 0, sky: 0x05021a, fog: 0x05021a, light: 0x223366, intensity: 0.15 },
  { h: 5, sky: 0x14123a, fog: 0x140f33, light: 0x445599, intensity: 0.3 },
  { h: 6.5, sky: 0xff7a4d, fog: 0xff2da8, light: 0xffae6b, intensity: 0.9 },
  { h: 9, sky: 0x6fc7ff, fog: 0x4a8fcf, light: 0xffffff, intensity: 1.2 },
  { h: 16, sky: 0x6fc7ff, fog: 0x4a8fcf, light: 0xffffff, intensity: 1.1 },
  { h: 18, sky: 0xff5e8a, fog: 0xff2da8, light: 0xff9d5c, intensity: 0.95 },
  { h: 19.5, sky: 0x35124f, fog: 0x2a0a40, light: 0xff6bd6, intensity: 0.5 },
  { h: 21, sky: 0x0c0524, fog: 0x12042c, light: 0x6644aa, intensity: 0.25 },
  { h: 24, sky: 0x05021a, fog: 0x05021a, light: 0x223366, intensity: 0.15 }
];

function getSkyState(h) {
  for (let i = 0; i < skyKeys.length - 1; i++) {
    const a = skyKeys[i], b = skyKeys[i + 1];
    if (h >= a.h && h <= b.h) {
      const t = (h - a.h) / (b.h - a.h);
      return {
        sky: lerpColor(a.sky, b.sky, t),
        fog: lerpColor(a.fog, b.fog, t),
        light: lerpColor(a.light, b.light, t),
        intensity: a.intensity + (b.intensity - a.intensity) * t
      };
    }
  }
  return { sky: new THREE.Color(skyKeys[0].sky), fog: new THREE.Color(skyKeys[0].fog), light: new THREE.Color(skyKeys[0].light), intensity: 0.2 };
}

// starfield — visible at night, fades out at dawn/dusk
const starGeo = new THREE.BufferGeometry();
const starCount = 1500;
const starPositions = new Float32Array(starCount * 3);
for (let i = 0; i < starCount; i++) {
  const r = 1800;
  const theta = Math.random() * Math.PI * 2;
  const phi = Math.random() * Math.PI * 0.5; // upper hemisphere
  starPositions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
  starPositions[i * 3 + 1] = r * Math.cos(phi) + 50;
  starPositions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
}
starGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
const starMat = new THREE.PointsMaterial({ color: 0xffffff, size: 2.2, transparent: true, opacity: 0 });
const stars = new THREE.Points(starGeo, starMat);
scene.add(stars);

function nightFactor(h) {
  // 1 at deep night, 0 during day
  if (h < 5 || h > 20) return 1;
  if (h < 6.5) return 1 - (h - 5) / 1.5;
  if (h > 19) return (h - 19) / 1;
  return 0;
}

function updateSky() {
  const s = getSkyState(dayTime);
  scene.background = s.sky;
  scene.fog.color = s.fog;
  sun.color = s.light;
  sun.intensity = s.intensity;
  hemi.intensity = 0.25 + s.intensity * 0.3;

  const angle = ((dayTime / 24) * Math.PI * 2) - Math.PI / 2;
  sun.position.set(Math.cos(angle) * 600, Math.max(40, Math.sin(angle) * 600), -200);
  sun.target.position.set(0, 0, 0);

  starMat.opacity = nightFactor(dayTime) * 0.9;
  stars.position.set(camera.position.x, 0, camera.position.z);

  const hh = Math.floor(dayTime).toString().padStart(2, '0');
  const mm = Math.floor((dayTime % 1) * 60).toString().padStart(2, '0');
  document.getElementById('clock').textContent = hh + ':' + mm;
}

const NEON_COLORS = [0xff2da8, 0x00eaff, 0x7b2dff, 0xffd400, 0x2dffb0];

// ---------------------------------------------------------------
// Ground, roads, city blocks
// ---------------------------------------------------------------
const groundGeo = new THREE.PlaneGeometry(WORLD_SIZE * 2, WORLD_SIZE * 2);
const groundMat = new THREE.MeshStandardMaterial({ map: TEX.grass, roughness: 1 });
const ground = new THREE.Mesh(groundGeo, groundMat);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

const blockSpacing = 90;
const roadW = 16;
const buildings = [];
const buildingGroup = new THREE.Group();
scene.add(buildingGroup);

function nearKeepClear(x, z) {
  return Math.hypot(x - HOME_POS.x, z - HOME_POS.z) < 320 || Math.hypot(x - AIRPORT_POS.x, z - AIRPORT_POS.z) < 220;
}

for (let x = -WORLD_SIZE / 2; x < WORLD_SIZE / 2; x += blockSpacing) {
  for (let z = -WORLD_SIZE / 2; z < WORLD_SIZE / 2; z += blockSpacing) {
    if (nearKeepClear(x, z)) continue;
    if (Math.random() < 0.12) continue;
    const w = 22 + Math.random() * 14;
    const d = 22 + Math.random() * 14;
    const height = 18 + Math.random() * 90;
    const brickChoices = [TEX.brickPink, TEX.brickBlue, TEX.brickTeal];
    const winChoices = [TEX.windowPink, TEX.windowCyan, TEX.windowYellow];
    const idx = Math.floor(Math.random() * 3);

    const mat = [
      new THREE.MeshStandardMaterial({ map: winChoices[idx] }),
      new THREE.MeshStandardMaterial({ map: winChoices[idx] }),
      new THREE.MeshStandardMaterial({ map: brickChoices[idx] }),
      new THREE.MeshStandardMaterial({ map: brickChoices[idx] }),
      new THREE.MeshStandardMaterial({ map: winChoices[idx] }),
      new THREE.MeshStandardMaterial({ map: winChoices[idx] })
    ];
    const geo = new THREE.BoxGeometry(w, height, d);
    const building = new THREE.Mesh(geo, mat);
    building.position.set(x + (Math.random() - 0.5) * 10, height / 2, z + (Math.random() - 0.5) * 10);
    building.castShadow = true; building.receiveShadow = true;
    buildingGroup.add(building);
    buildings.push({ mesh: building, w, d, h: height });

    const neonColor = NEON_COLORS[Math.floor(Math.random() * NEON_COLORS.length)];
    const edge = new THREE.Mesh(
      new THREE.BoxGeometry(w + 0.4, 1, d + 0.4),
      new THREE.MeshStandardMaterial({ color: neonColor, emissive: neonColor, emissiveIntensity: 2 })
    );
    edge.position.set(building.position.x, height + 0.6, building.position.z);
    buildingGroup.add(edge);
  }
}

const roadMat = new THREE.MeshStandardMaterial({ map: TEX.road, roughness: 0.9 });
for (let x = -WORLD_SIZE / 2; x < WORLD_SIZE / 2; x += blockSpacing) {
  const r = new THREE.Mesh(new THREE.PlaneGeometry(roadW, WORLD_SIZE * 2), roadMat);
  r.rotation.x = -Math.PI / 2;
  r.position.set(x - blockSpacing / 2, 0.02, 0);
  scene.add(r);
}
for (let z = -WORLD_SIZE / 2; z < WORLD_SIZE / 2; z += blockSpacing) {
  const r = new THREE.Mesh(new THREE.PlaneGeometry(WORLD_SIZE * 2, roadW), roadMat);
  r.rotation.x = -Math.PI / 2;
  r.position.set(0, 0.02, z - blockSpacing / 2);
  scene.add(r);
}

// ---------------------------------------------------------------
// Home: two-story house on a hill
// ---------------------------------------------------------------
function buildHill() {
  const hillGeo = new THREE.ConeGeometry(150, 36, 24, 1, true);
  const hillMat = new THREE.MeshStandardMaterial({ map: TEX.grass, roughness: 1 });
  const hill = new THREE.Mesh(hillGeo, hillMat);
  hill.position.set(HOME_POS.x, 18, HOME_POS.z);
  hill.castShadow = true; hill.receiveShadow = true;
  scene.add(hill);

  const top = new THREE.Mesh(new THREE.CircleGeometry(70, 24), hillMat);
  top.rotation.x = -Math.PI / 2;
  top.position.set(HOME_POS.x, 36, HOME_POS.z);
  top.receiveShadow = true;
  scene.add(top);
  return 36;
}
const hillTopY = buildHill();

function buildHouse(baseY) {
  const house = new THREE.Group();
  const wallMat = new THREE.MeshStandardMaterial({ map: TEX.brickPink });
  const winMat = new THREE.MeshStandardMaterial({ map: TEX.windowYellow });
  const roofMat = new THREE.MeshStandardMaterial({ map: TEX.roof });
  const doorMat = new THREE.MeshStandardMaterial({ map: TEX.door });
  const trimMat = new THREE.MeshStandardMaterial({ color: 0x00eaff, emissive: 0x00eaff, emissiveIntensity: 1.4 });

  const floor1 = new THREE.Mesh(new THREE.BoxGeometry(26, 10, 22), wallMat);
  floor1.position.set(0, 5, 0); floor1.castShadow = floor1.receiveShadow = true;
  house.add(floor1);
  const floor2 = new THREE.Mesh(new THREE.BoxGeometry(22, 9, 18), wallMat);
  floor2.position.set(0, 14.5, 0); floor2.castShadow = floor2.receiveShadow = true;
  house.add(floor2);
  const roof = new THREE.Mesh(new THREE.ConeGeometry(17, 8, 4), roofMat);
  roof.rotation.y = Math.PI / 4;
  roof.position.set(0, 23, 0);
  roof.castShadow = true;
  house.add(roof);

  for (const [x, y] of [[-7, 5], [7, 5], [-6, 14.5], [6, 14.5]]) {
    const win = new THREE.Mesh(new THREE.PlaneGeometry(4.5, 4), winMat);
    win.position.set(x, y, 11.05);
    house.add(win);
  }
  const door = new THREE.Mesh(new THREE.PlaneGeometry(4, 7), doorMat);
  door.position.set(0, 3.5, 11.05);
  house.add(door);

  const trim = new THREE.Mesh(new THREE.BoxGeometry(26.4, 0.4, 22.4), trimMat);
  trim.position.set(0, 0.2, 0);
  house.add(trim);
  const trim2 = new THREE.Mesh(new THREE.BoxGeometry(22.4, 0.4, 18.4), trimMat);
  trim2.position.set(0, 9.9, 0);
  house.add(trim2);

  const pool = new THREE.Mesh(new THREE.CircleGeometry(8, 24), new THREE.MeshStandardMaterial({ color: 0x00d2ff, emissive: 0x00aacc, emissiveIntensity: 0.6 }));
  pool.rotation.x = -Math.PI / 2;
  pool.position.set(0, 0.05, 22);
  house.add(pool);

  // jacuzzi beside the pool — warm glow, raised rim
  const jacuzziRim = new THREE.Mesh(new THREE.CylinderGeometry(3.4, 3.4, 0.6, 20), new THREE.MeshStandardMaterial({ color: 0xe8e8e8, roughness: 0.5 }));
  jacuzziRim.position.set(13, 0.3, 24);
  house.add(jacuzziRim);
  const jacuzziWater = new THREE.Mesh(new THREE.CircleGeometry(2.9, 20), new THREE.MeshStandardMaterial({ color: 0xff9d5c, emissive: 0xff7a3d, emissiveIntensity: 0.7 }));
  jacuzziWater.rotation.x = -Math.PI / 2;
  jacuzziWater.position.set(13, 0.62, 24);
  house.add(jacuzziWater);

  // landscaped garden seating
  for (const [gx, gz] of [[-13, 24], [-16, 18]]) {
    const bench = new THREE.Mesh(new THREE.BoxGeometry(3, 0.5, 1.2), new THREE.MeshStandardMaterial({ color: 0x3a2a1a }));
    bench.position.set(gx, 0.4, gz);
    house.add(bench);
  }
  for (let i = 0; i < 8; i++) {
    const bush = new THREE.Mesh(new THREE.SphereGeometry(1 + Math.random() * 0.6, 8, 8), new THREE.MeshStandardMaterial({ color: 0x1d4228 }));
    bush.position.set(-20 + Math.random() * 40, 1, 14 + Math.random() * 16);
    house.add(bush);
  }

  house.position.set(HOME_POS.x, baseY, HOME_POS.z);
  scene.add(house);

  const porchLight = new THREE.PointLight(0xffd27f, 1.2, 60);
  porchLight.position.set(HOME_POS.x, baseY + 8, HOME_POS.z + 10);
  scene.add(porchLight);
  return house;
}
buildHouse(hillTopY);

// ---------------------------------------------------------------
// Neighborhood — matching upscale homes on their own mounds nearby,
// reinforcing the cohesive high-end architectural style
// ---------------------------------------------------------------
function buildNeighborMound(x, z, radius) {
  const m = new THREE.Mesh(new THREE.ConeGeometry(radius, 24, 20, 1, true), new THREE.MeshStandardMaterial({ map: TEX.grass, roughness: 1 }));
  m.position.set(x, 12, z);
  m.castShadow = true; m.receiveShadow = true;
  scene.add(m);
  const top = new THREE.Mesh(new THREE.CircleGeometry(radius * 0.55, 20), m.material);
  top.rotation.x = -Math.PI / 2;
  top.position.set(x, 24, z);
  top.receiveShadow = true;
  scene.add(top);
  return 24;
}

function buildNeighborHouse(x, z, brickTex) {
  const baseY = buildNeighborMound(x, z, 90);
  const wallMat = new THREE.MeshStandardMaterial({ map: brickTex });
  const winMat = new THREE.MeshStandardMaterial({ map: TEX.windowCyan });
  const roofMat = new THREE.MeshStandardMaterial({ map: TEX.roof });
  const trimMat = new THREE.MeshStandardMaterial({ color: 0x00eaff, emissive: 0x00eaff, emissiveIntensity: 1.2 });

  const g = new THREE.Group();
  const floor1 = new THREE.Mesh(new THREE.BoxGeometry(24, 9, 20), wallMat);
  floor1.position.set(0, 4.5, 0); floor1.castShadow = floor1.receiveShadow = true;
  g.add(floor1);
  const floor2 = new THREE.Mesh(new THREE.BoxGeometry(20, 8, 16), wallMat);
  floor2.position.set(0, 13, 0); floor2.castShadow = floor2.receiveShadow = true;
  g.add(floor2);
  const roof = new THREE.Mesh(new THREE.ConeGeometry(15, 7, 4), roofMat);
  roof.rotation.y = Math.PI / 4;
  roof.position.set(0, 20.5, 0);
  g.add(roof);
  for (const [wx, wy] of [[-6, 4.5], [6, 4.5], [-5, 13], [5, 13]]) {
    const win = new THREE.Mesh(new THREE.PlaneGeometry(4, 3.6), winMat);
    win.position.set(wx, wy, 10.05);
    g.add(win);
  }
  const trim = new THREE.Mesh(new THREE.BoxGeometry(24.4, 0.35, 20.4), trimMat);
  trim.position.set(0, 0.2, 0);
  g.add(trim);

  const pool = new THREE.Mesh(new THREE.CircleGeometry(6, 20), new THREE.MeshStandardMaterial({ color: 0x00d2ff, emissive: 0x00aacc, emissiveIntensity: 0.5 }));
  pool.rotation.x = -Math.PI / 2;
  pool.position.set(0, 0.05, 20);
  g.add(pool);
  const jacuzzi = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.4, 0.5, 16), new THREE.MeshStandardMaterial({ color: 0xff9d5c, emissive: 0xff7a3d, emissiveIntensity: 0.6 }));
  jacuzzi.position.set(9, 0.3, 21);
  g.add(jacuzzi);

  g.position.set(x, baseY, z);
  scene.add(g);
}

const neighborBricks = [TEX.brickPink, TEX.brickBlue, TEX.brickTeal];
const neighborSlots = [
  [HOME_POS.x + 230, HOME_POS.z - 40], [HOME_POS.x + 200, HOME_POS.z + 190],
  [HOME_POS.x - 30, HOME_POS.z + 230], [HOME_POS.x - 230, HOME_POS.z + 60],
  [HOME_POS.x + 40, HOME_POS.z - 230]
];
neighborSlots.forEach((p, i) => buildNeighborHouse(p[0], p[1], neighborBricks[i % neighborBricks.length]));

// ---------------------------------------------------------------
// HOUSE INTERIOR — a separate walkable space, entered through the
// front door. Open-plan living/kitchen/dining, master suite with
// en-suite + walk-in closet + private balcony, office, entertainment
// room, and home gym — each with its own ambient lighting and props.
// ---------------------------------------------------------------
const INTERIOR_BASE = new THREE.Vector3(HOME_POS.x, -600, HOME_POS.z); // tucked far below the city, own lighting bubble
const interiorGroup = new THREE.Group();
interiorGroup.position.copy(INTERIOR_BASE);
scene.add(interiorGroup);

const interiorLight = new THREE.AmbientLight(0xfff4e0, 0.9);
const interiorSun = new THREE.DirectionalLight(0xfff7ea, 0.7);
interiorSun.position.set(40, 60, 20);
interiorGroup.add(interiorLight, interiorSun);

const floorMat = new THREE.MeshStandardMaterial({ map: makeCanvasTexture((c, w, h) => {
  c.fillStyle = '#d8cdbc'; c.fillRect(0, 0, w, h);
  c.strokeStyle = 'rgba(0,0,0,0.07)';
  for (let i = 0; i < w; i += 16) { c.beginPath(); c.moveTo(i, 0); c.lineTo(i, h); c.stroke(); }
}, 64, 64, 6, 6), roughness: 0.4 });
const wallMatInt = new THREE.MeshStandardMaterial({ color: 0xf2efe9, roughness: 0.9 });
const glassWallMat = new THREE.MeshStandardMaterial({ color: 0x88c8e8, transparent: true, opacity: 0.25, roughness: 0.05, metalness: 0.2 });

// skyline backdrop seen through the glass — a wide panel of city-glow silhouettes,
// swaps look with day/night via emissive intensity tied to the same dayTime clock
const skylineCanvasTex = makeCanvasTexture((c, w, h) => {
  c.fillStyle = '#1a2a44'; c.fillRect(0, 0, w, h);
  for (let i = 0; i < 26; i++) {
    const bw = 14 + Math.random() * 22;
    const bh = 40 + Math.random() * 140;
    const bx = Math.random() * w;
    c.fillStyle = '#0c1830';
    c.fillRect(bx, h - bh, bw, bh);
    c.fillStyle = '#ffd37f';
    for (let wy = h - bh + 6; wy < h - 6; wy += 10) for (let wx = bx + 2; wx < bx + bw - 4; wx += 8) {
      if (Math.random() < 0.5) c.fillRect(wx, wy, 4, 5);
    }
  }
}, 512, 256, 1, 1);
const skylineMat = new THREE.MeshStandardMaterial({ map: skylineCanvasTex, emissive: 0xffffff, emissiveMap: skylineCanvasTex, emissiveIntensity: 0.8 });

function addSkylinePanel(parent, x, y, z, w, h, rotY) {
  const panel = new THREE.Mesh(new THREE.PlaneGeometry(w, h), skylineMat);
  panel.position.set(x, y, z);
  panel.rotation.y = rotY;
  parent.add(panel);
  return panel;
}
const skylinePanels = [];

function room(x, z, w, d, hgt, opts = {}) {
  const g = new THREE.Group();
  const floor = new THREE.Mesh(new THREE.BoxGeometry(w, 0.4, d), floorMat);
  floor.position.set(0, -0.2, 0);
  floor.receiveShadow = true;
  g.add(floor);
  const ceiling = new THREE.Mesh(new THREE.BoxGeometry(w, 0.4, d), wallMatInt);
  ceiling.position.set(0, hgt, 0);
  g.add(ceiling);
  if (!opts.openFront) {
    const wallFront = new THREE.Mesh(new THREE.BoxGeometry(w, hgt, 0.3), opts.glassFront ? glassWallMat : wallMatInt);
    wallFront.position.set(0, hgt / 2, -d / 2);
    g.add(wallFront);
  }
  if (!opts.openBack) {
    const wallBack = new THREE.Mesh(new THREE.BoxGeometry(w, hgt, 0.3), opts.glassBack ? glassWallMat : wallMatInt);
    wallBack.position.set(0, hgt / 2, d / 2);
    g.add(wallBack);
  }
  if (!opts.openLeft) {
    const wallLeft = new THREE.Mesh(new THREE.BoxGeometry(0.3, hgt, d), opts.glassLeft ? glassWallMat : wallMatInt);
    wallLeft.position.set(-w / 2, hgt / 2, 0);
    g.add(wallLeft);
  }
  if (!opts.openRight) {
    const wallRight = new THREE.Mesh(new THREE.BoxGeometry(0.3, hgt, d), opts.glassRight ? glassWallMat : wallMatInt);
    wallRight.position.set(w / 2, hgt / 2, 0);
    g.add(wallRight);
  }
  g.position.set(x, 0, z);
  interiorGroup.add(g);
  return g;
}

function prop(parent, geo, mat, x, y, z, rotY = 0) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.rotation.y = rotY;
  m.castShadow = true;
  parent.add(m);
  return m;
}

const wood = new THREE.MeshStandardMaterial({ map: doorWoodTexture(), roughness: 0.6 });
const fabricSofa = new THREE.MeshStandardMaterial({ map: fabricTexture('#3c3c46'), color: '#3c3c46' });
const fabricRug = new THREE.MeshStandardMaterial({ color: 0xb89c7c, roughness: 0.9 });
const metalApp = new THREE.MeshStandardMaterial({ map: metalTexture('#cfcfd4'), color: '#cfcfd4', metalness: 0.7, roughness: 0.3 });
const marbleTop = new THREE.MeshStandardMaterial({ color: 0xeeeae0, roughness: 0.15 });
const screenMat = new THREE.MeshStandardMaterial({ color: 0x0a0a14, emissive: 0x2255ff, emissiveIntensity: 0.5 });
const bedMat = new THREE.MeshStandardMaterial({ map: fabricTexture('#e9e3d8'), color: '#e9e3d8' });
const closetWood = new THREE.MeshStandardMaterial({ color: 0x6b4a32, roughness: 0.5 });

// --- Entry hall ---
const entryHall = room(0, 0, 14, 10, 9, { openBack: true });
prop(entryHall, new THREE.BoxGeometry(1, 7, 3.6), wood, -6.4, 3.5, 0); // front door slab (visual)

// --- Open-plan living / kitchen / dining (the big one) ---
const mainHall = room(0, 24, 50, 36, 11, { openFront: true, glassBack: true, glassLeft: true, glassRight: true });
addSkylinePanel(mainHall, 0, 5.5, 17.8, 48, 11, 0);
addSkylinePanel(mainHall, -24.8, 5.5, 0, 35, 11, Math.PI / 2);
addSkylinePanel(mainHall, 24.8, 5.5, 0, 35, 11, -Math.PI / 2);

// living lounge (west side)
prop(mainHall, new THREE.BoxGeometry(8, 1.6, 3), fabricSofa, -14, 0.8, 6);
prop(mainHall, new THREE.BoxGeometry(8, 1.6, 1), fabricSofa, -14, 0.8, 4.3);
prop(mainHall, new THREE.CylinderGeometry(3.2, 3.2, 0.3, 20), fabricRug, -14, 0.05, 9);
prop(mainHall, new THREE.BoxGeometry(3, 0.6, 1.4), marbleTop, -14, 0.5, 9.5); // coffee table
const tv = prop(mainHall, new THREE.BoxGeometry(6.5, 3.8, 0.2), screenMat, -14, 3.2, -1.5);
prop(mainHall, new THREE.BoxGeometry(7, 0.3, 0.6), wood, -14, 1.2, -1.5); // tv console
for (const [lx, lz] of [[-20, 11], [-8, 11], [-20, 2], [-8, 2]]) {
  const lamp = new THREE.PointLight(0xffd9a0, 0.5, 14);
  lamp.position.set(lx, 8, lz);
  mainHall.add(lamp);
}

// kitchen (east side) with island
const islandMat = marbleTop;
prop(mainHall, new THREE.BoxGeometry(8, 2.2, 3.2), metalApp, 14, 1.1, 6);
prop(mainHall, new THREE.BoxGeometry(8.4, 0.3, 3.6), islandMat, 14, 2.3, 6); // island countertop
for (let i = -3; i <= 3; i += 2) prop(mainHall, new THREE.CylinderGeometry(0.25, 0.25, 1.4, 8), wood, 14 + i, 1.6, 9); // bar stools (legs simplified)
prop(mainHall, new THREE.BoxGeometry(7, 4, 1.2), metalApp, 14, 2, -2.5); // cabinetry run
prop(mainHall, new THREE.BoxGeometry(2, 2.6, 1.4), metalApp, 17.5, 1.5, -2.4); // fridge block
prop(mainHall, new THREE.BoxGeometry(2.4, 0.2, 2), new THREE.MeshStandardMaterial({ color: 0x222222, metalness: 0.8 }), 11, 2.45, 6); // cooktop

// dining table connecting living + kitchen
prop(mainHall, new THREE.BoxGeometry(5, 0.3, 2.6), wood, 1, 1.5, 7);
for (const [dx, dz] of [[-1.5, 5.5], [1.5, 5.5], [-1.5, 8.5], [1.5, 8.5]]) prop(mainHall, new THREE.BoxGeometry(0.6, 1.5, 0.6), wood, dx, 0.75, dz);
const pendant = new THREE.PointLight(0xffe6c0, 0.6, 12);
pendant.position.set(1, 7, 7);
mainHall.add(pendant);

// --- Hallway to private wing ---
const hallway = room(0, 50, 8, 24, 8, { openBack: true });

// --- Master bedroom with en-suite, walk-in closet, balcony ---
const bedroom = room(-20, 70, 22, 20, 9, { openLeft: true, glassFront: true });
addSkylinePanel(bedroom, 0, 5, -9.8, 20, 8, 0);
prop(bedroom, new THREE.BoxGeometry(7, 1.4, 6.5), bedMat, -2, 0.7, 1);
prop(bedroom, new THREE.BoxGeometry(7.4, 2.2, 0.6), bedMat, -2, 1.2, -2.1); // headboard
prop(bedroom, new THREE.CylinderGeometry(5, 5, 0.2, 24), fabricRug, -2, 0.02, 3);
const nightLamp = new THREE.PointLight(0xffd9a0, 0.5, 10);
nightLamp.position.set(2, 3, 1);
bedroom.add(nightLamp);

// walk-in closet (alcove)
const closet = room(-26, 60, 9, 8, 8, { openRight: true });
for (const [cx, cz] of [[-3, -2], [-3, 2], [3, -2], [3, 2]]) {
  prop(closet, new THREE.BoxGeometry(2.6, 0.1, 3), closetWood, cx, 5.5, cz); // hanging rail shelf
  prop(closet, new THREE.BoxGeometry(2.6, 3, 0.1), new THREE.MeshStandardMaterial({ color: 0xc9b89a }), cx, 4, cz); // hanging garments block
}

// en-suite bathroom
const ensuite = room(-26, 78, 9, 9, 8, { openRight: true });
prop(ensuite, new THREE.BoxGeometry(4, 1.6, 6), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.2 }), -1, 0.8, 0); // soaking tub
prop(ensuite, new THREE.BoxGeometry(3, 0.2, 1.6), marbleTop, 2.8, 2.2, -3); // vanity top
prop(ensuite, new THREE.PlaneGeometry(2.6, 2), new THREE.MeshStandardMaterial({ color: 0xcfefff, metalness: 0.6, roughness: 0.1 }), 2.8, 3.2, -3.8); // mirror

// balcony with skyline view (steps off the bedroom)
const balcony = room(-20, 84, 16, 8, 0.4, { openBack: true, openLeft: true, openRight: true, openFront: true });
addSkylinePanel(balcony, 0, 7, 3.9, 16, 14, Math.PI);
for (const [rx] of [[-7.8], [7.8]]) {
  prop(balcony, new THREE.BoxGeometry(0.2, 3, 8), new THREE.MeshStandardMaterial({ color: 0xeeeeee, transparent: true, opacity: 0.6 }), rx, 1.5, 0);
}
prop(balcony, new THREE.BoxGeometry(2, 0.7, 2), fabricSofa, -3, 0.35, 2);
prop(balcony, new THREE.BoxGeometry(2, 0.7, 2), fabricSofa, 3, 0.35, 2);

// --- Home office / study ---
const office = room(18, 70, 16, 16, 8, { openLeft: true, glassFront: true });
addSkylinePanel(office, 0, 4, -7.8, 16, 7, 0);
prop(office, new THREE.BoxGeometry(4, 1.4, 2), wood, 0, 0.7, 4); // desk
prop(office, new THREE.BoxGeometry(2, 2.4, 0.1), screenMat, 0, 2.1, 3.1); // monitor
prop(office, new THREE.BoxGeometry(1, 1.4, 1), fabricSofa, 0, 0.7, 5.6); // chair
for (let i = -1; i <= 1; i++) prop(office, new THREE.BoxGeometry(3.5, 6, 0.6), closetWood, 5.5, 3, i * 0 + 0); // bookshelf wall
const deskLamp = new THREE.PointLight(0xfff4d0, 0.4, 8);
deskLamp.position.set(0, 3, 4);
office.add(deskLamp);

// --- Entertainment room (movies / music / gaming) ---
const entertainment = room(18, 92, 16, 16, 8, {});
prop(entertainment, new THREE.BoxGeometry(7, 4, 0.2), screenMat, 0, 3, -7.7); // big screen
prop(entertainment, new THREE.BoxGeometry(6, 1.6, 2), fabricSofa, 0, 0.8, 3);
prop(entertainment, new THREE.BoxGeometry(6, 1.6, 1), fabricSofa, 0, 0.8, 1.5);
prop(entertainment, new THREE.BoxGeometry(1.2, 1, 0.8), metalApp, -5, 0.5, -2); // game console / amp stack
const moodLight = new THREE.PointLight(0xff2da8, 0.8, 14);
moodLight.position.set(0, 6, 0);
entertainment.add(moodLight);
const moodLight2 = new THREE.PointLight(0x00eaff, 0.6, 14);
moodLight2.position.set(0, 6, 6);
entertainment.add(moodLight2);

// --- Home gym ---
const gym = room(-20, 92, 16, 16, 8, { glassFront: true });
addSkylinePanel(gym, 0, 4, -7.8, 16, 7, 0);
prop(gym, new THREE.BoxGeometry(1.4, 0.6, 5), metalApp, -4, 0.3, 0); // treadmill base
prop(gym, new THREE.BoxGeometry(1.4, 3, 0.4), metalApp, -4, 1.8, -2.4); // treadmill console
prop(gym, new THREE.BoxGeometry(2.6, 2, 0.6), closetWood, 4, 1, -6); // weights rack
for (let i = 0; i < 4; i++) prop(gym, new THREE.CylinderGeometry(0.5, 0.5, 0.3, 12), new THREE.MeshStandardMaterial({ color: 0x222222 }), 4 + (i % 2) * 1.2 - 0.6, 0.6, -6 + Math.floor(i / 2) * 1);
prop(gym, new THREE.BoxGeometry(3, 0.4, 5), fabricRug, 3, 0.04, 2); // mat area

// room zones for proximity descriptions while inside
const interiorRoomZones = [
  { name: 'Living Room', center: new THREE.Vector3(-14, 0, 30), radius: 9, desc: 'The open-plan lounge: sink into the designer sofa, flick on the smart TV, and let the ambient lighting set the mood.' },
  { name: 'Kitchen', center: new THREE.Vector3(14, 0, 30), radius: 9, desc: 'A fully equipped kitchen with a marble island, integrated cooktop, and sleek cabinetry — built for cooking and entertaining.' },
  { name: 'Dining Area', center: new THREE.Vector3(1, 0, 31), radius: 6, desc: 'The dining table sits where the living space meets the kitchen — perfect for dinner parties.' },
  { name: 'Master Bedroom', center: new THREE.Vector3(-20, 0, 70), radius: 8, desc: 'A serene master bedroom with floor-to-ceiling glass framing the skyline beyond.' },
  { name: 'Walk-in Closet', center: new THREE.Vector3(-26, 0, 60), radius: 5, desc: 'A walk-in closet with full wardrobe storage — change outfits any time at the Closet menu (press C).' },
  { name: 'En-suite Bathroom', center: new THREE.Vector3(-26, 0, 78), radius: 5, desc: 'A private en-suite with a deep soaking tub and marble vanity.' },
  { name: 'Private Balcony', center: new THREE.Vector3(-20, 0, 84), radius: 6, desc: 'Step out onto the balcony — the panoramic skyline stretches out before you, glowing differently by day and by night.' },
  { name: 'Home Office', center: new THREE.Vector3(18, 0, 70), radius: 8, desc: 'A quiet study with a desk and bookshelves — a place to focus and get things done.' },
  { name: 'Entertainment Room', center: new THREE.Vector3(18, 0, 92), radius: 8, desc: 'Movie nights, music, and gaming all happen here, bathed in neon mood lighting.' },
  { name: 'Home Gym', center: new THREE.Vector3(-20, 0, 92), radius: 8, desc: 'A private gym with a treadmill and free weights — work out with a skyline view.' }
];

let isInterior = false;
let lastRoomZone = null;

function enterInteriorHouse() {
  isInterior = true;
  player.pos.set(0, 0, 6);
  player.yaw = Math.PI;
  scene.fog.color.set(0xffffff);
  scene.fog.near = 200; scene.fog.far = 900; // effectively off indoors
  showCenter('HOME SWEET HOME');
  showBanner('Walk through the rooms — press E at the front door to head back outside.', 4500);
}

function exitInteriorHouse() {
  isInterior = false;
  player.pos.set(HOME_POS.x, hillTopY, HOME_POS.z + 14);
  player.yaw = Math.PI;
  scene.fog.near = 100; scene.fog.far = 1300;
  playerModel.visible = true;
  showBanner('Back outside. The neighborhood is quiet under the open sky.', 3000);
}

function updateInteriorZones() {
  if (!isInterior) return;
  const localPos = new THREE.Vector3(player.pos.x, 0, player.pos.z);
  let found = null;
  for (const z of interiorRoomZones) {
    if (localPos.distanceTo(z.center) < z.radius) { found = z; break; }
  }
  if (found && found !== lastRoomZone) {
    showBanner(found.name.toUpperCase() + ' — ' + found.desc, 4200);
  }
  lastRoomZone = found;
  // keep skyline glow in sync with the exterior day/night cycle
  skylineMat.emissiveIntensity = 0.4 + nightFactor(dayTime) * 0.9;
}

// ---------------------------------------------------------------
// Street lamps
// ---------------------------------------------------------------
for (let i = 0; i < 60; i++) {
  const x = (Math.random() - 0.5) * WORLD_SIZE;
  const z = (Math.random() - 0.5) * WORLD_SIZE;
  if (nearKeepClear(x, z)) continue;
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 10), new THREE.MeshStandardMaterial({ color: 0x222222 }));
  pole.position.set(x, 5, z);
  scene.add(pole);
  const bulb = new THREE.PointLight(0xff7fd0, 0.8, 30);
  bulb.position.set(x, 10, z);
  scene.add(bulb);
  const bulbMesh = new THREE.Mesh(new THREE.SphereGeometry(0.6), new THREE.MeshStandardMaterial({ color: 0xff7fd0, emissive: 0xff7fd0, emissiveIntensity: 2 }));
  bulbMesh.position.copy(bulb.position);
  scene.add(bulbMesh);
}

// ---------------------------------------------------------------
// Humanoid builder (player + NPCs) — textured for realism
// ---------------------------------------------------------------
function buildHuman(skinColor, shirtColor, pantsColor) {
  const group = new THREE.Group();
  const skinMat = new THREE.MeshStandardMaterial({ map: skinTexture(skinColor), color: skinColor, roughness: 0.85 });
  const shirtMat = new THREE.MeshStandardMaterial({ map: fabricTexture(shirtColor), color: shirtColor, roughness: 0.75 });
  const pantsMat = new THREE.MeshStandardMaterial({ map: fabricTexture(pantsColor), color: pantsColor, roughness: 0.75 });
  const hairMat = new THREE.MeshStandardMaterial({ color: 0x18130f, roughness: 0.9 });

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.5, 16, 16), skinMat);
  head.position.y = 3.35;
  head.castShadow = true;
  group.add(head);

  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.53, 16, 16, 0, Math.PI * 2, 0, Math.PI / 1.7), hairMat);
  hair.position.y = 3.45;
  group.add(hair);

  const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.55, 1.1, 8), shirtMat);
  torso.position.y = 2.4;
  torso.castShadow = true;
  group.add(torso);

  const hip = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.4, 8), pantsMat);
  hip.position.y = 1.55;
  group.add(hip);

  function limb(mat, len, radius) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, len, 6), mat);
    m.castShadow = true;
    const capTop = new THREE.Mesh(new THREE.SphereGeometry(radius, 6, 6), mat);
    capTop.position.y = len / 2;
    m.add(capTop);
    const capBottom = new THREE.Mesh(new THREE.SphereGeometry(radius, 6, 6), mat);
    capBottom.position.y = -len / 2;
    m.add(capBottom);
    return m;
  }

  const armL = limb(skinMat, 0.9, 0.16);
  const armR = limb(skinMat, 0.9, 0.16);
  const legL = limb(pantsMat, 1.0, 0.2);
  const legR = limb(pantsMat, 1.0, 0.2);

  const armPivotL = new THREE.Group(); armPivotL.position.set(0.75, 2.85, 0); armL.position.set(0, -0.45, 0); armPivotL.add(armL);
  const armPivotR = new THREE.Group(); armPivotR.position.set(-0.75, 2.85, 0); armR.position.set(0, -0.45, 0); armPivotR.add(armR);
  const legPivotL = new THREE.Group(); legPivotL.position.set(0.3, 1.4, 0); legL.position.set(0, -0.5, 0); legPivotL.add(legL);
  const legPivotR = new THREE.Group(); legPivotR.position.set(-0.3, 1.4, 0); legR.position.set(0, -0.5, 0); legPivotR.add(legR);

  group.add(armPivotL, armPivotR, legPivotL, legPivotR);

  group.userData = { skinMat, shirtMat, pantsMat, armPivotL, armPivotR, legPivotL, legPivotR, head, walkPhase: 0, talkTimer: 0 };
  return group;
}

function animateWalk(human, speedFactor, dt) {
  const u = human.userData;
  u.walkPhase += dt * 8 * speedFactor;
  const swing = Math.sin(u.walkPhase) * 0.5 * Math.min(1, speedFactor);
  u.armPivotL.rotation.x = -swing;
  u.armPivotR.rotation.x = swing;
  u.legPivotL.rotation.x = swing;
  u.legPivotR.rotation.x = -swing;
}

function restPose(human) {
  const u = human.userData;
  u.walkPhase = 0;
  u.armPivotL.rotation.x = u.armPivotR.rotation.x = u.legPivotL.rotation.x = u.legPivotR.rotation.x = 0;
}

// ---------------------------------------------------------------
// Vehicles — generic types, no brand names, hijackable
// ---------------------------------------------------------------
const VEHICLE_TYPES = {
  sedan: { w: 4.2, h: 3.6, len: 9.5, speed: 38, accel: 16, color: true },
  sportscar: { w: 4.0, h: 2.8, len: 9, speed: 56, accel: 26, color: true },
  suv: { w: 4.6, h: 4.6, len: 10.5, speed: 32, accel: 12, color: true },
  van: { w: 4.8, h: 5.2, len: 11.5, speed: 26, accel: 9, color: true },
  motorcycle: { w: 1.6, h: 3.2, len: 6, speed: 42, accel: 22, color: true }
};

function buildVehicle(type, color) {
  const def = VEHICLE_TYPES[type];
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ map: metalTexture(color), color, roughness: 0.4, metalness: 0.6 });
  const glassMat = new THREE.MeshStandardMaterial({ color: 0x111122, roughness: 0.1, metalness: 0.8, transparent: true, opacity: 0.85 });
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.9 });
  const lightMat = new THREE.MeshStandardMaterial({ color: 0xffffaa, emissive: 0xffffaa, emissiveIntensity: 1.5 });

  if (type === 'motorcycle') {
    const body = new THREE.Mesh(new THREE.BoxGeometry(def.w, def.h * 0.5, def.len * 0.55), bodyMat);
    body.position.y = def.h * 0.5; body.castShadow = true;
    group.add(body);
    const seat = new THREE.Mesh(new THREE.BoxGeometry(def.w * 0.8, 0.4, def.len * 0.35), new THREE.MeshStandardMaterial({ color: 0x111111 }));
    seat.position.set(0, def.h * 0.75, 0);
    group.add(seat);
    const wheelGeo = new THREE.CylinderGeometry(1.1, 1.1, 0.5, 12);
    [[0, 0.6, def.len * 0.35], [0, 0.6, -def.len * 0.35]].forEach(p => {
      const wheel = new THREE.Mesh(wheelGeo, wheelMat);
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(...p);
      group.add(wheel);
    });
  } else {
    const lowerH = def.h * 0.55;
    const lower = new THREE.Mesh(new THREE.BoxGeometry(def.w, lowerH, def.len), bodyMat);
    lower.position.y = lowerH / 2 + 0.6;
    lower.castShadow = true;
    group.add(lower);

    const cabinH = def.h * 0.45;
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(def.w * 0.88, cabinH, def.len * 0.55), glassMat);
    cabin.position.set(0, lowerH + 0.6 + cabinH / 2, def.len * 0.02);
    group.add(cabin);

    const wheelGeo = new THREE.CylinderGeometry(0.9, 0.9, 0.6, 14);
    const wOff = def.w / 2 - 0.1;
    const lOff = def.len / 2 - 1.6;
    [[wOff, 0.9, lOff], [-wOff, 0.9, lOff], [wOff, 0.9, -lOff], [-wOff, 0.9, -lOff]].forEach(p => {
      const wheel = new THREE.Mesh(wheelGeo, wheelMat);
      wheel.rotation.x = Math.PI / 2;
      wheel.position.set(...p);
      wheel.castShadow = true;
      group.add(wheel);
    });

    const headlightL = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.3, 0.1), lightMat);
    headlightL.position.set(wOff * 0.6, lowerH * 0.6 + 0.6, def.len / 2);
    group.add(headlightL);
    const headlightR = headlightL.clone();
    headlightR.position.x = -wOff * 0.6;
    group.add(headlightR);
  }

  group.userData = {
    type, def, speed: 0, occupied: false, driverNPC: null, isPlayerRide: false,
    boundingRadius: Math.max(def.w, def.len) / 2 + 1
  };
  return group;
}

const VEHICLE_COLORS = [0xff2da8, 0x00eaff, 0xffd400, 0x2dffb0, 0x7b2dff, 0xffffff, 0x222222, 0xff6b2d, 0x880000, 0x1d3bff];
const vehicleTypeList = Object.keys(VEHICLE_TYPES);
const vehicles = [];

function spawnVehicle(x, z, withDriver) {
  const type = vehicleTypeList[Math.floor(Math.random() * vehicleTypeList.length)];
  const color = VEHICLE_COLORS[Math.floor(Math.random() * VEHICLE_COLORS.length)];
  const v = buildVehicle(type, color);
  v.position.set(x, 0, z);
  v.rotation.y = Math.random() * Math.PI * 2;
  scene.add(v);
  const entry = { mesh: v, x, z, angle: v.rotation.y, speed: 0, type, parked: !withDriver, wanderTarget: null, retarget: 2 + Math.random() * 4 };
  if (withDriver) {
    const driver = buildHuman(
      SKIN_COLORS[Math.floor(Math.random() * SKIN_COLORS.length)],
      SHIRT_COLORS[Math.floor(Math.random() * SHIRT_COLORS.length)],
      PANTS_COLORS[Math.floor(Math.random() * PANTS_COLORS.length)]
    );
    driver.scale.set(0.9, 0.9, 0.9);
    driver.position.set(0, 0.6, 0.5);
    v.add(driver);
    entry.driver = driver;
  }
  v.userData.entry = entry;
  vehicles.push(entry);
  return entry;
}

// scatter vehicles through the city — some parked & empty, some with NPC drivers wandering
for (let i = 0; i < 30; i++) {
  let x, z;
  do {
    x = (Math.random() - 0.5) * WORLD_SIZE;
    z = (Math.random() - 0.5) * WORLD_SIZE;
  } while (nearKeepClear(x, z));
  spawnVehicle(x, z, Math.random() < 0.5);
}

function updateVehicles(dt) {
  for (const e of vehicles) {
    if (e.mesh.userData.isPlayerRide) continue;
    if (e.parked || !e.driver) continue;
    // simple NPC driving: cruise toward a wander target along roads (loose, visual only)
    e.retarget -= dt;
    if (!e.wanderTarget || e.retarget <= 0) {
      e.wanderTarget = new THREE.Vector3(e.mesh.position.x + (Math.random() - 0.5) * 200, 0, e.mesh.position.z + (Math.random() - 0.5) * 200);
      e.retarget = 5 + Math.random() * 5;
    }
    const dir = new THREE.Vector3().subVectors(e.wanderTarget, e.mesh.position);
    dir.y = 0;
    if (dir.length() > 3) {
      dir.normalize();
      const desiredAngle = Math.atan2(dir.x, dir.z);
      let diff = desiredAngle - e.mesh.rotation.y;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      e.mesh.rotation.y += Math.max(-1.4 * dt, Math.min(1.4 * dt, diff));
      const speed = VEHICLE_TYPES[e.type].speed * 0.4;
      e.mesh.position.x += Math.sin(e.mesh.rotation.y) * speed * dt;
      e.mesh.position.z += Math.cos(e.mesh.rotation.y) * speed * dt;
    }
  }
}

// ---------------------------------------------------------------
// Airport — runway, hangar, planes, helicopters
// ---------------------------------------------------------------
const aircraft = [];

function buildAirport() {
  const tarmacMat = new THREE.MeshStandardMaterial({ map: TEX.tarmac, roughness: 1 });
  const runway = new THREE.Mesh(new THREE.PlaneGeometry(40, 220), tarmacMat);
  runway.rotation.x = -Math.PI / 2;
  runway.position.set(AIRPORT_POS.x, 0.03, AIRPORT_POS.z);
  scene.add(runway);

  const apron = new THREE.Mesh(new THREE.PlaneGeometry(120, 90), tarmacMat);
  apron.rotation.x = -Math.PI / 2;
  apron.position.set(AIRPORT_POS.x + 90, 0.03, AIRPORT_POS.z + 40);
  scene.add(apron);

  // hangar
  const hangarMat = new THREE.MeshStandardMaterial({ color: 0x555566, roughness: 0.6, metalness: 0.4 });
  const hangar = new THREE.Mesh(new THREE.BoxGeometry(50, 22, 40), hangarMat);
  hangar.position.set(AIRPORT_POS.x + 100, 11, AIRPORT_POS.z - 20);
  hangar.castShadow = true; hangar.receiveShadow = true;
  scene.add(hangar);
  const roof = new THREE.Mesh(new THREE.CylinderGeometry(25, 25, 50, 12, 1, false, 0, Math.PI), hangarMat);
  roof.rotation.z = Math.PI / 2;
  roof.position.set(AIRPORT_POS.x + 100, 22, AIRPORT_POS.z - 20);
  scene.add(roof);

  // control tower
  const towerMat = new THREE.MeshStandardMaterial({ map: TEX.windowCyan });
  const tower = new THREE.Mesh(new THREE.CylinderGeometry(4, 5, 26, 8), towerMat);
  tower.position.set(AIRPORT_POS.x + 60, 13, AIRPORT_POS.z + 70);
  scene.add(tower);
  const towerTop = new THREE.Mesh(new THREE.CylinderGeometry(7, 7, 4, 8), new THREE.MeshStandardMaterial({ color: 0x222233 }));
  towerTop.position.set(AIRPORT_POS.x + 60, 28, AIRPORT_POS.z + 70);
  scene.add(towerTop);

  // runway lights
  for (let i = -100; i <= 100; i += 20) {
    [-21, 21].forEach(side => {
      const light = new THREE.Mesh(new THREE.SphereGeometry(0.6), new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffaa, emissiveIntensity: 2 }));
      light.position.set(AIRPORT_POS.x + side, 0.5, AIRPORT_POS.z + i);
      scene.add(light);
    });
  }
}
buildAirport();

function buildPlane(color) {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ map: metalTexture(color), color, metalness: 0.5, roughness: 0.4 });
  const fuselage = new THREE.Mesh(new THREE.CylinderGeometry(2, 2.6, 24, 12), bodyMat);
  fuselage.rotation.x = Math.PI / 2;
  fuselage.castShadow = true;
  g.add(fuselage);
  const nose = new THREE.Mesh(new THREE.ConeGeometry(2, 5, 12), bodyMat);
  nose.rotation.x = Math.PI / 2;
  nose.position.z = -14.5;
  g.add(nose);
  const wing = new THREE.Mesh(new THREE.BoxGeometry(34, 0.6, 5), bodyMat);
  wing.position.set(0, 0.5, 1);
  g.add(wing);
  const tailWing = new THREE.Mesh(new THREE.BoxGeometry(12, 0.5, 3), bodyMat);
  tailWing.position.set(0, 2, 11);
  g.add(tailWing);
  const tailFin = new THREE.Mesh(new THREE.BoxGeometry(0.5, 6, 4), bodyMat);
  tailFin.position.set(0, 4, 11.5);
  g.add(tailFin);
  const cockpit = new THREE.Mesh(new THREE.SphereGeometry(2, 8, 8), new THREE.MeshStandardMaterial({ color: 0x111122, transparent: true, opacity: 0.7 }));
  cockpit.position.set(0, 1.2, -10);
  g.add(cockpit);
  g.userData = { kind: 'plane', speed: 0, maxSpeed: 220, minFlySpeed: 60, altitudeVel: 0, isPlayerRide: false, boundingRadius: 18 };
  return g;
}

function buildHelicopter(color) {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ map: metalTexture(color), color, metalness: 0.5, roughness: 0.4 });
  const cabin = new THREE.Mesh(new THREE.SphereGeometry(3.2, 12, 12), bodyMat);
  cabin.scale.set(1, 0.9, 1.4);
  cabin.castShadow = true;
  g.add(cabin);
  const tailBoom = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.6, 9, 8), bodyMat);
  tailBoom.rotation.x = Math.PI / 2;
  tailBoom.position.set(0, 0.5, 6);
  g.add(tailBoom);
  const tailRotor = new THREE.Mesh(new THREE.BoxGeometry(0.1, 2, 0.2), new THREE.MeshStandardMaterial({ color: 0x222222 }));
  tailRotor.position.set(0.6, 0.8, 10.3);
  g.add(tailRotor);
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 1), new THREE.MeshStandardMaterial({ color: 0x222222 }));
  mast.position.set(0, 3.3, 0);
  g.add(mast);
  const rotor = new THREE.Mesh(new THREE.BoxGeometry(16, 0.15, 0.6), new THREE.MeshStandardMaterial({ color: 0x222222 }));
  rotor.position.set(0, 3.9, 0);
  g.add(rotor);
  const skidGeo = new THREE.BoxGeometry(0.3, 0.3, 6);
  const skidL = new THREE.Mesh(skidGeo, new THREE.MeshStandardMaterial({ color: 0x222222 }));
  skidL.position.set(-1.6, -2.2, 0); g.add(skidL);
  const skidR = skidL.clone(); skidR.position.x = 1.6; g.add(skidR);

  g.userData = { kind: 'helicopter', speed: 0, maxSpeed: 90, altitudeVel: 0, isPlayerRide: false, boundingRadius: 10, rotorMesh: rotor };
  return g;
}

const planeColors = [0xeeeeee, 0xff2da8, 0x1d3bff];
for (let i = 0; i < 2; i++) {
  const p = buildPlane(planeColors[i]);
  p.position.set(AIRPORT_POS.x + 60 + i * 30, 2, AIRPORT_POS.z - 60);
  p.rotation.y = Math.PI;
  scene.add(p);
  aircraft.push(p);
}
const heli = buildHelicopter(0xffd400);
heli.position.set(AIRPORT_POS.x + 90, 1.5, AIRPORT_POS.z + 10);
scene.add(heli);
aircraft.push(heli);

// ---------------------------------------------------------------
// Animals — birds, cats, mice
// ---------------------------------------------------------------
function buildBird() {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ map: furTexture('#2a2a33', '#444450') });
  const body = new THREE.Mesh(new THREE.ConeGeometry(0.25, 1, 6), bodyMat);
  body.rotation.x = Math.PI / 2;
  g.add(body);
  const wingGeo = new THREE.PlaneGeometry(1.4, 0.4);
  const wingMat = new THREE.MeshStandardMaterial({ color: 0x33333d, side: THREE.DoubleSide });
  const wingL = new THREE.Mesh(wingGeo, wingMat); wingL.position.x = 0.7; g.add(wingL);
  const wingR = new THREE.Mesh(wingGeo, wingMat); wingR.position.x = -0.7; g.add(wingR);
  g.userData = { wingL, wingR, phase: Math.random() * 10 };
  return g;
}

const birds = [];
for (let i = 0; i < 18; i++) {
  const b = buildBird();
  const angle = Math.random() * Math.PI * 2;
  const radius = 60 + Math.random() * 200;
  b.userData.center = new THREE.Vector3((Math.random() - 0.5) * WORLD_SIZE, 35 + Math.random() * 40, (Math.random() - 0.5) * WORLD_SIZE);
  b.userData.radius = radius;
  b.userData.angle = angle;
  b.userData.angularSpeed = 0.15 + Math.random() * 0.2;
  scene.add(b);
  birds.push(b);
}

function buildSmallAnimal(kind) {
  const g = new THREE.Group();
  const colors = kind === 'cat' ? ['#3a3a3a', '#1c1c1c'] : ['#8a7a6a', '#5a4a3a'];
  const mat = new THREE.MeshStandardMaterial({ map: furTexture(colors[0], colors[1]) });
  const scale = kind === 'cat' ? 1 : 0.45;
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.18 * scale, 0.22 * scale, 0.6 * scale, 8), mat);
  body.rotation.z = Math.PI / 2;
  body.position.y = 0.22 * scale;
  g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.16 * scale, 8, 8), mat);
  head.position.set(0, 0.26 * scale, 0.32 * scale);
  g.add(head);
  const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.03 * scale, 0.05 * scale, 0.5 * scale, 6), mat);
  tail.position.set(0, 0.3 * scale, -0.4 * scale);
  tail.rotation.x = Math.PI / 3;
  g.add(tail);
  for (const sx of [-0.12, 0.12]) for (const sz of [-0.2, 0.2]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.03 * scale, 0.03 * scale, 0.22 * scale, 6), mat);
    leg.position.set(sx * scale * 1.5, 0.1 * scale, sz * scale * 1.5);
    g.add(leg);
  }
  g.userData = { kind, target: new THREE.Vector3(), retarget: Math.random() * 3 };
  return g;
}

const smallAnimals = [];
function spawnSmallAnimal(kind, x, z) {
  const a = buildSmallAnimal(kind);
  a.position.set(x, 0, z);
  a.userData.target.set(x, 0, z);
  scene.add(a);
  smallAnimals.push(a);
}
for (let i = 0; i < 14; i++) {
  const x = HOME_POS.x + (Math.random() - 0.5) * 250;
  const z = HOME_POS.z + (Math.random() - 0.5) * 250;
  spawnSmallAnimal('cat', x, z);
}
for (let i = 0; i < 16; i++) {
  const x = (Math.random() - 0.5) * WORLD_SIZE;
  const z = (Math.random() - 0.5) * WORLD_SIZE;
  spawnSmallAnimal('mouse', x, z);
}

function updateAnimals(dt) {
  for (const b of birds) {
    const u = b.userData;
    u.angle += u.angularSpeed * dt;
    b.position.set(
      u.center.x + Math.cos(u.angle) * u.radius,
      u.center.y + Math.sin(u.angle * 2) * 4,
      u.center.z + Math.sin(u.angle) * u.radius
    );
    b.rotation.y = -u.angle + Math.PI / 2;
    u.phase += dt * 10;
    const flap = Math.sin(u.phase) * 0.6;
    u.wingL.rotation.z = flap;
    u.wingR.rotation.z = -flap;
  }
  for (const a of smallAnimals) {
    const u = a.userData;
    u.retarget -= dt;
    if (a.position.distanceTo(u.target) < 1 || u.retarget <= 0) {
      u.target.set(a.position.x + (Math.random() - 0.5) * 20, 0, a.position.z + (Math.random() - 0.5) * 20);
      u.retarget = 2 + Math.random() * 3;
    }
    const dir = new THREE.Vector3().subVectors(u.target, a.position);
    if (dir.length() > 0.1) {
      dir.normalize();
      const speed = u.kind === 'cat' ? 1.8 : 2.6;
      a.position.x += dir.x * speed * dt;
      a.position.z += dir.z * speed * dt;
      a.rotation.y = Math.atan2(dir.x, dir.z);
    }
  }
}

// ---------------------------------------------------------------
// Player setup
// ---------------------------------------------------------------
const playerCosmetics = { skin: '#e8b98f', shirt: '#ff2da8', pants: '#1c1c2a' };
let playerModel = buildHuman(playerCosmetics.skin, playerCosmetics.shirt, playerCosmetics.pants);
scene.add(playerModel);

const player = {
  pos: new THREE.Vector3(HOME_POS.x, hillTopY, HOME_POS.z + 18),
  yaw: Math.PI,
  pitch: 0,
  health: 100,
  money: 500,
  wanted: 0,
  speed: 7,
  sprintMult: 1.9,
  weapon: 'glock',
  fireCooldown: 0,
  dead: false,
  ride: null // { mesh, kind: 'car'|'plane'|'helicopter', entry }
};

const weaponStats = {
  glock: { rate: 0.32, damage: 22, range: 80, auto: false },
  smg: { rate: 0.09, damage: 12, range: 70, auto: true },
  ak: { rate: 0.13, damage: 30, range: 110, auto: true }
};

function buildGun(color) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.18, 0.7), new THREE.MeshStandardMaterial({ color }));
  body.position.set(0, 0, -0.3);
  g.add(body);
  const mag = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.35, 0.12), new THREE.MeshStandardMaterial({ color: 0x111111 }));
  mag.position.set(0, -0.25, -0.2);
  g.add(mag);
  return g;
}
const guns = { glock: buildGun(0x333333), smg: buildGun(0x222233), ak: buildGun(0x4a3a22) };
for (const k in guns) { guns[k].visible = false; playerModel.userData.armPivotR.add(guns[k]); guns[k].position.set(0, -0.9, -0.2); }
guns.glock.visible = true;

function setWeapon(w) {
  player.weapon = w;
  for (const k in guns) guns[k].visible = (k === w);
  document.querySelectorAll('.wslot').forEach(el => el.classList.remove('active'));
  ({ glock: 'slotGlock', smg: 'slotSMG', ak: 'slotAK' })[w] &&
    document.getElementById(({ glock: 'slotGlock', smg: 'slotSMG', ak: 'slotAK' })[w]).classList.add('active');
}
setWeapon('glock');

// ---------------------------------------------------------------
// Camera modes
// ---------------------------------------------------------------
const CAM_MODES = ['1st Person', 'Over-the-Shoulder', 'Far 3rd Person'];
let camMode = 0;
function cycleCamera() {
  camMode = (camMode + 1) % CAM_MODES.length;
  document.getElementById('camInfo').textContent = 'Camera: ' + CAM_MODES[camMode];
}
document.getElementById('camInfo').textContent = 'Camera: ' + CAM_MODES[camMode];

// ---------------------------------------------------------------
// Input
// ---------------------------------------------------------------
const keys = {};
window.addEventListener('keydown', e => {
  const k = e.key.toLowerCase();
  keys[k] = true;
  if (k === 'v') cycleCamera();
  if (k === '1') setWeapon('glock');
  if (k === '2') setWeapon('smg');
  if (k === '3') setWeapon('ak');
  if (k === 't') { dayTime = (dayTime + 12) % 24; }
  if (k === 'h') {
    if (player.ride) exitRide();
    if (isInterior) {
      isInterior = false;
      scene.fog.near = 100; scene.fog.far = 1300;
      playerModel.visible = true;
    }
    player.pos.set(HOME_POS.x, hillTopY, HOME_POS.z + 18);
    showCenter('WELCOME HOME');
  }
  if (k === 'c') openCloset();
  if (k === 'e') tryInteract();
});
window.addEventListener('keyup', e => { keys[e.key.toLowerCase()] = false; });

let mouseDown = false;
let pointerLocked = false;
renderer.domElement.addEventListener('click', () => {
  if (document.getElementById('closetMenu').style.display === 'flex') return;
  renderer.domElement.requestPointerLock();
});
document.addEventListener('pointerlockchange', () => { pointerLocked = document.pointerLockElement === renderer.domElement; });
document.addEventListener('mousemove', e => {
  if (!pointerLocked) return;
  player.yaw -= e.movementX * 0.0022;
  player.pitch -= e.movementY * 0.0022;
  player.pitch = Math.max(-1.1, Math.min(1.1, player.pitch));
});
document.addEventListener('mousedown', e => { if (e.button === 0) mouseDown = true; });
document.addEventListener('mouseup', e => { if (e.button === 0) mouseDown = false; });

// ---------------------------------------------------------------
// Closet
// ---------------------------------------------------------------
function buildSwatches(containerId, colors, current, onPick) {
  const el = document.getElementById(containerId);
  el.innerHTML = '';
  colors.forEach(col => {
    const sw = document.createElement('div');
    sw.className = 'swatch' + (col === current ? ' selected' : '');
    sw.style.background = col;
    sw.addEventListener('click', () => {
      onPick(col);
      el.querySelectorAll('.swatch').forEach(s => s.classList.remove('selected'));
      sw.classList.add('selected');
    });
    el.appendChild(sw);
  });
}

function refreshCloset() {
  buildSwatches('shirtSwatches', SHIRT_COLORS, playerCosmetics.shirt, c => {
    playerCosmetics.shirt = c;
    playerModel.userData.shirtMat.color.set(c);
    playerModel.userData.shirtMat.map = fabricTexture(c);
    playerModel.userData.shirtMat.needsUpdate = true;
  });
  buildSwatches('pantsSwatches', PANTS_COLORS, playerCosmetics.pants, c => {
    playerCosmetics.pants = c;
    playerModel.userData.pantsMat.color.set(c);
    playerModel.userData.pantsMat.map = fabricTexture(c);
    playerModel.userData.pantsMat.needsUpdate = true;
  });
  buildSwatches('skinSwatches', SKIN_COLORS, playerCosmetics.skin, c => {
    playerCosmetics.skin = c;
    playerModel.userData.skinMat.color.set(c);
    playerModel.userData.skinMat.map = skinTexture(c);
    playerModel.userData.skinMat.needsUpdate = true;
  });
}

function openCloset() {
  document.getElementById('closetMenu').style.display = 'flex';
  document.exitPointerLock();
  refreshCloset();
}
document.getElementById('closeCloset').addEventListener('click', () => {
  document.getElementById('closetMenu').style.display = 'none';
});

// ---------------------------------------------------------------
// NPCs (with simple NPC-to-NPC interaction)
// ---------------------------------------------------------------
const npcs = [];
function spawnNPC() {
  const skin = SKIN_COLORS[Math.floor(Math.random() * SKIN_COLORS.length)];
  const shirt = SHIRT_COLORS[Math.floor(Math.random() * SHIRT_COLORS.length)];
  const pants = PANTS_COLORS[Math.floor(Math.random() * PANTS_COLORS.length)];
  const model = buildHuman(skin, shirt, pants);
  let x, z;
  do {
    x = (Math.random() - 0.5) * WORLD_SIZE;
    z = (Math.random() - 0.5) * WORLD_SIZE;
  } while (nearKeepClear(x, z));
  model.position.set(x, 0, z);
  scene.add(model);
  npcs.push({
    model, health: 40, dead: false, fleeing: false,
    target: new THREE.Vector3(x + (Math.random() - 0.5) * 40, 0, z + (Math.random() - 0.5) * 40),
    retarget: Math.random() * 4, talkCooldown: Math.random() * 5
  });
}
for (let i = 0; i < 35; i++) spawnNPC();

function updateNPCs(dt) {
  for (const n of npcs) {
    if (n.dead) continue;
    n.model.userData.talkTimer -= dt;
    if (n.model.userData.talkTimer > 0) continue; // currently "talking" — stand still

    n.talkCooldown -= dt;
    if (n.talkCooldown <= 0) {
      n.talkCooldown = 4 + Math.random() * 5;
      for (const other of npcs) {
        if (other === n || other.dead || other.model.userData.talkTimer > 0) continue;
        if (n.model.position.distanceTo(other.model.position) < 4 && Math.random() < 0.3) {
          const chatTime = 2 + Math.random() * 2;
          n.model.userData.talkTimer = chatTime;
          other.model.userData.talkTimer = chatTime;
          n.model.lookAt(other.model.position.x, n.model.position.y + 3, other.model.position.z);
          other.model.lookAt(n.model.position.x, other.model.position.y + 3, n.model.position.z);
          restPose(n.model); restPose(other.model);
          break;
        }
      }
    }

    n.retarget -= dt;
    const toTarget = new THREE.Vector3().subVectors(n.target, n.model.position);
    if (toTarget.length() < 2 || n.retarget <= 0) {
      n.target.set(n.model.position.x + (Math.random() - 0.5) * 60, 0, n.model.position.z + (Math.random() - 0.5) * 60);
      n.retarget = 3 + Math.random() * 4;
    }
    toTarget.y = 0;
    if (toTarget.length() > 0.1) {
      toTarget.normalize();
      n.model.position.x += toTarget.x * 1.6 * dt;
      n.model.position.z += toTarget.z * 1.6 * dt;
      n.model.rotation.y = Math.atan2(toTarget.x, toTarget.z);
      animateWalk(n.model, 0.6, dt);
    }
  }
}

// ---------------------------------------------------------------
// Shooting / raycast combat
// ---------------------------------------------------------------
const raycaster = new THREE.Raycaster();
let muzzleFlashTimer = 0;
const muzzleLight = new THREE.PointLight(0xfff2c0, 0, 15);
scene.add(muzzleLight);

function shoot() {
  const stats = weaponStats[player.weapon];
  if (player.fireCooldown > 0) return;
  player.fireCooldown = stats.rate;
  muzzleFlashTimer = 0.06;

  const dir = new THREE.Vector3(0, 0, -1).applyEuler(new THREE.Euler(player.pitch, player.yaw, 0, 'YXZ'));
  const origin = camera.position.clone();
  raycaster.set(origin, dir);

  const targets = npcs.filter(n => !n.dead).map(n => n.model);
  const intersects = raycaster.intersectObjects(targets, true);
  if (intersects.length && intersects[0].distance < stats.range) {
    let obj = intersects[0].object;
    while (obj.parent && !npcs.find(n => n.model === obj)) obj = obj.parent;
    const npc = npcs.find(n => n.model === obj);
    if (npc) {
      npc.health -= stats.damage;
      if (npc.health <= 0 && !npc.dead) {
        npc.dead = true;
        scene.remove(npc.model);
        player.wanted = Math.min(5, player.wanted + 1);
        showBanner('Witnesses are calling the cops...', 2500);
      }
    }
  }
}

// ---------------------------------------------------------------
// HUD helpers
// ---------------------------------------------------------------
function showBanner(text, ms = 3000) {
  const el = document.getElementById('banner');
  el.textContent = text; el.style.opacity = 1;
  clearTimeout(showBanner._t);
  showBanner._t = setTimeout(() => el.style.opacity = 0, ms);
}
function showCenter(text, ms = 1600) {
  const el = document.getElementById('centerMsg');
  el.textContent = text; el.style.opacity = 1;
  clearTimeout(showCenter._t);
  showCenter._t = setTimeout(() => el.style.opacity = 0, ms);
}
function setInteractPrompt(text) {
  const el = document.getElementById('interactPrompt');
  el.textContent = text;
  el.style.opacity = text ? 1 : 0;
}

function updateHUD() {
  document.getElementById('moneyLine').textContent = '$' + Math.floor(player.money);
  document.getElementById('healthBar').style.width = Math.max(0, player.health) + '%';
  document.getElementById('stars').textContent = 'WANTED: ' + '★'.repeat(player.wanted) + '☆'.repeat(5 - player.wanted);
}

let wantedTimer = 0;
function updateWanted(dt) {
  if (player.wanted > 0) {
    wantedTimer += dt;
    if (wantedTimer > 10) { player.wanted--; wantedTimer = 0; }
  }
}

// ---------------------------------------------------------------
// Ground height helper (hill near home, flat elsewhere)
// ---------------------------------------------------------------
function groundHeightAt(x, z) {
  const d = Math.hypot(x - HOME_POS.x, z - HOME_POS.z);
  if (d < 70) return hillTopY;
  if (d < 150) return hillTopY * (1 - (d - 70) / 80);
  return 0;
}

// ---------------------------------------------------------------
// Interaction (enter/exit/hijack vehicles & aircraft, plus the front door)
// ---------------------------------------------------------------
let nearestInteractable = null;
const HOME_DOOR_OUTSIDE = new THREE.Vector3(HOME_POS.x, 0, HOME_POS.z + 11);
const HOME_DOOR_INSIDE = new THREE.Vector3(-6, 0, 0);

function playerWorldXZ() {
  return isInterior
    ? { x: player.pos.x + INTERIOR_BASE.x, z: player.pos.z + INTERIOR_BASE.z }
    : { x: player.pos.x, z: player.pos.z };
}

function nearHomeDoor() {
  if (isInterior) return Math.hypot(player.pos.x - HOME_DOOR_INSIDE.x, player.pos.z - HOME_DOOR_INSIDE.z) < 7;
  return Math.hypot(player.pos.x - HOME_DOOR_OUTSIDE.x, player.pos.z - HOME_DOOR_OUTSIDE.z) < 9;
}

function findNearestInteractable() {
  if (isInterior) return null;
  let best = null, bestDist = 9;
  for (const e of vehicles) {
    if (e.mesh.userData.isPlayerRide) continue;
    const d = e.mesh.position.distanceTo(player.pos);
    if (d < bestDist + e.mesh.userData.boundingRadius) { best = { kind: 'vehicle', entry: e }; bestDist = d; }
  }
  for (const a of aircraft) {
    if (a.userData.isPlayerRide) continue;
    const d = a.position.distanceTo(player.pos);
    if (d < bestDist + a.userData.boundingRadius) { best = { kind: 'aircraft', mesh: a }; bestDist = d; }
  }
  return best;
}

function tryInteract() {
  if (player.ride) { exitRide(); return; }
  if (nearHomeDoor()) {
    if (isInterior) exitInteriorHouse();
    else enterInteriorHouse();
    return;
  }
  if (!nearestInteractable) return;
  if (nearestInteractable.kind === 'vehicle') {
    const e = nearestInteractable.entry;
    if (e.driver) {
      // hijack: eject the NPC driver
      e.driver.position.set(e.mesh.position.x + 2, 0, e.mesh.position.z);
      scene.attach(e.driver);
      e.driver = null;
      player.wanted = Math.min(5, player.wanted + 1);
      showBanner('Vehicle hijacked! The driver fled.', 2200);
    } else {
      showBanner('Vehicle stolen.', 1800);
    }
    e.parked = false;
    e.mesh.userData.isPlayerRide = true;
    player.ride = { mesh: e.mesh, kind: 'car', entry: e };
    playerModel.visible = false;
  } else if (nearestInteractable.kind === 'aircraft') {
    const mesh = nearestInteractable.mesh;
    mesh.userData.isPlayerRide = true;
    player.ride = { mesh, kind: mesh.userData.kind };
    playerModel.visible = false;
    showBanner(mesh.userData.kind === 'plane' ? 'Boarded aircraft. Build up speed on the runway to take off!' : 'Helicopter boarded. Hold Space to lift off.', 4000);
  }
}

function exitRide() {
  if (!player.ride) return;
  const mesh = player.ride.mesh;
  mesh.userData.isPlayerRide = false;
  const exitPos = mesh.position.clone();
  exitPos.y = Math.max(groundHeightAt(exitPos.x, exitPos.z), exitPos.y);
  if (exitPos.y > 60) exitPos.y = groundHeightAt(exitPos.x, exitPos.z); // crude: prevent stranding mid-air
  player.pos.copy(exitPos);
  player.pos.x += 3;
  playerModel.position.copy(player.pos);
  playerModel.visible = true;
  player.ride = null;
}

// ---------------------------------------------------------------
// Player / vehicle / aircraft movement
// ---------------------------------------------------------------
function updatePlayerOnFoot(dt) {
  const forward = new THREE.Vector3(Math.sin(player.yaw), 0, Math.cos(player.yaw)).multiplyScalar(-1);
  const right = new THREE.Vector3(forward.z, 0, -forward.x);

  let move = new THREE.Vector3();
  if (keys['w']) move.add(forward);
  if (keys['s']) move.sub(forward);
  if (keys['d']) move.add(right);
  if (keys['a']) move.sub(right);

  const isMoving = move.lengthSq() > 0;
  if (isMoving) move.normalize();
  const sprinting = keys['shift'] && isMoving;
  const speed = player.speed * (sprinting ? player.sprintMult : 1);

  player.pos.x += move.x * speed * dt;
  player.pos.z += move.z * speed * dt;
  player.pos.y = isInterior ? 0 : groundHeightAt(player.pos.x, player.pos.z);

  if (isMoving) playerModel.rotation.y = Math.atan2(move.x, move.z);
  playerModel.position.copy(player.pos);
  if (isInterior) playerModel.position.add(INTERIOR_BASE);

  if (isMoving) animateWalk(playerModel, sprinting ? 1.6 : 1, dt);
  else restPose(playerModel);

  player.fireCooldown -= dt;
  const stats = weaponStats[player.weapon];
  if (mouseDown && pointerLocked) {
    if (stats.auto) { if (player.fireCooldown <= 0) shoot(); }
    else if (player.fireCooldown <= 0) shoot();
  }
}

function updateCarRide(dt) {
  const e = player.ride.entry;
  const def = VEHICLE_TYPES[e.type];
  if (keys['w']) e.speed = Math.min(def.speed, e.speed + def.accel * dt);
  else if (keys['s']) e.speed = Math.max(-def.speed * 0.5, e.speed - def.accel * dt);
  else e.speed *= (1 - 1.5 * dt);

  const turnDir = (keys['a'] ? 1 : 0) - (keys['d'] ? 1 : 0);
  if (Math.abs(e.speed) > 0.5) e.mesh.rotation.y += turnDir * 1.8 * dt * Math.sign(e.speed);

  e.mesh.position.x += Math.sin(e.mesh.rotation.y) * e.speed * dt;
  e.mesh.position.z += Math.cos(e.mesh.rotation.y) * e.speed * dt;
  e.mesh.position.y = groundHeightAt(e.mesh.position.x, e.mesh.position.z);

  player.pos.copy(e.mesh.position);
  player.yaw = e.mesh.rotation.y + Math.PI;
}

function updateAircraftRide(dt) {
  const mesh = player.ride.mesh;
  const u = mesh.userData;

  if (u.kind === 'plane') {
    if (keys['w']) u.speed = Math.min(u.maxSpeed, u.speed + 30 * dt);
    if (keys['s']) u.speed = Math.max(0, u.speed - 30 * dt);
    const turnDir = (keys['a'] ? 1 : 0) - (keys['d'] ? 1 : 0);
    mesh.rotation.y += turnDir * 0.6 * dt;
    mesh.rotation.z = turnDir * 0.3;

    const airborne = u.speed > u.minFlySpeed;
    if (airborne) {
      if (keys[' ']) u.altitudeVel = Math.min(20, u.altitudeVel + 15 * dt);
      else if (keys['control']) u.altitudeVel = Math.max(-20, u.altitudeVel - 15 * dt);
      else u.altitudeVel *= (1 - dt);
      mesh.rotation.x = -u.altitudeVel * 0.02;
    } else {
      u.altitudeVel = Math.max(0, u.altitudeVel - 10 * dt);
    }

    mesh.position.x += Math.sin(mesh.rotation.y) * u.speed * dt;
    mesh.position.z += Math.cos(mesh.rotation.y) * u.speed * dt;
    mesh.position.y = Math.max(2, mesh.position.y + u.altitudeVel * dt);
  } else {
    // helicopter
    if (keys[' ']) u.altitudeVel = Math.min(18, u.altitudeVel + 12 * dt);
    else if (keys['control']) u.altitudeVel = Math.max(-18, u.altitudeVel - 12 * dt);
    else u.altitudeVel *= (1 - 2 * dt);
    mesh.position.y = Math.max(1.5, mesh.position.y + u.altitudeVel * dt);

    const turnDir = (keys['a'] ? 1 : 0) - (keys['d'] ? 1 : 0);
    mesh.rotation.y += turnDir * 1.0 * dt;
    let thrust = 0;
    if (keys['w']) thrust = 1; else if (keys['s']) thrust = -1;
    u.speed = thrust * u.maxSpeed;
    mesh.position.x += Math.sin(mesh.rotation.y) * u.speed * dt;
    mesh.position.z += Math.cos(mesh.rotation.y) * u.speed * dt;
    if (u.rotorMesh) u.rotorMesh.rotation.y += dt * (10 + u.speed * 0.2);
  }

  player.pos.copy(mesh.position);
  player.yaw = mesh.rotation.y + Math.PI;
}

function updatePlayer(dt) {
  if (player.ride) {
    if (player.ride.kind === 'car') updateCarRide(dt);
    else updateAircraftRide(dt);
  } else {
    updatePlayerOnFoot(dt);
  }

  nearestInteractable = player.ride ? null : findNearestInteractable();
  const atDoor = !player.ride && nearHomeDoor();
  if (atDoor) {
    setInteractPrompt(isInterior ? 'Press E to head outside' : 'Press E to enter your house');
  } else if (nearestInteractable) {
    if (nearestInteractable.kind === 'vehicle') {
      const label = nearestInteractable.entry.driver ? 'Press E to hijack ' : 'Press E to enter ';
      setInteractPrompt(label + nearestInteractable.entry.type);
    } else {
      setInteractPrompt('Press E to board the ' + nearestInteractable.mesh.userData.kind);
    }
  } else if (player.ride) {
    setInteractPrompt('Press E to exit');
  } else {
    setInteractPrompt('');
  }
}

const camOffset = new THREE.Vector3();
function updateCamera() {
  const isAircraft = player.ride && player.ride.kind !== 'car' && player.ride.kind !== undefined && (player.ride.kind === 'plane' || player.ride.kind === 'helicopter');
  const headHeight = player.ride ? (isAircraft ? 4 : 2.2) : 3.3;
  const headPos = new THREE.Vector3(player.pos.x, player.pos.y + headHeight, player.pos.z);
  if (isInterior) headPos.add(INTERIOR_BASE);
  const lookDir = new THREE.Vector3(0, 0, -1).applyEuler(new THREE.Euler(player.pitch, player.yaw, 0, 'YXZ'));

  if (camMode === 0 && !player.ride) {
    camera.position.copy(headPos);
    playerModel.visible = false;
  } else if (camMode === 0 && player.ride) {
    camera.position.copy(headPos);
  } else if (camMode === 1) {
    const dist = player.ride ? 7 : 3.2;
    const back = lookDir.clone().multiplyScalar(-dist);
    const sideOffset = new THREE.Vector3(lookDir.z, 0, -lookDir.x).multiplyScalar(0.9);
    camera.position.copy(headPos).add(back).add(sideOffset).add(new THREE.Vector3(0, 0.6, 0));
    if (!player.ride) playerModel.visible = true;
  } else {
    const dist = player.ride ? 16 : 8.5;
    const back = lookDir.clone().multiplyScalar(-dist);
    camera.position.copy(headPos).add(back).add(new THREE.Vector3(0, player.ride ? 4 : 2.2, 0));
    if (!player.ride) playerModel.visible = true;
  }
  const target = headPos.clone().add(lookDir.multiplyScalar(10));
  camera.lookAt(target);

  muzzleLight.position.copy(camera.position).add(lookDir.clone().multiplyScalar(1.5));
  muzzleLight.intensity = (muzzleFlashTimer > 0 && !player.ride) ? 4 : 0;
}

// ---------------------------------------------------------------
// Main loop
// ---------------------------------------------------------------
function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(0.05, clock.getDelta());
  if (!running) { renderer.render(scene, camera); return; }

  if (!dayPaused) dayTime = (dayTime + dt * 0.05) % 24;
  updateSky();

  updatePlayer(dt);
  updateNPCs(dt);
  updateVehicles(dt);
  updateAnimals(dt);
  updateWanted(dt);
  updateInteriorZones();
  updateCamera();
  updateHUD();

  if (muzzleFlashTimer > 0) muzzleFlashTimer -= dt;

  renderer.render(scene, camera);
}

// ---------------------------------------------------------------
// Start
// ---------------------------------------------------------------
document.getElementById('startBtn').addEventListener('click', () => {
  document.getElementById('startScreen').style.display = 'none';
  running = true;
  showCenter('VICE STREETS', 1800);
  showBanner('Press C for closet, H for home, E to enter/hijack a ride, V for camera.', 5500);
});

updateSky();
animate();
