const PRE_SHARED_KEY = "testpsk"; 

function doGet(e) {
  // 1. ライブラリ読み込み
  eval(UrlFetchApp.fetch('https://cdnjs.cloudflare.com/ajax/libs/crypto-js/4.1.1/crypto-js.min.js').getContentText());

  // 2. 【修正箇所】GAS環境用の乱数生成パッチ
  // GASにはNative Cryptoがないため、Math.randomで代用する関数で上書きします
  CryptoJS.lib.WordArray.random = function (nBytes) {
    var words = [];
    for (var i = 0; i < nBytes; i += 4) {
      // 完全な暗号学的強度ではありませんが、GASで動作させるための回避策です
      words.push((Math.random() * 0x100000000) | 0);
    }
    return new CryptoJS.lib.WordArray.init(words, nBytes);
  };

  // 3. スプレッドシートデータ取得
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
  const data = sheet.getDataRange().getDisplayValues();
  const csvString = data.map(row => {
    return row.map(cell => {
      let str = cell.toString().replace(/"/g, '""');
      if (/[",\n]/.test(str)) str = `"${str}"`;
      return str;
    }).join(",");
  }).join("\n");

  // 4. 暗号化 (AES-CBC)
  const keyHash = CryptoJS.SHA256(PRE_SHARED_KEY);
  // パッチを当てた random 関数がここで使われます
  const iv = CryptoJS.lib.WordArray.random(16); 
  
  const encrypted = CryptoJS.AES.encrypt(csvString, keyHash, { 
    iv: iv,
    mode: CryptoJS.mode.CBC,
    padding: CryptoJS.pad.Pkcs7
  });

  // 5. 返却
  const responsePayload = {
    iv: CryptoJS.enc.Hex.stringify(iv),
    ciphertext: encrypted.toString()
  };

  const resp = JSON.stringify(responsePayload);
  console.log(resp);
  return ContentService.createTextOutput(resp)
    .setMimeType(ContentService.MimeType.JSON);
}
