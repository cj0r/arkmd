// Turning the bytes of a file into text without damaging it. ArkMD reads and writes UTF-8. A file in another encoding
// would come out with replacement characters, and saving would write that damage back, so it is detected here and the
// caller opens a decoded copy instead of the original.

/** Largest file ArkMD opens: a bigger one would freeze the editor, and no note is this large. */
export const MAX_BYTES = 20 * 1024 * 1024;

export class NotTextError extends Error {}

/** Whether the start of the file looks binary (a NUL byte never appears in text, except in UTF-16 which has a BOM). */
function looksBinary(bytes) {
  for (let i = 0, n = Math.min(bytes.length, 8000); i < n; i++) if (bytes[i] === 0) return true;
  return false;
}

/**
 * { text, encoding } for the bytes. encoding is "utf-8" for a file that can be edited and saved safely; otherwise the
 * name of the encoding the text was read as ("utf-16le", "utf-16be" or "windows-1252"), and the file must not be
 * saved over. Throws NotTextError for a file that is too large or is not text.
 */
export function decodeBytes(input) {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  if (bytes.length > MAX_BYTES) throw new NotTextError(`This file is ${(bytes.length / 1048576).toFixed(0)} MB, which is more than ArkMD opens (${MAX_BYTES / 1048576} MB).`);
  if (bytes[0] === 0xff && bytes[1] === 0xfe) return { text: new TextDecoder("utf-16le").decode(bytes.subarray(2)), encoding: "utf-16le" };
  if (bytes[0] === 0xfe && bytes[1] === 0xff) return { text: new TextDecoder("utf-16be").decode(bytes.subarray(2)), encoding: "utf-16be" };
  if (looksBinary(bytes)) throw new NotTextError("This doesn't look like a text file.");
  try {
    return { text: new TextDecoder("utf-8", { fatal: true }).decode(bytes), encoding: "utf-8" };
  } catch {
    return { text: new TextDecoder("windows-1252").decode(bytes), encoding: "windows-1252" };
  }
}

/** The error a read throws for a file that isn't UTF-8; `notUtf8` carries the decoded copy. */
export function notUtf8Error(result) {
  const e = new Error(`The file is not UTF-8 (read as ${result.encoding})`);
  e.notUtf8 = result;
  return e;
}
