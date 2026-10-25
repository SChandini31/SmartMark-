import { useState } from "react";
import Sidebar from "./Sidebar";
import ThemeToggle from "./ThemeToggle";
import Notifications from "./Notifications";
import "./SemanticSearch.css";

const sampleResources = [
  {
    id: 1,
    title: "React Documentation",
    description: "Learn React components, props, state, and hooks.",
    resource_type: "Article",
    source_domain: "react.dev",
    url: "https://react.dev/",
    keywords: ["react", "frontend", "javascript", "components", "hooks"],
  },
  {
    id: 2,
    title: "FastAPI Documentation",
    description: "Learn how to build APIs using Python and FastAPI.",
    resource_type: "Documentation",
    source_domain: "fastapi.tiangolo.com",
    url: "https://fastapi.tiangolo.com/",
    keywords: ["fastapi", "python", "api", "backend", "jwt"],
  },
  {
    id: 3,
    title: "JWT Introduction",
    description: "Understand JSON Web Tokens and authentication.",
    resource_type: "Article",
    source_domain: "jwt.io",
    url: "https://jwt.io/introduction",
    keywords: ["jwt", "authentication", "security", "token", "fastapi"],
  },
  {
    id: 4,
    title: "Machine Learning Basics",
    description: "Explore machine learning concepts and algorithms.",
    resource_type: "Learning Resource",
    source_domain: "developers.google.com",
    url: "https://developers.google.com/machine-learning",
    keywords: ["machine learning", "ai", "algorithms", "data"],
  },
  {
    id: 5,
    title: "JavaScript Guide",
    description: "Learn JavaScript fundamentals and web development.",
    resource_type: "Documentation",
    source_domain: "developer.mozilla.org",
    url: "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide",
    keywords: ["javascript", "web development", "frontend", "programming"],
  },
];

