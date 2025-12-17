import { TextDecoder } from "node:util";

const UTF8_DECODER = new TextDecoder("utf-8", { fatal: false });
const SHIFT_JIS_DECODER = (() => {
  try {
    return new TextDecoder("shift_jis", { fatal: false });
  } catch (error) {
    console.warn("Shift_JIS デコーダーの初期化に失敗したため UTF-8 にフォールバックします:", error);
    return null;
  }
})();

function countReplacementChars(text: string): number {
  if (!text) {
    return 0;
  }
  const matches = text.match(/\ufffd/g);
  return matches ? matches.length : 0;
}

export function decodeCsvBuffer(buffer: Buffer): string {
  if (!buffer || buffer.length === 0) {
    return "";
  }

  const utf8Text = UTF8_DECODER.decode(buffer);
  const utf8Replacements = countReplacementChars(utf8Text);
  if (utf8Replacements === 0) {
    return utf8Text;
  }

  if (SHIFT_JIS_DECODER) {
    try {
      const shiftJisText = SHIFT_JIS_DECODER.decode(buffer);
      const shiftJisReplacements = countReplacementChars(shiftJisText);
      if (shiftJisReplacements === 0 || shiftJisReplacements < utf8Replacements) {
        return shiftJisText;
      }
    } catch (error) {
      console.warn("Shift_JIS でのデコードに失敗したため UTF-8 を使用します:", error);
    }
  }

  return utf8Text;
}
