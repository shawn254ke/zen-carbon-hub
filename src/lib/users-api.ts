import { expireSession, getStoredSession } from "@/lib/auth";

type UpdateUserPayload = {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  password?: string;
  status?: string;
  roleId?: number;
  departmentId?: number;
};

type CreateUserPayload = {
  firstName: string;
  lastName: string;
  email: string;
  role: string;
};

export type ApiUserRecord = {
  id: number | string;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  phone?: string | null;
  status?: string | null;
  role?: string | null;
  roleId?: number | null;
};

function getUserEndpoints(userId: string) {
  const base = import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, "") ?? "";
  const path = `/api/users/${userId}`;
   
  
  return base ? [`${base}${path}`] : [path];
}

function getUsersCollectionEndpoints() {
  const base = import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, "") ?? "";
  const path = "/api/users";

  return base ? [`${base}${path}`, path] : [path];
}

function withAuthHeaders(authToken?: string | null) {
  return {
    "Content-Type": "application/json",
    ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
  };
}

async function safeJson<T>(response: Response) {
  return (await response.json().catch(() => null)) as T | null;
}

function dedupe<T>(values: T[]) {
  return [...new Set(values)];
}

async function readApiErrorMessage(response: Response) {
  const contentType = response.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    const data = await response
      .json()
      .catch(() => null) as { message?: string; error?: string; details?: string } | null;

    if (data?.message?.trim()) return data.message;
    if (data?.error?.trim()) return data.error;
    if (data?.details?.trim()) return data.details;
  }

  const text = await response.text().catch(() => "");
  return text.trim();
}

export async function updateUserApi(userId: string, payload: UpdateUserPayload, token?: string | null) {
  if (!/^\d+$/.test(userId)) {
    throw new Error("Your account id is missing. Please sign out and sign in again.");
  }

  const authToken = token ?? getStoredSession().token;
  const endpoints = getUserEndpoints(userId);

  let lastError = "Unable to update your profile right now.";

  for (const endpoint of endpoints) {
    try {
      const response = await fetch(endpoint, {
        method: "PATCH",
        headers: withAuthHeaders(authToken),
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        return;
      }

      if (response.status === 401) {
        expireSession();
        throw new Error("Your session has expired. Please sign in again.");
      }

      const apiMessage = await readApiErrorMessage(response);
      lastError = apiMessage || `Update failed (${response.status})`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : "Unable to reach the user service.";
    }
  }

  throw new Error(lastError);
}

export async function getUsersApi(token?: string | null): Promise<ApiUserRecord[]> {
  const authToken = token ?? getStoredSession().token;
  const endpoints = getUsersCollectionEndpoints();

  let lastError = "Unable to load users right now.";

  for (const endpoint of endpoints) {
    try {
      const response = await fetch(endpoint, {
        method: "GET",
        headers: withAuthHeaders(authToken),
      });

      if (response.ok) {
        const data = await safeJson<ApiUserRecord[]>(response);
        return Array.isArray(data) ? data : [];
      }

      if (response.status === 401) {
        expireSession();
        throw new Error("Your session has expired. Please sign in again.");
      }

      const apiMessage = await readApiErrorMessage(response);
      lastError = apiMessage || `Fetching users failed (${response.status})`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : "Unable to reach the user service.";
    }
  }

  throw new Error(lastError);
}

export async function createUserInviteApi(payload: CreateUserPayload, token?: string | null) {
  const authToken = token ?? getStoredSession().token;
  const endpoints = getUsersCollectionEndpoints();

  let lastError = "Unable to invite user right now.";

  const roleCandidates = dedupe([
    payload.role,
    payload.role.toUpperCase(),
    payload.role.toLowerCase(),
    `ROLE_${payload.role.toUpperCase()}`,
  ]);

  for (const endpoint of endpoints) {
    for (const roleCandidate of roleCandidates) {
      try {
        const response = await fetch(endpoint, {
          method: "POST",
          headers: withAuthHeaders(authToken),
          body: JSON.stringify({
            ...payload,
            role: roleCandidate,
            // Backend validates non-empty password before replacing it with generated passcode.
            password: "invite-init",
          }),
        });

        if (response.ok) {
          return;
        }

        if (response.status === 401) {
          expireSession();
          throw new Error("Your session has expired. Please sign in again.");
        }

        const apiMessage = await readApiErrorMessage(response);
        lastError = apiMessage || `Invite failed (${response.status})`;

        if (response.status === 409) {
          throw new Error(lastError);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unable to reach the user service.";
        lastError = message;
        if (message.toLowerCase().includes("already exists") || message.toLowerCase().includes("expired")) {
          throw new Error(message);
        }
      }
    }
  }

  throw new Error(lastError);
}

export async function deactivateUserApi(userId: string, token?: string | null) {
  if (!/^\d+$/.test(userId)) {
    throw new Error("User id is invalid.");
  }

  const authToken = token ?? getStoredSession().token;
  const endpoints = getUsersCollectionEndpoints().flatMap((endpoint) => [
    `${endpoint}/${userId}/deactivate`,
    `${endpoint}/deactivate/${userId}`,
  ]);

  let lastError = "Unable to deactivate user right now.";

  for (const endpoint of endpoints) {
    try {
      const response = await fetch(endpoint, {
        method: "PATCH",
        headers: withAuthHeaders(authToken),
      });

      if (response.ok) {
        return;
      }

      if (response.status === 401) {
        expireSession();
        throw new Error("Your session has expired. Please sign in again.");
      }

      const apiMessage = await readApiErrorMessage(response);
      lastError = apiMessage || `Deactivate failed (${response.status})`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : "Unable to reach the user service.";
    }
  }

  throw new Error(lastError);
}

export async function activateUserApi(userId: string, token?: string | null) {
  if (!/^\d+$/.test(userId)) {
    throw new Error("User id is invalid.");
  }

  const authToken = token ?? getStoredSession().token;
  const endpoints = getUsersCollectionEndpoints().flatMap((endpoint) => [
    `${endpoint}/${userId}/activate`,
    `${endpoint}/activate/${userId}`,
  ]);

  let lastError = "Unable to activate user right now.";

  for (const endpoint of endpoints) {
    try {
      const response = await fetch(endpoint, {
        method: "PATCH",
        headers: withAuthHeaders(authToken),
      });

      if (response.ok) {
        return;
      }

      if (response.status === 401) {
        expireSession();
        throw new Error("Your session has expired. Please sign in again.");
      }

      const apiMessage = await readApiErrorMessage(response);
      lastError = apiMessage || `Activate failed (${response.status})`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : "Unable to reach the user service.";
    }
  }

  throw new Error(lastError);
}

export async function deleteUserApi(userId: string, token?: string | null) {
  if (!/^\d+$/.test(userId)) {
    throw new Error("User id is invalid.");
  }

  const authToken = token ?? getStoredSession().token;
  const endpoints = getUserEndpoints(userId);

  let lastError = "Unable to delete user right now.";

  for (const endpoint of endpoints) {
    try {
      const response = await fetch(endpoint, {
        method: "DELETE",
        headers: withAuthHeaders(authToken),
      });

      if (response.ok) {
        return;
      }

      if (response.status === 401) {
        expireSession();
        throw new Error("Your session has expired. Please sign in again.");
      }

      const apiMessage = await readApiErrorMessage(response);
      lastError = apiMessage || `Delete failed (${response.status})`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : "Unable to reach the user service.";
    }
  }

  throw new Error(lastError);
}
