# XSMB Dashboard

Dashboard phân tích kết quả Xổ số Miền Bắc từ 2005 đến nay. Ứng dụng là trang tĩnh chạy hoàn toàn trên trình duyệt (React + TypeScript + Vite, Tailwind CSS, Apache ECharts), không cần backend.

Dữ liệu lấy từ thư mục `../data`, được GitHub Action của dự án cập nhật mỗi ngày lúc 18:35.

> Số liệu chỉ mô tả quá khứ. Các kỳ quay độc lập và ngẫu nhiên, nên không thống kê nào ở đây giúp dự đoán kết quả.

## Yêu cầu

- Node.js 20 trở lên (đã thử với Node 24)

## Chạy thử

```sh
cd frontend
npm install
npm run dev        # http://localhost:5173
```

`npm run dev` và `npm run build` tự chạy `npm run copy-data` trước. Script này copy `../data/xsmb-2-digits.json` sang `public/data/` (bỏ khoảng trắng thừa, còn khoảng 2,9 MB) và tạo `xsmb-latest.json` chứa kỳ quay mới nhất với đầy đủ các chữ số. Thư mục `public/data/` không được commit.

## Các lệnh

| Lệnh | Việc |
|---|---|
| `npm run dev` | Chạy server phát triển, tự tải lại khi sửa code |
| `npm run build` | Kiểm tra kiểu (TypeScript) và build ra `dist/` |
| `npm run preview` | Chạy thử bản build trong `dist/` (http://localhost:4173) |
| `npm test` | Chạy unit test một lần |
| `npm run test:watch` | Chạy test ở chế độ theo dõi |
| `npm run lint` | Kiểm tra code bằng oxlint |
| `npm run copy-data` | Copy lại dữ liệu từ `../data` |

## Kiểm thử

### Unit test

```sh
npm test
```

Test nằm cạnh code: [src/utils/lotteryStats.test.ts](src/utils/lotteryStats.test.ts) và [src/services/dataLoader.test.ts](src/services/dataLoader.test.ts). Mỗi test dựng một bộ dữ liệu nhỏ đã biết trước đáp án và kiểm tra:

- bộ lọc thời gian (N kỳ, N năm, khoảng tùy chọn, ngày 29/2);
- tần suất lô và đề, xếp hạng khi bằng nhau;
- lô gan hiện tại, kỷ lục gan, ngưỡng cảnh báo, nhịp rơi, nháy;
- đầu, đuôi, chạm, tổng, đầu câm, đuôi câm, chẵn/lẻ, tài/xỉu;
- ma trận cặp số, lift, xếp hạng cặp;
- giá trị p của kiểm định χ² (so với giá trị tham chiếu và công thức chính xác);
- kiểm tra dữ liệu đầu vào (số ngoài 0–99, ngày trùng).

Các con số trên dữ liệu thật cũng đã được đối chiếu với pandas: tần suất 1 năm (lớn nhất 121, nhỏ nhất 81, trung bình 97,47, độ lệch chuẩn 9,57, khớp README của dự án), lô gan, đầu câm và cặp số.

### Kiểm tra thủ công trước khi phát hành

Chạy `npm run build && npm run preview` rồi kiểm tra:

1. **Tải trang**: thẻ "Kỳ quay mới nhất" hiện đủ 5 chữ số giải ĐB và đúng ngày trong `../data/xsmb.csv`.
2. **Bộ lọc**: lần lượt chọn 30 kỳ, 100 kỳ, 1 năm, Toàn bộ, Tùy chọn. Dòng "N kỳ · ngày – ngày" bên phải và thẻ "Phạm vi phân tích" phải đổi theo. Ở Tùy chọn, đặt ngày bắt đầu sau ngày kết thúc thì hai ngày được tự đổi chỗ.
3. **Lô tô / Đề**: chuyển sang "Đề · Giải ĐB". Tiêu đề thẻ KPI đổi thành "Đề…", tab Cặp số báo không có cặp, bảng đầu câm có giải thích riêng.
4. **Tab 1**: rê chuột vào ô bản đồ nhiệt để thấy tooltip; bấm vào ô, vào cột Top 10 và vào thẻ KPI đều mở chi tiết số. Modal đóng được bằng Esc, nút ×, và bấm ra ngoài.
5. **Tab 2**: đổi cách sắp xếp lô gan; chọn số khác ở mục Nhịp rơi bằng dropdown và nút ‹ ›; kéo thanh trượt dòng thời gian (với khoảng Toàn bộ).
6. **Tab 3**: đổi Radar Đầu & Đuôi / Chạm, Tổng 0–18 / Tổng lô đề, Chẵn/Lẻ / Tài/Xỉu.
7. **Tab 4**: rê chuột vào nút mạng liên kết để làm nổi các cặp; bấm một nút thì danh sách "Số hay về cùng" đổi theo; kéo và cuộn để phóng to.
8. **Link theo tab**: mở `/#streaks`, `/#groups`, `/#pairs` thì phải vào thẳng tab tương ứng.
9. **Điện thoại**: thu cửa sổ còn khoảng 390px (hoặc dùng chế độ thiết bị của DevTools). Trang không được cuộn ngang, thanh lọc xuống dòng hợp lý.
10. **Bàn phím**: dùng Tab/Shift+Tab đi qua bộ lọc, tab và các nút; mọi phần tử đều có viền focus.

## Cấu trúc

```
scripts/copy-data.mjs         copy dữ liệu từ ../data vào public/data
src/services/dataLoader.ts    tải JSON một lần, kiểm tra, chuyển thành Uint8Array gọn
src/utils/lotteryStats.ts     toàn bộ thuật toán thống kê (hàm thuần, không phụ thuộc React)
src/hooks/useAnalysis.ts      nối bộ lọc với thuật toán bằng useMemo
src/lib/echarts.ts            đăng ký các module ECharts cần dùng, bảng màu biểu đồ
src/components/               Header, bộ lọc, thẻ KPI, modal, các panel
src/components/charts/        từng biểu đồ ECharts
src/components/tabs/          4 tab phân tích
```

Quy ước trong `lotteryStats.ts`: "lượt" đếm mọi lần về (kể cả nháy), "kỳ" đếm mỗi kỳ tối đa một lần; gan là số kỳ liên tiếp chưa về; nhịp = gan + 1.

## Cập nhật dữ liệu và triển khai tự động

Workflow [.github/workflows/update-data.yml](../.github/workflows/update-data.yml) chạy trên GitHub Actions:

| Khi nào | Việc làm |
|---|---|
| 18:35 hằng ngày (giờ Việt Nam) | `fetch.py` tải kết quả mới, `analyze.py` vẽ lại biểu đồ, commit vào `main`, rồi build và deploy dashboard lên GitHub Pages |
| 19:05 hằng ngày | Chạy lại để lấy kết quả nếu lần 18:35 gặp kỳ quay chưa xong. Nếu không có gì mới thì không commit và không deploy |
| Khi push thay đổi trong `frontend/` lên `main` | Chỉ build và deploy lại dashboard |
| Bấm "Run workflow" trong tab Actions | Chạy toàn bộ: tải dữ liệu, rồi deploy |

Lịch cron của GitHub có thể trễ vài phút đến vài chục phút vào giờ cao điểm.

`fetch.py` được thiết kế để chạy lặp lại an toàn:
- Tự thử lại tối đa 3 lần khi lỗi mạng hoặc máy chủ trả lỗi 5xx.
- Nếu trang đang quay dở (còn ký tự giữ chỗ hoặc thiếu giải), ngày đó không được lưu. Vòng lặp dừng lại để lần chạy sau tải lại đúng từ ngày đó, còn các ngày đã tải trước đó vẫn được lưu.
- Ngày không có kết quả (ví dụ nghỉ Tết) thì bỏ qua như trước.

Trên trình duyệt, dữ liệu luôn được kiểm tra lại với máy chủ mỗi lần tải trang. Nếu trang đang mở khi có kết quả mới, dashboard hiện thông báo kèm nút "Tải lại". Việc kiểm tra diễn ra 15 phút một lần và mỗi khi quay lại tab.

### Thiết lập lần đầu

1. Đưa dự án lên một repository GitHub của bạn (nhánh `main`).
2. Vào **Settings → Pages**, ở mục **Build and deployment → Source** chọn **GitHub Actions**.
3. Vào tab **Actions**, chọn workflow **Update data**, bấm **Run workflow**.
4. Khi chạy xong, dashboard nằm ở `https://<tên-tài-khoản>.github.io/<tên-repo>/`. Link cũng hiện trong kết quả của job `deploy-dashboard`.

Nếu bước commit báo lỗi quyền ghi, vào **Settings → Actions → General → Workflow permissions** và chọn **Read and write permissions**.

### Cập nhật trên máy khi đang phát triển

```sh
# ở thư mục gốc dự án
python src/fetch.py && python src/analyze.py
# rồi trong frontend/
npm run copy-data       # server dev đang chạy sẽ phục vụ file mới, chỉ cần tải lại trang
```

### Triển khai ở nơi khác

`npm run build` tạo ra trang tĩnh trong `dist/`, gồm cả `dist/data/`. Vì `base: './'`, thư mục này chạy được ở bất kỳ đường dẫn nào (Netlify, Vercel, Cloudflare Pages, web server thường). Nhớ build lại mỗi khi dữ liệu thay đổi.
