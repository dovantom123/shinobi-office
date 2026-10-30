// Chibi ninja dựng hoàn toàn bằng khối hình học (không dùng asset ngoài).
// Màu sắc, trang phục và dáng đứng bám theo ảnh tham chiếu nhân vật người dùng cung cấp.
import * as THREE from 'three';

const UP = new THREE.Vector3(0, 1, 0);
const matCache = new Map();

function mat(color, extra = {}) {
  const key = color + JSON.stringify(extra);
  if (!matCache.has(key)) {
    matCache.set(key, new THREE.MeshStandardMaterial({ color, roughness: 0.75, ...extra }));
  }
  return matCache.get(key);
}

function mesh(geo, material, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, material);
  m.position.set(x, y, z);
  m.castShadow = true;
  return m;
}

// PRNG có seed để kiểu tóc ổn định giữa các lần tải
function rng(seed) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

// Gai tóc: hình nón đặt trên mặt cầu, hướng ra ngoài theo `dir`
function spike(parent, material, dir, r, radius, length) {
  dir = dir.clone().normalize();
  const c = mesh(new THREE.ConeGeometry(radius, length, 6), material);
  c.position.copy(dir).multiplyScalar(r + length * 0.25);
  c.quaternion.setFromUnitVectors(UP, dir);
  parent.add(c);
}

const HEAD_R = 0.55;

function hairCap(head, material, tilt = -0.4, scale = 1.06) {
  const cap = mesh(
    new THREE.SphereGeometry(HEAD_R * scale, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.55),
    material,
  );
  cap.rotation.x = tilt;
  head.add(cap);
  return cap;
}

const HAIR = {
  spiky(head, m, seed, long = false) {
    hairCap(head, m);
    const rand = rng(seed);
    for (let i = 0; i < 18; i++) {
      const theta = rand() * Math.PI * 2;
      const phi = 0.15 + rand() * 1.1;
      const d = new THREE.Vector3(Math.sin(phi) * Math.cos(theta), Math.cos(phi), Math.sin(phi) * Math.sin(theta));
      if (d.z > 0.55 && d.y < 0.6) d.z *= 0.4; // không che mặt
      spike(head, m, d, HEAD_R * 0.9, 0.15, 0.45 + rand() * 0.2);
    }
    // tóc mái
    for (const x of [-0.25, 0, 0.25]) spike(head, m, new THREE.Vector3(x, 0.55, 0.9), HEAD_R * 0.85, 0.11, 0.32);
    if (long) {
      // tóc mai dài ôm mặt (Minato)
      for (const x of [-1, 1]) {
        spike(head, m, new THREE.Vector3(x, -0.5, 0.5), HEAD_R * 0.85, 0.12, 0.65);
        spike(head, m, new THREE.Vector3(x * 0.8, -0.2, 0.6), HEAD_R * 0.85, 0.1, 0.45);
      }
    }
  },
  pineapple(head, m) {
    hairCap(head, m, -0.35);
    const knot = new THREE.Group();
    knot.position.set(0, 0.42, -0.32);
    head.add(knot);
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2;
      spike(knot, m, new THREE.Vector3(Math.cos(a) * 0.45, 1, Math.sin(a) * 0.45 - 0.35), 0.05, 0.08, 0.38);
    }
  },
  longWhite(head, m, seed) {
    hairCap(head, m, -0.45, 1.08);
    const rand = rng(seed);
    // bờm trắng dày xõa tới hông, xòe ra hai bên (Jiraiya)
    for (let i = 0; i < 22; i++) {
      const x = (rand() - 0.5) * 1.8;
      spike(head, m, new THREE.Vector3(x, -0.7 - rand() * 0.6, -1), HEAD_R * 0.7, 0.24, 1.1 + rand() * 0.7);
    }
    for (let i = 0; i < 12; i++) {
      const a = -Math.PI * 0.75 + (i / 11) * Math.PI * 1.5;
      spike(head, m, new THREE.Vector3(Math.sin(a), 0.2 + rand() * 0.6, -Math.cos(a) * 0.8 - 0.2), HEAD_R * 0.9, 0.18, 0.6 + rand() * 0.3);
    }
    for (const x of [-1, 1]) spike(head, m, new THREE.Vector3(x, -0.6, 0.15), HEAD_R * 0.85, 0.16, 0.9);
  },
  short(head, m) {
    hairCap(head, m, -0.3, 1.04);
    for (const x of [-0.3, -0.1, 0.1, 0.3]) {
      spike(head, m, new THREE.Vector3(x, 0.45, 0.9), HEAD_R * 0.85, 0.09, 0.22);
    }
  },
  longStraight(head, m) {
    hairCap(head, m, -0.3, 1.05);
    const back = mesh(new THREE.BoxGeometry(0.85, 1.25, 0.18), m, 0, -0.55, -0.42);
    head.add(back);
    for (const x of [-1, 1]) {
      head.add(mesh(new THREE.BoxGeometry(0.14, 0.95, 0.16), m, x * 0.5, -0.35, 0.18));
    }
  },
  ponytail(head, m) {
    hairCap(head, m, -0.3, 1.05);
    const tieY = 0.58, tieZ = -0.2;
    head.add(mesh(new THREE.SphereGeometry(0.15, 10, 8), m, 0, tieY, tieZ));
    head.add(mesh(new THREE.TorusGeometry(0.1, 0.03, 6, 12), mat(0x3a2a55), 0, tieY + 0.02, tieZ));
    // đuôi ngựa dài, cong về sau rồi rủ xuống
    const tail = new THREE.Group();
    tail.position.set(0, tieY, tieZ - 0.1);
    tail.rotation.x = -0.5;
    head.add(tail);
    const seg = mesh(new THREE.CapsuleGeometry(0.17, 0.5, 4, 8), m, 0, 0.05, -0.3);
    seg.rotation.x = -1.1;
    tail.add(seg);
    const end = mesh(new THREE.ConeGeometry(0.2, 1.8, 8), m, 0, -0.75, -0.6);
    end.rotation.x = Math.PI - 0.15;
    tail.add(end);
    // mái lệch che mắt phải (phía trái người xem)
    const bang = mesh(new THREE.BoxGeometry(0.36, 0.62, 0.12), m, -0.2, 0.0, 0.48);
    bang.rotation.z = -0.25;
    head.add(bang);
    head.add(mesh(new THREE.BoxGeometry(0.12, 0.7, 0.12), m, -0.47, -0.3, 0.12));
  },
};

