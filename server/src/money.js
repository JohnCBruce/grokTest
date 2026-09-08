const CENTS_PER_DOLLAR = 100;

export function dollarsToCents(amount) {
  if (amount === "" || amount === null || amount === undefined) {
    throw new Error("Amount is required");
  }
  const value = typeof amount === "number" ? amount : Number(String(amount).trim());
  if (!Number.isFinite(value)) {
    throw new Error("Amount must be a number");
  }
  if (value < 0) {
    throw new Error("Amount cannot be negative");
  }
  return Math.round(value * CENTS_PER_DOLLAR);
}

export function centsToDollars(cents) {
  return (cents / CENTS_PER_DOLLAR).toFixed(2);
}

export function formatMoney(cents) {
  const abs = Math.abs(cents);
  const formatted = `$${(abs / CENTS_PER_DOLLAR).toFixed(2)}`;
  if (cents < 0) return `−${formatted}`;
  return formatted;
}

export function equalSplit(totalCents, memberIds) {
  if (!memberIds.length) {
    throw new Error("Select at least one member to split with");
  }
  if (totalCents < 0) {
    throw new Error("Amount cannot be negative");
  }
  const n = memberIds.length;
  const base = Math.floor(totalCents / n);
  const remainder = totalCents % n;
  return memberIds.map((memberId, index) => ({
    memberId,
    amountCents: base + (index < remainder ? 1 : 0),
  }));
}

export function assertSplitsSum(totalCents, splits) {
  const sum = splits.reduce((acc, split) => acc + split.amountCents, 0);
  if (sum !== totalCents) {
    throw new Error(
      `Custom splits must add up to ${centsToDollars(totalCents)}; got ${centsToDollars(sum)}`,
    );
  }
}
