// Thế giới "Shinobi Office": các đảo nổi giữa trời đêm, mỗi đảo một văn phòng,
// nối với nhau bằng cầu treo. Dựng hoàn toàn bằng code, bám theo ảnh bối cảnh tham chiếu.
import * as THREE from 'three';

const std = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.85, ...extra });

function add(parent, geo, material, x = 0, y = 0, z = 0, { cast = true, receive = true } = {}) {
  const m = new THREE.Mesh(geo, material);
  m.position.set(x, y, z);
  m.castShadow = cast;
  m.receiveShadow = receive;
  parent.add(m);
  return m;
}

function rng(seed) {
  let s = (Math.abs(Math.round(seed)) % 2147483646) + 1; // seed phải dương, khác 0
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function canvasTex(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

// Ký hiệu Làng Lá cách điệu: xoắn ốc + mũi lá
function drawLeaf(g, cx, cy, s, color) {
  g.save();
  g.strokeStyle = color;
  g.lineWidth = s * 0.11;
  g.lineCap = 'round';
  g.beginPath();
  for (let a = 0; a <= Math.PI * 3.1; a += 0.08) {
    const r = s * (0.05 + a * 0.085);
    const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r * 0.92;
    a === 0 ? g.moveTo(x, y) : g.lineTo(x, y);
  }
  g.lineTo(cx + s * 0.95, cy - s * 0.55);
  g.lineTo(cx + s * 0.55, cy - s * 0.2);
  g.stroke();
  g.restore();
}

// ---------- Texture dùng chung ----------
const TEX = {};
function tex(key, make) {
  return (TEX[key] ??= make());
}

const glowTex = () =>
  tex('glow', () =>
    canvasTex(128, 128, (g) => {
      const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
      grd.addColorStop(0, 'rgba(255,255,255,1)');
      grd.addColorStop(0.25, 'rgba(255,255,255,0.45)');
      grd.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = grd;
      g.fillRect(0, 0, 128, 128);
    }),
  );

const puffTex = () =>
  tex('puff', () =>
    canvasTex(256, 128, (g) => {
      const r = rng(5);
      for (let i = 0; i < 18; i++) {
        const x = 40 + r() * 176, y = 50 + r() * 40, rad = 22 + r() * 34;
        const grd = g.createRadialGradient(x, y, 0, x, y, rad);
        grd.addColorStop(0, 'rgba(235,242,255,0.55)');
        grd.addColorStop(1, 'rgba(235,242,255,0)');
        g.fillStyle = grd;
        g.fillRect(0, 0, 256, 128);
      }
    }),
  );

const shojiTex = () =>
  tex('shoji', () =>
    canvasTex(128, 128, (g) => {
      g.fillStyle = '#f6e6c4';
      g.fillRect(0, 0, 128, 128);
      g.strokeStyle = '#5a3a20';
      g.lineWidth = 5;
      g.strokeRect(2, 2, 124, 124);
      g.lineWidth = 3;
      for (const v of [32, 64, 96]) {
        g.beginPath(); g.moveTo(v, 0); g.lineTo(v, 128); g.stroke();
        g.beginPath(); g.moveTo(0, v); g.lineTo(128, v); g.stroke();
      }
    }),
  );

const waterTex = () =>
  tex('water', () => {
    const t = canvasTex(64, 256, (g) => {
      g.fillStyle = 'rgba(160,210,255,0.25)';
      g.fillRect(0, 0, 64, 256);
      const r = rng(11);
      for (let i = 0; i < 40; i++) {
        g.fillStyle = `rgba(235,248,255,${0.25 + r() * 0.5})`;
        g.fillRect(r() * 64, r() * 256, 1 + r() * 3, 20 + r() * 60);
      }
    });
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    return t;
  });

function bannerTex() {
  return tex('banner', () =>
    canvasTex(128, 320, (g) => {
      g.fillStyle = '#b3261e';
      g.fillRect(0, 0, 128, 320);
      g.fillStyle = '#7d1a14';
      g.fillRect(0, 0, 128, 18);
      g.fillRect(0, 302, 128, 18);
      g.fillStyle = '#f7e8d0';
      g.beginPath(); g.arc(64, 150, 44, 0, Math.PI * 2); g.fill();
      drawLeaf(g, 60, 154, 40, '#b3261e');
    }),
  );
}

function verticalSign(text, bg = '#f3e6c8', fg = '#2a1a10') {
  return tex('vsign:' + text + bg, () =>
    canvasTex(128, 96 + text.length * 120, (g, w, h) => {
      g.fillStyle = bg;
      g.fillRect(0, 0, w, h);
      g.strokeStyle = '#5a3a20';
      g.lineWidth = 10;
      g.strokeRect(5, 5, w - 10, h - 10);
      g.fillStyle = fg;
      g.font = 'bold 100px "Noto Serif JP", "Yu Mincho", serif';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      [...text].forEach((ch, i) => g.fillText(ch, w / 2, 70 + i * 120));
    }),
  );
}

function emblemTex(bg = '#f6ead2', fg = '#b3261e') {
  return tex('emblem' + bg + fg, () =>
    canvasTex(256, 160, (g) => {
      g.fillStyle = bg;
      g.fillRect(0, 0, 256, 160);
      g.strokeStyle = '#5a3a20';
      g.lineWidth = 12;
      g.strokeRect(6, 6, 244, 148);
      drawLeaf(g, 120, 84, 62, fg);
    }),
  );
}

function clockTex() {
  return tex('clock', () =>
    canvasTex(256, 256, (g) => {
      g.fillStyle = '#f6ecd6';
      g.beginPath(); g.arc(128, 128, 120, 0, Math.PI * 2); g.fill();
      g.strokeStyle = '#3a2614';
      g.lineWidth = 10;
      g.stroke();
      g.fillStyle = '#3a2614';
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        g.fillRect(128 + Math.sin(a) * 96 - 4, 128 - Math.cos(a) * 96 - 10, 8, 20);
      }
    }),
  );
}

function inkPaintingTex(seed) {
  return tex('ink' + seed, () =>
    canvasTex(192, 256, (g) => {
      const r = rng(seed);
      g.fillStyle = '#f7f1e3';
      g.fillRect(0, 0, 192, 256);
      g.strokeStyle = '#1a1a1a';
      g.lineCap = 'round';
      // núi mực
      g.fillStyle = 'rgba(20,20,20,0.75)';
      g.beginPath(); g.moveTo(0, 220);
      for (let x = 0; x <= 192; x += 24) g.lineTo(x, 140 + r() * 60);
      g.lineTo(192, 256); g.lineTo(0, 256); g.fill();
      // cành cây
      g.lineWidth = 6;
      g.beginPath(); g.moveTo(10, 60);
      g.quadraticCurveTo(90, 40 + r() * 40, 170, 90 + r() * 30); g.stroke();
      g.fillStyle = '#c0392b';
      for (let i = 0; i < 9; i++) { g.beginPath(); g.arc(30 + r() * 140, 50 + r() * 60, 5 + r() * 4, 0, 7); g.fill(); }
      g.beginPath(); g.arc(150, 40, 18, 0, 7); g.fill(); // mặt trời đỏ
    }),
  );
}

function mapTex() {
  return tex('map', () =>
    canvasTex(256, 192, (g) => {
      g.fillStyle = '#e8d6ad';
      g.fillRect(0, 0, 256, 192);
      g.strokeStyle = '#7a5a30';
      g.lineWidth = 3;
      const r = rng(21);
      for (let i = 0; i < 6; i++) {
        g.beginPath(); g.moveTo(r() * 256, r() * 192);
        for (let k = 0; k < 4; k++) g.lineTo(r() * 256, r() * 192);
        g.stroke();
      }
      g.fillStyle = '#b3261e';
      for (let i = 0; i < 5; i++) { g.beginPath(); g.arc(r() * 256, r() * 192, 5, 0, 7); g.fill(); }
    }),
  );
}

// ---------- Đạo cụ ----------
const glowSprites = [];
const lanternMats = [];

function glow(parent, x, y, z, scale, color, opacity = 0.7) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending }));
  s.position.set(x, y, z);
  s.scale.setScalar(scale);
  parent.add(s);
  glowSprites.push(s);
  return s;
}

