import { test } from "node:test";
import assert from "node:assert/strict";
import { swipeDirection } from "./swipe.js";

const at = (x, y, t) => ({ x, y, t });

test("a quick sideways drag is a swipe in that direction", () => {
  assert.equal(swipeDirection(at(20, 300, 0), at(180, 320, 250)), "right");
  assert.equal(swipeDirection(at(300, 300, 0), at(120, 290, 300)), "left");
});

test("short, slow or mostly vertical drags are not swipes", () => {
  assert.equal(swipeDirection(at(100, 300, 0), at(140, 300, 100)), null);     // too short
  assert.equal(swipeDirection(at(20, 300, 0), at(220, 300, 1200)), null);     // too slow
  assert.equal(swipeDirection(at(100, 100, 0), at(190, 400, 300)), null);     // mostly vertical
  assert.equal(swipeDirection(at(20, 300, 500), at(220, 300, 100)), null);    // time went backwards
});
