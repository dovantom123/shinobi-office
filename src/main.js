import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { buildWorld } from './world.js';
import { Simulation, STATIONS, BRIDGES } from './agents.js';
import { fetchStatus, testConnection, formatOutput, generateImage } from './ai.js';

const $ = (sel) => document.querySelector(sel);

function hasWebGL() {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}

if (!hasWebGL()) {
  $('#loading').classList.add('hide');
  $('#webgl-error').hidden = false;
} else {
  init();
}

function init() {
  // ---------- Renderer / scene ----------
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.NeutralToneMapping; // giữ màu ảnh nhân vật trung thực
  $('#app').appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x1b2c55, 90, 330);

  const camera = new THREE.PerspectiveCamera(42, window.innerWidth / window.innerHeight, 0.5, 1200);
  const narrow = () => window.innerWidth < 760; // điện thoại dọc: quyết định khung camera
  // giao diện gọn cho điện thoại, kể cả xoay ngang (khớp media query trong style.css)
  const compactUI = () => window.matchMedia('(max-width: 760px), (max-height: 520px) and (orientation: landscape)').matches;
  const HOME_TARGET = new THREE.Vector3(0, 1, 2);
  // Điện thoại dọc: tính khoảng cách để thấy đủ 7 đảo theo tỉ lệ màn hình (nửa bề ngang cảnh ~38 đơn vị gồm cả biển tên)
  const FIT_HALF_WIDTH = 36;
  const homeCam = () => {
    if (!narrow()) return new THREE.Vector3(0, 34, 86);
    const halfTanH = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.aspect;
    const d = THREE.MathUtils.clamp(FIT_HALF_WIDTH / halfTanH, 120, 240);
    return new THREE.Vector3(0, d * 0.34, d * 0.94);
  };
  camera.position.copy(homeCam());

  // camera nhìn chéo phía trước, chỉ xoay ±45° để nhân vật ảnh luôn đẹp
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.copy(HOME_TARGET);
  controls.enableDamping = true;
  controls.minAzimuthAngle = -Math.PI / 4;
  controls.maxAzimuthAngle = Math.PI / 4;
  controls.minPolarAngle = 0.55;
  controls.maxPolarAngle = 1.4;
  controls.minDistance = 10;
  controls.maxDistance = narrow() ? 260 : 150;
  controls.enablePan = true;

  // ánh trăng xanh lạnh + ánh nền tối; ánh ấm do đèn lồng trên từng đảo
  scene.add(new THREE.HemisphereLight(0x7d93cc, 0x1a2036, 0.9));
  const moonLight = new THREE.DirectionalLight(0xb8ccff, 1.6);
  moonLight.castShadow = true;
  moonLight.shadow.mapSize.set(2048, 2048);
  Object.assign(moonLight.shadow.camera, { left: -55, right: 55, top: 55, bottom: -55, near: 1, far: 400 });
  moonLight.shadow.bias = -0.0006;
  scene.add(moonLight, moonLight.target);

  // ---------- World ----------
  const world = buildWorld(scene, STATIONS, BRIDGES);
  moonLight.position.copy(world.moonPos).normalize().multiplyScalar(160);
  const ui = createUI();
  const sim = new Simulation(scene, world, {
    onLog: ui.log,
    onStatus: ui.setStatus,
    onComplete: ui.showResult,
    onCancel: () => ui.setRunning(false),
  });
  sim.camera = camera; // để nhân vật 2.5D luôn quay về phía người xem
  sim.setNight(0.2); // hòa ảnh nhân vật vào ánh đêm
  ui.bindAgents(sim.all, world);
  fetchStatus().then((st) => ui.setConfig(st));
  if (import.meta.env.DEV) window.__shinobi = { sim, world, camera, ui }; // chỉ để gỡ lỗi khi chạy dev
  if (compactUI()) $('#hud-right').open = false;

  // ---------- Hậu kỳ: phát sáng đèn lồng ----------
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.75, 0.55, 0.82);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  let effects = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function setEffects(on) {
    effects = on;
    bloom.enabled = on;
    world.setEffects(on);
    $('#btn-effects').setAttribute('aria-pressed', String(on));
    $('#btn-effects').textContent = on ? '✦ Hiệu ứng: bật' : '✧ Hiệu ứng: tắt';
  }
  setEffects(effects);

  // ---------- Camera focus ----------
  let focus = null;
  let flyHome = false;

  function focusAgent(agent) {
    focus = agent;
    flyHome = false;
    ui.setActive(agent);
    const dir = new THREE.Vector3().subVectors(camera.position, controls.target).normalize();
    focus.zoomPos = agent.pos.clone().add(new THREE.Vector3(0, 2, 0)).addScaledVector(dir, 16);
  }

  function resetView() {
    focus = null;
    flyHome = true;
    ui.setActive(null);
  }

  function updateCamera(dt) {
    const k = Math.min(1, dt * 4);
    if (focus) {
      const desired = focus.pos.clone().add(new THREE.Vector3(0, 2, 0));
      const delta = desired.sub(controls.target).multiplyScalar(k);
      controls.target.add(delta);
      camera.position.add(delta);
      if (focus.zoomPos) {
        camera.position.lerp(focus.zoomPos, k);
        if (camera.position.distanceTo(focus.zoomPos) < 0.3) focus.zoomPos = null;
      }
    } else if (flyHome) {
      const home = homeCam();
      controls.target.lerp(HOME_TARGET, k);
      camera.position.lerp(home, k);
      if (camera.position.distanceTo(home) < 0.3) flyHome = false;
    }
  }

  // nhấp vào nhân vật hoặc đảo để theo dõi (phân biệt với kéo xoay)
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  let downAt = null;
  renderer.domElement.addEventListener('pointerdown', (e) => (downAt = { x: e.clientX, y: e.clientY }));
  renderer.domElement.addEventListener('pointerup', (e) => {
    if (!downAt || Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) > 5) return;
    pointer.set((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
    raycaster.setFromCamera(pointer, camera);
    const targets = sim.all.flatMap((a) => [a.rig.root, world.islands.get(a.def.id)]);
    const hits = raycaster.intersectObjects(targets, true);
    if (!hits.length) return;
    const agent = sim.all.find((a) => {
      for (let p = hits[0].object; p; p = p.parent) if (p === a.rig.root || p === world.islands.get(a.def.id)) return true;
      return false;
    });
    if (agent) focusAgent(agent);
  });

  // ---------- UI wiring ----------
  $('#mission-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const topic = $('#topic').value.trim();
    if (!topic) return ui.error('Hãy nhập chủ đề nhiệm vụ trước khi giao.');
    if (topic.length < 3) return ui.error('Chủ đề quá ngắn (tối thiểu 3 ký tự).');
    const comments = $('#comments').value.split('\n').map((l) => l.trim()).filter(Boolean);
    if (comments.length > 5 || comments.some((c) => c.length > 300)) return ui.error('Tối đa 5 bình luận, mỗi bình luận không quá 300 ký tự.');
    ui.error('');
    if (sim.start(topic, comments)) ui.setRunning(true);
  });
  $('#btn-cancel').addEventListener('click', () => sim.cancel());
  $('#btn-effects').addEventListener('click', () => setEffects(!effects));
  // Điện thoại: tùy chọn (bình luận, tốc độ, hiệu ứng) thu gọn sau nút ⚙
  const setOpts = (open) => {
    $('#hud-left').classList.toggle('opts-open', open);
    $('#btn-opts').setAttribute('aria-expanded', String(open));
  };
  $('#btn-opts').addEventListener('click', () => {
    const open = !$('#hud-left').classList.contains('opts-open');
    setOpts(open);
    if (open && compactUI()) $('#hud-right').open = false; // hai bảng không chồng lên nhau trên điện thoại
  });
  $('#hud-right').addEventListener('toggle', () => {
    if ($('#hud-right').open && compactUI()) setOpts(false);
  });
  $('#btn-reset').addEventListener('click', resetView);
  ui.onPick((agent) => {
    focusAgent(agent);
    if (compactUI()) $('#hud-right').open = false; // thu thanh đội để thấy nhân vật vừa chọn; mở lại sẽ thấy thông tin nguồn AI
  });
  $('#result').addEventListener('close', () => {
    ui.closeResult();
    ui.setRunning(false);
  });

  window.addEventListener('keydown', (e) => {
    if (e.target instanceof Element && e.target.matches('input, select, textarea')) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key >= '1' && e.key <= '7') focusAgent(sim.all[Number(e.key) - 1]);
    else if (e.key === '0' || e.key === 'Escape') resetView();
    else if (e.key.toLowerCase() === 'e') setEffects(!effects);
  });

  let lastAspect = window.innerWidth / window.innerHeight;
  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    controls.maxDistance = narrow() ? 260 : 150;
    // chỉ căn lại toàn cảnh khi đổi hướng màn hình; thanh địa chỉ co giãn không được reset camera của người dùng
    if (!focus && Math.abs(camera.aspect - lastAspect) > 0.2) flyHome = true;
    lastAspect = camera.aspect;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    composer.setSize(window.innerWidth, window.innerHeight);
  });

  // ---------- Loop (tự dừng khi tab bị ẩn nhờ requestAnimationFrame) ----------
  const clock = new THREE.Clock();
  let t = 0, simT = 0, uiTick = 0;
  function frame() {
    const rawDt = clock.getDelta();
    const dt = Math.min(rawDt, 0.05);
    const speed = Number($('#speed').value) || 1;
    t += dt;
    simT += dt * speed;
    sim.update(dt * speed, simT);
    world.update(t, dt);
    updateCamera(Math.min(rawDt, 0.5));
    controls.update();
    if (effects) composer.render();
    else renderer.render(scene, camera);
    ui.placeLabels(camera);
    if ((uiTick += dt) > 0.1) {
      uiTick = 0;
      ui.refreshRoster();
    }
    requestAnimationFrame(frame);
  }
  frame();
  $('#loading').classList.add('hide');
  setTimeout(() => $('#loading').remove(), 600);
}

