import "./Sidebar.css";

const menuItems = [
  { page: "dashboard", label: "Dashboard", icon: "⌂" },
  { page: "saved-resources", label: "Saved Resources", icon: "🔖" },
  { page: "collections", label: "Collections", icon: "📁" },
  { page: "tags", label: "Tags", icon: "🏷" },
  { page: "notes", label: "Notes", icon: "📝" },
  { page: "favorites", label: "Favorites", icon: "⭐" },
  { page: "recent", label: "Recent", icon: "🕘" },
];

function Sidebar({
  activePage,
  profileName = "Monika",
  profileRole = "Student",

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

  onToggleSidebar,
}) {
  const handleMenuClick = (page) => {
    if (page === "dashboard") onDashboard?.();
    if (page === "saved-resources") onSavedResources?.();
    if (page === "collections") onCollections?.();
    if (page === "tags") onTags?.();
    if (page === "notes") onNotes?.();
    if (page === "favorites") onFavorites?.();
    if (page === "recent") onRecent?.();
  };

  return (
    <aside className="shared-sidebar">

      {/* SMARTMARK BRAND */}
      <button
        type="button"
        className="shared-sidebar-brand"
        onClick={onToggleSidebar}
        title="Close sidebar"
      >
        <div className="shared-brand-logo">
          S
        </div>

        <div className="shared-brand-copy">
          <h2>SmartMark</h2>
          <span>Knowledge Hub</span>
        </div>
      </button>

      {/* MENU */}
      <nav className="shared-sidebar-nav">

        <p className="shared-sidebar-title">
          MENU
        </p>

        {menuItems.map((item) => (
          <button
            key={item.page}
            type="button"
            className={`shared-menu-item ${
              activePage === item.page ? "active" : ""
            }`}
            onClick={() => handleMenuClick(item.page)}
          >
            <span className="shared-menu-icon">
              {item.icon}
            </span>

            <span className="shared-menu-label">
              {item.label}
            </span>
          </button>
        ))}

      </nav>

      {/* BOTTOM */}
      <div className="shared-sidebar-bottom">

        <button
          type="button"
          className="shared-menu-item"
          onClick={onSettings}
        >
          <span className="shared-menu-icon">⚙</span>
          <span className="shared-menu-label">Settings</span>
        </button>

        <button
          type="button"
          className="shared-menu-item"
          onClick={onHelpSupport}
        >
          <span className="shared-menu-icon">❓</span>
          <span className="shared-menu-label">Help & Support</span>
        </button>

        <button
          type="button"
          className="shared-menu-item shared-logout"
          onClick={onLogout}
        >
          <span className="shared-menu-icon">↪</span>
          <span className="shared-menu-label">Logout</span>
        </button>

      </div>

    </aside>
  );
}

export default Sidebar;