function lantern(parent, x, y, z, { color = 0xffb14a, hang = true, size = 1 } = {}) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  g.scale.setScalar(size);
  const m = new THREE.MeshStandardMaterial({ color: 0xffe2b0, emissive: color, emissiveIntensity: 2.2, roughness: 0.6 });
  lanternMats.push(m);
  add(g, new THREE.CylinderGeometry(0.22, 0.22, 0.42, 12), m, 0, 0, 0, { cast: false });
  const cap = std(0x2a1a10);
  add(g, new THREE.CylinderGeometry(0.16, 0.2, 0.07, 12), cap, 0, 0.24, 0, { cast: false });
  add(g, new THREE.CylinderGeometry(0.2, 0.16, 0.07, 12), cap, 0, -0.24, 0, { cast: false });
  if (hang) add(g, new THREE.CylinderGeometry(0.012, 0.012, 0.4, 4), cap, 0, 0.47, 0, { cast: false });
  glow(g, 0, 0, 0, 1.8, color, 0.55);
  parent.add(g);
  return g;
}

function stoneLantern(parent, x, z) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  const stone = std(0x8a8f98);
  add(g, new THREE.CylinderGeometry(0.3, 0.38, 0.2, 6), stone, 0, 0.1, 0);
  add(g, new THREE.CylinderGeometry(0.1, 0.12, 0.7, 6), stone, 0, 0.55, 0);
  add(g, new THREE.BoxGeometry(0.5, 0.36, 0.5), new THREE.MeshStandardMaterial({ color: 0xfff0c8, emissive: 0xffa040, emissiveIntensity: 1.6 }), 0, 1.06, 0, { cast: false });
  add(g, new THREE.ConeGeometry(0.48, 0.3, 4), stone, 0, 1.4, 0).rotation.y = Math.PI / 4;
  glow(g, 0, 1.06, 0, 1.6, 0xffa040, 0.5);
  parent.add(g);
}

function banner(parent, x, y, z, rotY = 0, h = 2.4) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  g.rotation.y = rotY;
  add(g, new THREE.CylinderGeometry(0.05, 0.05, h + 0.6, 6), std(0x3a2614), 0, h / 2, -0.03);
  add(g, new THREE.CylinderGeometry(0.03, 0.03, 1.1, 6), std(0x3a2614), 0, h + 0.15, 0).rotation.z = Math.PI / 2;
  const cloth = add(g, new THREE.PlaneGeometry(1, h * 0.85), new THREE.MeshStandardMaterial({ map: bannerTex(), side: THREE.DoubleSide, roughness: 0.9 }), 0, h * 0.55, 0.02);
  cloth.castShadow = false;
  parent.add(g);
  return g;
}

