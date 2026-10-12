import { createContext, useContext } from "react";

export const ThemeContext = createContext({
  darkMode: false,
  toggleDarkMode: () => {},
});

function ThemeToggle() {
  const { darkMode, toggleDarkMode } = useContext(ThemeContext);
  const label = darkMode ? "Switch to light mode" : "Switch to dark mode";

  return (
    <button
      aria-label={label}
      aria-pressed={darkMode}
      className="app-theme-toggle"
      onClick={toggleDarkMode}
      title={label}
      type="button"
    >
      {darkMode ? "☀" : "☾"}
    </button>
  );
}

export default ThemeToggle;