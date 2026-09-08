import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { balancesFromActivity, simplifyDebts } from "../src/settle.js";

describe("simplifyDebts", () => {
  it("returns no transfers when everyone is already even", () => {
    assert.deepEqual(
      simplifyDebts([
        { memberId: 1, name: "Ada", cents: 0 },
        { memberId: 2, name: "Bea", cents: 0 },
      ]),
      [],
    );
  });

  it("settles a single debt with one payment", () => {
    const transfers = simplifyDebts([
      { memberId: 1, name: "Ada", cents: 3000 },
      { memberId: 2, name: "Bea", cents: -3000 },
    ]);
    assert.deepEqual(transfers, [
      { fromId: 2, fromName: "Bea", toId: 1, toName: "Ada", amountCents: 3000 },
    ]);
  });

  it("pairs the largest creditor with the largest debtor", () => {
    const transfers = simplifyDebts([
      { memberId: 1, name: "Ada", cents: 6500 },
      { memberId: 2, name: "Bea", cents: 500 },
      { memberId: 3, name: "Cid", cents: -3500 },
      { memberId: 4, name: "Dee", cents: -3500 },
    ]);

    assert.deepEqual(transfers, [
      { fromId: 3, fromName: "Cid", toId: 1, toName: "Ada", amountCents: 3500 },
      { fromId: 4, fromName: "Dee", toId: 1, toName: "Ada", amountCents: 3000 },
      { fromId: 4, fromName: "Dee", toId: 2, toName: "Bea", amountCents: 500 },
    ]);

    const remaining = applyTransfers(
      [
        { memberId: 1, cents: 6500 },
        { memberId: 2, cents: 500 },
        { memberId: 3, cents: -3500 },
        { memberId: 4, cents: -3500 },
      ],
      transfers,
    );
    assert.ok(remaining.every((cents) => cents === 0));
  });
});

describe("balancesFromActivity", () => {
  it("nets paid minus share for each member", () => {
    const members = [
      { id: 1, name: "Ada" },
      { id: 2, name: "Bea" },
      { id: 3, name: "Cid" },
    ];
    const expenses = [
      {
        paidById: 1,
        amountCents: 6000,
        splits: [
          { memberId: 1, amountCents: 2000 },
          { memberId: 2, amountCents: 2000 },
          { memberId: 3, amountCents: 2000 },
        ],
      },
      {
        paidById: 2,
        amountCents: 3000,
        splits: [
          { memberId: 1, amountCents: 1000 },
          { memberId: 2, amountCents: 1000 },
          { memberId: 3, amountCents: 1000 },
        ],
      },
    ];

    assert.deepEqual(balancesFromActivity(members, expenses), [
      { memberId: 1, name: "Ada", cents: 3000 },
      { memberId: 2, name: "Bea", cents: 0 },
      { memberId: 3, name: "Cid", cents: -3000 },
    ]);
  });
});

function applyTransfers(balances, transfers) {
  const map = new Map(balances.map((b) => [b.memberId, b.cents]));
  for (const t of transfers) {
    map.set(t.fromId, map.get(t.fromId) + t.amountCents);
    map.set(t.toId, map.get(t.toId) - t.amountCents);
  }
  return [...map.values()];
}
