// Định nghĩa đội agent + bộ mô phỏng luồng nhiệm vụ.
// Mỗi agent gọi backend /api/produce (functions/api/produce.js, dùng Claude API).
// Hàm `produce` của từng agent chỉ là mẫu dự phòng khi backend chưa cấu hình, lỗi hoặc quá hạn.
import * as THREE from 'three';
import { createChibi, animateChibi } from './characters.js';
import { loadCharacterModel, loadCharacterSprite } from './models.js';

const SKIN = 0xffd7b5;

export const COMMANDER = {
  id: 'naruto', name: 'Naruto', role: 'Tổng chỉ huy', color: '#ff8a1f',
  station: { type: 'hokage', place: 'Tháp Hokage', pos: new THREE.Vector3(0, 8, -16), r: 9.5, waterfall: 0.9, plaqueX: -0.9 },
  spec: {
    skin: SKIN, hair: 0xffd23f, hairStyle: 'spiky', top: 0xff7b1c, pants: 0xff7b1c,
    headband: { cloth: 0x1d1d22 }, eyes: 0x2a6fdb, prop: 'none', seed: 3, scale: 1.15, pose: 'fist', shinWraps: true, shoes: 0x2a3550,
    mouth: 'grin', whiskers: true, shoulders: 0x1d1d22, zipper: 0xf2efe6, pouch: true, browTilt: -0.05,
  },
};