function SemanticSearch({
  onDashboard,
  onSavedResources,
  onCollections,
  onTags,
  onNotes,
  onFavorites,
  onRecent,
  onSemanticSearch,
  onSettings,
  onHelpSupport,
  onLogout,
  sidebarOpen = true,
  onToggleSidebar,
}) {
  const [query, setQuery] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [headerQuery, setHeaderQuery] = useState("");
  const [results, setResults] = useState([]);
  const [hasSearched, setHasSearched] = useState(false);

  // Search the sample resources locally.
  const performSearch = (searchText) => {
    const normalizedQuery = searchText.trim().toLowerCase();

    if (!normalizedQuery) {
      setSearchQuery("");
      setResults([]);
      setHasSearched(false);
      return;
    }

    const queryWords = normalizedQuery.split(/\s+/).filter(Boolean);

    const matchedResources = sampleResources
      .map((resource) => {
        const searchableText = [
          resource.title,
          resource.description,
          resource.resource_type,
          resource.source_domain,
          ...resource.keywords,
        ]
          .join(" ")
          .toLowerCase();

        const score = queryWords.reduce(
          (total, word) =>
            total + (searchableText.includes(word) ? 1 : 0),
          0
        );

        return { ...resource, score };
      })
      .filter((resource) => resource.score > 0)
      .sort((a, b) => b.score - a.score);

    setSearchQuery(searchText.trim());
    setResults(matchedResources);
    setHasSearched(true);
  };

  const handleSearch = (event) => {
    event.preventDefault();
    performSearch(query);
  };

  const handleSuggestion = (suggestion) => {
    setQuery(suggestion);
  };

  const handleHeaderSearch = (event) => {
    event.preventDefault();

    if (!headerQuery.trim()) return;

    setQuery(headerQuery);
    performSearch(headerQuery);
  };

  return (
    <div className="semantic-search-page">
      <Sidebar
        activePage="semantic-search"
        onDashboard={onDashboard}
        onSavedResources={onSavedResources}
        onCollections={onCollections}
        onTags={onTags}
        onNotes={onNotes}
        onFavorites={onFavorites}
        onRecent={onRecent}
        onSemanticSearch={onSemanticSearch}
        onSettings={onSettings}
        onHelpSupport={onHelpSupport}
        onLogout={onLogout}
        sidebarOpen={sidebarOpen}
        onToggleSidebar={onToggleSidebar}
      />

      <main className="semantic-search-main">
        <header className="semantic-search-topbar">
          <form
            className="semantic-search-topbar-search"
            onSubmit={handleHeaderSearch}
          >
            <span aria-hidden="true">⌕</span>

            <input
              type="search"
              placeholder="Search your saved knowledge..."
              value={headerQuery}
              onChange={(event) =>
                setHeaderQuery(event.target.value)
              }
              aria-label="Search your saved knowledge"
            />
          </form>

          <div className="semantic-search-header-actions">
            <Notifications
              onSavedResources={onSavedResources}
              onCollections={onCollections}
              onTags={onTags}
            />

            <ThemeToggle />

            <span
              className="semantic-search-header-divider"
              aria-hidden="true"
            />

            <button
              className="semantic-search-profile"
              type="button"
              onClick={onSettings}
              aria-label="Open profile settings"
            >
              <span className="semantic-search-avatar">M</span>

              <span className="semantic-search-profile-copy">
                <strong>My Account</strong>
                <span>SmartMark User</span>
              </span>

              <span className="semantic-search-profile-arrow">
                ⌄
              </span>
            </button>
          </div>
        </header>

        <section className="semantic-search-page-heading">
          <div>
            <h1>Semantic Search</h1>
            <p>
              Find resources using meaning and keyword matching.
            </p>
          </div>
        </section>

        <section className="semantic-search-content">
          <section className="semantic-search-hero">
            <div
              className="semantic-search-hero-icon"
              aria-hidden="true"
            >
              ✨
            </div>

            <h2>Discover what you saved</h2>

            <p>
              Describe a topic, concept, or question to discover
              related resources.
            </p>

            <form
              className="semantic-search-form"
              onSubmit={handleSearch}
            >
              <span
                className="semantic-search-input-icon"
                aria-hidden="true"
              >
                ⌕
              </span>

              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Try: JWT authentication with FastAPI"
                aria-label="Search resources"
              />

              <button type="submit" disabled={!query.trim()}>
                Search
              </button>
            </form>

            <div className="semantic-search-hint">
              <span>Try searching for:</span>

              <button
                type="button"
                onClick={() =>
                  handleSuggestion(
                    "React tutorials and frontend development"
                  )
                }
              >
                React tutorials
              </button>

              <button
                type="button"
                onClick={() =>
                  handleSuggestion("JWT authentication with FastAPI")
                }
              >
                FastAPI authentication
              </button>

              <button
                type="button"
                onClick={() =>
                  handleSuggestion("Machine learning fundamentals")
                }
              >
                Machine learning
              </button>
            </div>
          </section>

          <section className="semantic-search-results">
            <div className="semantic-search-results-header">
              <div>
                <h2>
                  {hasSearched ? "Search Results" : "Ready to explore?"}
                </h2>

                <p>
                  {hasSearched
                    ? `Results for "${searchQuery}"`
                    : "Your matching resources will appear here."}
                </p>
              </div>

              {hasSearched && (
                <span className="semantic-search-result-count">
                  {results.length} results
                </span>
              )}
            </div>

            {results.length > 0 ? (
              <div className="semantic-search-result-list">
                {results.map((resource) => (
                  <article
                    className="semantic-search-result-card"
                    key={resource.id}
                  >
                    <div
                      className="semantic-search-result-icon"
                      aria-hidden="true"
                    >
                      {resource.resource_type.toLowerCase().includes("video")
                        ? "▶"
                        : "↗"}
                    </div>

                    <div className="semantic-search-result-details">
                      <h3>{resource.title}</h3>
                      <p>{resource.description}</p>

                      {resource.source_domain && (
                        <span className="semantic-search-domain">
                          {resource.source_domain}
                        </span>
                      )}

                      <a
                        href={resource.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="semantic-search-open-link"
                      >
                        Open resource ↗
                      </a>
                    </div>
                  </article>
                ))}
              </div>
            ) : hasSearched ? (
              <div className="semantic-search-empty">
                <div
                  className="semantic-search-empty-icon"
                  aria-hidden="true"
                >
                  ⌕
                </div>

                <h3>No matching resources found</h3>

                <p>
                  Try searching for React, JavaScript, FastAPI,
                  JWT authentication, or machine learning.
                </p>
              </div>
            ) : (
              <div className="semantic-search-empty">
                <div
                  className="semantic-search-empty-icon"
                  aria-hidden="true"
                >
                  ✦
                </div>

                <h3>Your next discovery starts here</h3>

                <p>
                  Enter a search phrase above or select a suggested
                  topic to explore resources.
                </p>
              </div>
            )}
          </section>
        </section>
      </main>
    </div>
  );
}

export default SemanticSearch;