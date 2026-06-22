import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const {
  createLinePath,
  createAreaPath,
  createSparklinePoints,
  findSeriesBounds,
} = require("./charts.js");

test("findSeriesBounds returns stable extents for mixed values", () => {
  assert.deepEqual(findSeriesBounds([5, 14, 2, 9]), {
    min: 2,
    max: 14,
    range: 12,
  });
});

test("createSparklinePoints maps values into chart coordinates", () => {
  const points = createSparklinePoints([10, 20, 15], { width: 120, height: 40, padding: 4 });
  assert.deepEqual(points[0], { x: 4, y: 36 });
  assert.equal(points.length, 3);
  assert.equal(points[1].x, 60);
});

test("createLinePath and createAreaPath generate svg path strings", () => {
  const points = createSparklinePoints([4, 8, 6], { width: 90, height: 30, padding: 3 });
  assert.match(createLinePath(points), /^M /);
  assert.match(createAreaPath(points, { height: 30, padding: 3 }), /^M /);
});
