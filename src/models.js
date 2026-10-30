// Nạp hình nhân vật cho từng agent, theo thứ tự ưu tiên:
//   1. model GLB (tạo bằng Tripo/Meshy) — "models" trong public/models/manifest.json
//   2. ảnh 2.5D tách nền từ ảnh tham chiếu — "sprites" trong manifest
//   3. nhân vật dựng bằng khối hình học (characters.js) nếu không có hai loại trên
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';

const TARGET_HEIGHT = 2.3; // bằng chiều cao nhân vật khối, để nhãn và camera không lệch
// Model nên được nén bằng `npx @gltf-transform/cli optimize in.glb out.glb` (mặc định dùng meshopt)
const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
let manifestPromise = null;

function manifest() {
  manifestPromise ??= fetch('/models/manifest.json', { cache: 'no-cache' })
    .then((r) => (r.ok ? r.json() : {}))
    .catch(() => ({}));
  return manifestPromise;
}

const SPRITE_HEIGHT = 3.6;
const texLoader = new THREE.TextureLoader();

/**
 * Nhân vật 2.5D: ảnh nền trong (public/characters/, khai báo ở "sprites" trong manifest)
 * dựng trên một tấm phẳng luôn quay về camera. Trả về { object, material } hoặc null.
 */
export async function loadCharacterSprite(id) {
  const file = (await manifest()).sprites?.[id];
  if (!file) return null;
  try {
    const tex = await texLoader.loadAsync(`/characters/${file}`);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    const w = SPRITE_HEIGHT * (tex.image.width / tex.image.height);
    const geo = new THREE.PlaneGeometry(w, SPRITE_HEIGHT);
    geo.translate(0, SPRITE_HEIGHT / 2, 0); // chân chạm đất
    // giữ đúng màu ảnh gốc (không qua tone mapping); ban đêm làm tối qua material.color
    const material = new THREE.MeshBasicMaterial({ map: tex, alphaTest: 0.5, side: THREE.DoubleSide, toneMapped: false });
    const mesh = new THREE.Mesh(geo, material);
    mesh.castShadow = true;
    // bóng đổ theo đúng hình nhân vật thay vì hình chữ nhật
    mesh.customDepthMaterial = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: tex, alphaTest: 0.5 });
    const object = new THREE.Group();
    object.add(mesh);
    return { object, material };
  } catch (err) {
    console.warn(`Không nạp được ảnh nhân vật ${id} (${file}), giữ nhân vật khối.`, err);
    return null;
  }
}

/** Trả về { object, mixer, clips } hoặc null nếu nhân vật chưa có model. */
export async function loadCharacterModel(id) {
  const file = (await manifest()).models?.[id];
  if (!file) return null;
  try {
    const gltf = await loader.loadAsync(`/models/${file}`);
    const object = gltf.scene;
    object.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
      }
    });
    // chuẩn hóa: cao TARGET_HEIGHT, đứng trên mặt đất, tâm ở gốc
    const box = new THREE.Box3().setFromObject(object);
    const size = box.getSize(new THREE.Vector3());
    const s = TARGET_HEIGHT / (size.y || 1);
    object.scale.setScalar(s);
    const center = box.getCenter(new THREE.Vector3());
    object.position.set(-center.x * s, -box.min.y * s, -center.z * s);
    const wrapper = new THREE.Group();
    wrapper.add(object);

    const mixer = gltf.animations.length ? new THREE.AnimationMixer(object) : null;
    const clips = {};
    for (const clip of gltf.animations) {
      const n = clip.name.toLowerCase();
      if (n.includes('walk') || n.includes('run')) clips.walk ??= clip;
      else if (n.includes('idle') || n.includes('stand')) clips.idle ??= clip;
      else clips.other ??= clip;
    }
    return { object: wrapper, mixer, clips };
  } catch (err) {
    console.warn(`Không nạp được model của ${id} (${file}), giữ nhân vật khối.`, err);
    return null;
  }
}
