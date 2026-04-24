# Trip Split — 旅遊分帳 Web App

> 出門玩，輕鬆算。免登入，用連結分享。

一個給朋友出遊使用的分帳工具：建立房間 → 分享連結給同伴 → 大家加入並記錄花費 → 系統自動算出最少轉帳次數。支援多幣別、平分/手動分攤、即時同步。

## 主要功能

- **零登入**：建立房間後將網址丟給朋友即可使用
- **多幣別**：支援 TWD / JPY / USD / EUR，依精度自動處理小數
- **兩種分攤模式**：
  - 平分模式：自動將總額平均分配（向上取整避免短收）
  - 手動模式：自訂每人金額，送出前驗證加總是否等於總額
- **即時同步**：透過 Supabase Realtime，任一裝置新增成員或花費，所有頁面立即更新
- **智慧結算**：以 Greedy Match 演算法計算最少轉帳次數
- **快速結清**：點一下勾勾即可記錄一筆轉帳

## 技術棧

| 類別 | 使用技術 |
|------|----------|
| 框架 | Next.js 16 (App Router) + React 19 |
| 語言 | TypeScript 5 |
| UI | Tailwind CSS 4 + shadcn/ui + @base-ui/react |
| 圖示 | lucide-react |
| 後端 / 資料庫 | Supabase (PostgreSQL + Realtime) |
| 部署 | Vercel |

> ⚠️ **Next.js 16 注意事項**：本專案使用 Next.js 16，與舊版 API 有差異。修改前請參考 `node_modules/next/dist/docs/`，相關規則寫在 `AGENTS.md`。

## 專案結構

```
src/
├── app/
│   ├── page.tsx                    建立房間首頁
│   ├── layout.tsx                  根 Layout（字型、metadata）
│   ├── globals.css                 全域樣式
│   └── room/[id]/
│       ├── page.tsx                房間頁（orchestrator，組合各子元件）
│       ├── _hooks/
│       │   └── useRoomData.ts      Supabase 資料 fetch + Realtime 訂閱
│       └── _components/
│           ├── MemberCard.tsx      成員列表 + 加入表單
│           ├── ExpenseForm.tsx     新增花費 Dialog
│           ├── SettlementCard.tsx  結算清單 + 建議轉帳
│           └── ExpenseList.tsx     花費紀錄列表
├── components/ui/                  shadcn/ui 共用元件
└── lib/
    ├── supabase.ts                 Supabase client
    ├── currencies.ts               幣別常數
    ├── types.ts                    共用型別 (Member, Expense)
    └── utils.ts                    cn() className 合併
```

> Next.js App Router 慣例：`_` 開頭的資料夾不會被當作路由。

## 本地開發

### 1. 安裝依賴

```bash
npm install
```

### 2. 設定環境變數

在專案根目錄建立 `.env.local`：

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

### 3. 建立資料表

在 Supabase 後台 SQL Editor 執行 `supabase_schema.sql` 內的指令。

### 4. 啟動開發伺服器

```bash
npm run dev
```

開啟 http://localhost:3000 即可看到結果。

## 常用指令

```bash
npm run dev      # 開發模式（Turbopack）
npm run build    # 建置 production 版本
npm run start    # 啟動 production server
npm run lint     # ESLint 檢查
npx tsc --noEmit # TypeScript 型別檢查
```

## 資料庫 Schema

三張表，全部使用 UUID 主鍵：

- **`rooms`** — 分帳房間（`id`, `name`, `created_at`）
- **`members`** — 房間成員（`id`, `room_id`, `name`, `created_at`）
- **`expenses`** — 花費紀錄（`id`, `room_id`, `description`, `amount`, `currency`, `paid_by`, `split_among`, `created_at`）

`expenses.split_among` 為 JSONB，相容兩種格式：
- 陣列 `["uuid1", "uuid2"]`：平分（舊格式）
- 物件 `{"uuid1": 100, "uuid2": 50}`：指定金額（新格式）

完整建表 SQL 在 `supabase_schema.sql`。

## 核心演算法

### 1. 平分模式取整

```ts
const perPerson = Math.ceil((total / count) * factor) / factor;
```

例如 100 / 3 = 34（不是 33.33），確保付款人不會短收。

### 2. Greedy Match 結算（位於 `_components/SettlementCard.tsx`）

1. 計算每人淨收支：付款 − 應分攤
2. 將正數（債權人）由大到小排序、負數（債務人）由小到大排序
3. 從債務最多的人付給債權最多的人，每次抵銷其中一方
4. 結果產生最少數量的轉帳

## 部署

專案連結 Vercel + GitHub，`main` 分支 push 後自動部署。

需在 Vercel 設定環境變數：
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## 未來規劃

- [ ] 收據圖片上傳（Supabase Storage）
- [ ] 房間過期自動清理
- [ ] 圖表統計（Recharts）
- [ ] 即時匯率 API 串接（目前同幣別僅做過濾，未做換算）
- [ ] PWA 支援
