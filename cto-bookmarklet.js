/* ==========================================================================
 *  STUDIO A — CTO Apple 規格擷取書籤（bookmarklet 原始碼 / 可讀版 v3）
 * --------------------------------------------------------------------------
 *  使用流程（全部由人員手動，書籤只按一次）：
 *    1. 在本表單選 CTO、填「原存貨代碼／原產品名稱」，按「🍎 前往 Apple 配置」
 *       （這會把基本機型記到 localStorage，供回填時算「只列變動規格」）
 *    2. 在 Apple 台灣頁自己點選好客製規格
 *    3. 自己截圖訂製總覽（mailto 無法自動附圖）
 *    4. 自己按「加入購物袋」
 *    5. 到「購物袋」頁，按一次本書籤 → 從購物袋擷取 機型/規格/客製後價格/購物袋網址
 *       → 自動開啟表單帶入（規格只列與基本機型不同處）
 *
 *  為什麼在購物袋頁抓？購物袋頁展開「顯示產品詳細資訊」後有完整且乾淨的規格，
 *  且這頁的網址正是使用者要的「加入購物袋後的網址」。一次按完成，不需擋畫面、
 *  不需自動加入購物袋。
 *
 *  ⚠️ 原價(起)：只在「商品配置頁」才有（NT$xxxxx 起），購物袋頁沒有，
 *     故 v3 不自動帶原價，由人員手動補。
 *
 *  維護：依賴 Apple 購物袋 DOM（bag-item-*, item-macdetails-link, bag-item-name,
 *        Monthly_price 等），改版時需更新。FORM_URL 由測試頁動態注入。
 * ========================================================================== */