export const WORKERS = [
  {
    id: 'shikamaru', name: 'Shikamaru', role: 'Nghiên cứu', color: '#5fd068',
    station: { type: 'library', place: 'Thư viện', pos: new THREE.Vector3(0, 0, 8), r: 8.5, waterfall: 0.8 },
    working: 'Phiền phức thật… để tôi phân tích đã.',
    spec: { skin: 0xf2c9a0, hair: 0x1d1d22, hairStyle: 'pineapple', top: 0x2a2f45, pants: 0x2a2f45, vest: 0x56733d, armband: 0x2a2f45, fishnet: ['wrists'], eyes: 0x2a2a2a, prop: 'none', seed: 5, eyeStyle: 'sleepy', mouth: 'flat', earrings: true, pouch: true, browTilt: 0.2, pose: 'think', shoes: 0x2a3a2a },
    produce: (topic) =>
      `• Khán giả chính: ninja trẻ 18–30 tuổi quan tâm "${topic}"\n• 3 góc nội dung: lợi ích nổi bật, câu chuyện hậu trường, ưu đãi giới hạn\n• Khung giờ tương tác cao: 11h30 và 20h00`,
  },
  {
    id: 'jiraiya', name: 'Jiraiya', role: 'Viết bài', color: '#d94b3a',
    station: { type: 'inn', place: 'Quán trọ', pos: new THREE.Vector3(-27, 6, -13), r: 7.5, waterfall: -0.9 },
    working: 'Cảm hứng của Tiên nhân đang dâng trào!',
    spec: { skin: 0xf5cba7, hair: 0xf4f4f4, hairStyle: 'longWhite', top: 0x6b7a4a, pants: 0x6b7a4a, haori: 0xb3261e, headband: { cloth: 0x3a3a3a, horns: true, text: '油' }, eyes: 0x3a2a1a, prop: 'none', backScroll: { body: 0x3f6b3a, ends: 0x8a2a1e }, seed: 9, scale: 1.25, mouth: 'grin', tearMarks: true, geta: true, fishnet: ['wrists'], brow: 0xdddddd, pose: 'crossed' },
    produce: (topic) =>
      `Tiêu đề: "${topic} — chuyện mà cả Làng Lá đang bàn tán!"\nMở bài kể chuyện, 3 đoạn thân bài theo 3 góc nội dung, kết bằng lời kêu gọi hành động. (~350 chữ)`,
  },
  {
    id: 'sai', name: 'Sai', role: 'Thiết kế', color: '#4a8fe0',
    station: { type: 'studio', place: 'Xưởng vẽ', pos: new THREE.Vector3(-17, -6, 25), r: 7.5, waterfall: -0.7 },
    working: 'Siêu Thú Giả Họa… vẽ xong ngay.',
    spec: { skin: 0xfbeee4, hair: 0x111111, hairStyle: 'short', top: 0x1a1c22, pants: 0x22263a, strap: 0xa8322a, gloves: 0x1a1a1a, headband: { cloth: 0x1a1a1a }, eyes: 0x111111, prop: 'brush', backScroll: { body: 0xf2efe6, ends: 0x2b2b2b, stripes: 0xa8322a, r: 0.2, len: 1.1 }, seed: 13, eyeStyle: 'normal', mouth: 'flat', midriff: true, pouch: true, shinWraps: true, pose: 'brush' },
    produce: () => `Bộ 3 ảnh: 1 ảnh bìa 1200×630, 1 ảnh vuông 1080×1080, 1 story 1080×1920.\nPhong cách mực tàu đen trắng, điểm nhấn cam.`,
  },
  {
    id: 'neji', name: 'Neji', role: 'Kiểm duyệt', color: '#a99bff',
    station: { type: 'dojo', place: 'Võ đường Hyuga', pos: new THREE.Vector3(27, 0, 7), r: 8, waterfall: 0.7 },
    working: 'Byakugan! Không lỗi nào thoát được.',
    spec: { skin: SKIN, hair: 0x3b2a1f, hairStyle: 'longStraight', top: 0xeee8da, pants: 0x2e2a2a, robe: true, headband: { cloth: 0x2a2f45 }, eyes: 0xdcd6f7, prop: 'none', seed: 17, eyeStyle: 'byakugan', mouth: 'flat', belt: 0x3a3030, shinWraps: true, browTilt: 0.25, pose: 'palm' },
    produce: () => `Đã soát: chính tả ✔, giọng thương hiệu ✔, bản quyền hình ✔.\nSửa 2 lỗi nhỏ, rút gọn tiêu đề còn 60 ký tự. Duyệt đăng.`,
  },
  {
    id: 'minato', name: 'Minato', role: 'Hẹn giờ đăng', color: '#ffd84a',
    station: { type: 'clock', place: 'Tháp đồng hồ', pos: new THREE.Vector3(-27, 1, 7), r: 7.5, waterfall: -0.6 },
    working: 'Phi Lôi Thần — đúng giờ, không lệch một giây.',
    spec: { skin: SKIN, hair: 0xffd84a, hairStyle: 'spiky', longSideBangs: true, top: 0x23324d, pants: 0x23324d, vest: 0x56733d, cloak: 0xf6f3ec, cloakTrim: 0xe2422d, cloakSleeves: true, headband: { cloth: 0x23324d }, eyes: 0x3b7bd6, prop: 'kunai', seed: 11, mouth: 'smile', pouch: true, shinWraps: true, pose: 'kunai' },
    produce: () => `Lịch đăng: Facebook 11:30, Instagram 20:00, TikTok 20:15 (hôm nay).\nĐã đặt nhắc lại sau 24h cho bài tổng hợp.`,
  },
  {
    id: 'ino', name: 'Ino', role: 'Trả lời bình luận', color: '#b56cff',
    station: { type: 'flower', place: 'Tiệm hoa Yamanaka', pos: new THREE.Vector3(27, 6, -13), r: 7.5, waterfall: 0.9 },
    working: 'Tâm Chuyển Thân — hiểu ngay khách muốn gì!',
    spec: { skin: SKIN, hair: 0xf6e7a1, hairStyle: 'ponytail', top: 0x7a45b5, pants: 0x7a45b5, skirt: 0x6a3aa5, midriff: true, eyes: 0x5aa3e0, prop: 'flower', seed: 19, mouth: 'smile', earrings: true, sleeveless: true, armWraps: 0x2a2433, fishnet: ['elbows', 'knees'], fishnetShins: true, shoes: 0x2a2433, pose: 'hip' },
    produce: () => `Soạn sẵn 5 mẫu trả lời: cảm ơn, hỏi giá, hỏi địa chỉ, góp ý, khiếu nại.\nGắn cờ bình luận tiêu cực để Tổng chỉ huy xem.`,
  },
];