// ---------- DOM UI ----------
function createUI() {
  const roster = $('#roster');
  const logEl = $('#log');
  const labelsEl = $('#labels');
  let agents = [];
  let world = null;
  let pick = () => {};
  const v = new THREE.Vector3();

  const STATUS_CLASS = { working: 'working', done: 'done', error: 'error' };
  let config = null; // /api/status; null = chưa có backend
  let active = null;
  let info = null;

  // trạng thái AI của một nhân vật, suy ra từ cấu hình và luồng nhiệm vụ thật
  function aiState(a) {
    if (a.testing) return 'Đang kiểm tra kết nối';
    if (a.state === 'working') return 'Đang xử lý';
    if (a.state === 'error') return 'Lỗi';
    if (a.state === 'done' || a.status === 'Nhiệm vụ hoàn thành') return 'Hoàn thành';
    if (!a.cfg?.configured) return 'Chưa cấu hình';
    return 'Sẵn sàng';
  }
  const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

  function project(p, camera, el) {
    v.copy(p).project(camera);
    const visible = v.z < 1 && Math.abs(v.x) < 1.15 && Math.abs(v.y) < 1.15;
    el.style.display = visible ? '' : 'none';
    if (visible) el.style.transform = `translate(${(v.x * 0.5 + 0.5) * window.innerWidth}px, ${(-v.y * 0.5 + 0.5) * window.innerHeight}px) translate(-50%, -50%)`;
    return visible;
  }

  const mk = (tag, text, cls) => {
    const el = document.createElement(tag);
    if (text != null) el.textContent = text;
    if (cls) el.className = cls;
    return el;
  };

  // panel nguồn AI / model / trạng thái của nhân vật đang chọn; chỉ dùng textContent nên không chèn HTML
  function renderInfo(a) {
    const box = $('#agent-info');
    box.replaceChildren();
    info = null;
    if (!a) return box.append(mk('p', 'Chọn một nhân vật để xem nguồn AI, model và trạng thái.', 'hint'));
    const c = a.cfg;
    box.append(mk('h3', `${a.def.name} · ${a.def.role}`));
    const dl = mk('dl');
    const state = mk('dd');
    const rows = [
      ['Nguồn AI', c?.providerLabel ?? 'Chưa có backend'],
      ['Model', c ? c.model : '—'],
    ];
    for (const [k, val] of rows) dl.append(mk('dt', k), mk('dd', val));
    dl.append(mk('dt', 'Trạng thái'), state);
    box.append(dl);
    if (c && !c.configured) box.append(mk('p', c.issue === 'model_not_allowed' ? 'Model cấu hình không hợp lệ.' : 'Thiếu khóa API trên máy chủ.', 'error'));
    const btn = mk('button', 'Kiểm tra kết nối');
    btn.type = 'button';
    const out = mk('p', '', 'ai-test-result');
    out.setAttribute('role', 'status');
    btn.addEventListener('click', async () => {
      if (a.testing) return;
      a.testing = true;
      btn.disabled = true;
      out.className = 'ai-test-result';
      out.textContent = 'Đang gọi thử…';
      const r = await testConnection(a.def.id);
      a.testing = false;
      btn.disabled = false;
      out.className = 'ai-test-result' + (r.ok ? '' : ' bad');
      out.textContent = r.ok ? `Kết nối OK · ${r.model} · ${r.latencyMs} ms` : `Lỗi: ${r.message}`;
    });
    box.append(btn, out);
    info = { state };
    state.textContent = aiState(a);
  }

  // Nút "Tạo ảnh" cho từng prompt của Sai. Ảnh chỉ được tạo khi bấm; kết quả đến muộn của lượt cũ bị bỏ qua.
  let imageAbort = null;
  const SRC_OK = /^(data:image\/png;base64,[A-Za-z0-9+/=]+|https:\/\/\S+)$/;
  function attachImageTools(saiOutput) {
    imageAbort?.abort();
    const host = $('#result-body article[data-agent="sai"] > div');
    if (!host || !saiOutput.imagePrompts.length) return;
    const ctrl = (imageAbort = new AbortController());
    const box = mk('div', null, 'img-tools');
    saiOutput.imagePrompts.forEach((prompt, i) => {
      const btn = mk('button', `Tạo ảnh từ prompt ${i + 1}`);
      btn.type = 'button';
      const out = mk('div', null, 'img-out');
      out.setAttribute('role', 'status');
      btn.addEventListener('click', async () => {
        btn.disabled = true;
        out.replaceChildren(mk('p', 'Đang tạo ảnh… có thể mất vài chục giây và tốn phí.', 'hint'));
        const r = await generateImage({ sai: saiOutput, promptIndex: i }, ctrl.signal);
        if (ctrl.signal.aborted) return;
        btn.disabled = false;
        if (!r.ok) return out.replaceChildren(mk('p', `Lỗi: ${r.message}`, 'error'));
        if (!SRC_OK.test(r.image?.src ?? '')) return out.replaceChildren(mk('p', 'Lỗi: dữ liệu ảnh không hợp lệ.', 'error'));
        const img = new Image();
        img.alt = `Ảnh do AI tạo từ prompt ${i + 1}`;
        img.referrerPolicy = 'no-referrer';
        img.src = r.image.src;
        out.replaceChildren(img, mk('small', r.meta?.note ?? 'Ảnh do AI tạo.'));
      });
      box.append(mk('p', prompt, 'img-prompt'), btn, out);
    });
    host.append(box);
  }

  return {
    closeResult() {
      imageAbort?.abort();
      imageAbort = null;
    },
    bindAgents(list, w) {
      agents = list;
      world = w;
      roster.innerHTML = '';
      list.forEach((a, i) => {
        const id = a.def.id;
        const li = document.createElement('li');
        li.style.setProperty('--c', a.def.color);
        li.innerHTML = `<button type="button" aria-label="Theo dõi ${a.def.name}, ${a.def.role} (phím ${i + 1})">
          <img class="avatar" src="/characters/${id}.png" alt="" loading="lazy" />
          <span class="r-name">${a.def.name}</span>
          <span class="r-status"></span>
          <span class="r-role">${a.def.role}</span>
          <span class="bar"><i></i></span>
        </button>`;
        li.querySelector('button').addEventListener('click', () => pick(a));
        roster.appendChild(li);
        a.ui = { li, status: li.querySelector('.r-status'), bar: li.querySelector('.bar i') };

        // biển tên kiểu bảng gỗ viền vàng ở mép đảo
        const plaque = document.createElement('button');
        plaque.type = 'button';
        plaque.className = 'plaque';
        plaque.style.setProperty('--c', a.def.color);
        plaque.innerHTML = `<b>${a.def.name}</b><span>${a.def.role}</span><small>${a.def.station.place}</small><em class="chip"></em>`;
        plaque.addEventListener('click', () => pick(a));
        labelsEl.appendChild(plaque);
        a.ui.plaque = plaque;
        a.ui.chip = plaque.querySelector('.chip');

        const bubble = document.createElement('div');
        bubble.className = 'bubble';
        labelsEl.appendChild(bubble);
        a.ui.bubble = bubble;
      });
    },
    onPick(fn) {
      pick = fn;
    },
    setConfig(st) {
      config = st;
      for (const a of agents) a.cfg = st?.characters.find((c) => c.id === a.def.id) ?? null;
      renderInfo(active);
    },
    setActive(agent) {
      active = agent;
      renderInfo(agent);
      for (const a of agents) {
        a.ui.li.classList.toggle('active', a === agent);
        a.ui.plaque.classList.toggle('active', a === agent);
      }
    },
    refreshRoster() {
      for (const a of agents) {
        const cls = STATUS_CLASS[a.state] ?? '';
        a.ui.status.textContent = a.status;
        a.ui.status.className = 'r-status ' + cls;
        a.ui.bar.style.width = `${Math.round(a.progress * 100)}%`;
        a.ui.chip.textContent = a.status;
        a.ui.chip.className = 'chip ' + cls;
      }
      if (info && active) info.state.textContent = aiState(active);
    },
    placeLabels(camera) {
      for (const a of agents) {
        project(world.plaques.get(a.def.id), camera, a.ui.plaque);
        const s = a.rig.root.scale.y;
        const lift = a.sprite ? a.sprite.object.position.y : a.rig.body.position.y;
        const head = v.copy(a.pos).setY(a.pos.y + 4.1 * s + lift).clone();
        const shown = a.bubble && project(head, camera, a.ui.bubble);
        if (!a.bubble) a.ui.bubble.style.display = 'none';
        if (shown) a.ui.bubble.style.transform += ' translateY(-60%)';
        if (a.ui.bubble.textContent !== a.bubble) a.ui.bubble.textContent = a.bubble;
      }
    },
    log(text, agent) {
      logEl.querySelector('.empty')?.remove();
      const li = document.createElement('li');
      const time = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      li.innerHTML = `<time>${time}</time> <b style="color:${agent.def.color}">${agent.def.name}</b> ${esc(text)}`;
      logEl.appendChild(li);
      while (logEl.children.length > 60) logEl.firstChild.remove();
      logEl.parentElement.scrollTop = logEl.parentElement.scrollHeight;
    },
    setStatus(text) {
      $('#mission-status').textContent = text;
    },
    setRunning(running) {
      $('#btn-start').disabled = running;
      $('#btn-start').textContent = running ? 'Đội đang làm nhiệm vụ…' : 'Gửi phong thư nhiệm vụ';
      $('#topic').disabled = running;
      $('#comments').disabled = running;
      $('#btn-cancel').hidden = !running;
    },
    error(msg) {
      const el = $('#form-error');
      el.textContent = msg;
      el.hidden = !msg;
      if (msg) $('#topic').focus();
    },
    showResult({ topic, results, error }) {
      const card = (r) => {
        const body = r.skipped ?? formatOutput(r.agent.id, r.output);
        const tag = r.skipped ? 'bỏ qua' : `AI · ${r.meta.model}`;
        const note = r.meta?.note ? `<span class="note">${esc(r.meta.note)}</span>` : '';
        return `<article data-agent="${r.agent.id}" style="--c:${r.agent.color}"><img src="/characters/${r.agent.id}.png" alt="" /><div><h3>${esc(r.agent.name)} · ${esc(r.agent.role)} <small>(${esc(tag)})</small></h3><p>${esc(body)}</p>${note}</div></article>`;
      };
      $('#result-body').innerHTML =
        `<p class="topic"><b>Chủ đề:</b> ${esc(topic)}</p>` +
        (error ? `<p class="fail" role="alert"><b>Nhiệm vụ dừng tại ${esc(error.agent.name)}:</b> ${esc(error.message)}</p>` : '') +
        results.map(card).join('');
      $('#result h2').textContent = error ? 'Nhiệm vụ chưa hoàn thành' : 'Nhiệm vụ hoàn thành';
      const sai = results.find((r) => r.agent.id === 'sai' && r.output);
      if (sai) attachImageTools(sai.output);
      $('#result').showModal();
    },
  };
}
