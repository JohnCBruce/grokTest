export function formatMoney(cents) {
  const abs = Math.abs(cents);
  const formatted = `$${(abs / 100).toFixed(2)}`;
  return cents < 0 ? `−${formatted}` : formatted;
}

export function signedBalance(cents) {
  if (cents === 0) return { label: "settled up", className: "is-even" };
  if (cents > 0) return { label: `is owed ${formatMoney(cents)}`, className: "is-credit" };
  return { label: `owes ${formatMoney(cents)}`, className: "is-debt" };
}
