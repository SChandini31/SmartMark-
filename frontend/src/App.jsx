import { useEffect, useState } from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useNavigate,
} from "react-router-dom";

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
import SemanticSearchPage from "./SemanticSearchPage";
import { ThemeContext } from "./ThemeToggle";

function AppContent() {
  const navigate = useNavigate();

  const [sidebarOpen, setSidebarOpen] = useState(true);

  // DARK MODE
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

  useEffect(() => {
    document.documentElement.dataset.theme = darkMode ? "dark" : "light";
  }, [darkMode]);

  // EXPIRED SESSION
  useEffect(() => {
    const handleExpiredSession = () => {
      setSidebarOpen(true);
      navigate("/login");
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
  }, [navigate]);

  // TOGGLE DARK MODE
  const toggleDarkMode = () => {
    const nextDarkMode = !darkMode;

    setDarkMode(nextDarkMode);

    try {
      window.localStorage.setItem(
        "smartmark-theme",
        nextDarkMode ? "dark" : "light"
      );
    } catch {
      // Dark mode still works for this session.
    }
  };

  // LOGOUT
  const handleLogout = () => {
    try {
      window.localStorage.removeItem("smartmark-access-token");
    } catch {
      // Continue to login.
    }

    setSidebarOpen(true);
    navigate("/login");
  };

  // SIDEBAR NAVIGATION
  const sidebarProps = {
    onDashboard: () => navigate("/dashboard"),
    onSavedResources: () => navigate("/saved-resources"),
    onCollections: (suggestedName) => {
      const name =
        typeof suggestedName === "string" ? suggestedName.trim() : "";

      if (name) {
        const params = new URLSearchParams({ createCollection: name });
        navigate(`/collections?${params.toString()}`);
        return;
      }

      navigate("/collections");
    },
    onTags: () => navigate("/tags"),
    onNotes: () => navigate("/notes"),
    onFavorites: () => navigate("/favorites"),
    onRecent: () => navigate("/recent"),
    onSemanticSearch: () => {
  console.log("Semantic Search clicked");
  navigate("/semantic-search");
},
    onSettings: () => navigate("/settings"),
    onHelpSupport: () => navigate("/help"),
    onLogout: handleLogout,
    sidebarOpen,
    onToggleSidebar: () => {
      setSidebarOpen((previous) => !previous);
    },
  };

  return (
    <ThemeContext.Provider value={{ darkMode, toggleDarkMode }}>
      <Routes>
        <Route
          path="/"
          element={<Navigate to="/login" replace />}
        />

        <Route
          path="/login"
          element={
            <LoginPage
              onSignUp={() => navigate("/signup")}
              onLogin={() => {
                setSidebarOpen(true);
                navigate("/dashboard");
              }}
              onForgotPassword={() => navigate("/forgot-password")}
            />
          }
        />

        <Route
          path="/signup"
          element={
            <SignUpPage onLogin={() => navigate("/login")} />
          }
        />

        <Route
          path="/forgot-password"
          element={
            <ForgotPasswordPage
              onBackToLogin={() => navigate("/login")}
            />
          }
        />

        <Route
          path="/dashboard"
          element={<Dashboard {...sidebarProps} />}
        />

        <Route
          path="/saved-resources"
          element={<SavedResources {...sidebarProps} />}
        />

        <Route
          path="/collections"
          element={<Collections {...sidebarProps} />}
        />

        <Route
          path="/favorites"
          element={<Favorites {...sidebarProps} />}
        />

        <Route
          path="/recent"
          element={<Recent {...sidebarProps} />}
        />

        <Route
          path="/notes"
          element={<Notes {...sidebarProps} />}
        />

        <Route
          path="/tags"
          element={<Tags {...sidebarProps} />}
        />

        <Route
          path="/semantic-search"
          element={<SemanticSearchPage {...sidebarProps} />}
        />

        <Route
          path="/settings"
          element={<Settings {...sidebarProps} />}
        />

        <Route
          path="/help"
          element={<HelpSupport {...sidebarProps} />}
        />

        <Route
          path="*"
          element={<Navigate to="/login" replace />}
        />
      </Routes>
    </ThemeContext.Provider>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  );
}

export default App;
