import { Router } from "express";
import { equalSplit, dollarsToCents, assertSplitsSum } from "./money.js";
import { balancesFromActivity, simplifyDebts } from "./settle.js";
import { broadcast, subscribe } from "./events.js";

export function createRouter(queries) {
  const router = Router();

  router.get("/health", (_req, res) => {
    res.json({ ok: true });
  });

  router.get("/groups", (_req, res) => {
    res.json({ groups: queries.listGroups() });
  });

  router.post("/groups", (req, res) => {
    const name = cleanName(req.body?.name, "Group name");
    const memberNames = parseMemberNames(req.body?.members);
    if (memberNames.length < 2) {
      throw httpError(400, "Add at least two members");
    }

    const result = queries.transaction(() => {
      const created = queries.insertGroup(name);
      const groupId = Number(created.lastInsertRowid);
      for (const memberName of memberNames) {
        queries.insertMember(groupId, memberName);
      }
      return groupId;
    });
    res.status(201).json(loadGroupPayload(queries, result));
  });

  router.get("/groups/:id", (req, res) => {
    res.json(requireGroup(queries, req.params.id));
  });

  router.get("/groups/:id/events", (req, res) => {
    requireGroup(queries, req.params.id);
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders();
    res.write(":\n\n");
    subscribe(req.params.id, res);
  });

  router.post("/groups/:id/members", (req, res) => {
    const group = requireGroupRecord(queries, req.params.id);
    const name = cleanName(req.body?.name, "Member name");
    const existing = queries.listMembers(group.id);
    if (existing.some((m) => m.name.toLowerCase() === name.toLowerCase())) {
      throw httpError(400, "That name is already in this group");
    }
    queries.insertMember(group.id, name);
    broadcast(group.id);
    res.status(201).json(loadGroupPayload(queries, group.id));
  });

  router.post("/groups/:id/expenses", (req, res) => {
    const group = requireGroupRecord(queries, req.params.id);
    const members = queries.listMembers(group.id);
    const memberIds = new Set(members.map((m) => m.id));

    const description = cleanName(req.body?.description, "Description");
    const amountCents = parseCents(req.body?.amount);
    if (amountCents <= 0) {
      throw httpError(400, "Amount must be greater than zero");
    }

    const paidById = Number(req.body?.paidById);
    if (!memberIds.has(paidById)) {
      throw httpError(400, "Payer must be a member of this group");
    }

    const splitType = req.body?.splitType === "custom" ? "custom" : "equal";
    const splits = buildSplits({ splitType, amountCents, body: req.body, memberIds });

    queries.transaction(() => {
      const expense = queries.insertExpense(
        group.id,
        description,
        amountCents,
        paidById,
        splitType,
      );
      const expenseId = Number(expense.lastInsertRowid);
      for (const split of splits) {
        queries.insertSplit(expenseId, split.memberId, split.amountCents);
      }
    });

    broadcast(group.id);
    res.status(201).json(loadGroupPayload(queries, group.id));
  });

  router.delete("/groups/:id/expenses/:expenseId", (req, res) => {
    const group = requireGroupRecord(queries, req.params.id);
    const result = queries.deleteExpense(Number(req.params.expenseId), group.id);
    if (result.changes === 0) {
      throw httpError(404, "Expense not found");
    }
    broadcast(group.id);
    res.json(loadGroupPayload(queries, group.id));
  });

  return router;
}

function buildSplits({ splitType, amountCents, body, memberIds }) {
  if (splitType === "equal") {
    const selected = (body.splitWith ?? []).map(Number);
    const unique = [...new Set(selected)].filter((id) => memberIds.has(id));
    try {
      return equalSplit(amountCents, unique);
    } catch (err) {
      throw httpError(400, err.message);
    }
  }

  const rawSplits = Array.isArray(body.splits) ? body.splits : [];
  const splits = [];
  const seen = new Set();
  for (const entry of rawSplits) {
    const memberId = Number(entry.memberId);
    if (!memberIds.has(memberId)) {
      throw httpError(400, "Each split must belong to a group member");
    }
    if (seen.has(memberId)) {
      throw httpError(400, "Each member can only appear once in a custom split");
    }
    seen.add(memberId);
    const amount = parseCents(entry.amount ?? 0);
    if (amount < 0) {
      throw httpError(400, "Split amounts cannot be negative");
    }
    if (amount > 0) {
      splits.push({ memberId, amountCents: amount });
    }
  }
  if (!splits.length) {
    throw httpError(400, "Enter at least one custom split amount");
  }
  try {
    assertSplitsSum(amountCents, splits);
  } catch (err) {
    throw httpError(400, err.message);
  }
  return splits;
}

function requireGroup(queries, id) {
  const group = requireGroupRecord(queries, id);
  return loadGroupPayload(queries, group.id);
}

function requireGroupRecord(queries, id) {
  const group = queries.getGroup(Number(id));
  if (!group) throw httpError(404, "Group not found");
  return group;
}

function loadGroupPayload(queries, groupId) {
  const group = queries.getGroup(groupId);
  const members = queries.listMembers(groupId);
  const expenses = queries.listExpenses(groupId).map((expense) => ({
    ...expense,
    splits: queries.listSplitsForExpense(expense.id),
  }));
  const balances = balancesFromActivity(members, expenses);
  const settlements = simplifyDebts(balances);
  return { group, members, expenses, balances, settlements };
}

function parseCents(amount) {
  try {
    return dollarsToCents(amount);
  } catch (err) {
    throw httpError(400, err.message);
  }
}

function parseMemberNames(input) {
  const list = Array.isArray(input) ? input : typeof input === "string" ? input.split(",") : [];
  const names = [];
  const seen = new Set();
  for (const item of list) {
    const name = String(item ?? "").trim();
    if (!name) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    names.push(name);
  }
  return names;
}

function cleanName(value, label) {
  const name = String(value ?? "").trim();
  if (!name) throw httpError(400, `${label} is required`);
  return name;
}

function httpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}
