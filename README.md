# AI Marketing · Shinobi Office

Văn phòng Marketing AI dạng đảo nổi 3D (Three.js + Vite), bối cảnh Làng Lá về đêm. Tổng chỉ huy Naruto gửi phong thư nhiệm vụ; phong thư phát sáng bay dọc theo cầu treo, lần lượt qua 6 văn phòng rồi quay về báo cáo:

| # | Agent | Vai trò | Văn phòng (đảo) |
|---|-------|---------|------|
| 1 | Naruto | Tổng chỉ huy | Tháp Hokage |
| 2 | Shikamaru | Nghiên cứu | Thư viện |
| 3 | Jiraiya | Viết bài | Quán trọ |
| 4 | Sai | Thiết kế | Xưởng vẽ |
| 5 | Neji | Kiểm duyệt | Võ đường Hyuga |
| 6 | Minato | Hẹn giờ đăng | Tháp đồng hồ |
| 7 | Ino | Trả lời bình luận | Tiệm hoa Yamanaka |

> **Chế độ mô phỏng:** nội dung agent tạo ra là mẫu soạn sẵn, chưa gọi AI thật.
> Nhân vật là ảnh figure do người dùng cung cấp (fan-art, dùng cá nhân); đảo, nhà, cầu dựng bằng code.

## Chạy

```bash
npm install
npm run dev
```

Mở http://localhost:5173. Font chữ tải từ Google Fonts (cần mạng; không có mạng thì dùng font dự phòng).

## Điều khiển

- Kéo để xoay (giới hạn ±45° để nhân vật luôn nhìn về phía trước), cuộn để zoom.
- Bấm vào nhân vật, đảo hoặc biển tên; hoặc phím `1`–`7` để theo dõi agent.
- `0` / `Esc`: về toàn cảnh. `E`: bật/tắt hiệu ứng (phát sáng, mây trôi, thác chảy). Hiệu ứng tự tắt nếu hệ điều hành bật "giảm chuyển động".

## Cấu trúc

- `src/world.js`: bầu trời đêm, trăng, mây, núi xa, 7 đảo nổi, văn phòng từng đảo, cầu treo, tuyến bay phong thư.
- `src/agents.js`: dữ liệu agent, vị trí đảo, danh sách cầu, luồng nhiệm vụ (`Simulation`) và phong thư.
- `src/models.js`: nạp hình nhân vật (GLB → ảnh 2.5D → khối hình học).
- `src/characters.js`: nhân vật khối hình học (chỉ dùng khi thiếu ảnh/model).
- `src/main.js`: renderer, hậu kỳ phát sáng, camera, giao diện.

## Hình nhân vật

App chọn hình cho mỗi agent theo thứ tự ưu tiên: model GLB → ảnh 2.5D → nhân vật dựng bằng khối hình học. Cả ba đều khai báo trong `public/models/manifest.json`.

### Ảnh 2.5D (đang dùng)

`public/characters/*.png` là 7 ảnh figure (nền trong suốt, đã bỏ bệ trưng bày bằng `tools/strip-pedestal.cjs`; ảnh gốc ở `assets/reference/figures/`).

Muốn làm lại ảnh (ví dụ khi có ảnh tham chiếu mới), cài công cụ trong một thư mục riêng ngoài dự án:
```bash
npm install sharp@0.33.5 @imgly/background-removal-node@1.4.5
```
Sau đó chạy `tools/remove-bg.mjs <thư mục ảnh> <thư mục ra>`, rồi chạy `tools/clean-cutouts.cjs <thư mục vào> <thư mục ra>`. Script thứ hai làm đặc mặt nạ, bỏ hiệu ứng nền, lấp lỗ và cắt gọn ảnh. Trong script có vài luật lọc màu riêng cho từng nhân vật.

## Thay nhân vật bằng model 3D (Tripo / Meshy)

Ảnh đầu vào cho từng nhân vật, cắt từ ảnh tham chiếu, nằm trong `assets/reference/` (`naruto.png`, `ino.png`, …).

1. Tạo model từ ảnh bằng Tripo hoặc Meshy (image-to-3D), xuất file `.glb`. Muốn nhân vật đi lại có hoạt ảnh thì bật auto-rig (Meshy).
2. Nén model (khuyến nghị; chế độ mặc định dùng meshopt, app đã hỗ trợ):
   ```bash
   npx @gltf-transform/cli optimize naruto.glb public/models/naruto.glb --texture-compress webp --texture-size 1024
   ```
3. Khai báo trong `public/models/manifest.json`:
   ```json
   { "models": { "naruto": "naruto.glb", "ino": "ino.glb" } }
   ```
4. Tải lại trang. Model được tự co về đúng chiều cao và đặt đứng trên vòng hào quang. Nếu file có clip tên chứa `idle` / `walk` / `run` thì app dùng các clip đó. Nhân vật nào chưa có model hoặc file lỗi thì vẫn giữ nhân vật khối, và console in cảnh báo.

Mã agent: `naruto`, `shikamaru`, `jiraiya`, `sai`, `neji`, `minato`, `ino`.

## AI thật (Claude API)

Khi nhận phong thư, mỗi agent gọi `POST /api/produce` (`functions/api/produce.js`, Cloudflare Pages Function) kèm kết quả của các agent trước. Hàm này gọi Claude API bằng khóa `ANTHROPIC_API_KEY`, khóa không nằm trong mã frontend.

- **Cấu hình trên Cloudflare:** Workers & Pages → dự án → Settings → Variables and Secrets → thêm secret `ANTHROPIC_API_KEY`, rồi deploy lại.
- **Chạy local:** `npm run dev` (Vite) không chạy Functions nên `/api/produce` trả 404 và agent dùng mẫu mô phỏng. Muốn thử AI thật ở local: `npx wrangler pages dev dist` sau `npm run build`, khóa đặt trong `.dev.vars` (đã bị `.gitignore`: thêm dòng `.dev.vars` nếu dùng).
- **Dự phòng:** nếu backend lỗi, chưa có khóa hoặc quá 25 giây, agent dùng hàm `produce(topic)` mẫu trong `src/agents.js`; nhật ký và bảng kết quả ghi rõ "AI thật" hay "mẫu mô phỏng".
- **Chi phí:** mỗi nhiệm vụ gọi 6 lần (model `claude-haiku-5-5`, tối đa 400 token đầu ra). Endpoint chỉ nhận lời gọi cùng nguồn gốc nhưng chưa giới hạn tần suất; nên đặt giới hạn chi tiêu ở Anthropic Console hoặc rate limit ở Cloudflare.