// Cầu treo nối các đảo (giống ảnh bối cảnh): Tháp Hokage và Thư viện là hai đảo trung tâm
export const BRIDGES = [
  ['naruto', 'jiraiya'], ['naruto', 'ino'], ['naruto', 'shikamaru'],
  ['shikamaru', 'minato'], ['shikamaru', 'neji'], ['shikamaru', 'sai'],
];

export const STATIONS = [COMMANDER, ...WORKERS].map((a) => ({ id: a.id, ...a.station }));

const WALK_SPEED = 4.2;
const WORK_TIME = 6;
const ENVELOPE_SPEED = 13;
const AI_TIMEOUT = 25000;

class Agent {
  constructor(def, scene, home) {
    this.def = def;
    this.rig = createChibi(def.spec);
    this.home = home.clone();
    this.rig.root.position.copy(home);
    scene.add(this.rig.root);
    // vòng chakra dưới chân theo màu nhân vật (như bệ đứng trong ảnh tham chiếu)
    const auraMat = new THREE.MeshBasicMaterial({
      color: def.color, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    this.aura = new THREE.Group();
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.75, 0.9, 40), auraMat);
    const disc = new THREE.Mesh(new THREE.CircleGeometry(0.75, 40), auraMat.clone());
    disc.material.opacity = 0.15;
    for (const m of [ring, disc]) {
      m.rotation.x = -Math.PI / 2;
      this.aura.add(m);
    }
    this.aura.position.y = 0.04;
    this.rig.root.add(this.aura);
    this.phase = Math.random() * 10;
    this.state = 'idle'; // idle | moving | working | done
    this.anim = 'idle';
    this.status = 'Đang chờ';
    this.progress = 0;
    this.bubble = '';
    this.bubbleTimer = 0;
    this.target = null;
    this.onArrive = null;
    this.wanderTimer = 1 + Math.random() * 3;
    this.cheerTimer = 0;
    this.facing = 0;
    this.model = null;
    this.sprite = null;
    loadCharacterModel(def.id).then((m) =>
      m ? this.useModel(m) : loadCharacterSprite(def.id).then((s) => s && this.useSprite(s)),
    );
  }

  // Thay nhân vật khối bằng ảnh 2.5D luôn quay về camera
  useSprite(s) {
    this.rig.body.visible = false;
    this.rig.root.add(s.object);
    this.sprite = s;
    this.flip = 1;
  }

  animateSprite(t, cam) {
    const o = this.sprite.object;
    const root = this.rig.root;
    // quay tấm ảnh về camera, chỉ xoay quanh trục đứng để nhân vật không nghiêng
    const camYaw = cam ? Math.atan2(cam.position.x - this.pos.x, cam.position.z - this.pos.z) : 0;
    o.rotation.y = camYaw - root.rotation.y;
    // khi đi: lật ảnh theo hướng di chuyển trên màn hình
    if (this.anim === 'walk') this.flip = Math.sin(root.rotation.y - camYaw) < 0 ? -1 : 1;
    else if (this.anim !== 'cheer') this.flip = 1;

    const T = t + this.phase;
    let y = 0, tilt = 0, sx = 1, sy = 1;
    if (this.anim === 'idle') {
      sy = 1 + Math.sin(T * 2) * 0.015; // thở
      sx = 1 - Math.sin(T * 2) * 0.008;
    } else if (this.anim === 'walk') {
      y = Math.abs(Math.sin(T * 9)) * 0.12;
      tilt = Math.sin(T * 9) * 0.07;
    } else if (this.anim === 'work') {
      y = Math.abs(Math.sin(T * 7)) * 0.05;
      tilt = Math.sin(T * 14) * 0.035;
    } else if (this.anim === 'cheer') {
      y = Math.abs(Math.sin(T * 6)) * 0.5;
      sy = 1 + Math.sin(T * 12) * 0.03;
    }
    o.position.y = y;
    o.rotation.z = tilt;
    o.scale.set(sx * this.flip, sy, 1);
  }

  setNight(k) {
    this.sprite?.material.color.setScalar(1 - k * 0.45);
  }

  // Thay nhân vật khối bằng model GLB (giữ nguyên root, vòng hào quang, nhãn)
  useModel(m) {
    this.rig.body.visible = false;
    this.rig.root.add(m.object);
    this.model = m;
    if (m.mixer) {
      m.actions = {};
      for (const [k, clip] of Object.entries(m.clips)) m.actions[k] = m.mixer.clipAction(clip);
      m.current = null;
    }
  }