function bonsai(parent, x, z, s = 1, seed = 1) {
  const r = rng(seed);
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.scale.setScalar(s);
  const bark = std(0x5a3a22);
  let p = new THREE.Vector3(0, 0, 0);
  for (let i = 0; i < 4; i++) {
    const next = p.clone().add(new THREE.Vector3((r() - 0.5) * 0.9, 0.8, (r() - 0.5) * 0.5));
    const len = p.distanceTo(next);
    const seg = add(g, new THREE.CylinderGeometry(0.12 - i * 0.02, 0.17 - i * 0.02, len, 6), bark);
    seg.position.copy(p).lerp(next, 0.5);
    seg.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), next.clone().sub(p).normalize());
    p = next;
  }
  const leafMat = std(0x2f6b3a, { flatShading: true });
  for (let i = 0; i < 5; i++) {
    const pad = add(g, new THREE.IcosahedronGeometry(0.75, 0), leafMat, p.x + (r() - 0.5) * 1.6, p.y - 0.6 + r() * 1.0, p.z + (r() - 0.5) * 0.8);
    pad.scale.set(1.2, 0.45, 0.9);
    pad.rotation.y = r() * 3;
  }
  parent.add(g);
}

function desk(parent, x, z, rotY = 0, { laptop = false, hourglass = false, map = false } = {}) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.rotation.y = rotY;
  const wood = std(0x6b4423);
  add(g, new THREE.BoxGeometry(1.9, 0.12, 0.95), wood, 0, 0.78, 0);
  for (const sx of [-0.85, 0.85]) for (const sz of [-0.38, 0.38]) add(g, new THREE.BoxGeometry(0.1, 0.72, 0.1), wood, sx, 0.38, sz);
  const paper = std(0xf2e6c8);
  for (let i = 0; i < 3; i++) {
    const sc = add(g, new THREE.CylinderGeometry(0.07, 0.07, 0.6, 10), paper, -0.55 + i * 0.12, 0.92, -0.25);
    sc.rotation.z = Math.PI / 2;
    sc.rotation.y = 0.3 * i;
  }
  const books = [0x8b2a1e, 0x2b4a7a, 0x3f6b3a];
  books.forEach((c, i) => add(g, new THREE.BoxGeometry(0.42, 0.09, 0.3), std(c), 0.6, 0.89 + i * 0.09, -0.2));
  add(g, new THREE.CylinderGeometry(0.06, 0.07, 0.1, 10), std(0x111111), 0.15, 0.89, 0.2);
  if (map) add(g, new THREE.PlaneGeometry(0.9, 0.6), new THREE.MeshStandardMaterial({ map: mapTex() }), -0.1, 0.85, 0.05).rotation.x = -Math.PI / 2;
  if (laptop) {
    add(g, new THREE.BoxGeometry(0.55, 0.03, 0.38), std(0x9aa3ae, { metalness: 0.5 }), -0.1, 0.86, 0.05);
    const screen = add(g, new THREE.BoxGeometry(0.55, 0.36, 0.02), new THREE.MeshStandardMaterial({ color: 0x223355, emissive: 0x5aa0ff, emissiveIntensity: 0.8 }), -0.1, 1.04, -0.14);
    screen.rotation.x = -0.25;
  }
  if (hourglass) {
    const glass = new THREE.MeshStandardMaterial({ color: 0xffe0a0, transparent: true, opacity: 0.6 });
    add(g, new THREE.ConeGeometry(0.12, 0.18, 10), glass, -0.2, 1.02, 0.15).rotation.x = Math.PI;
    add(g, new THREE.ConeGeometry(0.12, 0.18, 10), glass, -0.2, 0.9, 0.15);
  }
  parent.add(g);
  return g;
}

function bookshelf(parent, x, z, rotY = 0, w = 1.6, h = 2) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.rotation.y = rotY;
  const wood = std(0x5a3a22);
  add(g, new THREE.BoxGeometry(w, h, 0.45), wood, 0, h / 2, 0);
  const r = rng(Math.round(x * 100 + z * 7));
  const colors = [0x8b2a1e, 0x2b4a7a, 0x3f6b3a, 0xc9a24a, 0x6b4a8a, 0xd8cfc0];
  for (let row = 0; row < 4; row++) {
    let bx = -w / 2 + 0.1;
    while (bx < w / 2 - 0.15) {
      const bw = 0.06 + r() * 0.07, bh = 0.28 + r() * 0.12;
      add(g, new THREE.BoxGeometry(bw, bh, 0.3), std(colors[(r() * colors.length) | 0]), bx + bw / 2, 0.15 + row * (h / 4) + bh / 2, 0.1, { cast: false });
      bx += bw + 0.01;
    }
  }
  parent.add(g);
}

