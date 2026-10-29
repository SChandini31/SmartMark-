import { useEffect, useState } from "react";

const SETTINGS_KEY = "smartmark-settings";
const SETTINGS_UPDATED_EVENT = "smartmark-settings-updated";
const DEFAULT_PROFILE_NAME = "Monika";

function getStoredProfileName() {
  try {
    const savedSettings = JSON.parse(
      window.localStorage.getItem(SETTINGS_KEY) || "{}"
    );

    if (
      savedSettings &&
      typeof savedSettings.name === "string" &&
      savedSettings.name.trim()
    ) {
      return savedSettings.name.trim();
    }
  } catch (error) {
    console.error("Unable to load the saved profile name:", error);
  }

  return DEFAULT_PROFILE_NAME;
}

function useProfileName() {
  const [profileName, setProfileName] = useState(getStoredProfileName);

  useEffect(() => {
    const updateProfileName = (event) => {
      const eventName = event?.detail?.name;
      setProfileName(
        typeof eventName === "string" && eventName.trim()
          ? eventName.trim()
          : getStoredProfileName()
      );
    };

    const handleStorage = (event) => {
      if (event.key === SETTINGS_KEY || event.key === null) {
        updateProfileName();
      }
    };

    window.addEventListener(SETTINGS_UPDATED_EVENT, updateProfileName);
    window.addEventListener("storage", handleStorage);

    return () => {
      window.removeEventListener(SETTINGS_UPDATED_EVENT, updateProfileName);
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  return profileName;
}

export default useProfileName;
