function hexToBytes(hex) {
  if (typeof hex !== "string" || hex.length === 0 || hex.length % 2 !== 0) {
    throw new Error("IV の形式が不正です");
  }
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    const byte = Number.parseInt(hex.slice(i, i + 2), 16);
    if (Number.isNaN(byte)) {
      throw new Error("IV をバイト列に変換できませんでした");
    }
    bytes[i / 2] = byte;
  }
  return bytes;
}

function base64ToBytes(base64) {
  if (typeof base64 !== "string" || base64.length === 0) {
    throw new Error("ciphertext の形式が不正です");
  }
  try {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`暗号文のデコードに失敗しました: ${message}`);
  }
}

async function deriveAesKey(preSharedKey) {
  if (typeof preSharedKey !== "string" || preSharedKey.trim().length === 0) {
    throw new Error("PSK を入力してください");
  }
  const encoder = new TextEncoder();
  const keyMaterial = encoder.encode(preSharedKey);
  const hashed = await crypto.subtle.digest("SHA-256", keyMaterial);
  return crypto.subtle.importKey("raw", hashed, { name: "AES-CBC" }, false, ["decrypt"]);
}

async function decryptSpreadsheetPayload(payload, preSharedKey) {
  if (!payload || typeof payload !== "object") {
    throw new Error("レスポンスの形式が不正です");
  }
  const { iv, ciphertext } = payload;
  if (typeof iv !== "string" || typeof ciphertext !== "string") {
    throw new Error("レスポンスに必要なフィールドがありません");
  }

  const ivBytes = hexToBytes(iv);
  const cipherBytes = base64ToBytes(ciphertext);
  const key = await deriveAesKey(preSharedKey);
  try {
    const decrypted = await crypto.subtle.decrypt(
      {
        name: "AES-CBC",
        iv: ivBytes,
      },
      key,
      cipherBytes,
    );
    const decoder = new TextDecoder();
    return decoder.decode(decrypted);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`復号に失敗しました: ${message}`);
  }
}

export async function fetchSpreadsheetCsv(endpoint, preSharedKey) {
  if (!endpoint || typeof endpoint !== "string" || endpoint.trim().length === 0) {
    throw new Error("エンドポイントを入力してください");
  }
  if (typeof preSharedKey !== "string" || preSharedKey.trim().length === 0) {
    throw new Error("PSK を入力してください");
  }

  const trimmedEndpoint = endpoint.trim();
  const trimmedPsk = preSharedKey.trim();

  let response;
  try {
    response = await fetch(trimmedEndpoint, { method: "GET" });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`スプレッドシートの取得に失敗しました: ${message}`);
  }

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(
      `スプレッドシートの取得に失敗しました (${response.status}): ${detail || "通信エラー"}`,
    );
  }

  let payload;
  try {
    payload = await response.json();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`レスポンスをJSONとして解釈できませんでした: ${message}`);
  }

  const decrypted = await decryptSpreadsheetPayload(payload, trimmedPsk);
  if (!decrypted || decrypted.trim().length === 0) {
    throw new Error("スプレッドシートのデータが空でした");
  }
  return decrypted;
}
