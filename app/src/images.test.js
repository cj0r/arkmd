import { test } from "node:test";
import assert from "node:assert/strict";
import { extensionForType, isImagePath, pastedStem, altFromPath, pastesAsImage } from "./images.js";

test("extensionForType maps MIME types", () => {
  assert.equal(extensionForType("image/png"), "png");
  assert.equal(extensionForType("IMAGE/JPEG"), "jpg");
  assert.equal(extensionForType("text/plain"), null);
  assert.equal(extensionForType(undefined), null);
});

test("isImagePath checks the extension", () => {
  assert.equal(isImagePath("/a/b/pic.PNG"), true);
  assert.equal(isImagePath("notes.md"), false);
  assert.equal(isImagePath(""), false);
});

test("pastedStem is a sortable timestamp", () => {
  assert.equal(pastedStem(new Date(2026, 10, 2, 4, 5, 6)), "pasted-20261102-040506");
});

test("altFromPath makes readable alt text", () => {
  assert.equal(altFromPath("/x/holiday_photo-1.png"), "holiday photo 1");
  assert.equal(altFromPath("C:\\pics\\Cat.JPG"), "Cat");
  assert.equal(altFromPath(""), "");
});

test("a clipboard with a picture and no text pastes as an image", () => {
  const png = { kind: "file", type: "image/png" }, text = { kind: "string", type: "text/plain" }, html = { kind: "string", type: "text/html" };
  assert.equal(pastesAsImage([png]), true);
  assert.equal(pastesAsImage([html, png]), true);       // a screenshot tool may add html but no plain text
  assert.equal(pastesAsImage([text, png]), false);      // a spreadsheet copy: paste the text
  assert.equal(pastesAsImage([text]), false);
  assert.equal(pastesAsImage(undefined), false);
});
