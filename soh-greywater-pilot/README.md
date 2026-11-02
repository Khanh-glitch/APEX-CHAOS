# Soul of Hero — Map Lab Studio

Công cụ thiết kế bản đồ (browser, offline) cho Soul of Hero + bản đồ thế giới khởi tạo (**đề xuất của agent, chưa phải canon**).

- **Chạy ngay (Windows, không cài đặt):** tải `public/downloads/SoulOfHero_MapLab_Studio.zip` (hoặc `/downloads/SoulOfHero_MapLab_Studio.zip` khi app đang chạy) → giải nén → bấm đúp `Open_MapLab.bat`.
- **Web (Next.js):** `npm run build && npm start` → trang `/` là chính editor.
- **Hướng dẫn thao tác PC:** `USER_GUIDE.md` · **Nghiên cứu open-source:** `OPEN_SOURCE_RESEARCH.md` · **QA:** `QA_REPORT.md` · **License bên thứ ba:** `THIRD_PARTY_LICENSES.md`.
- **Mã nguồn lõi:** `src/maplab/` (`types`, `geom`, `terrain`, `seed`, `graph`, `analysis`, `validate`, `render`, `store`, `interact`, `smart`, `exporter`, `ui/`).
- **Dựng lại bản offline:** `node scripts/bundle.mjs src/maplab/standalone.tsx out.html` · **Đóng gói ZIP:** `node scripts/package.mjs`.
- **Kiểm thử trình duyệt:** `qa/qa.mjs`, `qa/qa_extra.mjs` (Playwright), ảnh chụp thật trong `qa/screens/`.
