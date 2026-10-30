// Làm sạch mặt nạ: đặc hóa phần thân, giữ khối liền lớn nhất, lấp lỗ nhỏ, cắt gọn
const sharp = require('sharp');
const [dir, out, thr = 40] = process.argv.slice(2);
const THR = { naruto: 6 };
const ids = ['naruto','ino','jiraiya','minato','shikamaru','sai','neji'];
(async () => {
  for (const id of ids) {
    const { data, info } = await sharp(`${dir}/${id}.png`).ensureAlpha().raw().toBuffer({ resolveWithFile: false, resolveWithObject: true });
    const { width: W, height: H } = info; const N = W * H;
    const a = new Uint8Array(N); for (let i = 0; i < N; i++) a[i] = data[i * 4 + 3];
    const mask = new Uint8Array(N); for (let i = 0; i < N; i++) mask[i] = a[i] > (THR[id] ?? +thr) ? 1 : 0;
    // bbox thô để xác định vùng chân
    let y0 = H, y1 = 0; for (let i = 0; i < N; i++) if (mask[i]) { const y = (i / W) | 0; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    const footY = y1 - (y1 - y0) * (id === 'naruto' ? 0.06 : 0.16);
    for (let i = 0; i < N; i++) {
      if (!mask[i]) continue;
      const r = data[i*4], g = data[i*4+1], b = data[i*4+2], y = (i / W) | 0;
      const mx = Math.max(r,g,b), mn = Math.min(r,g,b), sat = mx ? (mx-mn)/mx : 0, val = mx/255;
      // vệt sáng của bệ đứng quanh chân: màu rực, sáng
      if (y > footY && sat > 0.45 && val > 0.45) mask[i] = 0;
      if (id !== 'jiraiya' && id !== 'naruto' && y > footY && sat > 0.35 && val > 0.3 && !(r > g && g > b && sat < 0.5)) mask[i] = 0;
      // khói mực xanh quanh Sai
      const x = i % W;
      if (id === 'sai' && (x < W * 0.3 || x > W * 0.72) && b - r > 12) mask[i] = 0;
      if (id === 'sai' && x > W * 0.72 && val < 0.3) mask[i] = 0;
      if (id === 'naruto' && b > r + 8) mask[i] = 0;
      if (id === 'naruto' && x < W * 0.2 && y < H * 0.45) mask[i] = 0;
      if (id === 'naruto' && x < W * 0.45 && y < H * 0.4 && r > g + 40 && b < 90) mask[i] = 0;
      if (id === 'naruto' && y > footY && val > 0.3 && val < 0.78 && r > b + 30) mask[i] = 0; // nền đất dưới dép
    }
    // khối liền lớn nhất
    const lab = new Int32Array(N).fill(-1); let best = -1, bestSize = 0; const stack = [];
    for (let s = 0, c = 0; s < N; s++) {
      if (!mask[s] || lab[s] >= 0) continue;
      let size = 0; stack.push(s); lab[s] = c;
      while (stack.length) { const p = stack.pop(); size++; const x = p % W, y = (p / W) | 0;
        for (const q of [x > 0 ? p - 1 : -1, x < W - 1 ? p + 1 : -1, y > 0 ? p - W : -1, y < H - 1 ? p + W : -1])
          if (q >= 0 && mask[q] && lab[q] < 0) { lab[q] = c; stack.push(q); } }
      if (size > bestSize) { bestSize = size; best = c; } c++;
    }
    for (let i = 0; i < N; i++) mask[i] = lab[i] === best ? 1 : 0;
    // lấp lỗ nhỏ (< 0.4% ảnh) không thông ra mép
    const seen = new Uint8Array(N);
    for (let s = 0; s < N; s++) {
      if (mask[s] || seen[s]) continue;
      const comp = []; let border = false; stack.push(s); seen[s] = 1;
      while (stack.length) { const p = stack.pop(); comp.push(p); const x = p % W, y = (p / W) | 0;
        if (x === 0 || y === 0 || x === W - 1 || y === H - 1) border = true;
        for (const q of [x > 0 ? p - 1 : -1, x < W - 1 ? p + 1 : -1, y > 0 ? p - W : -1, y < H - 1 ? p + W : -1])
          if (q >= 0 && !mask[q] && !seen[q]) { seen[q] = 1; stack.push(q); } }
      let lum = 0; for (const p of comp) lum += 0.3*data[p*4] + 0.59*data[p*4+1] + 0.11*data[p*4+2];
      lum /= comp.length;
      if (!border && (comp.length < N * 0.004 || (id !== 'naruto' && comp.length < N * 0.05 && lum > 90))) for (const p of comp) mask[p] = 1;
    }
    // alpha cuối: trong mặt nạ đặc 255, viền giữ chuyển mượt
    let minX = W, minY = H, maxX = 0, maxY = 0;
    for (let i = 0; i < N; i++) {
      let v = 0;
      if (mask[i]) {
        const x = i % W, y = (i / W) | 0;
        const edge = (x > 0 && !mask[i - 1]) || (x < W - 1 && !mask[i + 1]) || (y > 0 && !mask[i - W]) || (y < H - 1 && !mask[i + W]);
        v = edge ? Math.min(255, a[i] * 2 + 60) : 255;
        if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y;
      }
      data[i * 4 + 3] = v;
    }
    const pad = 4;
    const left = Math.max(0, minX - pad), top = Math.max(0, minY - pad);
    const w = Math.min(W - left, maxX - minX + 1 + pad * 2), h = Math.min(H - top, maxY - minY + 1 + pad * 2);
    await sharp(data, { raw: { width: W, height: H, channels: 4 } }).extract({ left, top, width: w, height: h })
      .resize({ height: Math.min(640, h) }).png({ compressionLevel: 9 }).toFile(`${out}/${id}.png`);
    console.log(id, `${w}x${h}`, 'bbox', minX, minY, maxX, maxY);
  }
})();
