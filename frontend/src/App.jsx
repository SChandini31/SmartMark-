import { useEffect, useState } from "react";
import LoginPage from "./LoginPage";
import SignUpPage from "./SignUpPage";
import Dashboard from "./Dashboard";
import SavedResources from "./SavedResources";
import Collections from "./Collections";
import Favorites from "./Favorites";
import Recent from "./Recent";
import Notes from "./Notes";
import Settings from "./Settings";
import ForgotPasswordPage from "./ForgotPassword";
import Tags from "./Tags";
import HelpSupport from "./HelpSupport";
import { ThemeContext } from "./ThemeToggle";

function App() {
  const [page, setPage] = useState("login");

  /* =========================================================
     SIDEBAR OPEN / CLOSE
     ========================================================= */

  const [sidebarOpen, setSidebarOpen] = useState(true);

  const toggleSidebar = () => {
    setSidebarOpen((previous) => !previous);
  };

  /* =========================================================
     DARK MODE
     ========================================================= */

  const [darkMode, setDarkMode] = useState(() => {
    try {
      const savedTheme = window.localStorage.getItem("smartmark-theme");

      if (savedTheme) {
        return savedTheme === "dark";
      }

      const savedSettings = JSON.parse(
        window.localStorage.getItem("smartmark-settings") || "{}"
      );

      return Boolean(savedSettings.darkMode);
    } catch {
      return false;
    }
  });

  /* =========================================================
     APPLY DARK MODE
     ========================================================= */

  useEffect(() => {
    document.documentElement.dataset.theme = darkMode
      ? "dark"
      : "light";
  }, [darkMode]);

  /* =========================================================
     EXPIRED SESSION
     ========================================================= */

  useEffect(() => {
    const handleExpiredSession = () => {
      setPage("login");
      setSidebarOpen(true);
    };

    window.addEventListener(
      "smartmark:session-expired",
      handleExpiredSession
    );

    return () => {
      window.removeEventListener(
        "smartmark:session-expired",
        handleExpiredSession
      );
    };
  }, []);

  /* =========================================================
     TOGGLE DARK MODE
     ========================================================= */

  const toggleDarkMode = () => {
    const nextDarkMode = !darkMode;

    setDarkMode(nextDarkMode);

    try {
      window.localStorage.setItem(
        "smartmark-theme",
        nextDarkMode ? "dark" : "light"
      );
    } catch {
      // The theme still changes for this session
      // if storage is unavailable.
    }
  };

  /* =========================================================
     LOGOUT
     ========================================================= */

  const handleLogout = () => {
    try {
      window.localStorage.removeItem("smartmark-access-token");
    } catch {
      // Return to login even when browser storage is unavailable.
    }

    setSidebarOpen(true);
    setPage("login");
  };

  /* =========================================================
     COMMON SIDEBAR PROPS
     ========================================================= */

  const sidebarProps = {
    onDashboard: () => {
      setPage("dashboard");
    },

    onSavedResources: () => {
      setPage("saved");
    },

    onCollections: () => {
      setPage("collections");
    },

    onTags: () => {
      setPage("tags");
    },

    onNotes: () => {
      setPage("notes");
    },

    onFavorites: () => {
      setPage("favorites");
    },

    onRecent: () => {
      setPage("recent");
    },

    onSettings: () => {
      setPage("settings");
    },

    onHelpSupport: () => {
      setPage("help");
    },

    onLogout: handleLogout,

    /* NEW */
    sidebarOpen: sidebarOpen,
    onToggleSidebar: toggleSidebar,
  };

  /* =========================================================
     PAGE
     ========================================================= */

  return (
    <ThemeContext.Provider
      value={{
        darkMode,
        toggleDarkMode,
      }}
    >
      {/* =====================================================
          LOGIN PAGE
          ===================================================== */}

      {page === "login" && (
        <LoginPage
          onSignUp={() => setPage("signup")}
          onLogin={() => {
            setSidebarOpen(true);
            setPage("dashboard");
          }}
          onForgotPassword={() => setPage("forgot")}
        />
      )}

      {/* =====================================================
          SIGNUP PAGE
          ===================================================== */}

      {page === "signup" && (
        <SignUpPage
          onLogin={() => setPage("login")}
        />
      )}

      {/* =====================================================
          DASHBOARD
          ===================================================== */}

      {page === "dashboard" && (
        <Dashboard
          {...sidebarProps}
        />
      )}

      {/* =====================================================
          SAVED RESOURCES
          ===================================================== */}

      {page === "saved" && (
        <SavedResources
          {...sidebarProps}
        />
      )}

      {/* =====================================================
          COLLECTIONS
          ===================================================== */}

      {page === "collections" && (
        <Collections
          {...sidebarProps}
        />
      )}

      {/* =====================================================
          FAVORITES
          ===================================================== */}

      {page === "favorites" && (
        <Favorites
          {...sidebarProps}
        />
      )}

      {/* =====================================================
          RECENT
          ===================================================== */}

      {page === "recent" && (
        <Recent
          {...sidebarProps}
        />
      )}

      {/* =====================================================
          TAGS
          ===================================================== */}

      {page === "tags" && (
        <Tags
          {...sidebarProps}
        />
      )}

      {/* =====================================================
          NOTES
          ===================================================== */}

      {page === "notes" && (
        <Notes
          {...sidebarProps}
        />
      )}

      {/* =====================================================
          SETTINGS
          ===================================================== */}

      {page === "settings" && (
        <Settings
          {...sidebarProps}
        />
      )}

      {/* =====================================================
          FORGOT PASSWORD
          ===================================================== */}

      {page === "forgot" && (
        <ForgotPasswordPage
          onBackToLogin={() => setPage("login")}
        />
      )}

      {/* =====================================================
          HELP & SUPPORT
          ===================================================== */}

      {page === "help" && (
        <HelpSupport
          {...sidebarProps}
        />
      )}
    </ThemeContext.Provider>
  );
}

export default App;