// Mặt kim loại băng trán: ký hiệu lá xoắn, hoặc chữ (VD 油 của Jiraiya)
const plateTex = new Map();
function plateTexture(text) {
  const key = text ?? 'leaf';
  if (plateTex.has(key)) return plateTex.get(key);
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 110;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, 110);
  grad.addColorStop(0, '#e4e8ee');
  grad.addColorStop(1, '#9aa3ae');
  g.fillStyle = grad;
  g.fillRect(0, 0, 256, 110);
  g.fillStyle = '#6f7782';
  for (const x of [14, 242]) for (const y of [16, 94]) g.fillRect(x - 4, y - 4, 8, 8);
  g.strokeStyle = '#3a414b';
  g.fillStyle = '#3a414b';
  if (text) {
    g.font = 'bold 84px serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(text, 128, 58);
  } else {
    // xoắn ốc + mũi lá
    g.lineWidth = 7;
    g.beginPath();
    for (let a = 0; a < Math.PI * 3.2; a += 0.1) {
      const r = 4 + a * 6;
      const x = 122 + Math.cos(a) * r, y = 58 + Math.sin(a) * r * 0.9;
      a === 0 ? g.moveTo(x, y) : g.lineTo(x, y);
    }
    g.lineTo(178, 22);
    g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  plateTex.set(key, t);
  return t;
}

function plateMesh(text) {
  const m = new THREE.MeshStandardMaterial({ map: plateTexture(text), metalness: 0.5, roughness: 0.35 });
  return mesh(new THREE.BoxGeometry(0.42, 0.18, 0.05), [mat(0x9aa3ae, { metalness: 0.5 }), mat(0x9aa3ae), mat(0x9aa3ae), mat(0x9aa3ae), m, mat(0x9aa3ae)]);
}

