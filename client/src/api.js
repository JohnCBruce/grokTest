async function request(path, options = {}) {
  const { body, ...rest } = options;
  const res = await fetch(path, {
    ...rest,
    headers: {
      "Content-Type": "application/json",
      ...(rest.headers ?? {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || "Request failed");
  }
  return data;
}

export function listGroups() {
  return request("/api/groups");
}

export function createGroup(payload) {
  return request("/api/groups", { method: "POST", body: payload });
}

export function getGroup(id) {
  return request(`/api/groups/${id}`);
}

export function addMember(groupId, name) {
  return request(`/api/groups/${groupId}/members`, {
    method: "POST",
    body: { name },
  });
}

export function addExpense(groupId, payload) {
  return request(`/api/groups/${groupId}/expenses`, {
    method: "POST",
    body: payload,
  });
}

export function deleteExpense(groupId, expenseId) {
  return request(`/api/groups/${groupId}/expenses/${expenseId}`, {
    method: "DELETE",
  });
}
