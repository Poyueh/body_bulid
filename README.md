# 體態導航站 Body Compass

互動式體態、營養、訓練和熱量收支儀表板。

## 網站
[GitHub Pages](https://poyueh.github.io/body_bulid/)（須先在 Repository → Settings → Pages → Build and deployment → Source 選擇 **GitHub Actions**，再從 Actions 重新執行 Deploy dashboard to GitHub Pages）。

主頁：`index.html`。部署流程：`.github/workflows/pages.yml`。

## 資料儲存與同步
- 現有版本使用瀏覽器 localStorage，能保存同一瀏覽器的修改，但不同裝置**不會自動同步**。
- 跨裝置手動同步：在「編輯與備份」點「下載完整 JSON」，到另一台裝置使用「匯入 JSON」。修改後要再匯出新檔。
- 若需**真正自動同步**：建議建立受登入保護的私人資料庫（例如 Supabase Auth + Postgres + Row Level Security），讓每個帳號只能讀寫自己的資料。前端公開的匿名 key 搭配正確的 RLS 可以使用；切勿把 service_role key、個人存取 token 或密碼放進前端 HTML / GitHub repo。
- 此網站目前的種子資料**內嵌在公開的 index.html 中**，代表任何訪客都可能閱讀歷史資料；未來轉用私人雲端同步時，應改成不含個人資料的公開 HTML，把資料儲存在私有資料庫中。

## 後續需要設定
1. 在 GitHub Settings → Pages 設定 Source: GitHub Actions。
2. 到 [Actions](https://github.com/Poyueh/body_bulid/actions) 重新執行部署；確認網址能開啟。
3. 若想要跨裝置即時同步，建立 Supabase 專案及登入方式，再為本儀表板接入經過權限保護的雲端資料表。部署與資料庫是分開的兩件事。

> 注意：檔案裡包含個人健康與運動紀錄。公開 repo / GitHub Pages 不適合保存私人原始資料。
