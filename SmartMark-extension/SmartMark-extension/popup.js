// ======================================================
// SmartMark Browser Extension - popup.js
// ======================================================

// Backend API
const API_BASE =
  "https://guitar-except-divorce-mem.trycloudflare.com/api";

// SmartMark React frontend
const APP_URL = "http://localhost:5173";

// Same key used by the SmartMark frontend
const TOKEN_KEY = "smartmark-access-token";

// Get HTML elements
const saveBtn = document.getElementById("saveBtn");
const viewBtn = document.getElementById("viewBtn");
const statusEl = document.getElementById("status");

// ======================================================
// STATUS MESSAGE
// ======================================================

function setStatus(message) {
  if (statusEl) {
    statusEl.textContent = message;
  }
}

// ======================================================
// GET JWT TOKEN
// ======================================================
// First check an open SmartMark tab.
// If unavailable, use the cached token.
// ======================================================

async function getToken() {
  try {
    const appTabs = await chrome.tabs.query({
      url: `${APP_URL}/*`,
    });

    for (const tab of appTabs) {
      if (!tab.id) continue;

      try {
        const results = await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: (key) => window.localStorage.getItem(key),
          args: [TOKEN_KEY],
        });

        const token = results?.[0]?.result;

        if (token) {
          await chrome.storage.local.set({
            [TOKEN_KEY]: token,
          });

          return token;
        }
      } catch (error) {
        console.warn(
          "Could not read token from this SmartMark tab:",
          error
        );
      }
    }
  } catch (error) {
    console.error("Could not check SmartMark tabs:", error);
  }

  // Use cached token if no token was found in an open tab.
  try {
    const stored = await chrome.storage.local.get(TOKEN_KEY);
    return stored[TOKEN_KEY] || null;
  } catch (error) {
    console.error("Could not read cached token:", error);
    return null;
  }
}

// ======================================================
// GET CURRENT PAGE DESCRIPTION
// ======================================================

async function getPageDescription(tabId) {
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        const meta =
          document.querySelector('meta[name="description"]') ||
          document.querySelector('meta[property="og:description"]');

        return meta?.content || "";
      },
    });

    return results?.[0]?.result || "";
  } catch (error) {
    console.warn("Could not read page description:", error);
    return "";
  }
}

// ======================================================
// SAVE CURRENT PAGE
// ======================================================

if (saveBtn) {
  saveBtn.addEventListener("click", async () => {
    saveBtn.disabled = true;
    setStatus("Saving...");

    try {
      // 1. Get the active browser tab
      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });

      // Validate the current page URL
      if (!tab?.id || !tab.url || !/^https?:\/\//i.test(tab.url)) {
        setStatus("This page can't be saved.");
        return;
      }

      console.log("Current page:", tab.url);

      // 2. Get the user's JWT token
      const token = await getToken();

      if (!token) {
        setStatus("Please log in to SmartMark first.");

        await chrome.tabs.create({
          url: APP_URL,
        });

        return;
      }

      // 3. Get the page description
      const description = await getPageDescription(tab.id);

      // 4. Send the resource to the backend
      // API_BASE already ends in /api.
      // Final endpoint: /api/resources/
      const response = await fetch(`${API_BASE}/resources/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          url: tab.url,
          title: tab.title || "",
          description: description || "",
        }),
      });

      console.log("Backend response status:", response.status);

      // 5. Handle authentication errors
      if (response.status === 401 || response.status === 403) {
        await chrome.storage.local.remove(TOKEN_KEY);

        setStatus("Session expired. Please log in again.");

        await chrome.tabs.create({
          url: APP_URL,
        });

        return;
      }

      // 6. Handle other backend errors
      if (!response.ok) {
        let detail = "";

        try {
          const errorData = await response.json();

          if (typeof errorData.detail === "string") {
            detail = errorData.detail;
          } else if (errorData.detail) {
            detail = JSON.stringify(errorData.detail);
          }
        } catch (error) {
          // The server may return a non-JSON error response.
        }

        console.error(
          "Save failed:",
          response.status,
          detail
        );

        setStatus(
          `Could not save (${response.status}). ${
            detail || "Please try again."
          }`
        );

        return;
      }

      // 7. Handle successful save
      const data = await response.json();

      console.log("Saved resource:", data);

      const savedTitle =
        data.resource?.title ||
        data.title ||
        tab.title ||
        "page";

      setStatus(`Saved: ${savedTitle}`);
    } catch (error) {
      // Network or connection error
      console.error("SmartMark extension error:", error);

      setStatus(
        "Could not reach the server. Check your backend and API URL."
      );
    } finally {
      saveBtn.disabled = false;
    }
  });
}

// ======================================================
// OPEN SMARTMARK
// ======================================================

if (viewBtn) {
  viewBtn.addEventListener("click", () => {
    chrome.tabs.create({
      url: APP_URL,
    });
  });
}