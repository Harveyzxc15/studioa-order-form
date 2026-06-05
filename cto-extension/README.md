# STUDIO A｜Apple 規格擷取 Chrome 擴充

書籤（bookmarklet）的升級版載體。把「在 Apple 台灣官網擷取 Mac 客製規格、帶回訂購單表單」做成 Chrome 擴充（Manifest V3），消除書籤的長期痛點，並解鎖書籤做不到的能力。

## 為什麼用擴充取代書籤
| 書籤痛點 | 擴充如何解決 |
|---|---|
| 舊書籤殘留 →「點了沒反應」 | 不存在；擴充自動注入按鈕 |
| `#` fragment 截斷 script | 不靠書籤 URL，改用 `chrome.runtime` 訊息 |
| 彈窗手勢易碎 | 用 `chrome.tabs` 開/聚焦分頁，不需點擊手勢 |
| 拖曳安裝累積重複書籤 | 載入一次資料夾即可 |
| 產品圖 CORS 汙染 canvas | background `fetch` 圖片轉 dataURL |
| 規格截圖要手動 | 表單端用購物袋明細重繪乾淨規格卡（自動） |

## 安裝（開發者模式，每台一次）
1. Chrome 網址列輸入 `chrome://extensions`
2. 右上角開啟「**開發人員模式**」
3. 按「**載入未封裝項目**」→ 選擇這個 `cto-extension` 資料夾
4. 完成。Apple 頁面右下角會自動出現按鈕。

> 開發人員模式每次啟動 Chrome 會跳一次提示，可忽略。擴充資料夾請固定路徑、勿移動或刪除。
> 機台變多時建議改用 Google Workspace 企業政策 force-install（免提示、自動更新，程式碼不需改）。

## 設定
- `background.js` 最上方的 **`FORM_URL`**：沒有既有表單分頁時用來開新分頁。預設指向 GitHub Pages 的 `index-cto-test.html`。
- `manifest.json` 的表單 `matches` 與 `background.js` 的 `FORM_URL_MATCH`：若表單換網域，兩處都要加上新網址。

## 使用流程
1. 表單選 CTO、填原機型 → 按「🍎 前往 Apple 配置」
2. 在 Apple 配置頁自行選好規格、**手動按「加入購物袋」**（後段附加選項由店員自行處理）
3. 到 Apple 購物袋頁 → 按擴充注入的「📋 擷取規格到訂購單」
4. 表單分頁自動聚焦並回填（含自動產生的規格截圖與產品圖）；多筆購物袋自動只留最新一筆
5. 補原價(起)、客戶姓名/電話/發票 → 下載訂購單 PDF

## 檔案
| 檔案 | 角色 |
|---|---|
| `manifest.json` | MV3 設定、權限、content script 註冊 |
| `scrape.js` | 共用購物袋 DOM 解析（沿用書籤邏輯） |
| `content-apple-bag.js` | 購物袋頁注入按鈕 + 擷取 + 多筆清理 |
| `background.js` | 截圖、抓圖、開/聚焦表單分頁送資料 |
| `content-form.js` | 表單頁：註冊分頁 + 轉 postMessage 給既有表單監聽器 |

## 驗證（end-to-end）
1. `chrome://extensions` 載入本資料夾；`FORM_URL` 指向你的表單。
2. 開表單 → 選 CTO、填原機型 → 按「🍎 前往 Apple 配置」。
3. 在 Apple 配置好規格，**手動加入購物袋**，進入購物袋頁。
4. 購物袋頁確認「📋 擷取規格到訂購單」按鈕出現；點擊 → 表單聚焦並回填，`itemsBefore==itemsAfter==1`。
5. 確認規格卡自動產生（含產品圖）、PDF 內產品圖不因 taint 消失。
6. 多筆購物袋：放 2 筆 → 保留置頂、其餘自動移除、表單提示「已移除 N 筆」。

## 已知限制
- 僅支援 Chrome（Safari 需另包，不在此範圍）。
- 原價(起) 購物袋頁無法取得，請手動補填（同書籤）。
- mailto 無法自動附檔；截圖可自動產生並下載，寄信仍手動。
