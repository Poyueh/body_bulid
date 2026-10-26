# 體態導航站 · Body Compass

**GitHub Pages：** https://poyueh.github.io/body_bulid/

以 HTML + JavaScript 呈現體態、營養、運動、能量平衡趨勢；使用 Supabase Auth 與 RLS 保護登入使用者的雲端資料。

## 一次性設定

1. 在 [Supabase](https://supabase.com/dashboard) 建立專案與 Authentication Email 使用者。
2. 在 SQL Editor 建立 `public.dashboard_data`，欄位為 `user_id uuid primary key references auth.users(id)`、`data jsonb`、`updated_at timestamptz default now()`；啟用 RLS，只允許 `auth.uid()=user_id` 的 authenticated 使用者讀寫。
3. 在 Authentication → URL Configuration 設定 Site URL / Redirect URL：`https://poyueh.github.io/body_bulid/`。
4. 在 GitHub Pages 網站登入（使用 Authentication → Users 內的 Email／密碼；不是 GitHub 登入）。若尚未設定密碼，用網站的「忘記密碼」。
5. **首次登入**若雲端沒有資料，匯入先前於 ChatGPT 下載的 `體態導航站_舊資料匯入_2026-10-26.json`。檔案**不放在公開倉庫**。
6. 之後任何裝置以相同帳號登入，即可讀取／修改相同雲端資料。當前頁面重新取得焦點、切回分頁，或約每分鐘會檢查是否有別處的新紀錄。

## 同步與備份

- 每次新增或修改資料後自動向 Supabase 寫入整份 JSON。
- 若斷線，儲存在此瀏覽器的**未同步草稿**中。看到「未同步」請重試，換裝置之前請匯出 JSON。
- 為防止跨裝置覆蓋，同步使用 `updated_at` 版本檢查；衝突時必須手動決定讀取雲端或以本機覆蓋。此同步方式是單份 JSON 快照，**不支援多裝置同時編輯後自動合併**。
- 「編輯與備份」可匯出完整 JSON；Supabase Free 沒有你自己可依賴的自動資料庫備份，請定期備份。
- 首次匯入應優先使用聊天中提供的原始 JSON；若此前已在舊版 GitHub 網站修改，首次登入畫面也提供「使用這個瀏覽器的舊版記錄」。
- 本站的雲端同步只發生於**網站內操作**。在 ChatGPT 對話中回報飲食，**尚不會自動寫入 Supabase**。

## 安全與公開資訊

- `cloud-sync.js` 包含 **Project URL + Publishable Key**，這是設計上可放在前端的資料；**不得**放入 Supabase Secret Key、`service_role` 金鑰、資料庫密碼或使用者登入密碼。
- Supabase RLS 必須維持啟用。建議在 Authentication → Sign In / Providers 關閉非必要的公開註冊。
- 新版 `index.html` 不再內嵌體重、飲食或個人健康原始資料。
- **但舊版含歷史紀錄的 `index.html` 曾提交到公開 GitHub，過去的 commit 仍可能被外部存取。** 若需要完整移除公開 Git 歷史資料，應進行經確認的 Git 歷史重寫、建立乾淨新倉庫或後續的 GitHub 資料清理；單純刪除目前網頁內容並不會刪除歷史。
- 登入畫面是使用者介面限制；真正的資料存取權限由 Supabase Auth 和 RLS 保證。

## 專案檔案

- `index.html`：靜態儀表板、原有圖表與紀錄編輯介面、登入畫面
- `cloud-sync.js`：登入、忘記密碼、資料讀寫、衝突處理、離線草稿
- `.github/workflows/pages.yml`：GitHub Pages 自動部署
- `.github/workflows/validate.yml`：JavaScript 語法與公開健康資料種子檢查

> 本站屬於個人資料管理工具，營養估算與穿戴裝置數據不等於醫療診斷。
