import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { addExpense, addMember, deleteExpense, getGroup } from "../api.js";
import { formatMoney, signedBalance } from "../format.js";

export default function GroupPage() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [memberName, setMemberName] = useState("");

  useEffect(() => {
    let cancelled = false;
    getGroup(id)
      .then((next) => {
        if (!cancelled) setData(next);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      });

    const source = new EventSource(`/api/groups/${id}/events`);
    source.onmessage = () => {
      getGroup(id)
        .then((next) => {
          if (!cancelled) setData(next);
        })
        .catch(() => {});
    };
    source.onerror = () => {};

    return () => {
      cancelled = true;
      source.close();
    };
  }, [id]);

  if (error) {
    return (
      <div className="card">
        <Link className="back" to="/">
          ← All groups
        </Link>
        <div className="error">{error}</div>
      </div>
    );
  }

  if (!data) {
    return <p>Loading group…</p>;
  }

  async function onAddMember(event) {
    event.preventDefault();
    try {
      const next = await addMember(id, memberName);
      setData(next);
      setMemberName("");
      setError("");
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="stack">
      <div>
        <Link className="back" to="/">
          ← All groups
        </Link>
        <h1>{data.group.name}</h1>
        <p>Log expenses, watch balances, and settle with as few payments as possible.</p>
      </div>

      {error ? <div className="error">{error}</div> : null}

      <section className="card">
        <div className="section-head">
          <h2>Members</h2>
        </div>
        <div className="chips">
          {data.members.map((member) => (
            <span className="chip" key={member.id}>
              {member.name}
            </span>
          ))}
        </div>
        <form className="row" style={{ marginTop: 12 }} onSubmit={onAddMember}>
          <input
            value={memberName}
            onChange={(e) => setMemberName(e.target.value)}
            placeholder="Add another person"
          />
          <button className="button secondary" type="submit">
            Add
          </button>
        </form>
      </section>

      <div className="grid-2">
        <div className="stack">
          <ExpenseForm
            members={data.members}
            onSave={async (payload) => {
              const next = await addExpense(id, payload);
              setData(next);
            }}
          />
          <ExpenseList
            expenses={data.expenses}
            onDelete={async (expenseId) => {
              const next = await deleteExpense(id, expenseId);
              setData(next);
            }}
          />
        </div>
        <div className="stack">
          <Balances balances={data.balances} />
          <SettleUp settlements={data.settlements} />
        </div>
      </div>
    </div>
  );
}

