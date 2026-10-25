import { useEffect, useState } from "react";
import ExtensionModal from "./ExtensionModal";
import useExtensionStatus from "./useExtensionStatus";
import "./Extension.css";

const DISMISS_KEY = "smartmark_ext_dismissed";
const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;

const CHROME_URL = import.meta.env.VITE_EXTENSION_URL;
const FIREFOX_URL = import.meta.env.VITE_FIREFOX_EXTENSION_URL;

function getStoreUrl(browser) {
  if (browser === "firefox") return FIREFOX_URL;

  if (["chrome", "edge", "brave"].includes(browser)) {
    return CHROME_URL;
  }

  return "";
}

export default function ExtensionCard() {
  const { installed, browser } = useExtensionStatus();

  const [dismissed, setDismissed] = useState(() => {
    try {
      const until = Number(
        localStorage.getItem(DISMISS_KEY) || 0
      );

      return until > Date.now();
    } catch {
      return false;
    }
  });

  const [modalOpen, setModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const storeUrl = getStoreUrl(browser);
  const supported = Boolean(storeUrl);

  useEffect(() => {
    if (installed) setLoading(false);
  }, [installed]);

  if (installed) {
    return (
      <div className="extension-connected" role="status">
        <span aria-hidden="true">✓</span>
        Extension connected
      </div>
    );
  }

  if (dismissed) return null;

  function trackEvent(eventName) {
    // Replace with your analytics provider when configured.
    window.dispatchEvent(
      new CustomEvent("smartmark:analytics", {
        detail: { event: eventName },
      })
    );
  }

  function installExtension() {
    if (!supported || loading) return;

    trackEvent("extension_install_click");
    setLoading(true);

    window.open(
      storeUrl,
      "_blank",
      "noopener,noreferrer"
    );

    window.setTimeout(() => {
      setLoading(false);
    }, 1000);
  }

  function dismissCard() {
    try {
      localStorage.setItem(
        DISMISS_KEY,
        String(Date.now() + SEVEN_DAYS)
      );
    } catch {
      // Continue hiding the card for this session.
    }

    setDismissed(true);
  }

  function learnMore() {
    trackEvent("extension_learn_more_click");
    setModalOpen(true);
  }

  return (
    <>
      <section
        className="extension-card"
        aria-labelledby="extension-card-title"
      >
        <button
          className="extension-dismiss"
          onClick={dismissCard}
          aria-label="Dismiss extension card for seven days"
          title="Hide for 7 days"
          type="button"
        >
          ×
        </button>

        <div className="extension-card-icon" aria-hidden="true">
          🧩
        </div>

        <h3 id="extension-card-title">
          Save faster with Chrome Extension
        </h3>

        <p>
          Capture useful links while browsing and organize
          everything in SmartMark.
        </p>

        {!supported && (
          <p className="extension-browser-note">
            Available on desktop Chrome, Edge, Firefox
          </p>
        )}

        <button
          className="extension-primary-button"
          onClick={installExtension}
          disabled={!supported || loading}
          type="button"
        >
          {loading
            ? "Opening store…"
            : "Install Extension"}
        </button>

        <button
          className="extension-learn-more"
          onClick={learnMore}
          type="button"
        >
          Learn more
        </button>

        {import.meta.env.DEV && (
          <a
            className="extension-developer-download"
            href="/smartmark-extension.zip"
            download
            title="After downloading, extract the ZIP. Open chrome://extensions, enable Developer mode, and select Load unpacked."
          >
            Download .zip (developer mode)
          </a>
        )}
      </section>

      <ExtensionModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onInstall={installExtension}
        storeSupported={supported}
      />
    </>
  );
}