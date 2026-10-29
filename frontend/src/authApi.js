
const configuredApiBase = import.meta.env.VITE_API_BASE_URL?.replace(/\/+$/, "");

const normalizedApiBase =
  configuredApiBase &&
  (configuredApiBase.endsWith("/api")
    ? configuredApiBase
    : `${configuredApiBase}/api`);

const apiBaseUrl = import.meta.env.DEV ? "/api" : normalizedApiBase;

async function requestApi(path, { method, payload, authenticated }) {
  if (!apiBaseUrl) {
    throw new Error("The API base URL is not configured.");
  }

  const isFormData =
    typeof FormData !== "undefined" && payload instanceof FormData;

  const headers = {};

  if (payload !== undefined && !isFormData) {
    headers["Content-Type"] = "application/json";
  }

  if (authenticated) {
    let token;

    try {
      token = window.localStorage.getItem("smartmark-access-token");
    } catch {
      throw new Error("Your session could not be read. Please log in again.");
    }

    if (!token) {
      throw new Error("Please log in to access your resources.");
    }

    headers.Authorization = `Bearer ${token}`;
  }

  let response;

  try {
    response = await fetch(
      `${apiBaseUrl}/${path.replace(/^\/+/, "")}`,
      {
        method,
        headers,
        ...(payload === undefined
          ? {}
          : {
              body: isFormData ? payload : JSON.stringify(payload),
            }),
      }
    );
  } catch {
    throw new Error("Could not connect to SmartMark. Please try again.");
  }

  const responseText = await response.text();

let result = {};

if (responseText.trim()) {
  try {
    result = JSON.parse(responseText);
  } catch {
    if (response.ok) {
      throw new Error(
        "The server completed the request but returned an invalid JSON response."
      );
    }

    result = { detail: responseText };
  }
}

  if (!response.ok) {
    if (authenticated && response.status === 401) {
      try {
        window.localStorage.removeItem("smartmark-access-token");
      } catch {
        // Notify the app even if the browser prevents clearing storage.
      }

      window.dispatchEvent(new Event("smartmark:session-expired"));

      throw new Error("Your session is no longer valid. Please log in again.");
    }

    if ([502, 503, 504].includes(response.status)) {
      throw new Error(
        `SmartMark's API is temporarily unavailable (HTTP ${response.status}). Please try again shortly.`
      );
    }

    const detail = result.detail;

    const message = Array.isArray(detail)
      ? detail.map((issue) => issue.msg).join(" ")
      : typeof detail === "string"
        ? detail
        : typeof detail === "object" && detail?.message
          ? detail.message
          : "The request could not be completed. Please try again.";

    throw new Error(message);
  }

  return result;
}

export function postAuth(path, payload) {
  return requestApi(path, {
    method: "POST",
    payload,
    authenticated: false,
  });
}

export function apiRequest(path, { method = "GET", payload } = {}) {
  return requestApi(path, {
    method,
    payload,
    authenticated: true,
  });
}

// Fetch an uploaded PDF, document, or image using JWT authentication.
export async function openResourceFile(resourceId) {
  if (!apiBaseUrl) {
    throw new Error("The API base URL is not configured.");
  }

  let token;

  try {
    token = window.localStorage.getItem("smartmark-access-token");
  } catch {
    throw new Error("Your session could not be read. Please log in again.");
  }

  if (!token) {
    throw new Error("Please log in to access your resources.");
  }

  let response;

  try {
    response = await fetch(
      `${apiBaseUrl}/resources/${encodeURIComponent(resourceId)}/file`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );
  } catch {
    throw new Error("Could not connect to SmartMark. Please try again.");
  }

  if (!response.ok) {
    if (response.status === 401) {
      try {
        window.localStorage.removeItem("smartmark-access-token");
      } catch {
        // Ignore storage errors.
      }

      window.dispatchEvent(new Event("smartmark:session-expired"));

      throw new Error("Your session is no longer valid. Please log in again.");
    }

    let message = "Could not open this file. Please try again.";

    try {
      const result = await response.json();

      if (typeof result.detail === "string") {
        message = result.detail;
      } else if (result.detail?.message) {
        message = result.detail.message;
      }
    } catch {
      // Keep the default message.
    }

    throw new Error(message);
  }

  return response.blob();
}