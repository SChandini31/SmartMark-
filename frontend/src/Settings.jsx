import React, { useEffect, useState } from "react"; 
import "./Settings.css"; 
import Sidebar from "./Sidebar"; 
import ThemeToggle from "./ThemeToggle"; 
import SemanticSearch from "./SemanticSearch";
import Notifications from "./Notifications";
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
  onHelpSupport, 
  onLogout, 
}) { 
  const [settings, setSettings] = useState(() => { 
    try { 
      const savedSettings = JSON.parse(window.localStorage.getItem("smartmark-settings")); 
      if (savedSettings && typeof savedSettings === "object" && !Array.isArray(savedSettings)) { 
        return { ...defaultSettings, ...savedSettings }; 
      } 
    } catch { 
      return defaultSettings; 
    } 
    return defaultSettings; 
  }); 
  const [saveMessage, setSaveMessage] = useState(""); 
  const [searchTerm, setSearchTerm] = useState("");
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [isPasswordDialogOpen, setIsPasswordDialogOpen] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [passwordForm, setPasswordForm] = useState({
    current_password: "",
    new_password: "",
    confirm_password: "",
  });

  useEffect(() => {
    let isActive = true;

    Promise.allSettled([
      apiRequest("settings/profile"),
      apiRequest("settings/preferences"),
    ])
      .then(([profileResult, preferencesResult]) => {
        if (!isActive) return;
        const errors = [];
        const profile = profileResult.status === "fulfilled" ? profileResult.value : null;
        const preferences = preferencesResult.status === "fulfilled" ? preferencesResult.value : null;

        if (!profile) errors.push(profileResult.reason?.message || "Unable to load your profile.");
        if (!preferences) errors.push(preferencesResult.reason?.message || "Unable to load your preferences.");

        setSettings((currentSettings) => ({
          ...currentSettings,
          name: typeof profile?.name === "string" ? profile.name : currentSettings.name,
          email: typeof profile?.email === "string" ? profile.email : currentSettings.email,
          emailNotifications: typeof preferences?.rediscovery_emails_enabled === "boolean"
            ? preferences.rediscovery_emails_enabled
            : currentSettings.emailNotifications,
        }));
        if (errors.length) setErrorMessage(errors.join(" "));
      })
      .finally(() => {
        if (isActive) setIsLoadingProfile(false);
      });

    return () => {
      isActive = false;
    };
  }, []);
 
  const handleSettingChange = (event) => { 
    const { name, value, type, checked } = event.target; 
    setSettings((currentSettings) => ({ 
      ...currentSettings, 
      [name]: type === "checkbox" ? checked : value, 
    })); 
    setSaveMessage(""); 
  }; 
 
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
          payload: { name: settings.name.trim() },
        }),
        apiRequest("settings/preferences", {
          method: "PUT",
          payload: { rediscovery_emails_enabled: settings.emailNotifications },
        }),
      ]);

      setSettings((currentSettings) => ({
        ...currentSettings,
        name: typeof profile.name === "string" ? profile.name : currentSettings.name,
        email: typeof profile.email === "string" ? profile.email : currentSettings.email,
        emailNotifications: typeof preferences.rediscovery_emails_enabled === "boolean"
          ? preferences.rediscovery_emails_enabled
          : currentSettings.emailNotifications,
      }));

      try {
        window.localStorage.setItem("smartmark-settings", JSON.stringify(settings));
        setSaveMessage("Profile and preferences saved.");
      } catch {
        setSaveMessage("Profile and email preferences saved. Local-only settings could not be saved.");
      }
    } catch (error) {
      setErrorMessage(error.message || "Unable to save your settings.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleChangePassword = async (event) => {
    event.preventDefault();
    setPasswordError("");
    setPasswordMessage("");
    if (passwordForm.new_password !== passwordForm.confirm_password) {
      setPasswordError("New password and confirmation do not match.");
      return;
    }
    setIsChangingPassword(true);

    try {
      await apiRequest("settings/password", {
        method: "PUT",
        payload: passwordForm,
      });
      setPasswordForm({ current_password: "", new_password: "", confirm_password: "" });
      setPasswordMessage("Password changed successfully.");
      setIsPasswordDialogOpen(false);
    } catch (error) {
      setPasswordError(error.message || "Unable to change your password.");
    } finally {
      setIsChangingPassword(false);
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
        onSettings={onSettings}
        onHelpSupport={onHelpSupport} 
        onLogout={onLogout} 
      /> 
 
      {/* ================= MAIN CONTENT ================= */} 
      <main className="settings-main"> 
 
        {/* Header */} 
        <header className="settings-header"> 
 
          <div className="header-search"> 
 
            <span> 
              ⌕ 
            </span> 
 
            <input 
              type="text" 
              placeholder="Search your saved knowledge..." 
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
            /> 
            <SemanticSearch query={searchTerm} />
 
          </div> 
 
 
          <div className="header-actions"> 
 
            <Notifications
              onSavedResources={onSavedResources}
              onCollections={onCollections}
              onTags={onTags}
            />
 
            <ThemeToggle /> 
 
            <div className="header-divider"></div> 
 
            <button
              aria-label={`Open profile settings for ${settings.name}`}
              className="header-profile profile-settings-trigger"
              onClick={onSettings}
              type="button"
            >
 
              <div className="profile-avatar small"> 
                {settings.name.trim().charAt(0).toUpperCase() || "M"} 
              </div>
 
              <div> 
 
                <strong> 
                  {settings.name} 
                </strong> 
 
                <span> 
                  My Account 
                </span> 
              </div>
 
              <span className="arrow"> 
                ⌄ 
              </span> 
 
            </button>
 
          </div> 
 
        </header> 
 
 
        {/* ================= SETTINGS CONTENT ================= */} 
        <div className="settings-content"> 
 
          {/* Page Heading */} 
          <div className="settings-heading"> 
 
            <div> 
 
              <p className="settings-label"> 
                PREFERENCES 
              </p> 
 
              <h1> 
                Settings 
              </h1> 
 
              <p> 
                Manage your account, preferences and SmartMark experience. 
              </p> 
 
            </div> 
 
            <div className="settings-save-actions"> 
              <span className="settings-save-status" aria-live="polite"> 
                {saveMessage} 
              </span> 
              <button className="save-settings-btn" disabled={isSaving || isLoadingProfile} onClick={handleSaveChanges} type="button"> 
                {isSaving ? "Saving..." : "Save Changes"} 
              </button> 
            </div> 
 
          </div> 

          {errorMessage && (
            <p className="settings-save-status" role="alert">{errorMessage}</p>
          )}
          {isLoadingProfile && (
            <p className="settings-save-status" role="status">Loading account settings...</p>
          )}
 
 
          {/* ================= PROFILE ================= */} 
          <section className="settings-card"> 
 
            <div className="settings-card-header"> 
 
              <div> 
 
                <h2> 
                  Profile Information 
                </h2> 
 
                <p> 
                  Manage your personal information 
                </p> 
 
              </div> 
 
              <div className="settings-card-icon"> 
                👤 
              </div> 
 
            </div> 
 
 
            <div className="profile-settings"> 
 
              <div className="large-profile-avatar"> 
                {settings.name.trim().charAt(0).toUpperCase() || "M"} 
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
 
 
          {/* ================= NOTIFICATIONS ================= */} 
          <section className="settings-card"> 
 
            <div className="settings-card-header"> 
 
              <div> 
 
                <h2> 
                  Notifications 
                </h2> 
 
                <p> 
                  Choose how you want to receive notifications 
                </p> 
 
              </div> 
 
              <div className="settings-card-icon"> 
                🔔 
              </div> 
 
            </div> 
 
 
            <div className="setting-row"> 
 
              <div className="setting-info"> <strong> 
                  Push Notifications 
                </strong> 
 
                <span> 
                  Receive notifications about your saved knowledge 
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
 
 
            <div className="setting-row"> 
 
              <div className="setting-info"> 
 
                <strong> 
                  Email Notifications 
                </strong> 
 
                <span> 
                  Receive important updates through email 
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
 
          </section> 
 
 
          {/* ================= RESOURCE SETTINGS ================= */} 
          <section className="settings-card"> 
 
            <div className="settings-card-header"> 
 
              <div> 
 
                <h2> 
                  Resource Preferences 
                </h2> 
 
                <p> 
                  Configure how your resources are handled 
                </p> 
 
              </div> 
 
              <div className="settings-card-icon"> 
                🔖 
              </div> 
 
            </div> 
 
 
            <div className="setting-row"> 
 
              <div className="setting-info"> 
 
                <strong> 
                  Auto Save 
                </strong> 
 
                <span> 
                  Automatically save detected resource information 
                </span> 
 
              </div> 
 
              <label className="switch"> 
 
                <input 
                  type="checkbox" 
                  name="autoSave" 
                  checked={settings.autoSave} 
                  onChange={handleSettingChange} 
                /> 
 
                <span className="slider"></span> 
 
              </label> 
 
            </div> 
 
          </section> 
 
 
          {/* ================= SECURITY ================= */} 
          <section className="settings-card"> 
 
            <div className="settings-card-header"> 
 
              <div> 
 
                <h2> 
                  Security 
                </h2> 
 
                <p> 
                  Manage your account security 
                </p> 
 
              </div> 
 
              <div className="settings-card-icon"> 
                🔐 
              </div> 
 
            </div> 
 
 
            <div className="security-row"> 
 
              <div> 
 
                <strong> 
                  Password 
                </strong> 
 
                <p> 
                  Last changed recently 
                </p> 
 
              </div> 
 
              <button
                className="secondary-btn"
                onClick={() => {
                  setPasswordError("");
                  setPasswordMessage("");
                  setIsPasswordDialogOpen(true);
                }}
                type="button"
              > 
                Change Password 
              </button> 
 
            </div> 
 
 
            <div className="security-row"> 
 
              <div> 
 
                <strong> 
                  Active Sessions 
                </strong> 
 
                <p> 
                  Manage devices currently signed in 
                </p> 
 
              </div> 
 
              <button className="secondary-btn" type="button"> 
                View Sessions 
              </button> 
 
            </div> 
 
          </section> 

          {passwordMessage && (
            <p className="settings-save-status" role="status">{passwordMessage}</p>
          )}

          {isPasswordDialogOpen && (
            <div className="settings-dialog-backdrop">
              <section className="settings-card" role="dialog" aria-modal="true" aria-labelledby="change-password-title">
                <div className="settings-card-header">
                  <div>
                    <h2 id="change-password-title">Change Password</h2>
                    <p>Enter your current password and choose a new one.</p>
                  </div>
                  <button
                    aria-label="Close password dialog"
                    className="secondary-btn"
                    onClick={() => setIsPasswordDialogOpen(false)}
                    type="button"
                  >
                    ×
                  </button>
                </div>
                <form className="profile-form" onSubmit={handleChangePassword}>
                  {[
                    ["current_password", "Current Password", "current-password"],
                    ["new_password", "New Password", "new-password"],
                    ["confirm_password", "Confirm New Password", "new-password"],
                  ].map(([name, label, autoComplete]) => (
                    <div className="form-group" key={name}>
                      <label htmlFor={`password-${name}`}>{label}</label>
                      <input
                        autoComplete={autoComplete}
                        id={`password-${name}`}
                        onChange={(event) => setPasswordForm((current) => ({
                          ...current,
                          [name]: event.target.value,
                        }))}
                        required
                        type="password"
                        value={passwordForm[name]}
                      />
                    </div>
                  ))}
                  {passwordError && <p className="settings-save-status" role="alert">{passwordError}</p>}
                  <div className="settings-save-actions">
                    <button
                      className="secondary-btn"
                      onClick={() => setIsPasswordDialogOpen(false)}
                      type="button"
                    >
                      Cancel
                    </button>
                    <button className="save-settings-btn" disabled={isChangingPassword} type="submit">
                      {isChangingPassword ? "Changing..." : "Change Password"}
                    </button>
                  </div>
                </form>
              </section>
            </div>
          )}
 
 
          {/* ================= DANGER ZONE ================= */} 
          <section className="settings-card danger-card"> 
 
            <div className="settings-card-header"> 
 
              <div> 
 
                <h2> 
                  Account Actions 
                </h2> 
 
                <p> 
                  Permanent and sensitive account actions 
                </p> 
 
              </div> 
 
              <div className="settings-card-icon danger-icon"> 
                ⚠️ 
              </div> 
 
            </div> 
 
 
            <div className="security-row"> 
 
              <div> 
 
                <strong> 
                  Delete Account 
                </strong> 
 
                <p> 
                  Permanently delete your SmartMark account 
                  and saved information. 
                </p> 
 
              </div> 
 
              <button className="delete-btn" type="button"> 
                Delete Account 
              </button> 
 
            </div> 
 
          </section> 
 
 
          {/* Footer */} 
          <div className="settings-footer"> 
 
            <span> 
              SmartMark 
            </span> 
 
            <span> 
              Personal Information Retrieval & Knowledge Management System 
            </span> 
 
          </div> 
 
        </div> 
 
      </main> 
 
    </div> 
  ); 
} 
 
export default Settings; 