// Nhà kiểu Nhật: sàn gỗ, cột, vách giấy shoji phát sáng, mái nhiều tầng
function house(parent, { w = 6, d = 4, h = 2.6, floors = 1, roof = 0x2b3550, x = 0, z = 0, rotY = 0 }) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.rotation.y = rotY;
  const wood = std(0x5a3a22), dark = std(0x3a2614);
  const paper = new THREE.MeshStandardMaterial({ map: shojiTex(), emissive: 0xffb860, emissiveMap: shojiTex(), emissiveIntensity: 0.55, roughness: 0.9 });
  const roofMat = std(roof, { roughness: 0.6 });
  add(g, new THREE.BoxGeometry(w + 0.6, 0.3, d + 0.6), dark, 0, 0.15, 0);
  for (let f = 0; f < floors; f++) {
    const fw = w - f * 1.2, fd = d - f * 0.8, y0 = 0.3 + f * (h + 0.3);
    add(g, new THREE.BoxGeometry(fw - 0.2, h, fd - 0.2), wood, 0, y0 + h / 2, -0.05);
    // mặt trước & hai bên bằng giấy shoji
    const front = add(g, new THREE.PlaneGeometry(fw - 0.5, h - 0.4), paper, 0, y0 + h / 2, fd / 2 - 0.13, { cast: false });
    front.material = paper;
    for (const s of [-1, 1]) {
      const side = add(g, new THREE.PlaneGeometry(fd - 0.6, h - 0.5), paper, s * (fw / 2 - 0.09), y0 + h / 2, 0, { cast: false });
      side.rotation.y = (s * Math.PI) / 2;
    }
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) add(g, new THREE.BoxGeometry(0.2, h, 0.2), dark, sx * (fw / 2 - 0.1), y0 + h / 2, sz * (fd / 2 - 0.1));
    add(g, new THREE.BoxGeometry(fw + 0.2, 0.2, fd + 0.2), dark, 0, y0 + h + 0.05, 0);
    // mái hông + vành mái loe
    const top = f === floors - 1;
    const rh = top ? Math.min(fw, fd) * 0.42 : 0.55;
    const eave = add(g, new THREE.BoxGeometry(fw + 1.5, 0.12, fd + 1.5), roofMat, 0, y0 + h + 0.2, 0);
    eave.castShadow = true;
    const cone = add(g, new THREE.ConeGeometry(1, rh, 4), roofMat, 0, y0 + h + 0.26 + rh / 2, 0);
    cone.rotation.y = Math.PI / 4;
    cone.scale.set(((fw + 1.3) / Math.SQRT2), 1, (fd + 1.3) / Math.SQRT2);
    if (top) {
      add(g, new THREE.BoxGeometry(fw * 0.5, 0.16, 0.16), dark, 0, y0 + h + 0.26 + rh, 0);
      for (const s of [-1, 1]) {
        const tip = add(g, new THREE.ConeGeometry(0.12, 0.5, 5), std(0xc9a24a, { metalness: 0.6 }), s * fw * 0.25, y0 + h + 0.4 + rh, 0);
        tip.rotation.z = -s * 0.6;
      }
    }
  }
  parent.add(g);
  return g;
}

function plane(parent, w, h, map, x, y, z, rotY = 0, emissive = 0) {
  const m = add(parent, new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map, side: THREE.DoubleSide, emissive: emissive ? 0xffffff : 0, emissiveMap: emissive ? map : null, emissiveIntensity: emissive }), x, y, z, { cast: false });
  m.rotation.y = rotY;
  return m;
}

