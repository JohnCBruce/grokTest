import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { assertSplitsSum, dollarsToCents, equalSplit } from "../src/money.js";

describe("dollarsToCents", () => {
  it("rounds common decimal amounts without float drift", () => {
    assert.equal(dollarsToCents(19.99), 1999);
    assert.equal(dollarsToCents("10.10"), 1010);
    assert.equal(dollarsToCents(0.1 + 0.2), 30);
  });

  it("rejects invalid amounts", () => {
    assert.throws(() => dollarsToCents("abc"), /number/);
    assert.throws(() => dollarsToCents(-1), /negative/);
  });
});

describe("equalSplit", () => {
  it("divides leftover cents across the first members", () => {
    const splits = equalSplit(1000, [1, 2, 3]);
    assert.deepEqual(
      splits.map((s) => s.amountCents),
      [334, 333, 333],
    );
    assert.equal(
      splits.reduce((sum, s) => sum + s.amountCents, 0),
      1000,
    );
  });

  it("requires at least one member", () => {
    assert.throws(() => equalSplit(100, []), /at least one member/);
  });
});

describe("assertSplitsSum", () => {
  it("accepts splits that match the total", () => {
    assert.doesNotThrow(() =>
      assertSplitsSum(500, [
        { memberId: 1, amountCents: 200 },
        { memberId: 2, amountCents: 300 },
      ]),
    );
  });

  it("rejects splits that miss the total", () => {
    assert.throws(
      () => assertSplitsSum(500, [{ memberId: 1, amountCents: 200 }]),
      /must add up to 5.00/,
    );
  });
});
