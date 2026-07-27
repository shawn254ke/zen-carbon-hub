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

function getUserEndpoints(userId: string) {
  const base = import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, "") ?? "";
  const path = `/api/users/${userId}`;
   
  
  return base ? [`${base}${path}`] : [path];
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
        headers: {
          "Content-Type": "application/json",
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        },
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
