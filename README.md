# Split Fair

A small Splitwise-style app for group expenses. Create a trip or household, add people by name (no login), log who paid, and get a simplified settle-up list.

## Run locally

Requires **Node.js 22+** (uses the built-in SQLite module).

```bash
npm install
npm run dev
```

Then open **http://localhost:5173**.

- Vite serves the React UI on port `5173` and proxies `/api` to Express.
- Express listens on **http://localhost:3001** and stores data in `server/data/splitfair.sqlite`.

To run the production build (UI served by Express):

```bash
npm install
npm run build
npm start
```

Open **http://localhost:3001**.

Run unit and API tests:

```bash
npm test
```

## Using the app

1. Create a group and add at least two members.
2. Open the group and log an expense. Equal split divides the amount among the selected people (leftover cents go to the first names). Custom split lets you type an amount per person; those amounts must add up to the expense total.
3. Balances update after each save. The settle-up list shows the minimum greedy set of payments that brings everyone to zero.
4. Leave the group page open — it listens for live updates over Server-Sent Events, so another tab (or person hitting the same local server) will refresh balances automatically.

## Settle-up algorithm

Each member’s **balance** is `amount paid − amount owed`:

- positive → they are a **creditor** (the group owes them)
- negative → they are a **debtor** (they owe the group)
- zero → already settled

Finding the absolute fewest payments is NP-hard. This app uses a clear greedy heuristic:

1. Take the current largest creditor and the current largest debtor.
2. Transfer `min(credit, |debt|)`.
3. Drop anyone who reaches zero and repeat.

That produces **at most n − 1** payments and always nets every balance to zero.

### Example

Four people, two expenses:

| Expense | Payer | Amount | Split |
| --- | --- | --- | --- |
| Cabin | Ada | $100 | equal four ways |
| Gas | Bea | $40 | equal four ways |

Balances:

| Member | Paid | Share | Balance |
| --- | --- | --- | --- |
| Ada | $100 | $35 | **+$65** |
| Bea | $40 | $35 | **+$5** |
| Cid | $0 | $35 | **−$35** |
| Dee | $0 | $35 | **−$35** |

Greedy matching:

1. Cid (largest debtor, $35) pays Ada (largest creditor, $65) → **$35**. Ada still owed $30.
2. Dee ($35) pays Ada ($30) → **$30**. Dee still owes $5.
3. Dee ($5) pays Bea ($5) → **$5**.

Three payments, everyone at zero. Without netting you would need a payment for every pairwise share; the greedy pass collapses that to a short list.

## Project layout

```
client/     React + Vite UI
server/     Express API + SQLite + settle-up math
```
