# Trip Split: 專案開發與維護指南 (Maintenance Guide)

這份文件旨在紀錄 **Trip Split** 分帳 Web App 的開發邏輯與維護流程，方便未來進行功能擴充或 Bug 修復。

## 1. 核心技術棧 (Tech Stack)
*   **前端/後端框架：** Next.js 15 (App Router) - 利用 Serverless API 達成免維護伺服器。
*   **樣式與 UI：** Tailwind CSS 4 + shadcn/ui - 提供手機優先 (Mobile-first) 的流暢體驗。
*   **資料庫：** Supabase (PostgreSQL) - 提供 Realtime 即時更新與免費的資料儲存。
*   **部署平台：** Vercel - 與 GitHub 連動，達成自動化部署 (CI/CD)。

## 2. 資料庫綱要 (Database Schema)
目前在 Supabase 中使用了三個主要的資料表：
*   **`rooms`**：存儲分帳房間資訊。
    *   `id` (UUID): 房間唯一識別碼，也是 URL 的一部分。
    *   `name` (Text): 房間名稱。
*   **`members`**：存儲房間內的成員。
    *   `id` (UUID): 成員 ID。
    *   `room_id` (UUID): 關聯至房間。
    *   `name` (Text): 成員暱稱。
*   **`expenses`**：存儲花費與轉帳紀錄。
    *   `description` (Text): 花費說明 (例如：[轉帳] A 給 B)。
    *   `amount` (Decimal): 總金額。
    *   `paid_by` (UUID): 付款人 ID。
    *   `split_among` (JSONB): 分攤成員 ID 列表 (陣列形式)。

## 3. 核心分帳演算法邏輯
演算法位於 `src/app/room/[id]/page.tsx` 的 `useMemo` 中：

### A. 整數分帳 (Integer Split)
*   **邏輯**：每筆花費平分時，使用 `Math.ceil(總額 / 分攤人數)` 向上取整。
*   **辛苦補償**：系統會假設付款人「代墊了調整後的總額」，使其最終實際支出比其他人少一點點，補償其墊款的辛勞與轉帳的瑣碎。

### B. 債務簡化 (Greedy Match)
*   **邏輯**：統計每個人的「淨收支」。
*   **流程**：每次從「欠錢最多的人」拿錢交給「應收錢最多的人」，直到所有人債務歸零。這能保證產生最少的轉帳次數。

## 4. 如何新增功能？
*   **修改 UI**：主要邏輯與視圖都在 `src/app/room/[id]/page.tsx`。
*   **修改資料庫**：去 Supabase 後台 SQL Editor 執行 SQL 指令，並更新 `supabase_schema.sql` 備份。
*   **新增 API**：Next.js 的 Server Actions 或 API Routes 可用於更複雜的後端邏輯。

## 5. 常見維護流程
*   **修改代碼**：本地執行 `npm run dev` 測試。
*   **提交變更**：`git add .` -> `git commit -m "說明"` -> `git push origin main`。
*   **線上同步**：推送後 Vercel 會自動更新網址。
*   **環境變數**：若 Supabase 更換專案，需同步更新 Vercel 上的 `NEXT_PUBLIC_SUPABASE_URL` 與 `NEXT_PUBLIC_SUPABASE_ANON_KEY`。

## 6. 未來擴充建議 (Roadmap)
*   **多幣別支持**：在 `expenses` 增加幣別欄位與匯率換算。
*   **收據圖片**：整合 Supabase Storage 存放照片。
*   **刪除房間**：增加一個過期自動清理或手動刪除的機制。
*   **圖表統計**：使用 Recharts 顯示各類花費比例。

---
*文件建立日期：2026年4月12日*