function headband(head, { cloth = 0x1f3a6b, horns = false, text } = {}) {
  const clothMat = mat(cloth, { side: THREE.DoubleSide });
  const band = mesh(new THREE.CylinderGeometry(HEAD_R * 1.04, HEAD_R * 1.04, 0.13, 28, 1, true), clothMat, 0, 0.2, 0);
  head.add(band);
  const p = plateMesh(text);
  p.position.set(0, 0.2, HEAD_R * 1.02);
  head.add(p);
  // hai dải vải buộc sau gáy
  for (const x of [-1, 1]) {
    const tail = mesh(new THREE.BoxGeometry(0.09, 0.42, 0.02), clothMat, x * 0.07, 0.02, -HEAD_R * 1.05);
    tail.rotation.set(0.35, 0, x * 0.35);
    head.add(tail);
  }
  if (horns) {
    for (const x of [-1, 1]) {
      const h = mesh(new THREE.ConeGeometry(0.06, 0.2, 6), mat(0xa8a8b0, { metalness: 0.5 }), x * 0.13, 0.36, HEAD_R * 1.0);
      head.add(h);
    }
  }
}

// Đặt chi tiết phẳng sát mặt cầu đầu, xoay theo pháp tuyến
function onFace(head, obj, x, y, lift = 0.012) {
  const z = Math.sqrt(Math.max(0, HEAD_R * HEAD_R - x * x - y * y)) + lift;
  obj.position.set(x, y, z);
  obj.lookAt(new THREE.Vector3(x, y, z).multiplyScalar(2));
  head.add(obj);
  return obj;
}

/** style: 'normal' | 'sleepy' | 'smile' | 'byakugan' — trả về các nhóm mắt để chớp */
function eyes(head, iris = 0x1b1b1b, style = 'normal', skin) {
  const groups = [];
  for (const x of [-1, 1]) {
    const g = new THREE.Group();
    onFace(head, g, x * 0.19, -0.02, -0.01);
    if (style === 'smile') {
      // mắt cười nhắm (Sai)
      const arc = mesh(new THREE.TorusGeometry(0.06, 0.014, 6, 16, Math.PI), mat(0x1b1b1b), 0, -0.02, 0.02);
      g.add(arc);
    } else {
      const sclera = mesh(new THREE.SphereGeometry(0.085, 14, 10), mat(style === 'byakugan' ? 0xf4f1ff : 0xffffff, { roughness: 0.3 }));
      sclera.scale.set(0.9, 1.2, 0.45);
      g.add(sclera);
      const irisMesh = mesh(new THREE.SphereGeometry(0.058, 12, 10), mat(iris, { roughness: 0.3 }), 0, -0.005, 0.02);
      irisMesh.scale.set(1, 1.2, 0.4);
      g.add(irisMesh);
      if (style !== 'byakugan') {
        const pupil = mesh(new THREE.SphereGeometry(0.03, 8, 8), mat(0x0d0d0d), 0, -0.005, 0.035);
        pupil.scale.set(1, 1.2, 0.4);
        g.add(pupil);
        g.add(mesh(new THREE.SphereGeometry(0.018, 6, 6), mat(0xffffff, { emissive: 0xffffff, emissiveIntensity: 0.6 }), 0.022, 0.03, 0.045));
      }
      if (style === 'sleepy') {
        const lid = mesh(new THREE.SphereGeometry(0.092, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), skin);
        lid.scale.set(0.95, 1.25, 0.55);
        lid.rotation.x = 0.35;
        g.add(lid);
      }
      // viền mi trên
      const lash = mesh(new THREE.TorusGeometry(0.075, 0.012, 5, 14, Math.PI), mat(0x1b1b1b), 0, 0.005, 0.02);
      lash.scale.y = 1.25;
      g.add(lash);
    }
    groups.push(g);
  }
  return groups;
}

