import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { createGroup, listGroups } from "../api.js";

export default function HomePage() {
  const navigate = useNavigate();
  const [groups, setGroups] = useState([]);
  const [name, setName] = useState("");
  const [members, setMembers] = useState([]);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    listGroups()
      .then((data) => setGroups(data.groups))
      .catch((err) => setError(err.message));
  }, []);

  function addMember() {
    const next = draft.trim();
    if (!next) return;
    if (members.some((m) => m.toLowerCase() === next.toLowerCase())) {
      setError("That name is already in the list");
      return;
    }
    setMembers([...members, next]);
    setDraft("");
    setError("");
  }

  async function onSubmit(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const created = await createGroup({ name, members });
      navigate(`/groups/${created.group.id}`);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <div className="stack">
      <section className="card">
        <h1>Split a group expense</h1>
        <p>
          Create a trip or household, add people by name, then log who paid.
          Balances and a simplified settle-up list stay in sync as you go.
        </p>
        <form className="stack" onSubmit={onSubmit}>
          <label>
            Group name
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Cabin weekend, Apartment 4B…"
              required
            />
          </label>
          <label>
            Add members
            <div className="row">
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Ada"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addMember();
                  }
                }}
              />
              <button className="button secondary" type="button" onClick={addMember}>
                Add
              </button>
            </div>
          </label>
          <div className="chips">
            {members.map((member) => (
              <span className="chip" key={member}>
                {member}
                <button
                  type="button"
                  aria-label={`Remove ${member}`}
                  onClick={() => setMembers(members.filter((m) => m !== member))}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
          <p className="hint">Add at least two people. No accounts needed.</p>
          {error ? <div className="error">{error}</div> : null}
          <div className="actions">
            <button className="button" type="submit" disabled={busy}>
              {busy ? "Creating…" : "Create group"}
            </button>
          </div>
        </form>
      </section>

      <section className="card">
        <h2>Your groups</h2>
        {groups.length === 0 ? (
          <div className="empty">
            <strong>No groups yet</strong>
            <p>Start with the form above. A group is just a name and the people sharing costs.</p>
          </div>
        ) : (
          <div className="group-list">
            {groups.map((group) => (
              <Link className="group-link" key={group.id} to={`/groups/${group.id}`}>
                <strong>{group.name}</strong>
                <span className="meta">
                  {group.memberCount} members · {group.expenseCount} expenses
                </span>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
