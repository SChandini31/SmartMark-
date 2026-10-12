// ======================================================
// SmartMark Browser Extension - popup.js
// ======================================================

// Backend API
// Your FastAPI backend is running on port 8000
const API_BASE = "https://stay-affects-registrar-cheap.trycloudflare.com/api";

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
  statusEl.textContent = message;
}

// ======================================================
// GET JWT TOKEN
// ======================================================
// First try to get the token from an open SmartMark tab.
// If that fails, use the cached token from chrome.storage.local.
// ======================================================

async function getToken() {
  try {
    const appTabs = await chrome.tabs.query({
      url: `${APP_URL}/*`,
    });

    for (const tab of appTabs) {
      if (!tab.id) continue;

      try {
        const [{ result }] = await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: (key) => window.localStorage.getItem(key),
          args: [TOKEN_KEY],
        });

        if (result) {
          // Keep a cached copy for the extension
          await chrome.storage.local.set({
            [TOKEN_KEY]: result,
          });

          return result;
        }
      } catch (err) {
        // This tab cannot be accessed.
        // Try the next SmartMark tab.
      }
    }

    // If no open tab contains the token,
    // use the cached token.
    const stored = await chrome.storage.local.get(TOKEN_KEY);

    return stored[TOKEN_KEY] || null;
  } catch (error) {
    console.error("Token error:", error);

    const stored = await chrome.storage.local.get(TOKEN_KEY);

    return stored[TOKEN_KEY] || null;
  }
}

// ======================================================
// GET PAGE DESCRIPTION
// ======================================================
// Reads the current webpage's meta description.
// ======================================================

async function getPageDescription(tabId) {
  try {
    const [{ result }] = await chrome.scripting.executeScript({
      target: { tabId },

      func: () => {
        const meta =
          document.querySelector('meta[name="description"]') ||
          document.querySelector('meta[property="og:description"]');

        return meta ? meta.content : "";
      },
    });

    return result || "";
  } catch (err) {
    console.log("Could not read page description:", err);
    return "";
  }
}

// ======================================================
// SAVE CURRENT PAGE
// ======================================================

saveBtn.addEventListener("click", async () => {
  saveBtn.disabled = true;

  setStatus("Saving...");

  try {
    // --------------------------------------------------
    // 1. Get current browser tab
    // --------------------------------------------------

    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });

    if (!tab || !tab.url || !/^https?:\/\//i.test(tab.url)) {
      setStatus("This page can't be saved.");
      return;
    }

    console.log("Current page:", tab.url);

    // --------------------------------------------------
    // 2. Get JWT token
    // --------------------------------------------------

    const token = await getToken();

    if (!token) {
      setStatus("Please log in to SmartMark first.");

      chrome.tabs.create({
        url: APP_URL,
      });

      return;
    }

    console.log("JWT token found.");

    // --------------------------------------------------
    // 3. Get page description
    // --------------------------------------------------

    const description = await getPageDescription(tab.id);

    // --------------------------------------------------
    // 4. Send resource to FastAPI backend
    // --------------------------------------------------
    //
    // IMPORTANT:
    //
    // API_BASE = http://localhost:8000/api
    //
    // Therefore endpoint is:
    //
    // http://localhost:8000/api/resources/
    //
    // NOT:
    //
    // http://localhost:8000/api/api/resources/
    // --------------------------------------------------

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

    // --------------------------------------------------
    // 5. Authentication error
    // --------------------------------------------------

    if (response.status === 401 || response.status === 403) {
      await chrome.storage.local.remove(TOKEN_KEY);

      setStatus("Session expired. Please log in again.");

      chrome.tabs.create({
        url: APP_URL,
      });

      return;
    }

    // --------------------------------------------------
    // 6. Other backend errors
    // --------------------------------------------------

    if (!response.ok) {
      let detail = "";

      try {
        const errorData = await response.json();

        if (typeof errorData.detail === "string") {
          detail = errorData.detail;
        } else if (errorData.detail) {
          detail = JSON.stringify(errorData.detail);
        }
      } catch (e) {
        // Response was not JSON
      }

      console.error(
        "Save failed:",
        response.status,
        detail
      );

      setStatus(
        `Could not save (${response.status}). ${detail}`
      );

      return;
    }

    // --------------------------------------------------
    // 7. Successfully saved
    // --------------------------------------------------

    const data = await response.json();

    console.log("Saved resource:", data);

    const savedTitle =
      data.resource?.title ||
      data.title ||
      tab.title ||
      "page";

    setStatus(`Saved: ${savedTitle}`);

  } catch (error) {
    // --------------------------------------------------
    // Network / connection error
    // --------------------------------------------------

    console.error("SmartMark extension error:", error);

    setStatus(
      "Could not reach the server. Is the backend running?"
    );

  } finally {
    saveBtn.disabled = false;
  }
});

// ======================================================
// VIEW SMARTMARK
// ======================================================

viewBtn.addEventListener("click", () => {
  chrome.tabs.create({
    url: APP_URL,
  });
});