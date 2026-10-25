import { useCallback, useEffect, useState } from "react";

const EXTENSION_ID = import.meta.env.VITE_EXTENSION_ID;

export default function useExtensionStatus() {
  const [installed, setInstalled] = useState(false);
  const [browser, setBrowser] = useState("unsupported");

  const checkExtension = useCallback(() => {
    const ua = navigator.userAgent;

    let detectedBrowser = "unsupported";

    if (/Firefox/i.test(ua)) {
      detectedBrowser = "firefox";
    } else if (/Edg\//i.test(ua)) {
      detectedBrowser = "edge";
    } else if (/Brave/i.test(ua)) {
      detectedBrowser = "brave";
    } else if (/Chrome/i.test(ua)) {
      detectedBrowser = "chrome";
    }

    setBrowser(detectedBrowser);

    // This marker must be added by the extension itself.
    const hasMarker =
      document.documentElement.dataset.smartmarkExtension ===
      "true";

    setInstalled(hasMarker);
  }, []);

  useEffect(() => {
    checkExtension();

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        checkExtension();
      }
    };

    document.addEventListener(
      "visibilitychange",
      handleVisibility
    );

    window.addEventListener("focus", checkExtension);

    return () => {
      document.removeEventListener(
        "visibilitychange",
        handleVisibility
      );
      window.removeEventListener("focus", checkExtension);
    };
  }, [checkExtension]);

  return { installed, browser, checkExtension, extensionId: EXTENSION_ID };
}