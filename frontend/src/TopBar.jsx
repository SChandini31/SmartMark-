import Notifications from "./Notifications";
import ThemeToggle from "./ThemeToggle";
import useProfileName from "./useProfileName";
import "./TopBar.css";

function TopBar({
  onSavedResources,
  onCollections,
  onTags,
  onHelpSupport,
  onSettings,
}) {
  const profileName = useProfileName();

  return (
    <header className="smartmark-topbar">
      <strong className="smartmark-topbar-welcome">Welcome back!</strong>

      <div className="smartmark-topbar-actions">
        <ThemeToggle />

        <Notifications
          onSavedResources={onSavedResources}
          onCollections={onCollections}
          onTags={onTags}
        />

        <button
          aria-label="Open Help and Support"
          className="smartmark-topbar-help"
          onClick={onHelpSupport}
          title="Help and Support"
          type="button"
        >
          <span aria-hidden="true">❓</span>
        </button>

        <span className="smartmark-topbar-divider" aria-hidden="true" />

        <button
          aria-label={`Open profile settings for ${profileName}`}
          className="smartmark-topbar-profile profile-settings-trigger"
          onClick={onSettings}
          type="button"
        >
          <span className="smartmark-topbar-avatar" aria-hidden="true">
            {profileName.charAt(0).toUpperCase()}
          </span>

          <span className="smartmark-topbar-profile-copy">
            <strong>{profileName}</strong>
            <span>My Account</span>
          </span>

          <span className="smartmark-topbar-profile-arrow" aria-hidden="true">
            ⌄
          </span>
        </button>
      </div>
    </header>
  );
}

export default TopBar;