/** mouth: 'grin' | 'smile' | 'flat' */
function face(head, spec, skin) {
  const browMat = mat(spec.brow ?? spec.hair);
  for (const x of [-1, 1]) {
    const b = onFace(head, mesh(new THREE.BoxGeometry(0.15, 0.03, 0.02), browMat), x * 0.19, 0.12);
    b.rotateZ(x * (spec.browTilt ?? 0.12));
    // tai
    const ear = mesh(new THREE.SphereGeometry(0.1, 10, 8), skin, x * 0.54, -0.04, 0);
    ear.scale.set(0.45, 1, 0.75);
    head.add(ear);
    if (spec.earrings) head.add(mesh(new THREE.SphereGeometry(0.035, 8, 6), mat(0xe2b33b, { metalness: 0.8, roughness: 0.3 }), x * 0.57, -0.17, 0));
    // má hồng
    const blush = new THREE.Mesh(new THREE.CircleGeometry(0.055, 16), new THREE.MeshBasicMaterial({ color: 0xff8a8a, transparent: true, opacity: 0.35 }));
    onFace(head, blush, x * 0.3, -0.13, 0.008);
    if (spec.whiskers) {
      for (let i = 0; i < 3; i++) {
        const w = onFace(head, mesh(new THREE.BoxGeometry(0.13, 0.012, 0.01), mat(0x6b4630)), x * 0.31, -0.07 - i * 0.045, 0.01);
        w.rotateZ(x * (0.08 - i * 0.08));
      }
    }
    if (spec.tearMarks) onFace(head, mesh(new THREE.BoxGeometry(0.03, 0.2, 0.01), mat(0xc0392b)), x * 0.2, -0.19, 0.01);
  }
  onFace(head, mesh(new THREE.SphereGeometry(0.025, 8, 6), mat(0xf0b896)), 0, -0.1, -0.005);

  const mouth = new THREE.Group();
  onFace(head, mouth, 0, -0.22, 0.008);
  const dark = mat(0x7a2525);
  if (spec.mouth === 'grin') {
    mouth.add(mesh(new THREE.CircleGeometry(0.075, 16, Math.PI, Math.PI), dark));
    mouth.add(mesh(new THREE.BoxGeometry(0.13, 0.02, 0.005), mat(0xffffff), 0, -0.012, 0.002));
  } else if (spec.mouth === 'flat') {
    mouth.add(mesh(new THREE.BoxGeometry(0.1, 0.018, 0.01), dark));
  } else {
    const arc = mesh(new THREE.TorusGeometry(0.055, 0.012, 5, 14, Math.PI), dark);
    arc.rotation.z = Math.PI;
    mouth.add(arc);
  }
  // miệng mở khi ăn mừng
  const open = new THREE.Group();
  onFace(head, open, 0, -0.23, 0.01);
  const o = mesh(new THREE.CircleGeometry(0.075, 18), dark);
  o.scale.y = 1.1;
  open.add(o);
  open.visible = false;
  return { mouth, open };
}

function verticalText(text, color = '#c62828') {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 64 + text.length * 96;
  const g = c.getContext('2d');
  g.fillStyle = color;
  g.font = 'bold 96px serif';
  g.textAlign = 'center';
  g.textBaseline = 'top';
  [...text].forEach((ch, i) => g.fillText(ch, 64, 24 + i * 96));
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return { tex: t, aspect: c.width / c.height };
}

/** Áo choàng mở phía trước. trim = màu viền lửa (null: không viền, VD áo khoác của Jiraiya) */
function cloak(torsoGroup, color, trim, text, length = 1.05, open = 0.15) {
  const start = Math.PI * open, len = Math.PI * (2 - open * 2);
  const top = 0.275, rBottom = 0.4 + 0.28 * (length / 1.05);
  const g = new THREE.CylinderGeometry(0.4, rBottom, length, 24, 1, true, start, len);
  torsoGroup.add(mesh(g, mat(color, { side: THREE.DoubleSide }), 0, top - length / 2, 0));
  // cổ áo choàng
  const collar = mesh(new THREE.TorusGeometry(0.34, 0.06, 6, 24), mat(color), 0, 0.27, 0);
  collar.rotation.x = Math.PI / 2;
  torsoGroup.add(collar);
  if (trim) {
    // viền lửa hình ngọn
    const flameMat = mat(trim, { side: THREE.DoubleSide });
    const yb = top - length;
    torsoGroup.add(mesh(new THREE.CylinderGeometry(rBottom - 0.015, rBottom + 0.01, 0.1, 24, 1, true, start, len), flameMat, 0, yb + 0.05, 0));
    const n = 16;
    for (let i = 0; i <= n; i++) {
      const th = start + (len * i) / n;
      const h = 0.18 + (i % 2) * 0.12;
      const f = mesh(new THREE.ConeGeometry(0.075, h, 4), flameMat, Math.sin(th) * (rBottom - 0.015), yb + 0.1 + h / 2, Math.cos(th) * (rBottom - 0.015));
      f.rotation.y = th;
      f.scale.z = 0.25;
      torsoGroup.add(f);
    }
  }
  if (text) {
    const { tex, aspect } = verticalText(text);
    const h = 0.72;
    const p = new THREE.Mesh(new THREE.PlaneGeometry(h * aspect, h), new THREE.MeshStandardMaterial({ map: tex, transparent: true }));
    p.position.set(0, -0.28, -0.6);
    p.rotation.set(-0.25, Math.PI, 0);
    torsoGroup.add(p);
  }
}