function ExpenseForm({ members, onSave }) {
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [paidById, setPaidById] = useState(members[0]?.id ?? "");
  const [splitType, setSplitType] = useState("equal");
  const [splitWith, setSplitWith] = useState(members.map((m) => m.id));
  const [custom, setCustom] = useState(() => Object.fromEntries(members.map((m) => [m.id, ""])));
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setPaidById((current) =>
      members.some((m) => m.id === current) ? current : (members[0]?.id ?? ""),
    );
    setSplitWith((current) => {
      const ids = new Set(members.map((m) => m.id));
      const kept = current.filter((id) => ids.has(id));
      return kept.length ? kept : members.map((m) => m.id);
    });
    setCustom((current) => {
      const next = {};
      for (const member of members) next[member.id] = current[member.id] ?? "";
      return next;
    });
  }, [members]);

  const customSum = useMemo(
    () =>
      Object.values(custom).reduce((sum, value) => {
        const n = Number(value);
        return sum + (Number.isFinite(n) ? n : 0);
      }, 0),
    [custom],
  );

  async function onSubmit(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await onSave({
        description,
        amount: Number(amount),
        paidById: Number(paidById),
        splitType,
        splitWith,
        splits: members.map((member) => ({
          memberId: member.id,
          amount: custom[member.id] === "" ? 0 : Number(custom[member.id]),
        })),
      });
      setDescription("");
      setAmount("");
      setCustom(Object.fromEntries(members.map((m) => [m.id, ""])));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card">
      <h2>Add an expense</h2>
      <form className="stack" onSubmit={onSubmit}>
        <label>
          Description
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Groceries, taxi, rent…"
            required
          />
        </label>
        <label>
          Amount
          <input
            type="number"
            min="0.01"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            required
          />
        </label>
        <label>
          Paid by
          <select value={paidById} onChange={(e) => setPaidById(Number(e.target.value))}>
            {members.map((member) => (
              <option key={member.id} value={member.id}>
                {member.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Split
          <select value={splitType} onChange={(e) => setSplitType(e.target.value)}>
            <option value="equal">Equal split</option>
            <option value="custom">Custom amounts</option>
          </select>
        </label>

        {splitType === "equal" ? (
          <div className="split-grid">
            {members.map((member) => (
              <label className="check" key={member.id}>
                <input
                  type="checkbox"
                  checked={splitWith.includes(member.id)}
                  onChange={(e) => {
                    setSplitWith((current) =>
                      e.target.checked
                        ? [...current, member.id]
                        : current.filter((id) => id !== member.id),
                    );
                  }}
                />
                {member.name}
              </label>
            ))}
          </div>
        ) : (
          <div className="split-grid">
            {members.map((member) => (
              <label className="split-row" key={member.id}>
                {member.name}
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={custom[member.id] ?? ""}
                  onChange={(e) =>
                    setCustom((current) => ({ ...current, [member.id]: e.target.value }))
                  }
                  placeholder="0.00"
                />
              </label>
            ))}
            <p className="hint">
              Custom amounts so far: ${customSum.toFixed(2)}
              {amount ? ` of $${Number(amount).toFixed(2)}` : ""}
            </p>
          </div>
        )}

        {error ? <div className="error">{error}</div> : null}
        <div className="actions">
          <button className="button" type="submit" disabled={busy || members.length === 0}>
            {busy ? "Saving…" : "Save expense"}
          </button>
        </div>
      </form>
    </section>
  );
}

function ExpenseList({ expenses, onDelete }) {
  return (
    <section className="card">
      <h2>Expenses</h2>
      {expenses.length === 0 ? (
        <div className="empty">
          <strong>No expenses yet</strong>
          <p>Add one on the left. Equal split is the default; switch to custom when shares differ.</p>
        </div>
      ) : (
        expenses.map((expense) => (
          <div className="expense-row" key={expense.id}>
            <div>
              <strong>{expense.description}</strong>
              <div className="meta">
                {expense.paidByName} paid {formatMoney(expense.amountCents)} ·{" "}
                {expense.splitType === "equal" ? "equal split" : "custom split"}
              </div>
            </div>
            <button className="button ghost" type="button" onClick={() => onDelete(expense.id)}>
              Remove
            </button>
          </div>
        ))
      )}
    </section>
  );
}

function Balances({ balances }) {
  return (
    <section className="card">
      <h2>Balances</h2>
      {balances.every((b) => b.cents === 0) ? (
        <div className="empty">
          <strong>Everyone is even</strong>
          <p>Balances appear after the first expense.</p>
        </div>
      ) : (
        balances.map((balance) => {
          const tone = signedBalance(balance.cents);
          return (
            <div className="balance-row" key={balance.memberId}>
              <span>{balance.name}</span>
              <span className={tone.className}>{tone.label}</span>
            </div>
          );
        })
      )}
    </section>
  );
}

function SettleUp({ settlements }) {
  return (
    <section className="card">
      <h2>Settle up</h2>
      {settlements.length === 0 ? (
        <div className="empty">
          <strong>No payments needed</strong>
          <p>This list uses greedy matching: largest creditor with largest debtor, until all balances hit zero.</p>
        </div>
      ) : (
        settlements.map((row, index) => (
          <div className="settle-row" key={`${row.fromId}-${row.toId}-${index}`}>
            <span>
              <strong>{row.fromName}</strong> pays <strong>{row.toName}</strong>
            </span>
            <span className="is-credit">{formatMoney(row.amountCents)}</span>
          </div>
        ))
      )}
    </section>
  );
}