  animateModel(dt, t) {
    const m = this.model;
    const want = this.anim === 'walk' ? 'walk' : 'idle';
    if (m.actions && Object.keys(m.actions).length) {
      const next = m.actions[want] ?? m.actions.idle ?? m.actions.other ?? m.actions.walk;
      if (next !== m.current) {
        m.current?.fadeOut(0.25);
        next.reset().fadeIn(0.25).play();
        m.current = next;
      }
      m.mixer.update(dt);
    }
    // chuyển động bổ sung khi model không có hoạt ảnh tương ứng
    const o = m.object;
    const T = t + this.phase;
    o.position.y = this.anim === 'cheer' ? Math.abs(Math.sin(T * 6)) * 0.45 : this.anim === 'walk' && !m.actions?.walk ? Math.abs(Math.sin(T * 10)) * 0.08 : 0;
    o.rotation.z = this.anim === 'walk' && !m.actions?.walk ? Math.sin(T * 10) * 0.06 : 0;
    o.rotation.x = this.anim === 'work' ? 0.12 + Math.sin(T * 8) * 0.04 : 0;
    o.scale.y = this.anim === 'idle' ? 1 + Math.sin(T * 2) * 0.012 : 1;
  }

  get pos() {
    return this.rig.root.position;
  }

  say(text, seconds = 4) {
    this.bubble = text;
    this.bubbleTimer = seconds;
  }

  moveTo(target, onArrive) {
    this.target = target.clone();
    this.walkSpeed = null;
    this.onArrive = onArrive ?? null;
  }

  cheer(seconds = 3) {
    this.cheerTimer = seconds;
  }

  update(dt, t, wanderCenter, wanderRadius, cam) {
    if (this.bubbleTimer > 0) {
      this.bubbleTimer -= dt;
      if (this.bubbleTimer <= 0) this.bubble = '';
    }
    if (this.cheerTimer > 0) this.cheerTimer -= dt;

    // đi lang thang khi rảnh
    if (this.state === 'idle' && !this.target && wanderCenter && !this.faceCamera) {
      this.wanderTimer -= dt;
      if (this.wanderTimer <= 0) {
        this.wanderTimer = 3 + Math.random() * 4;
        const a = Math.random() * Math.PI * 2;
        const r = Math.random() * wanderRadius;
        this.target = wanderCenter.clone().add(new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r));
        this.walkSpeed = WALK_SPEED * 0.4;
      }
    }

    let walking = false;
    if (this.target) {
      const d = new THREE.Vector3().subVectors(this.target, this.pos).setY(0);
      const dist = d.length();
      const speed = this.walkSpeed ?? WALK_SPEED;
      if (dist < 0.05) {
        this.target = null;
        this.walkSpeed = null;
        const cb = this.onArrive;
        this.onArrive = null;
        cb?.();
      } else {
        walking = true;
        this.pos.addScaledVector(d.normalize(), Math.min(dist, speed * dt));
        this.facing = Math.atan2(d.x, d.z);
      }
    } else if (this.faceCamera && this.state !== 'working') {
      // đang được camera theo dõi: quay mặt về người xem
      this.facing = Math.atan2(this.faceCamera.x - this.pos.x, this.faceCamera.z - this.pos.z);
    } else if (this.state === 'working' || this.state === 'done') {
      // quay lưng vào công trình, mặt hướng ra quảng trường
      this.facing = Math.atan2(-this.pos.x, -this.pos.z);
    }
    // xoay mượt
    let diff = this.facing - this.rig.root.rotation.y;
    diff = Math.atan2(Math.sin(diff), Math.cos(diff));
    this.rig.root.rotation.y += diff * Math.min(1, dt * 8);