function limb(parent, geo, material, x, y, z) {
  const pivot = new THREE.Group();
  pivot.position.set(x, y, z);
  const m = mesh(geo, material, 0, -geo.parameters.length / 2 - geo.parameters.radius * 0.5, 0);
  pivot.add(m);
  parent.add(pivot);
  return pivot;
}

const PROPS = {
  scroll() {
    const g = new THREE.Group();
    const s = mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.4, 10), mat(0xf3e2b3));
    s.rotation.z = Math.PI / 2;
    g.add(s);
    for (const x of [-0.22, 0.22]) {
      const cap = mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.05, 10), mat(0xb3261e), x, 0, 0);
      cap.rotation.z = Math.PI / 2;
      g.add(cap);
    }
    return g;
  },
  book() {
    return mesh(new THREE.BoxGeometry(0.3, 0.38, 0.08), mat(0x6b4f2a));
  },
  notebook() {
    const g = new THREE.Group();
    g.add(mesh(new THREE.BoxGeometry(0.28, 0.36, 0.05), mat(0xd94b3a)));
    const pen = mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.3, 6), mat(0x222222), 0.18, 0.05, 0.05);
    pen.rotation.z = 0.5;
    g.add(pen);
    return g;
  },
  brush() {
    const g = new THREE.Group();
    g.add(mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.45, 6), mat(0x7a5230)));
    g.add(mesh(new THREE.ConeGeometry(0.045, 0.12, 8), mat(0x111111), 0, -0.28, 0));
    g.rotation.x = Math.PI;
    return g;
  },
  kunai() {
    const g = new THREE.Group();
    const m = mat(0x9aa4b0, { metalness: 0.8, roughness: 0.25 });
    g.add(mesh(new THREE.ConeGeometry(0.06, 0.28, 4), m, 0, 0.14, 0));
    for (const a of [-0.6, 0.6]) {
      const prong = mesh(new THREE.ConeGeometry(0.035, 0.18, 4), m, Math.sin(a) * 0.08, 0.06, 0);
      prong.rotation.z = -a;
      g.add(prong);
    }
    g.add(mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.18, 6), mat(0x2b2b2b), 0, -0.08, 0));
    return g;
  },
  flower() {
    const g = new THREE.Group();
    g.add(mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.35, 5), mat(0x3f8f3a)));
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      g.add(mesh(new THREE.SphereGeometry(0.05, 8, 6), mat(0xff7eb6), Math.cos(a) * 0.06, 0.2, Math.sin(a) * 0.06));
    }
    g.add(mesh(new THREE.SphereGeometry(0.04, 8, 6), mat(0xffd84a), 0, 0.2, 0));
    return g;
  },
  none() {
    return new THREE.Group();
  },
};

/**
 * spec: { skin, hair, hairStyle, top, pants, vest?, cloak?, cloakTrim?, skirt?,
 *         headband?, eyes?, prop, scale?, seed }
 */