// ---------- Trang trí theo từng văn phòng ----------
const DECOR = {
  hokage(g, r) {
    house(g, { w: 8.5, d: 4.6, h: 2.6, floors: 2, roof: 0xa8322a, z: -r * 0.38 });
    plane(g, 2.6, 1.6, emblemTex(), 0, 7.3, -r * 0.38 + 2.15, 0, 0.35);
    banner(g, -4.2, 0, -r * 0.05);
    banner(g, 4.2, 0, -r * 0.05);
    for (const s of [-1, 1]) {
      // tượng sư tử đá canh cửa
      const lion = new THREE.Group();
      lion.position.set(s * 2.9, 0, r * 0.28);
      const stone = std(0x9aa0a8);
      add(lion, new THREE.BoxGeometry(0.8, 0.5, 0.8), stone, 0, 0.25, 0);
      add(lion, new THREE.BoxGeometry(0.55, 0.7, 0.6), stone, 0, 0.85, 0);
      add(lion, new THREE.SphereGeometry(0.38, 10, 8), stone, 0, 1.4, 0.1);
      g.add(lion);
    }
    desk(g, 0, r * 0.05, 0, { map: true });
    bookshelf(g, -2.6, -r * 0.08, 0.3, 1.4, 1.8);
    bonsai(g, -r * 0.72, r * 0.2, 1.1, 3);
    bonsai(g, r * 0.72, r * 0.15, 1.0, 4);
  },
  inn(g, r) {
    house(g, { w: 6, d: 4.2, h: 2.4, floors: 2, roof: 0x2b3550, z: -r * 0.35 });
    plane(g, 0.8, 1.7, verticalSign('宿'), -2.2, 3.6, -r * 0.35 + 2.15);
    for (const x of [-2.6, 2.6]) lantern(g, x, 2.4, -r * 0.35 + 2.4, { color: 0xff5a3a });
    banner(g, 3.3, 0, -r * 0.05);
    desk(g, -1.4, r * 0.08, 0.15);
    bookshelf(g, 1.9, -r * 0.05, -0.2, 1.3, 1.6);
    bonsai(g, -r * 0.7, r * 0.1, 0.9, 7);
  },
  flower(g, r) {
    house(g, { w: 6, d: 4, h: 2.6, roof: 0x2b3550, z: -r * 0.35 });
    plane(g, 0.8, 1.7, verticalSign('花'), 0, 3.9, -r * 0.35 + 2.05);
    const r2 = rng(31);
    // cây anh đào hồng + giàn tử đằng tím
    for (const [x, z] of [[-3.4, -1.5], [3.2, -2.2], [-2.6, 1.8]]) {
      add(g, new THREE.CylinderGeometry(0.15, 0.22, 2.2, 6), std(0x5a3a22), x, 1.1, z);
      for (let i = 0; i < 10; i++) {
        const c = [0xffb7d5, 0xff8fbf, 0xfff0f6][i % 3];
        add(g, new THREE.IcosahedronGeometry(0.55, 0), std(c, { flatShading: true }), x + (r2() - 0.5) * 1.8, 2.4 + r2() * 1.1, z + (r2() - 0.5) * 1.4);
      }
    }
    for (let i = 0; i < 8; i++) {
      const w = add(g, new THREE.ConeGeometry(0.16, 0.9, 6), std(0xa070e0, { emissive: 0x402060, emissiveIntensity: 0.4 }), -2.6 + i * 0.75, 2.6, -r * 0.35 + 2.75);
      w.rotation.x = Math.PI;
    }
    for (let i = 0; i < 7; i++) {
      const x = -3 + i, z = r * 0.45;
      add(g, new THREE.CylinderGeometry(0.22, 0.17, 0.32, 10), std(0x8b4a2a), x, 0.16, z);
      add(g, new THREE.SphereGeometry(0.26, 8, 6), std([0xff6fa8, 0xffd84a, 0xffffff, 0xff4d4d, 0xb57bff][i % 5]), x, 0.48, z);
    }
    desk(g, 1.5, r * 0.05, -0.15, { laptop: true });
  },
  clock(g, r) {
    // tháp đồng hồ
    const tower = new THREE.Group();
    tower.position.set(-2.6, 0, -r * 0.38);
    add(tower, new THREE.BoxGeometry(2.2, 6.2, 2.2), std(0x6b4423), 0, 3.1, 0);
    add(tower, new THREE.CircleGeometry(0.85, 32), new THREE.MeshStandardMaterial({ map: clockTex(), emissive: 0xffe6b0, emissiveMap: clockTex(), emissiveIntensity: 0.6 }), 0, 4.9, 1.12, { cast: false });
    const handMat = std(0x2a1a10);
    const hour = add(tower, new THREE.BoxGeometry(0.07, 0.45, 0.03), handMat, 0, 4.9, 1.16, { cast: false });
    const minute = add(tower, new THREE.BoxGeometry(0.05, 0.7, 0.03), handMat, 0, 4.9, 1.18, { cast: false });
    hour.geometry.translate(0, 0.2, 0);
    minute.geometry.translate(0, 0.32, 0);
    const roofMat = std(0x2b3550, { roughness: 0.6 });
    add(tower, new THREE.BoxGeometry(3.2, 0.14, 3.2), roofMat, 0, 6.3, 0);
    add(tower, new THREE.ConeGeometry(2.1, 1.4, 4), roofMat, 0, 7.05, 0).rotation.y = Math.PI / 4;
    g.add(tower);
    g.userData.hands = { hour, minute };
    house(g, { w: 4.6, d: 3.6, h: 2.4, roof: 0x2b3550, x: 2, z: -r * 0.38 });
    banner(g, 4.6, 0, -r * 0.02);
    banner(g, -0.6, 0, -r * 0.05);
    desk(g, 1.4, r * 0.1, -0.1, { hourglass: true });
    bonsai(g, -r * 0.65, r * 0.25, 0.9, 9);
  },
  library(g, r) {
    house(g, { w: 7.5, d: 4.4, h: 2.8, roof: 0x2b3550, z: -r * 0.4 });
    for (const x of [-2.4, 0, 2.4]) bookshelf(g, x, -r * 0.4 + 2.5, 0, 2, 2.3);
    plane(g, 1.8, 1.3, mapTex(), 3.6, 1.9, -r * 0.1, -0.5);
    desk(g, -1.5, r * 0.1, 0.1, { map: true });
    // bàn cờ shogi
    add(g, new THREE.BoxGeometry(0.8, 0.35, 0.8), std(0xc9a25a), 2.2, 0.18, r * 0.25);
    bonsai(g, r * 0.72, r * 0.2, 1, 12);
    bonsai(g, -r * 0.75, -r * 0.05, 0.9, 13);
  },
  dojo(g, r) {
    house(g, { w: 8, d: 4.4, h: 2.6, roof: 0x2b3550, z: -r * 0.38 });
    plane(g, 0.9, 2.2, verticalSign('日向'), -3.3, 1.9, -r * 0.38 + 2.25);
    plane(g, 0.9, 2.2, verticalSign('武道'), 3.3, 1.9, -r * 0.38 + 2.25);
    plane(g, 1.6, 1.6, emblemTex('#f6ead2', '#1a1a1a'), 0, 3.3, -r * 0.38 + 2.25);
    // giá vũ khí + cuộn giấy
    const rack = new THREE.Group();
    rack.position.set(3.4, 0, r * 0.05);
    add(rack, new THREE.BoxGeometry(1.4, 0.1, 0.3), std(0x5a3a22), 0, 1.2, 0);
    for (let i = 0; i < 4; i++) add(rack, new THREE.CylinderGeometry(0.03, 0.03, 1.4, 6), std(0x2a1a10), -0.5 + i * 0.33, 0.9, 0.1);
    g.add(rack);
    desk(g, -1.6, r * 0.08, 0.1);
    bonsai(g, -r * 0.72, r * 0.25, 1, 15);
  },
  studio(g, r) {
    house(g, { w: 6.5, d: 4, h: 2.6, roof: 0x2b3550, z: -r * 0.4 });
    // giá vẽ tranh thủy mặc
    [[-3, 0.15, 0.4], [2.8, 0, -0.35], [3.4, r * 0.3, -0.5]].forEach(([x, z, ry], i) => {
      const e = new THREE.Group();
      e.position.set(x, 0, z);
      e.rotation.y = ry;
      for (const s of [-1, 1]) add(e, new THREE.BoxGeometry(0.07, 2.2, 0.07), std(0x5a3a22), s * 0.5, 1.1, 0).rotation.z = s * 0.08;
      plane(e, 1.1, 1.45, inkPaintingTex(40 + i), 0, 1.5, 0.06);
      g.add(e);
    });
    plane(g, 2.4, 1.5, inkPaintingTex(77), 0, 2, -r * 0.4 + 2.05);
    desk(g, -1.4, r * 0.15, 0.1);
    // ống cắm cọ
    add(g, new THREE.CylinderGeometry(0.15, 0.15, 0.35, 10), std(0x2b4a7a), -1.0, 1.02, r * 0.15);
    bonsai(g, -r * 0.72, -r * 0.1, 0.9, 18);
  },
};

