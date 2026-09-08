/**
 * Greedy settle-up: repeatedly pair the current largest creditor
 * with the current largest debtor until every balance is zero.
 *
 * Each member's balance is paid − share. Positive means they are owed
 * money; negative means they owe. Transfers never exceed either side's
 * remaining balance, so the result always nets to zero.
 *
 * This is a standard O(n²) heuristic. Finding a globally minimal number
 * of payments is NP-hard; this greedy pass produces at most n − 1
 * transfers and is easy to verify.
 */
export function simplifyDebts(balances) {
  const creditors = [];
  const debtors = [];

  for (const balance of balances) {
    if (balance.cents > 0) {
      creditors.push({ ...balance });
    } else if (balance.cents < 0) {
      debtors.push({ ...balance });
    }
  }

  const transfers = [];

  while (creditors.length > 0 && debtors.length > 0) {
    creditors.sort((a, b) => b.cents - a.cents);
    debtors.sort((a, b) => a.cents - b.cents);

    const creditor = creditors[0];
    const debtor = debtors[0];
    const amount = Math.min(creditor.cents, -debtor.cents);

    transfers.push({
      fromId: debtor.memberId,
      fromName: debtor.name,
      toId: creditor.memberId,
      toName: creditor.name,
      amountCents: amount,
    });

    creditor.cents -= amount;
    debtor.cents += amount;

    if (creditor.cents === 0) creditors.shift();
    if (debtor.cents === 0) debtors.shift();
  }

  return transfers;
}

export function balancesFromActivity(members, expenses) {
  const paid = new Map(members.map((m) => [m.id, 0]));
  const share = new Map(members.map((m) => [m.id, 0]));

  for (const expense of expenses) {
    paid.set(expense.paidById, (paid.get(expense.paidById) ?? 0) + expense.amountCents);
    for (const split of expense.splits) {
      share.set(split.memberId, (share.get(split.memberId) ?? 0) + split.amountCents);
    }
  }

  return members.map((member) => ({
    memberId: member.id,
    name: member.name,
    cents: (paid.get(member.id) ?? 0) - (share.get(member.id) ?? 0),
  }));
}
