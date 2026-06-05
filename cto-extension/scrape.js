/* ==========================================================================
 *  STUDIO A — CTO 擴充：共用抓取模組（Apple 購物袋 DOM 解析）
 * --------------------------------------------------------------------------
 *  由 content-apple-bag.js 使用。邏輯直接沿用既有 cto-bookmarklet.js 的
 *  scrapeBagItem / itemCode / modelSlug / getItems，確保資料契約與書籤一致：
 *    { pname, fullSpecs:[{cat,text}], newprice, productUrl, detail }
 *
 *  維護：依賴 Apple 購物袋 DOM（bag-item-*, bag-item-name, Monthly_price,
 *        data-evar1="Cart||<代碼>" 等），Apple 改版時需同步更新。
 * ========================================================================== */
(function () {
  'use strict';
  var NS = (window.__StudioACTO = window.__StudioACTO || {});

  function cl(s) { return (s || '').replace(/\s+/g, ' ').trim(); }

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

  // 產品代碼：藏在 data-evar1="Cart||<代碼>"。CTO=Z 碼(Z1N2)；標準=完整料號(MDE54TA/A，含斜線)
  function itemCode(it) {
    var c = '';
    [].slice.call(it.querySelectorAll('[data-evar1]')).some(function (e) {
      var parts = (e.getAttribute('data-evar1') || '').split('||');
      var v = (parts[1] || '').trim();
      if (/^[A-Z0-9][A-Z0-9/.\-]{2,}$/i.test(v)) { c = v; return true; }
      return false;
    });
    return c;
  }

  // 購物袋商品清單（bag-item-1, bag-item-2 ...，置頂=最新加入）
  function getItems() {
    return [].slice.call(document.querySelectorAll('[data-autom^="bag-item-"]'))
             .filter(function (e) { return /^bag-item-\d+$/.test(e.getAttribute('data-autom')); });
  }

  // 擷取單筆 → { pname, fullSpecs, newprice, productUrl, detail }
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

    var code = itemCode(item);
    var slug = modelSlug(head);
    var productUrl = (code && slug)
      ? 'https://www.apple.com/tw/shop/buy-mac/' + slug + '?product=' + code + '&step=attach'
      : '';

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

  NS.cl = cl;
  NS.modelSlug = modelSlug;
  NS.itemCode = itemCode;
  NS.getItems = getItems;
  NS.scrapeBagItem = scrapeBagItem;
})();
