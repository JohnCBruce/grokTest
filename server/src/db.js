import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function defaultDbPath() {
  return path.join(__dirname, "..", "data", "splitfair.sqlite");
}

export function openDb(dbPath = process.env.SPLITFAIR_DB ?? defaultDbPath()) {
  if (dbPath !== ":memory:") {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  }

  const db = new DatabaseSync(dbPath);
  db.exec("PRAGMA foreign_keys = ON");
  if (dbPath !== ":memory:") {
    db.exec("PRAGMA journal_mode = WAL");
  }
  db.exec(`
    CREATE TABLE IF NOT EXISTS groups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS members (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      group_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS expenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      group_id INTEGER NOT NULL,
      description TEXT NOT NULL,
      amount_cents INTEGER NOT NULL,
      paid_by_id INTEGER NOT NULL,
      split_type TEXT NOT NULL CHECK (split_type IN ('equal', 'custom')),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE,
      FOREIGN KEY (paid_by_id) REFERENCES members(id)
    );

    CREATE TABLE IF NOT EXISTS expense_splits (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      expense_id INTEGER NOT NULL,
      member_id INTEGER NOT NULL,
      amount_cents INTEGER NOT NULL,
      FOREIGN KEY (expense_id) REFERENCES expenses(id) ON DELETE CASCADE,
      FOREIGN KEY (member_id) REFERENCES members(id)
    );
  `);
  return db;
}

export function createQueries(db) {
  return {
    listGroups: db.prepare(`
      SELECT
        g.id,
        g.name,
        g.created_at AS createdAt,
        COUNT(DISTINCT m.id) AS memberCount,
        COUNT(DISTINCT e.id) AS expenseCount
      FROM groups g
      LEFT JOIN members m ON m.group_id = g.id
      LEFT JOIN expenses e ON e.group_id = g.id
      GROUP BY g.id
      ORDER BY g.created_at DESC
    `),
    getGroup: db.prepare(`SELECT id, name, created_at AS createdAt FROM groups WHERE id = ?`),
    insertGroup: db.prepare(`INSERT INTO groups (name) VALUES (?)`),
    insertMember: db.prepare(`INSERT INTO members (group_id, name) VALUES (?, ?)`),
    listMembers: db.prepare(`
      SELECT id, group_id AS groupId, name, created_at AS createdAt
      FROM members
      WHERE group_id = ?
      ORDER BY id
    `),
    getMember: db.prepare(`SELECT id, group_id AS groupId, name FROM members WHERE id = ?`),
    listExpenses: db.prepare(`
      SELECT
        e.id,
        e.group_id AS groupId,
        e.description,
        e.amount_cents AS amountCents,
        e.paid_by_id AS paidById,
        m.name AS paidByName,
        e.split_type AS splitType,
        e.created_at AS createdAt
      FROM expenses e
      JOIN members m ON m.id = e.paid_by_id
      WHERE e.group_id = ?
      ORDER BY e.id DESC
    `),
    insertExpense: db.prepare(`
      INSERT INTO expenses (group_id, description, amount_cents, paid_by_id, split_type)
      VALUES (?, ?, ?, ?, ?)
    `),
    insertSplit: db.prepare(`
      INSERT INTO expense_splits (expense_id, member_id, amount_cents)
      VALUES (?, ?, ?)
    `),
    listSplitsForExpense: db.prepare(`
      SELECT
        s.member_id AS memberId,
        m.name AS memberName,
        s.amount_cents AS amountCents
      FROM expense_splits s
      JOIN members m ON m.id = s.member_id
      WHERE s.expense_id = ?
      ORDER BY s.id
    `),
    deleteExpense: db.prepare(`DELETE FROM expenses WHERE id = ? AND group_id = ?`),
  };
}
