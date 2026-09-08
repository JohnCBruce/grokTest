import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import express from "express";
import { createQueries, openDb } from "../src/db.js";
import { createRouter } from "../src/routes.js";

let server;
let baseUrl;
let db;

describe("API", () => {
  before(async () => {
    db = openDb(":memory:");
    const app = express();
    app.use(express.json());
    app.use("/api", createRouter(createQueries(db)));
    app.use((err, _req, res, _next) => {
      res.status(err.status ?? 500).json({ error: err.message });
    });
    await new Promise((resolve) => {
      server = app.listen(0, "127.0.0.1", resolve);
    });
    const { port } = server.address();
    baseUrl = `http://127.0.0.1:${port}`;
  });

  after(async () => {
    await new Promise((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
    db.close();
  });

  it("creates a group, logs equal and custom expenses, and settles to zero", async () => {
    const created = await api("POST", "/api/groups", {
      name: "Cabin weekend",
      members: ["Ada", "Bea", "Cid"],
    });
    assert.equal(created.members.length, 3);
    const [ada, bea, cid] = created.members;
    const groupId = created.group.id;

    await api("POST", `/api/groups/${groupId}/expenses`, {
      description: "Groceries",
      amount: 90,
      paidById: ada.id,
      splitType: "equal",
      splitWith: [ada.id, bea.id, cid.id],
    });

    const afterCustom = await api("POST", `/api/groups/${groupId}/expenses`, {
      description: "Gas",
      amount: 30,
      paidById: bea.id,
      splitType: "custom",
      splits: [
        { memberId: ada.id, amount: 10 },
        { memberId: bea.id, amount: 10 },
        { memberId: cid.id, amount: 10 },
      ],
    });

    const adaBal = afterCustom.balances.find((b) => b.memberId === ada.id);
    const beaBal = afterCustom.balances.find((b) => b.memberId === bea.id);
    const cidBal = afterCustom.balances.find((b) => b.memberId === cid.id);
    assert.equal(adaBal.cents, 5000);
    assert.equal(beaBal.cents, -1000);
    assert.equal(cidBal.cents, -4000);

    assert.equal(afterCustom.settlements.length, 2);
    const net = applySettlements(afterCustom.balances, afterCustom.settlements);
    assert.ok(net.every((cents) => cents === 0));
  });

  it("keeps serving after many reads and writes", async () => {
    for (let i = 0; i < 25; i += 1) {
      const listed = await api("GET", "/api/groups");
      assert.ok(Array.isArray(listed.groups));
      const created = await api("POST", "/api/groups", {
        name: `Loop ${i}`,
        members: ["Ada", "Bea"],
      });
      assert.equal(created.members.length, 2);
    }
  });

  it("rejects custom splits that do not sum to the amount", async () => {
    const created = await api("POST", "/api/groups", {
      name: "Dinner",
      members: ["Ada", "Bea"],
    });
    const [ada, bea] = created.members;
    const error = await api(
      "POST",
      `/api/groups/${created.group.id}/expenses`,
      {
        description: "Pizza",
        amount: 40,
        paidById: ada.id,
        splitType: "custom",
        splits: [
          { memberId: ada.id, amount: 10 },
          { memberId: bea.id, amount: 10 },
        ],
      },
      { expectOk: false },
    );
    assert.equal(error.status, 400);
    assert.match(error.body.error, /must add up to 40.00/);
  });

  async function api(method, path, body, { expectOk = true } = {}) {
    const res = await fetch(`${baseUrl}${path}`, {
      method,
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json();
    if (expectOk) {
      assert.ok(res.ok, data.error ?? res.statusText);
      return data;
    }
    return { status: res.status, body: data };
  }
});

function applySettlements(balances, settlements) {
  const map = new Map(balances.map((b) => [b.memberId, b.cents]));
  for (const t of settlements) {
    map.set(t.fromId, map.get(t.fromId) + t.amountCents);
    map.set(t.toId, map.get(t.toId) - t.amountCents);
  }
  return [...map.values()];
}