    this.anim = this.cheerTimer > 0 ? 'cheer' : walking ? 'walk' : this.state === 'working' ? 'work' : 'idle';
    if (this.model) this.animateModel(dt, t);
    else if (this.sprite) this.animateSprite(t, cam);
    else animateChibi(this.rig, t, this.anim, this.phase);
    // hào quang sáng mạnh khi làm việc, nhịp nhẹ khi rảnh
    const glow = this.anim === 'work' ? 0.8 + Math.sin(t * 8) * 0.2 : 0.45 + Math.sin(t * 2 + this.phase) * 0.1;
    this.aura.children[0].material.opacity = glow;
    this.aura.scale.setScalar(this.anim === 'work' ? 1.15 + Math.sin(t * 8) * 0.05 : 1);
  }
}

let envelopeTex = null;
let glowTex = null;
function makeEnvelope() {
  envelopeTex ??= (() => {
    const c = document.createElement('canvas');
    c.width = 192;
    c.height = 128;
    const g = c.getContext('2d');
    g.fillStyle = '#fbf1d8';
    g.fillRect(0, 0, 192, 128);
    g.strokeStyle = '#c9a24a';
    g.lineWidth = 6;
    g.strokeRect(3, 3, 186, 122);
    g.beginPath(); g.moveTo(4, 6); g.lineTo(96, 74); g.lineTo(188, 6); g.stroke();
    g.fillStyle = '#b3261e';
    g.beginPath(); g.arc(96, 74, 15, 0, Math.PI * 2); g.fill();
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  })();
  glowTex ??= (() => {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d');
    const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grd.addColorStop(0, 'rgba(255,255,255,1)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(c);
  })();
  const g = new THREE.Group();
  g.add(new THREE.Mesh(new THREE.PlaneGeometry(1.9, 1.28), new THREE.MeshBasicMaterial({ map: envelopeTex, side: THREE.DoubleSide, toneMapped: false })));
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xffc46b, transparent: true, opacity: 0.8, depthWrite: false, blending: THREE.AdditiveBlending }));
  glow.scale.setScalar(5);
  g.add(glow);
  return g;
}

// Phong thư phát sáng bay dọc theo cầu từ đảo này sang đảo khác
class Envelope {
  constructor(scene, path, onArrive) {
    this.mesh = makeEnvelope();
    scene.add(this.mesh);
    this.scene = scene;
    this.curve = new THREE.CatmullRomCurve3(path, false, 'centripetal');
    this.length = this.curve.getLength();
    this.mesh.position.copy(path[0]); // tránh hiện ở gốc tọa độ trước khung hình đầu tiên
    this.s = 0;
    this.onArrive = onArrive;
    this.done = false;
  }

  update(dt, t, cam) {
    this.s += dt * ENVELOPE_SPEED;
    const k = Math.min(1, this.s / this.length);
    const p = this.curve.getPointAt(k);
    p.y += Math.sin(t * 6) * 0.08;
    this.mesh.position.copy(p);
    if (cam) this.mesh.quaternion.copy(cam.quaternion);
    this.mesh.children[0].rotation.z = Math.sin(t * 5) * 0.15;
    if (k >= 1) {
      this.done = true;
      this.scene.remove(this.mesh);
      this.onArrive();
    }
  }
}

/**
 * Điều phối nhiệm vụ: Naruto gửi phong thư → 6 agent lần lượt làm → báo cáo về Naruto.
 * Callbacks: onLog(text, agent), onComplete({ topic, results }), onStatus(text)
 */
export class Simulation {
  constructor(scene, world, callbacks) {
    this.scene = scene;
    this.world = world;
    this.cb = callbacks;
    // mỗi người ở yên tại văn phòng trên đảo của mình
    this.commander = new Agent(COMMANDER, scene, world.spots.get(COMMANDER.id));
    this.workers = WORKERS.map((def) => new Agent(def, scene, world.spots.get(def.id)));
    this.all = [this.commander, ...this.workers];
    this.scrolls = [];
    this.running = false;
    this.results = [];
    this.topic = '';
  }

  start(topic) {
    if (this.running) return false;
    this.running = true;
    this.returnTimer = 0;
    this.topic = topic;
    this.results = [];
    for (const w of this.workers) {
      w.state = 'idle';
      w.status = 'Chờ đến lượt';
      w.progress = 0;
    }
    this.commander.status = 'Đang giao nhiệm vụ';
    this.commander.say(`Nhiệm vụ mới: "${topic}"! Shikamaru, bắt đầu đi!`, 4);
    this.commander.cheer(1.2);
    this.cb.onStatus('Đang thực hiện');
    this.cb.onLog(`Giao nhiệm vụ “${topic}” cho đội.`, this.commander);
    this.sendScroll(this.commander, 0);
    return true;
  }