// ---------- Đảo nổi ----------
function island(scene, st, waterfalls) {
  const g = new THREE.Group();
  g.position.copy(st.pos);
  const r = st.r;
  const rand = rng(Math.round(r * 1000 + st.pos.x * 7 + 99));
  // khối đá treo phía dưới
  const rockGeo = new THREE.ConeGeometry(r * 0.98, r * 1.7, 18, 6);
  rockGeo.rotateX(Math.PI);
  const pos = rockGeo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    const k = 1 + (rand() - 0.5) * 0.28;
    pos.setX(i, pos.getX(i) * k);
    pos.setZ(i, pos.getZ(i) * k);
    pos.setY(i, y + (rand() - 0.5) * 0.4);
  }
  rockGeo.computeVertexNormals();
  add(g, rockGeo, std(0x5d6474, { flatShading: true }), 0, -r * 0.85 - 0.6, 0);
  add(g, new THREE.CylinderGeometry(r, r * 0.97, 1.2, 40), std(0x6f7684, { flatShading: true }), 0, -0.6, 0);
  // mặt cỏ + lối đá
  add(g, new THREE.CylinderGeometry(r * 0.99, r * 0.99, 0.12, 40), std(0x4e7a3e), 0, 0.02, 0, { cast: false });
  const stone = std(0x9b968c);
  for (let i = 0; i < 6; i++) add(g, new THREE.CylinderGeometry(0.42, 0.45, 0.06, 7), stone, (rand() - 0.5) * 0.6, 0.1, r * (0.35 + i * 0.1), { cast: false });
  // đá vụn quanh mép
  for (let i = 0; i < 14; i++) {
    const a = rand() * Math.PI * 2;
    const b = add(g, new THREE.DodecahedronGeometry(0.4 + rand() * 0.5, 0), std(0x6a7180, { flatShading: true }), Math.cos(a) * r * 0.95, -0.3 - rand() * 0.6, Math.sin(a) * r * 0.95);
    b.rotation.set(rand(), rand(), rand());
  }
  // thác nước đổ xuống biển mây
  const wa = st.waterfall ?? (rand() > 0.5 ? 0.6 : -0.6);
  if (wa !== null) {
    const wm = new THREE.MeshBasicMaterial({ map: waterTex().clone(), transparent: true, opacity: 0.8, depthWrite: false, side: THREE.DoubleSide });
    wm.map.needsUpdate = true;
    wm.map.repeat.set(1, 3);
    const fall = add(g, new THREE.PlaneGeometry(1.4, 22), wm, Math.sin(wa) * (r + 0.05), -11, Math.cos(wa) * (r + 0.05), { cast: false, receive: false });
    fall.rotation.y = wa;
    waterfalls.push(wm.map);
    glow(g, Math.sin(wa) * r, -0.2, Math.cos(wa) * r, 2.2, 0xbfe4ff, 0.35);
  }
  DECOR[st.type](g, r);
  // đèn lồng quanh mép đảo phía trước
  for (const a of [-0.7, 0.7]) lantern(g, Math.sin(a) * r * 0.9, 1.1, Math.cos(a) * r * 0.9, { hang: false, size: 1.1 });
  stoneLantern(g, -r * 0.45, r * 0.62);
  stoneLantern(g, r * 0.45, r * 0.62);
  // ánh đèn ấm của văn phòng
  const light = new THREE.PointLight(0xffb066, 60, r * 3.2, 2);
  light.position.set(0, 3.5, r * 0.15);
  g.add(light);
  g.userData.light = light;
  scene.add(g);
  return g;
}