// Vải lưới mắt cáo (ở khuỷu tay, đầu gối, cổ tay)
let fishnetMat = null;
function fishnet() {
  if (fishnetMat) return fishnetMat;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = '#4a4f5a';
  g.fillRect(0, 0, 64, 64);
  g.strokeStyle = '#1c1f26';
  g.lineWidth = 3;
  for (let i = -64; i < 128; i += 12) {
    g.beginPath(); g.moveTo(i, 0); g.lineTo(i + 64, 64); g.stroke();
    g.beginPath(); g.moveTo(i, 64); g.lineTo(i + 64, 0); g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(3, 1);
  t.colorSpace = THREE.SRGBColorSpace;
  fishnetMat = new THREE.MeshStandardMaterial({ map: t, roughness: 0.9 });
  return fishnetMat;
}

function band(parent, r, h, material, y) {
  parent.add(mesh(new THREE.CylinderGeometry(r, r, h, 12), material, 0, y, 0));
}

// Dáng đứng chờ lấy theo ảnh tham chiếu: góc xoay vai (x: trước/sau, z: khép/dang)
const POSES = {
  fist: { L: [-0.5, 0.35], R: [-1.5, -0.05], stance: 0.18 },
  hip: { L: [0.1, 0.75], R: [-2.5, 0.35], stance: 0.08 },
  crossed: { L: [-1.35, 1.0], R: [-1.35, -1.0], stance: 0.12 },
  kunai: { L: [-0.3, 0.3], R: [-1.35, -0.65], stance: 0.2 },
  think: { L: [-0.9, 0.6], R: [-2.4, 0.55], stance: 0.1 },
  brush: { L: [-0.4, 0.2], R: [-1.0, -0.15], stance: 0.08 },
  palm: { L: [-1.0, 0.45], R: [-1.55, 0.05], stance: 0.2 },
};

export function createChibi(spec) {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const skin = mat(spec.skin ?? 0xffd7b5);
  const pants = mat(spec.pants);
  const top = mat(spec.top);

  const legGeo = new THREE.CapsuleGeometry(0.15, 0.32, 4, 8);
  const legL = limb(body, legGeo, pants, -0.16, 0.66, 0);
  const legR = limb(body, legGeo, pants, 0.16, 0.66, 0);
  for (const leg of [legL, legR]) {
    if (spec.geta) {
      // guốc gỗ (Jiraiya)
      leg.add(mesh(new THREE.BoxGeometry(0.24, 0.06, 0.36), mat(0x8b5a2b), 0, -0.6, 0.05));
      for (const z of [-0.08, 0.16]) leg.add(mesh(new THREE.BoxGeometry(0.22, 0.08, 0.05), mat(0x6b4423), 0, -0.67, z));
      leg.add(mesh(new THREE.BoxGeometry(0.2, 0.08, 0.26), skin, 0, -0.53, 0.06));
    } else {
      // dép ninja hở ngón
      leg.add(mesh(new THREE.BoxGeometry(0.24, 0.12, 0.34), mat(spec.shoes ?? 0x2d4a7a), 0, -0.58, 0.05));
      leg.add(mesh(new THREE.BoxGeometry(0.2, 0.07, 0.08), skin, 0, -0.56, 0.22));
    }
    if (spec.fishnetShins) band(leg, 0.152, 0.3, fishnet(), -0.36);
    if (spec.shinWraps) band(leg, 0.158, 0.12, mat(0xf2efe6), spec.fishnetShins ? -0.22 : -0.42);
    if (spec.fishnet?.includes('knees')) band(leg, 0.158, 0.14, fishnet(), -0.24);
  }
  if (spec.pouch) legR.add(mesh(new THREE.BoxGeometry(0.12, 0.16, 0.2), mat(0xd9cdb0), 0.14, -0.12, 0));

  const torso = new THREE.Group();
  torso.position.y = 0.95;
  body.add(torso);
  torso.add(mesh(new THREE.CylinderGeometry(0.3, 0.36, 0.62, 16), top));
  if (spec.shoulders) torso.add(mesh(new THREE.CylinderGeometry(0.31, 0.32, 0.16, 16), mat(spec.shoulders), 0, 0.24, 0));
  if (spec.zipper) torso.add(mesh(new THREE.BoxGeometry(0.03, 0.5, 0.02), mat(spec.zipper), 0, -0.02, 0.34));
  if (spec.midriff) torso.add(mesh(new THREE.CylinderGeometry(0.335, 0.345, 0.14, 16), skin, 0, -0.14, 0));
  if (spec.vest) {
    const vest = mat(spec.vest);
    torso.add(mesh(new THREE.CylinderGeometry(0.33, 0.38, 0.5, 16), vest, 0, 0.03, 0));
    const collar = mesh(new THREE.TorusGeometry(0.25, 0.07, 6, 18), vest, 0, 0.3, 0);
    collar.rotation.x = Math.PI / 2;
    torso.add(collar);
    // túi cuộn giấy trước ngực
    const pocket = mat(new THREE.Color(spec.vest).multiplyScalar(0.8).getHex());
    for (const x of [-0.17, -0.06, 0.06, 0.17]) {
      const p = mesh(new THREE.BoxGeometry(0.09, 0.15, 0.05), pocket, x, 0.08, 0.35);
      p.rotation.y = x * 1.4;
      torso.add(p);
    }
  }
  if (spec.belt) {
    const belt = mesh(new THREE.TorusGeometry(0.355, 0.04, 6, 20), mat(spec.belt), 0, -0.26, 0);
    belt.rotation.x = Math.PI / 2;
    torso.add(belt);
  }
  if (spec.skirt) torso.add(mesh(new THREE.CylinderGeometry(0.34, 0.5, 0.4, 16), mat(spec.skirt), 0, -0.38, 0));
  if (spec.robe) {
    // áo choàng Hyuga: vạt dài tới gối, cổ chéo chữ V
    torso.add(mesh(new THREE.CylinderGeometry(0.36, 0.48, 0.5, 18), top, 0, -0.45, 0));
    for (const x of [-1, 1]) {
      const lapel = mesh(new THREE.BoxGeometry(0.05, 0.42, 0.02), mat(new THREE.Color(spec.top).multiplyScalar(0.8).getHex()), x * 0.07, 0.08, 0.33);
      lapel.rotation.z = x * 0.45;
      torso.add(lapel);
    }
  }
  if (spec.strap) {
    const s = mesh(new THREE.BoxGeometry(0.07, 0.75, 0.03), mat(spec.strap), 0, 0.02, 0.34);
    s.rotation.z = -0.7;
    torso.add(s);
  }
  if (spec.cloak) cloak(torso, spec.cloak, spec.cloakTrim ?? 0xd8342b, spec.cloakText);
  if (spec.haori) cloak(torso, spec.haori, null, null, 1.25, 0.2);
  if (spec.backScroll) {
    const { body: bodyColor = 0x3f6b3a, ends = 0x8a2a1e, r = 0.24, len = 1.2, stripes } = spec.backScroll === true ? {} : spec.backScroll;
    const sc = new THREE.Group();
    sc.position.set(0, -0.05, -0.5);
    sc.rotation.z = Math.PI / 2 + 0.15;
    sc.add(mesh(new THREE.CylinderGeometry(r, r, len, 16), mat(bodyColor)));
    for (const y of [-1, 1]) sc.add(mesh(new THREE.CylinderGeometry(r + 0.03, r + 0.03, 0.12, 16), mat(ends), 0, y * (len / 2 - 0.04), 0));
    if (stripes) for (const y of [-0.22, 0.22]) sc.add(mesh(new THREE.CylinderGeometry(r + 0.01, r + 0.01, 0.12, 16), mat(stripes), 0, y, 0));
    torso.add(sc);
  }
  if (spec.tanto) {
    // đoản kiếm đeo chéo sau lưng (Sai)
    const sword = new THREE.Group();
    sword.position.set(0, 0.05, -0.4);
    sword.rotation.z = 0.7;
    sword.add(mesh(new THREE.BoxGeometry(0.07, 0.6, 0.05), mat(0x1a1a1a)));
    sword.add(mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.22, 8), mat(0x5a3a22), 0, 0.4, 0));
    torso.add(sword);
  }

  const armGeo = new THREE.CapsuleGeometry(0.1, 0.34, 4, 8);
  const armMat = spec.sleeveless ? skin : top;
  const armL = limb(body, armGeo, armMat, -0.4, 1.2, 0);
  const armR = limb(body, armGeo, armMat, 0.4, 1.2, 0);
  for (const arm of [armL, armR]) {
    arm.add(mesh(new THREE.SphereGeometry(0.11, 10, 8), spec.gloves ? mat(spec.gloves) : skin, 0, -0.55, 0));
    if (spec.armWraps) band(arm, 0.112, 0.2, mat(spec.armWraps === true ? 0xf2efe6 : spec.armWraps), -0.38);
    if (spec.fishnet?.includes('elbows')) band(arm, 0.11, 0.14, fishnet(), -0.22);
    if (spec.fishnet?.includes('wrists')) band(arm, 0.113, 0.1, fishnet(), -0.44);
    if (spec.cuffs) band(arm, 0.115, 0.07, mat(spec.cuffs), -0.42);
    if (spec.cloakSleeves) {
      // tay áo choàng ngắn có viền đỏ (Minato)
      arm.add(mesh(new THREE.CylinderGeometry(0.15, 0.19, 0.3, 12, 1, true), mat(spec.cloak, { side: THREE.DoubleSide }), 0, -0.12, 0));
      band(arm, 0.192, 0.05, mat(spec.cloakTrim ?? 0xd8342b), -0.26);
    }
  }
  if (spec.armband) {
    // băng trán buộc ở bắp tay trái (Shikamaru)
    band(armL, 0.112, 0.1, mat(spec.armband), -0.08);
    const p = plateMesh();
    p.scale.set(0.45, 0.6, 1);
    p.position.set(-0.11, -0.08, 0);
    p.rotation.y = -Math.PI / 2;
    armL.add(p);
  }
  armL.rotation.z = 0.12;
  armR.rotation.z = -0.12;

  const prop = (PROPS[spec.prop] ?? PROPS.none)();
  prop.position.set(0, -0.62, 0.12);
  armR.add(prop);

  const head = new THREE.Group();
  head.position.y = 1.78;
  body.add(head);
  head.add(mesh(new THREE.SphereGeometry(HEAD_R, 28, 20), skin));
  head.add(mesh(new THREE.CylinderGeometry(0.12, 0.14, 0.2, 10), skin, 0, -0.55, 0));
  const eyeGroups = eyes(head, spec.eyes, spec.eyeStyle, skin);
  const { mouth, open } = face(head, spec, skin);
  const hairMat = mat(spec.hair);
  HAIR[spec.hairStyle](head, hairMat, spec.seed ?? 7, spec.longSideBangs);
  if (spec.headband) headband(head, spec.headband === true ? {} : spec.headband);

  const s = spec.scale ?? 1;
  root.scale.setScalar(s);

  return {
    root, body, head, armL, armR, legL, legR, prop,
    eyes: eyeGroups, mouth, mouthOpen: open, blinkAt: 2 + (spec.seed ?? 0) % 3, pose: POSES[spec.pose],
  };
}

