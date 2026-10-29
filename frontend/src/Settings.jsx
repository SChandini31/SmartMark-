import React, { useEffect, useState } from "react";
import "./Settings.css";
import Sidebar from "./Sidebar";
import TopBar from "./TopBar";
import { apiRequest } from "./authApi";

const defaultSettings = {
  name: "Monika",
  accountType: "Student",
  email: "monika@example.com",
  notifications: true,
  emailNotifications: true,
  autoSave: true,
};

function Settings({
  onDashboard,
  onSavedResources,
  onCollections,
  onTags,
  onNotes,
  onFavorites,
  onRecent,
  onSettings,
  onSemanticSearch,
  onHelpSupport,
  onLogout,
  onForgotPassword,
}) {
  const [settings, setSettings] = useState(() => {
    try {
      const savedSettings = JSON.parse(
        window.localStorage.getItem("smartmark-settings")
      );

      if (
        savedSettings &&
        typeof savedSettings === "object" &&
        !Array.isArray(savedSettings)
      ) {
        return { ...defaultSettings, ...savedSettings };
      }
    } catch (error) {
      console.error("Unable to load saved settings:", error);
    }

    return { ...defaultSettings };
  });

  const [saveMessage, setSaveMessage] = useState("");
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  // Load profile information and notification preferences.
  useEffect(() => {
    let isActive = true;

    Promise.allSettled([
      apiRequest("settings/profile"),
      apiRequest("settings/preferences"),
    ])
      .then(([profileResult, preferencesResult]) => {
        if (!isActive) return;

        const profile =
          profileResult.status === "fulfilled"
            ? profileResult.value
            : null;

        const preferences =
          preferencesResult.status === "fulfilled"
            ? preferencesResult.value
            : null;

        const errors = [];

        if (!profile) {
          errors.push(
            profileResult.reason?.message ||
              "Unable to load your profile."
          );
        }

        if (!preferences) {
          errors.push(
            preferencesResult.reason?.message ||
              "Unable to load your notification preferences."
          );
        }

        setSettings((currentSettings) => {
          const updatedSettings = {
            ...currentSettings,
            name:
              typeof profile?.name === "string"
                ? profile.name
                : currentSettings.name,
            email:
              typeof profile?.email === "string"
                ? profile.email
                : currentSettings.email,
            emailNotifications:
              typeof preferences?.rediscovery_emails_enabled ===
              "boolean"
                ? preferences.rediscovery_emails_enabled
                : currentSettings.emailNotifications,
          };

          try {
            window.localStorage.setItem(
              "smartmark-settings",
              JSON.stringify(updatedSettings)
            );
          } catch (error) {
            console.error("Unable to cache settings:", error);
          }

          return updatedSettings;
        });

        if (errors.length > 0) {
          setErrorMessage(errors.join(" "));
        }
      })
      .catch((error) => {
        if (isActive) {
          setErrorMessage(
            error.message || "Unable to load your settings."
          );
        }
      })
      .finally(() => {
        if (isActive) {
          setIsLoadingProfile(false);
        }
      });

    return () => {
      isActive = false;
    };
  }, []);

  // Handle form fields and notification toggles.
  const handleSettingChange = (event) => {
    const { name, value, type, checked } = event.target;

    setSettings((currentSettings) => ({
      ...currentSettings,
      [name]: type === "checkbox" ? checked : value,
    }));

    setSaveMessage("");
    setErrorMessage("");
  };

  // Save profile and notification preferences.
  const handleSaveChanges = async () => {
    setErrorMessage("");
    setSaveMessage("");

    if (!settings.name.trim()) {
      setErrorMessage("Please enter your name.");
      return;
    }

    setIsSaving(true);

    try {
      const [profile, preferences] = await Promise.all([
        apiRequest("settings/profile", {
          method: "PUT",
          payload: {
            name: settings.name.trim(),
          },
        }),

        apiRequest("settings/preferences", {
          method: "PUT",
          payload: {
            rediscovery_emails_enabled:
              settings.emailNotifications,
          },
        }),
      ]);

      const updatedSettings = {
        ...settings,
        name:
          typeof profile?.name === "string"
            ? profile.name
            : settings.name.trim(),
        email:
          typeof profile?.email === "string"
            ? profile.email
            : settings.email,
        emailNotifications:
          typeof preferences?.rediscovery_emails_enabled ===
          "boolean"
            ? preferences.rediscovery_emails_enabled
            : settings.emailNotifications,
      };

      setSettings(updatedSettings);

      window.localStorage.setItem(
        "smartmark-settings",
        JSON.stringify(updatedSettings)
      );

      window.dispatchEvent(
        new CustomEvent("smartmark-settings-updated", {
          detail: updatedSettings,
        })
      );

      setSaveMessage("Settings saved successfully.");
    } catch (error) {
      setErrorMessage(
        error.message || "Unable to save your settings."
      );
    } finally {
      setIsSaving(false);
    }
  };

  // Navigate to the existing Forgot Password page.
  const handleResetPassword = () => {
    if (onForgotPassword) {
      onForgotPassword();
    } else {
      setErrorMessage(
        "Password reset navigation is not configured. Please check App.jsx."
      );
    }
  };

  return (
    <div className="settings-container">
      <Sidebar
        activePage="settings"
        onDashboard={onDashboard}
        onSavedResources={onSavedResources}
        onCollections={onCollections}
        onTags={onTags}
        onNotes={onNotes}
        onFavorites={onFavorites}
        onRecent={onRecent}
        onSemanticSearch={onSemanticSearch}
        onSettings={onSettings}
        onLogout={onLogout}
      />

      <main className="settings-main">
        <TopBar
          onSavedResources={onSavedResources}
          onCollections={onCollections}
          onTags={onTags}
          onHelpSupport={onHelpSupport}
          onSettings={onSettings}
        />

        <div className="settings-content">
          {/* Page heading */}
          <div className="settings-heading">
            <div>
              <h1>Settings</h1>
              <p>
                Manage your account and SmartMark experience.
              </p>
            </div>

            <div className="settings-save-actions">
              <span
                className="settings-save-status"
                aria-live="polite"
              >
                {saveMessage}
              </span>

              <button
                className="save-settings-btn"
                disabled={isSaving || isLoadingProfile}
                onClick={handleSaveChanges}
                type="button"
              >
                {isSaving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>

          {errorMessage && (
            <p className="settings-save-status" role="alert">
              {errorMessage}
            </p>
          )}

          {isLoadingProfile && (
            <p className="settings-save-status" role="status">
              Loading account settings...
            </p>
          )}

          {/* Profile Information */}
          <section className="settings-card">
            <div className="settings-card-header">
              <div>
                <h2>Profile Information</h2>
                <p>Manage your personal information.</p>
              </div>

              <div className="settings-card-icon">👤</div>
            </div>

            <div className="profile-settings">
              <div className="large-profile-avatar">
                {settings.name.trim().charAt(0).toUpperCase() ||
                  "M"}
              </div>

              <div className="profile-form">
                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="settings-name">
                      Full Name
                    </label>

                    <input
                      id="settings-name"
                      name="name"
                      type="text"
                      value={settings.name}
                      onChange={handleSettingChange}
                      autoComplete="name"
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="settings-account-type">
                      Account Type
                    </label>

                    <input
                      id="settings-account-type"
                      name="accountType"
                      type="text"
                      value={settings.accountType}
                      onChange={handleSettingChange}
                      required
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label htmlFor="settings-email">
                    Email Address
                  </label>

                  <input
                    id="settings-email"
                    name="email"
                    type="email"
                    value={settings.email}
                    autoComplete="email"
                    readOnly
                  />
                </div>
              </div>
            </div>
          </section>

          {/* Preferences */}
          <section className="settings-card">
            <div className="settings-card-header">
              <div>
                <h2>Notifications &amp; Security</h2>
                <p>
                  Manage your notifications and password settings.
                </p>
              </div>

              <div className="settings-card-icon">⚙️</div>
            </div>

            {/* Push Notifications */}
            <div className="setting-row">
              <div className="setting-info">
                <strong>Push Notifications</strong>
                <span>
                  Receive notifications about your saved knowledge.
                </span>
              </div>

              <label className="switch">
                <input
                  type="checkbox"
                  name="notifications"
                  checked={settings.notifications}
                  onChange={handleSettingChange}
                />
                <span className="slider"></span>
              </label>
            </div>

            {/* Email Notifications */}
            <div className="setting-row">
              <div className="setting-info">
                <strong>Email Notifications</strong>
                <span>
                  Receive important updates through email.
                </span>
              </div>

              <label className="switch">
                <input
                  type="checkbox"
                  name="emailNotifications"
                  checked={settings.emailNotifications}
                  onChange={handleSettingChange}
                />
                <span className="slider"></span>
              </label>
            </div>

            {/* Reset Password */}
            <div className="setting-row">
              <div className="setting-info">
                <strong>Reset Password</strong>
                <span>
                  Go to the password reset page to change or recover
                  your password.
                </span>
              </div>

              <label
                className="switch"
                title="Open password reset page"
              >
                <input
                  type="checkbox"
                  checked={false}
                  onChange={handleResetPassword}
                  aria-label="Open password reset page"
                />
                <span className="slider"></span>
              </label>
            </div>
          </section>

          {/* Footer */}
          <footer className="settings-footer">
            <span>SmartMark</span>
            <span>
              Personal Information Retrieval &amp; Knowledge
              Management System
            </span>
          </footer>
        </div>
      </main>
    </div>
  );
}

export default Settings;
