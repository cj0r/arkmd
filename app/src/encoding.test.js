import { test } from "node:test";
import assert from "node:assert/strict";
import { decodeBytes, NotTextError, MAX_BYTES } from "./encoding.js";

const bytes = (...a) => Uint8Array.from(a);
const enc = (s) => new TextEncoder().encode(s);

test("valid UTF-8 is returned as is, including a BOM-less accented file", () => {
  assert.deepEqual(decodeBytes(enc("café — ✓")), { text: "café — ✓", encoding: "utf-8" });
  assert.deepEqual(decodeBytes(new Uint8Array()), { text: "", encoding: "utf-8" });
});

test("a Windows-1252 file is decoded as that, not turned into replacement characters", () => {
  const r = decodeBytes(bytes(0x63, 0x61, 0x66, 0xe9, 0x20, 0x93, 0x68, 0x69, 0x94));   // café “hi”
  assert.equal(r.encoding, "windows-1252");
  assert.equal(r.text, "café “hi”");
  assert.ok(!r.text.includes("�"));
});

test("UTF-16 files are recognised by their byte order mark", () => {
  assert.deepEqual(decodeBytes(bytes(0xff, 0xfe, 0x68, 0x00, 0x69, 0x00)), { text: "hi", encoding: "utf-16le" });
  assert.deepEqual(decodeBytes(bytes(0xfe, 0xff, 0x00, 0x68, 0x00, 0x69)), { text: "hi", encoding: "utf-16be" });
});

test("binary data and oversized files are refused", () => {
  assert.throws(() => decodeBytes(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00)), NotTextError);
  assert.throws(() => decodeBytes(new Uint8Array(MAX_BYTES + 1)), /more than ArkMD opens/);
});
