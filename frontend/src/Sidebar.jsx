import "./Sidebar.css";

const menuItems = [
  { page: "dashboard", label: "Dashboard", icon: "⌂" },
  { page: "saved-resources", label: "Saved Resources", icon: "🔖" },
  { page: "collections", label: "Collections", icon: "📁" },
  { page: "tags", label: "Tags", icon: "🏷" },
  { page: "notes", label: "Notes", icon: "📝" },
  { page: "favorites", label: "Favorites", icon: "⭐" },
  { page: "semantic-search", label: "Semantic Search", icon: "✨" },
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
  onSemanticSearch,
  onSettings,
  onLogout,

  sidebarOpen = true,
  onToggleSidebar,
}) {
  const handleMenuClick = (page) => {
    switch (page) {
      case "dashboard":
        onDashboard?.();
        break;

      case "saved-resources":
        onSavedResources?.();
        break;

      case "collections":
        onCollections?.();
        break;

      case "tags":
        onTags?.();
        break;

      case "notes":
        onNotes?.();
        break;

      case "favorites":
        onFavorites?.();
        break;

      case "semantic-search":
        console.log("Semantic Search menu clicked");
        console.log("onSemanticSearch callback:", onSemanticSearch);

        if (typeof onSemanticSearch === "function") {
          onSemanticSearch();
        } else {
          console.error(
            "Semantic Search navigation callback is missing!"
          );
        }
        break;

      default:
        break;
    }
  };

  return (
    <aside
      className={`shared-sidebar ${
        sidebarOpen ? "sidebar-open" : "sidebar-collapsed"
      }`}
    >
      {/* SMARTMARK BRAND */}
      <button
        type="button"
        className="shared-sidebar-brand"
        onClick={onToggleSidebar}
        title={sidebarOpen ? "Close sidebar" : "Open sidebar"}
      >
        <div className="shared-brand-logo">S</div>

        <div className="shared-brand-copy">
          <h2>SmartMark</h2>
          <span>Knowledge Hub</span>
        </div>
      </button>

      {/* MAIN MENU */}
      <nav className="shared-sidebar-nav">

        {menuItems.map((item) => (
          <button
            key={item.page}
            type="button"
            className={`shared-menu-item ${
              activePage === item.page ? "active" : ""
            }`}
            onClick={() => handleMenuClick(item.page)}
            title={item.label}
            aria-current={
              activePage === item.page ? "page" : undefined
            }
          >
            <span className="shared-menu-icon">{item.icon}</span>
            <span className="shared-menu-label">{item.label}</span>
          </button>
        ))}
      </nav>

      {/* BOTTOM MENU */}
      <div className="shared-sidebar-bottom">
        <button
          type="button"
          className="shared-menu-item"
          onClick={onSettings}
          title="Settings"
        >
          <span className="shared-menu-icon">⚙</span>
          <span className="shared-menu-label">Settings</span>
        </button>

        <button
          type="button"
          className="shared-menu-item shared-logout"
          onClick={onLogout}
          title="Logout"
        >
          <span className="shared-menu-icon">↪</span>
          <span className="shared-menu-label">Logout</span>
        </button>
      </div>
    </aside>
  );
}

export default Sidebar;