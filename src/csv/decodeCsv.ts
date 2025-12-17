import { TextDecoder } from "node:util";

const UTF8_DECODER = new TextDecoder("utf-8", { fatal: false });
const SHIFT_JIS_DECODER = new TextDecoder("shift_jis", { fatal: false });

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

  const shiftJisText = SHIFT_JIS_DECODER.decode(buffer);
  const shiftJisReplacements = countReplacementChars(shiftJisText);
  if (shiftJisReplacements === 0 || shiftJisReplacements < utf8Replacements) {
    return shiftJisText;
  }

  return utf8Text;
}
