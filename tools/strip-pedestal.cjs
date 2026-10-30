// Bỏ bệ trưng bày khỏi ảnh figure (đã có nền trong suốt):
// cắt dưới đế dép, trong dải mặt bệ chỉ giữ dép tối và da, giữ khối liền lớn nhất, cắt gọn.
const sharp = require('sharp');
const [dir, out] = process.argv.slice(2);
// [mặt bệ bắt đầu, đáy đế dép] theo pixel ảnh gốc
const CUT = {
  naruto: [1215, 1315], sai: [1230, 1315], ino: [1140, 1247], minato: [1060, 1157],
  neji: [995, 1106], jiraiya: [1210, 1270], shikamaru: [1025, 1099],
};
(async () => {
  for (const [id, [bandTop, cut]] of Object.entries(CUT)) {
    const { data, info } = await sharp(`${dir}/${id}.png`).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const W = info.width, H = Math.min(info.height, cut), N = W * H;
    const legCols = new Uint8Array(W); const pad = Math.round(W * 0.1);
    for (let x = 0; x < W; x++) if (data[((bandTop - 1) * W + x) * 4 + 3] > 128)
      for (let k = Math.max(0, x - pad); k <= Math.min(W - 1, x + pad); k++) legCols[k] = 1;
    for (let i = 0; i < N; i++) {
      const y = (i / W) | 0;
      if (y < bandTop) continue;
      if (!legCols[i % W]) { data[i*4+3] = 0; continue; }
      const r = data[i*4], g = data[i*4+1], b = data[i*4+2];
      const mx = Math.max(r, g, b), mn = Math.min(r, g, b), sat = mx ? (mx - mn) / mx : 0, val = mx / 255;
      const dark = val < 0.3;
      const skin = r > g && g > b && r - g > 22 && g - b < 55 && g - b > 8 && sat > 0.18 && sat < 0.48 && val > 0.6;
      const strap = id === 'jiraiya' && r - g > 70 && val > 0.25; // dây guốc đỏ / gỗ nâu
      const greenSandal = id === 'shikamaru' && g >= r && g > b && val < 0.45;
      if (!(dark || skin || strap || greenSandal)) data[i*4+3] = 0;
    }
    // trong dải mặt bệ: chỉ giữ điểm ảnh nối liền với chân từ phía trên (dép, ngón chân)
    const reach = new Uint8Array(N); const q = [];
    for (let x = 0; x < W; x++) { const p = (bandTop - 1) * W + x; if (data[p*4+3] >= 20) { reach[p] = 1; q.push(p); } }
    while (q.length) { const p = q.pop(); const x = p % W, y = (p / W) | 0;
      for (const n of [x > 0 ? p-1 : -1, x < W-1 ? p+1 : -1, y < H-1 ? p+W : -1, y > bandTop ? p-W : -1])
        if (n >= 0 && !reach[n] && ((n / W) | 0) >= bandTop && data[n*4+3] >= 20) { reach[n] = 1; q.push(n); } }
    for (let i = bandTop * W; i < N; i++) if (!reach[i]) data[i*4+3] = 0;
    // khối liền lớn nhất
    const lab = new Int32Array(N).fill(-1); const stack = []; let best = -1, bestSize = 0;
    for (let s = 0, c = 0; s < N; s++) {
      if (data[s*4+3] < 20 || lab[s] >= 0) continue;
      let size = 0; stack.push(s); lab[s] = c;
      while (stack.length) { const p = stack.pop(); size++; const x = p % W, y = (p / W) | 0;
        for (const q of [x > 0 ? p-1 : -1, x < W-1 ? p+1 : -1, y > 0 ? p-W : -1, y < H-1 ? p+W : -1])
          if (q >= 0 && data[q*4+3] >= 20 && lab[q] < 0) { lab[q] = c; stack.push(q); } }
      if (size > bestSize) { bestSize = size; best = c; } c++;
    }
    let minX = W, minY = H, maxX = 0, maxY = 0;
    for (let i = 0; i < N; i++) {
      if (lab[i] !== best) { data[i*4+3] = 0; continue; }
      const x = i % W, y = (i / W) | 0;
      if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y;
    }
    const left = Math.max(0, minX - 2), top = Math.max(0, minY - 2);
    await sharp(data.subarray(0, N * 4), { raw: { width: W, height: H, channels: 4 } })
      .extract({ left, top, width: Math.min(W - left, maxX - minX + 5), height: Math.min(H - top, maxY - minY + 5) })
      .resize({ height: 768, withoutEnlargement: true }).png({ compressionLevel: 9 }).toFile(`${out}/${id}.png`);
    console.log(id, 'bbox', minX, minY, maxX, maxY);
  }
})();
