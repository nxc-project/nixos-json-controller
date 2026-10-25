import assert from "node:assert/strict";
import test from "node:test";
import { takePackageStateBatch } from "./discover-package-state-queue.ts";

test("takes at most 40 package IDs and leaves the rest queued", () => {
  const pending = new Set(
    Array.from({ length: 42 }, (_, index) => `package-${index}`),
  );

  const batch = takePackageStateBatch(pending);

  assert.equal(batch.length, 40);
  assert.deepEqual(
    batch,
    Array.from({ length: 40 }, (_, index) => `package-${index}`),
  );
  assert.deepEqual([...pending], ["package-40", "package-41"]);
});

test("returns an empty batch for an empty queue", () => {
  const pending = new Set<string>();

  assert.deepEqual(takePackageStateBatch(pending), []);
  assert.equal(pending.size, 0);
});
