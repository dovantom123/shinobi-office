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

## AI thật (từng nhân vật)

Mỗi nhân vật gọi backend `POST /api/produce` (Cloudflare Pages Functions trong `functions/`). Frontend chỉ gửi `characterId`, chủ đề và đầu ra của nhân vật trước; **provider, model, khóa, chỉ dẫn vai trò và schema đầu ra nằm hết ở server** (`functions/_lib/config.js`). Đầu ra được kiểm tra theo schema trước khi hiển thị.

| Nhân vật | Đầu vào | Đầu ra | Model mặc định |
|---|---|---|---|
| Shikamaru | chủ đề | tóm tắt, khán giả, insight, góc nội dung (chưa tra web, không có nguồn) | claude-haiku-5-5 |
| Jiraiya | chủ đề + Shikamaru | tiêu đề, caption, bài viết, hashtag, giả định | claude-sonnet-5-5 |
| Sai | + Jiraiya | brief thiết kế, bố cục, prompt ảnh (chưa tạo ảnh) | **Google** gemini-3.8-flash |
| Neji | + Sai | kết luận duyệt/sửa/không duyệt, vấn đề, tuyên bố thiếu căn cứ (đánh giá của AI) | claude-haiku-5-5 |
| Minato | + Jiraiya, múi giờ | lịch đề xuất (chưa lên lịch/đăng thật) | claude-haiku-5-5 |
| Ino | + Jiraiya, bình luận do người dùng nhập | bản nháp trả lời (chưa gửi); bỏ qua nếu không có bình luận | claude-haiku-5-5 |
| Naruto | tất cả kết quả | báo cáo tổng hợp, rủi ro, việc cho con người | claude-sonnet-5-5 |

- **Provider hỗ trợ:** Anthropic (Claude, khóa `ANTHROPIC_API_KEY`), Google (Gemini Interactions API, khóa `GEMINI_API_KEY`, hiện chỉ Sai dùng) và OpenAI (Responses API, khóa `OPENAI_API_KEY`, model `gpt-6.1-sol`, chưa nhân vật nào dùng). Khóa Google phải tạo ở Google AI Studio; gói Google AI Pro không kèm quyền gọi API. Kết nối Google chưa được kiểm chứng với khóa thật. Ngoài ra có provider thử nghiệm `cheapkey` (cổng bên thứ ba tương thích OpenAI, `https://cheapkeyai.shop/v1`, khóa `CHEAPKEY_API_KEY`, model `gpt-5-mini`): chỉ bật khi đặt `PROVIDER_<TÊN>=cheapkey`, ví dụ `PROVIDER_SAI=cheapkey`; bỏ biến đó để quay lại provider mặc định. Dịch vụ này ẩn danh và nội dung đi qua máy chủ của họ, chưa kiểm chứng với dịch vụ thật. Mỗi nhân vật chọn provider/model trong `functions/_lib/config.js`; thiếu khóa của provider nào thì chỉ nhân vật dùng provider đó báo chưa cấu hình. Model Anthropic hợp lệ theo tài liệu chính thức: `claude-haiku-5-5`, `claude-sonnet-5-5`, `claude-opus-5-5`, `claude-fable-5-1`. Đổi model từng nhân vật bằng biến `MODEL_<TÊN>` (xem `.env.example`), không cần sửa mã.
- **Cấu hình trên Cloudflare:** Workers & Pages → dự án → Settings → Variables and Secrets (môi trường Production) → thêm secret `ANTHROPIC_API_KEY`, (và `GEMINI_API_KEY` cho Sai), rồi deploy lại (biến mới chỉ áp cho lần deploy sau).
- **Chạy local:** `npm run dev` (Vite) không chạy Functions nên giao diện báo "chưa có backend" và nhiệm vụ dừng ở bước đầu. Thử với AI thật: `npm run build` rồi `npx wrangler pages dev dist`, khóa đặt trong `.dev.vars`.
- **Không có dữ liệu mẫu thay thế:** thiếu khóa, khóa sai, timeout hoặc API lỗi thì nhiệm vụ dừng tại nhân vật đó và hiện đúng nguyên nhân. Hoạt cảnh chỉ là trình diễn; nhân vật chỉ "hoàn thành" khi có kết quả thật. Tốc độ mô phỏng không làm tăng số lần gọi API.
- **Chọn nhân vật** để xem nguồn AI, model, trạng thái và bấm **Kiểm tra kết nối** (chỉ gọi khi bạn bấm; tốn một lời gọi rất nhỏ).
- **Chi phí và bảo vệ:** endpoint công khai nên ai mở trang cũng tiêu được khóa của bạn. Đã có: chỉ nhận cùng nguồn gốc, giới hạn 40 lượt/10 phút/IP và chặn yêu cầu trùng, nhưng các giới hạn này nằm trong bộ nhớ từng worker (chỉ là lớp phụ). Hãy đặt thêm Cloudflare Rate Limiting hoặc Access, và hạn mức chi tiêu ở Anthropic Console.
- **Kiểm thử:** `npm test` chạy 30 kiểm thử backend bằng mock (không cần khóa, không gọi API thật).
