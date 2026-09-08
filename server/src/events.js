const subscribers = new Map();

export function subscribe(groupId, res) {
  const id = Number(groupId);
  if (!subscribers.has(id)) subscribers.set(id, new Set());
  subscribers.get(id).add(res);

  const keepAlive = setInterval(() => {
    res.write(": ping\n\n");
  }, 20000);

  reqOnClose(res, () => {
    clearInterval(keepAlive);
    const set = subscribers.get(id);
    if (!set) return;
    set.delete(res);
    if (set.size === 0) subscribers.delete(id);
  });
}

function reqOnClose(res, handler) {
  res.req.on("close", handler);
}

export function broadcast(groupId) {
  const set = subscribers.get(Number(groupId));
  if (!set) return;
  for (const res of set) {
    res.write(`data: ${JSON.stringify({ type: "update" })}\n\n`);
  }
}