(function () {
  'use strict';
  var FORM_URL = '__FORM_URL__';

  function cl(s) { return (s || '').replace(/\s+/g, ' ').trim(); }
  function isBagPage() { return /\/shop\/bag/.test(location.pathname); }

  if (!isBagPage()) {
    alert('請先自己在 Apple 完成：①點選客製規格 ②截圖訂製總覽 ③加入購物袋，\n'
        + '然後到「購物袋」頁面，再按一次本書籤即可帶回表單。');
    return;
  }

  // 機型 → Apple 購買頁 slug（用來重建 step=attach 網址）
  function modelSlug(head) {
    if (/MacBook\s*Pro/i.test(head)) return 'macbook-pro';
    if (/MacBook\s*Air/i.test(head)) return 'macbook-air';
    if (/Mac\s*Studio/i.test(head)) return 'mac-studio';
    if (/Mac\s*mini/i.test(head)) return 'mac-mini';
    if (/Mac\s*Pro/i.test(head)) return 'mac-pro';
    if (/iMac/i.test(head)) return 'imac';
    return '';
  }

  // 擷取單筆購物袋商品 → { pname, fullSpecs:[{cat,text}], newprice, productUrl }
  function scrapeBagItem(item) {
    var head = cl((item.querySelector('[data-autom="bag-item-name"]') || {}).textContent || '');
    var specs = [];
    var mc = head.match(/^(\S+?)\s*\d+\s*吋/); if (mc) specs.push({ cat: 'color', text: mc[1] });
    var ms = head.match(/(\d+)\s*吋/);          if (ms) specs.push({ cat: 'size', text: ms[1] + ' 吋' });
    var mh = head.match(/配備\s*(.+?)\s*晶片/);  if (mh) specs.push({ cat: 'chip', text: cl(mh[1]) });

    var hw = item.querySelector('ul.list, ul[class*="list"]'); // 第一個清單＝硬體
    if (hw) {
      [].slice.call(hw.querySelectorAll('li')).forEach(function (li) {
        var t = cl(li.textContent);
        if (/核心\s*CPU/.test(t)) specs.push({ cat: 'cores', text: t.split('、').filter(function (x) { return /CPU|GPU/.test(x); }).join('、') });
        else if (/記憶體/.test(t)) { var m = t.match(/\d+\s*GB/); specs.push({ cat: 'memory', text: m ? m[0] : t }); }
        else if (/SSD|儲存/.test(t)) { var s = t.match(/\d+\s*(TB|GB)/); specs.push({ cat: 'storage', text: s ? s[0] : t }); }
        else if (/顯示器/.test(t) && !/外接|支援|埠/.test(t)) specs.push({ cat: 'display', text: t });
        else if (/電源轉接器|電源供應器/.test(t)) specs.push({ cat: 'power', text: t });
        else if (/鍵盤|Keyboard/.test(t)) specs.push({ cat: 'keyboard', text: t });
      });
    }
    var p = cl((item.querySelector('[data-autom="Monthly_price"]') || {}).textContent || '').match(/NT\$[\d,]+/);

    // 重建「加入購物袋後」的網址：產品代碼藏在 data-evar1="Cart||<代碼>"
    //   CTO 客製＝Z 碼(如 Z1N2)；標準配置＝完整料號(如 MDE54TA/A，含斜線)
    var code = itemCode(item);
    var slug = modelSlug(head);
    var productUrl = (code && slug)
      ? 'https://www.apple.com/tw/shop/buy-mac/' + slug + '?product=' + code + '&step=attach'
      : '';

    // 完整明細（給表單重繪「規格明細卡」用）：硬體=第一個清單、軟體=第二個
    var lists = item.querySelectorAll('ul.list, ul[class*="list"]');
    function liTexts(ul) {
      return ul ? [].slice.call(ul.querySelectorAll('li')).map(function (li) { return cl(li.textContent); }).filter(Boolean) : [];
    }
    var imgEl = item.querySelector('img');
    var detail = {
      hardware: liTexts(lists[0]),
      software: liTexts(lists[1]),
      img: imgEl ? (imgEl.currentSrc || imgEl.src || '') : '',
      price: p ? p[0] : ''
    };

    return { pname: head, fullSpecs: specs, newprice: p ? p[0].replace(/[^\d]/g, '') : '', productUrl: productUrl, detail: detail };
  }

  var wait = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
  function getItems() {
    return [].slice.call(document.querySelectorAll('[data-autom^="bag-item-"]'))
             .filter(function (e) { return /^bag-item-\d+$/.test(e.getAttribute('data-autom')); });
  }
  function itemCode(it) {
    var c = '';
    [].slice.call(it.querySelectorAll('[data-evar1]')).some(function (e) {
      var parts = (e.getAttribute('data-evar1') || '').split('||');
      var v = (parts[1] || '').trim();         // Cart||<代碼> → 取代碼（Z1N2 或 MDE54TA/A）
      if (/^[A-Z0-9][A-Z0-9/.\-]{2,}$/i.test(v)) { c = v; return true; }
      return false;
    });
    return c;
  }

  // 主流程：全程同步取資料（購物袋明細即使收合也已在 DOM，毋需展開/等待），
  //         在「點擊手勢」當下直接開表單分頁 → 不會被彈窗攔截、不卡 about:blank。
  var items = getItems();
  if (!items.length) { alert('購物袋是空的，或讀不到商品。請確認已加入購物袋。'); return; }

  var keep = items[0];                                  // Apple 購物袋置頂 = 最新加入
  var data = scrapeBagItem(keep);
  data.bagUrl = data.productUrl || location.href;       // 優先用重建的 ?product=...&step=attach
  if (items.length > 1) data.extraCount = items.length - 1;   // 供表單提示「已移除 N 筆」
  var keepCode = itemCode(keep);

  // 交付資料：
  //  優先 → 直接 postMessage 給「原表單分頁」(opener，由 goToApple 開啟本頁時建立) 並聚焦它，不另開分頁。
  //  後備 → 沒有 opener（例如直接開 Apple，非走按鈕）→ 用網址開/重用表單分頁。
  //  （注意：書籤碼內不可出現字面 '#'，會被當網址片段截斷；故用 fromCharCode(35) 組出。）
  var delivered = false;
  if (window.opener && !window.opener.closed) {
    try { window.opener.postMessage({ __studioa_cto: data }, '*'); delivered = true; } catch (e) {}
  }
  if (!delivered) {
    var url = FORM_URL + String.fromCharCode(35) + 'cto=' + encodeURIComponent(JSON.stringify(data));
    var w = window.open(url, 'studioa_cto_form');
    if (w) delivered = true; else location.href = url;
  }

  // 交付完畢後聚焦表單分頁（不關閉 Apple 分頁）
  // window.open('', name) 在使用者手勢中可切換到同名已開啟的分頁，
  // 比 opener.focus() 更可靠（後者常被瀏覽器跨來源封鎖）。
  if (delivered) { try { window.open('', 'studioa_cto_form'); } catch (e) {} }

  // 多筆：交付成功後自動移除其他筆（只刪代碼≠保留筆者，永不誤刪保留筆）
  if (items.length > 1 && delivered) {
    (async function () {
      for (var g = 0; g < 12; g++) {
        var cur = getItems();
        if (cur.length <= 1) break;
        var victim = null;
        for (var i = 0; i < cur.length; i++) { if (itemCode(cur[i]) !== keepCode) { victim = cur[i]; break; } }
        if (!victim) break;                              // 辨識不出（無代碼）就不亂刪
        var rm = victim.querySelector('[data-autom="bag-item-remove-button"]');
        if (!rm) break;
        rm.click();
        await wait(900);
      }
    })();
  }
})();