  sendScroll(fromAgent, index) {
    const to = index < this.workers.length ? this.workers[index] : this.commander;
    this.scrolls.push(
      new Envelope(this.scene, this.world.route(fromAgent.def.id, to.def.id), () => {
        if (index < this.workers.length) this.assign(index);
        else this.finish();
      }),
    );
  }

  assign(i) {
    const w = this.workers[i];
    w.state = 'working';
    w.status = 'Đang làm việc';
    w.workLeft = WORK_TIME;
    w.result = null;
    this.requestOutput(w);
    w.cheer(0.5);
    w.say(w.def.working, WORK_TIME);
    this.world.setActivity(w.def.id, 1);
    this.cb.onLog(`nhận phong thư nhiệm vụ.`, w);
  }

  // Gọi backend /api/produce (Claude API); lỗi hoặc quá hạn thì dùng mẫu soạn sẵn `produce` và đánh dấu live = false.
  requestOutput(w) {
    const topic = this.topic;
    const previous = this.results.map((r) => ({ name: r.agent.name, output: r.output }));
    const fallback = () => ({ output: w.def.produce(topic), live: false });
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), AI_TIMEOUT);
    fetch('/api/produce', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ agent: w.def.id, topic, previous }),
      signal: ctrl.signal,
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => (typeof d?.output === 'string' && d.output ? { output: d.output, live: true } : fallback()))
      .catch(fallback)
      .then((res) => {
        clearTimeout(timer);
        if (this.topic === topic) w.result = res;
      });
  }

  completeWork(i) {
    const w = this.workers[i];
    const { output, live } = w.result;
    this.results.push({ agent: w.def, output, live });
    w.state = 'done';
    w.status = 'Hoàn thành';
    w.progress = 1;
    w.say(output.split('\n')[0], 4);
    this.world.setActivity(w.def.id, 0);
    this.cb.onLog(`hoàn thành phần ${w.def.role.toLowerCase()}${live ? ' (AI thật)' : ' (mẫu mô phỏng)'}.`, w);
    this.sendScroll(w, i + 1);
  }

  finish() {
    this.running = false;
    this.commander.status = 'Nhiệm vụ hoàn thành';
    this.commander.say('Tuyệt vời! Đúng là con đường nhẫn đạo của chúng ta! 🍥', 5);
    for (const a of this.all) a.cheer(3);
    this.cb.onLog('nhận báo cáo — nhiệm vụ hoàn thành!', this.commander);
    this.cb.onStatus('Hoàn thành');
    this.returnTimer = 3.2; // sau khi ăn mừng, trở lại trạng thái chờ
    this.cb.onComplete({ topic: this.topic, results: this.results });
  }

  setNight(k) {
    for (const a of this.all) a.setNight(k);
  }

  update(dt, t) {
    if (this.returnTimer > 0) {
      this.returnTimer -= dt;
      if (this.returnTimer <= 0 && !this.running) {
        for (const w of this.workers) {
          w.state = 'idle';
          w.status = 'Đang chờ';
          w.progress = 0;
        }
        this.commander.status = 'Đang chờ lệnh';
        this.cb.onStatus('Đang chờ lệnh');
      }
    }
    this.scrolls.forEach((s) => s.update(dt, t, this.camera));
    this.scrolls = this.scrolls.filter((s) => !s.done);

    this.workers.forEach((w, i) => {
      if (w.state === 'working') {
        w.workLeft -= dt;
        // hết thời gian diễn hoạt nhưng AI chưa trả lời: giữ ở 95% và chờ
        w.progress = w.result ? 1 - Math.max(0, w.workLeft) / WORK_TIME : Math.min(0.95, 1 - Math.max(0, w.workLeft) / WORK_TIME);
        if (w.workLeft <= 0 && w.result) this.completeWork(i);
      }
      w.update(dt, t, null, 0, this.camera);
    });
    this.commander.update(dt, t, null, 0, this.camera);
  }
}