// ---------- Cầu treo ----------
function bridge(scene, a, b) {
  const dir = new THREE.Vector3().subVectors(b.pos, a.pos).setY(0).normalize();
  const A = a.pos.clone().addScaledVector(dir, a.r * 0.9).setY(a.pos.y + 0.15);
  const B = b.pos.clone().addScaledVector(dir, -b.r * 0.9).setY(b.pos.y + 0.15);
  const len = A.distanceTo(B);
  const n = Math.max(6, Math.ceil(len / 0.55));
  const sag = Math.min(2.2, len * 0.08);
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const p = A.clone().lerp(B, t);
    p.y -= Math.sin(Math.PI * t) * sag;
    pts.push(p);
  }
  const g = new THREE.Group();
  const plank = std(0x7a5232);
  const side = new THREE.Vector3(-dir.z, 0, dir.x);
  for (let i = 0; i < n; i++) {
    const p = pts[i].clone().lerp(pts[i + 1], 0.5);
    const m = add(g, new THREE.BoxGeometry(1.7, 0.08, 0.42), plank, p.x, p.y, p.z);
    m.lookAt(pts[i + 1].x, pts[i + 1].y, pts[i + 1].z);
  }
  const rope = std(0xc9a46a);
  for (const s of [-1, 1]) {
    const railPts = pts.map((p) => p.clone().addScaledVector(side, s * 0.85).add(new THREE.Vector3(0, 0.85, 0)));
    add(g, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(railPts), n * 2, 0.04, 5), rope, 0, 0, 0, { cast: false });
    for (let i = 0; i <= n; i += 3) {
      const p = pts[i].clone().addScaledVector(side, s * 0.85);
      add(g, new THREE.CylinderGeometry(0.02, 0.02, 0.85, 4), rope, p.x, p.y + 0.42, p.z, { cast: false });
    }
    for (const P of [A, B]) {
      const post = P.clone().addScaledVector(side, s * 0.9);
      add(g, new THREE.BoxGeometry(0.18, 1.6, 0.18), std(0x3a2614), post.x, post.y + 0.75, post.z);
      lantern(g, post.x, post.y + 1.75, post.z, { hang: false, size: 0.8 });
    }
  }
  scene.add(g);
  // đường bay của phong thư: phía trên mặt cầu
  return pts.map((p) => p.clone().add(new THREE.Vector3(0, 1.3, 0)));
}

// ---------- Bầu trời đêm, mây, núi xa ----------
function sky(scene) {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {},
    vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `varying vec3 vP;
      void main(){
        float h = vP.y;
        vec3 top = vec3(0.02,0.04,0.11), mid = vec3(0.07,0.13,0.27), hor = vec3(0.20,0.31,0.52);
        vec3 c = h > 0.15 ? mix(mid, top, smoothstep(0.15, 0.8, h)) : mix(hor, mid, smoothstep(-0.25, 0.15, h));
        gl_FragColor = vec4(c, 1.0);
      }`,
  });
  const s = new THREE.Mesh(new THREE.SphereGeometry(480, 32, 16), mat);
  s.renderOrder = -1;
  scene.add(s);
  // sao
  const r = rng(3);
  const pts = [];
  for (let i = 0; i < 1400; i++) {
    const th = r() * Math.PI * 2, ph = Math.acos(0.15 + r() * 0.85);
    pts.push(Math.sin(ph) * Math.cos(th) * 450, Math.cos(ph) * 450, Math.sin(ph) * Math.sin(th) * 450);
  }
  const sg = new THREE.BufferGeometry();
  sg.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  scene.add(new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xdfe8ff, size: 1.4, sizeAttenuation: false, transparent: true, opacity: 0.85, fog: false })));
  // trăng
  const moon = new THREE.Mesh(new THREE.SphereGeometry(9, 32, 16), new THREE.MeshBasicMaterial({ color: 0xfff4d6, fog: false }));
  moon.position.set(120, 95, -300);
  scene.add(moon);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: 0xcfe0ff, transparent: true, opacity: 0.55, depthWrite: false, fog: false, blending: THREE.AdditiveBlending }));
  halo.position.copy(moon.position);
  halo.scale.setScalar(80);
  scene.add(halo);
  return moon.position.clone();
}

function clouds(scene) {
  const r = rng(77);
  const list = [];
  for (let i = 0; i < 70; i++) {
    const low = i < 50;
    const m = new THREE.SpriteMaterial({ map: puffTex(), color: low ? 0x6f86b8 : 0x52669a, transparent: true, opacity: low ? 0.55 : 0.35, depthWrite: false });
    const s = new THREE.Sprite(m);
    const sc = low ? 30 + r() * 40 : 20 + r() * 25;
    s.scale.set(sc * 2, sc, 1);
    s.position.set((r() - 0.5) * 260, low ? -28 + r() * 12 : -6 + r() * 20, low ? -60 + r() * 120 : -120 - r() * 80);
    s.userData.speed = 0.4 + r() * 0.8;
    scene.add(s);
    list.push(s);
  }
  return list;
}