/** state: 'idle' | 'walk' | 'work' | 'cheer' */
export function animateChibi(rig, t, state, phase = 0) {
  const T = t + phase;
  let bob = Math.sin(T * 2) * 0.025;
  let legSwing = 0, armL = 0, armR = 0, headTilt = Math.sin(T * 0.7) * 0.08;
  let armLz = 0.12, armRz = -0.12, stance = 0;

  if (state === 'idle' && rig.pose) {
    // giữ dáng riêng, thở nhẹ
    const breath = Math.sin(T * 2) * 0.04;
    [armL, armLz] = rig.pose.L;
    [armR, armRz] = rig.pose.R;
    armL += breath;
    armR -= breath;
    stance = rig.pose.stance;
  } else if (state === 'walk') {
    legSwing = Math.sin(T * 10) * 0.55;
    armL = -legSwing * 0.8;
    armR = legSwing * 0.8;
    bob = Math.abs(Math.sin(T * 10)) * 0.07;
  } else if (state === 'work') {
    armR = -1.3 + Math.sin(T * 12) * 0.25;
    armL = -0.6 + Math.sin(T * 9) * 0.1;
    headTilt = 0.25;
  } else if (state === 'cheer') {
    bob = Math.abs(Math.sin(T * 6)) * 0.45;
    armL = -2.7;
    armR = -2.7;
  }

  rig.body.position.y = bob;
  rig.legL.rotation.x = legSwing;
  rig.legR.rotation.x = -legSwing;
  rig.armL.rotation.x = armL;
  rig.armR.rotation.x = armR;
  rig.armL.rotation.z = armLz;
  rig.armR.rotation.z = armRz;
  rig.legL.rotation.z = -stance;
  rig.legR.rotation.z = stance;
  rig.head.rotation.x = headTilt * 0.5;
  rig.head.rotation.y = state === 'idle' ? Math.sin(T * 0.5) * 0.3 : 0;

  // chớp mắt khoảng 4 giây một lần
  const cycle = (T + rig.blinkAt) % 4;
  const lid = cycle < 0.14 ? Math.abs(cycle - 0.07) / 0.07 : 1;
  for (const e of rig.eyes) e.scale.y = Math.max(0.1, lid);
  rig.mouthOpen.visible = state === 'cheer';
  rig.mouth.visible = state !== 'cheer';
}

export function makeScrollMesh() {
  const g = PROPS.scroll();
  g.scale.setScalar(1.6);
  return g;
}