function distantScenery(scene) {
  const r = rng(91);
  const rock = std(0x3a4a68, { flatShading: true });
  // các cột núi đá xa
  for (let i = 0; i < 26; i++) {
    const a = -Math.PI * 0.95 + r() * Math.PI * 0.9;
    const d = 110 + r() * 120;
    const h = 30 + r() * 60;
    const x = Math.cos(a) * d, z = Math.sin(a) * d;
    const p = add(scene, new THREE.CylinderGeometry(3 + r() * 4, 8 + r() * 8, h, 7), rock, x, -30 + h / 2, z, { cast: false, receive: false });
    p.rotation.y = r() * 3;
    add(scene, new THREE.IcosahedronGeometry(5 + r() * 3, 0), std(0x2c4a3c, { flatShading: true }), x, -30 + h + 2, z, { cast: false, receive: false });
    // vài ngôi chùa nhỏ có đèn
    if (i % 4 === 0) {
      const pg = new THREE.Group();
      pg.position.set(x, -30 + h + 3, z);
      for (let k = 0; k < 3; k++) {
        add(pg, new THREE.BoxGeometry(4 - k, 1.6, 4 - k), new THREE.MeshStandardMaterial({ color: 0x3a2a20, emissive: 0xff9a40, emissiveIntensity: 0.5 }), 0, k * 2, 0, { cast: false, receive: false });
        add(pg, new THREE.ConeGeometry(3.6 - k, 0.9, 4), std(0x1e2638), 0, k * 2 + 1.2, 0, { cast: false, receive: false }).rotation.y = Math.PI / 4;
      }
      scene.add(pg);
    }
  }
  // núi mặt Hokage ở xa phía sau bên phải
  const hr = new THREE.Group();
  hr.position.set(130, -10, -230);
  const stone = std(0x55607a, { flatShading: true });
  add(hr, new THREE.BoxGeometry(110, 60, 30), stone, 0, 20, 0, { cast: false, receive: false });
  [-36, -12, 12, 36].forEach((x) => {
    const f = new THREE.Group();
    f.position.set(x, 32, 16);
    add(f, new THREE.SphereGeometry(9, 16, 12), std(0x6c7790), 0, 0, 0, { cast: false, receive: false }).scale.set(1, 1.2, 0.5);
    for (const s of [-1, 1]) add(f, new THREE.BoxGeometry(3, 1, 1), std(0x2a3044), s * 3.4, 2, 4.3, { cast: false, receive: false });
    add(f, new THREE.BoxGeometry(4, 0.8, 1), std(0x2a3044), 0, -4.5, 4.2, { cast: false, receive: false });
    hr.add(f);
  });
  scene.add(hr);
}

/**
 * stations: [{ id, type, pos, r, waterfall? }]; bridges: [[idA, idB], ...]
 * Trả về { spots, plaques, islands, route(from, to), update(t, dt), setEffects(on), moonPos }
 */
export function buildWorld(scene, stations, bridges) {
  const moonPos = sky(scene);
  const cloudList = clouds(scene);
  distantScenery(scene);

  const waterfalls = [];
  const byId = new Map(stations.map((s) => [s.id, s]));
  const spots = new Map();
  const plaques = new Map();
  const islands = new Map();
  const clocks = [];
  for (const st of stations) {
    const g = island(scene, st, waterfalls);
    islands.set(st.id, g);
    if (g.userData.hands) clocks.push(g.userData.hands);
    spots.set(st.id, st.pos.clone().add(new THREE.Vector3(0, 0.08, st.r * 0.22)));
    // biển tên gắn ở vách đá phía trước đảo, dưới mặt cỏ, không che nhân vật
    // plaqueX: dời biển sang ngang (tỉ lệ bán kính) khi mép trước có đầu cầu
    const px = (st.plaqueX ?? 0) * st.r;
    plaques.set(st.id, st.pos.clone().add(new THREE.Vector3(px, -3.4, Math.sqrt(Math.max(0, (st.r * 0.82) ** 2 - px * px)))));
  }

  // đồ thị cầu → tuyến bay của phong thư
  const edges = new Map();
  for (const [a, b] of bridges) {
    const path = bridge(scene, byId.get(a), byId.get(b));
    edges.set(`${a}>${b}`, path);
    edges.set(`${b}>${a}`, [...path].reverse());
  }
  const neighbors = (id) => bridges.flatMap(([a, b]) => (a === id ? [b] : b === id ? [a] : []));
  function route(from, to) {
    const prev = new Map([[from, null]]);
    const queue = [from];
    while (queue.length) {
      const cur = queue.shift();
      if (cur === to) break;
      for (const n of neighbors(cur)) if (!prev.has(n)) { prev.set(n, cur); queue.push(n); }
    }
    const nodes = [];
    for (let c = to; c != null; c = prev.get(c)) nodes.unshift(c);
    const lift = new THREE.Vector3(0, 5, 0); // xuất phát / hạ cánh phía trên đầu nhân vật
    const pts = [spots.get(from).clone().add(lift)];
    for (let i = 0; i < nodes.length - 1; i++) {
      pts.push(...edges.get(`${nodes[i]}>${nodes[i + 1]}`));
      pts.push(spots.get(nodes[i + 1]).clone().add(lift));
    }
    return pts;
  }

  let effects = true;
  return {
    spots,
    plaques,
    islands,
    route,
    moonPos,
    update(t, dt) {
      for (const c of clocks) {
        c.minute.rotation.z = -t * 0.6;
        c.hour.rotation.z = -t * 0.05;
      }
      if (!effects) return;
      for (const w of waterfalls) w.offset.y = (w.offset.y + dt * 1.2) % 1;
      for (const c of cloudList) {
        c.position.x += dt * c.userData.speed;
        if (c.position.x > 140) c.position.x = -140;
      }
      for (const m of lanternMats) m.emissiveIntensity = 2 + Math.sin(t * 3 + m.id) * 0.25;
    },
    setEffects(on) {
      effects = on;
    },
    // văn phòng đang làm việc thì sáng đèn hơn
    setActivity(id, level) {
      const light = islands.get(id)?.userData.light;
      if (light) light.intensity = 60 + level * 90;
    },
  };
}
