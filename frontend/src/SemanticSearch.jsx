import { useState } from "react";
import Sidebar from "./Sidebar";
import TopBar from "./TopBar";
import "./SemanticSearch.css";

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
  const [results, setResults] = useState([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  // Search saved resources through the SmartMark backend.
  const performSearch = async (searchText) => {
    const normalizedQuery = searchText.trim();

    if (!normalizedQuery) {
      setSearchQuery("");
      setResults([]);
      setHasSearched(false);
      setErrorMessage("");
      return;
    }

    setSearchQuery(normalizedQuery);
    setHasSearched(true);
    setIsSearching(true);
    setErrorMessage("");
    setResults([]);

    try {
      const token = window.localStorage.getItem(
        "smartmark-access-token"
      );

      if (!token) {
        throw new Error("Please log in again to search your resources.");
      }

      const params = new URLSearchParams({
        q: normalizedQuery,
        limit: "10",
      });

      const response = await fetch(
        `http://127.0.0.1:8000/api/search/hybrid?${params.toString()}`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
          },
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          typeof data.detail === "string"
            ? data.detail
            : "Unable to search your saved resources."
        );
      }

      // Support either a direct array or a common wrapped response.
      let resources = [];

      if (Array.isArray(data)) {
        resources = data;
      } else if (Array.isArray(data.results)) {
        resources = data.results;
      } else if (Array.isArray(data.items)) {
        resources = data.items;
      } else if (Array.isArray(data.resources)) {
        resources = data.resources;
      } else {
        throw new Error(
          "The search response format was unexpected. Check the API response."
        );
      }

      setResults(resources);
    } catch (error) {
      console.error("Hybrid search failed:", error);
      setResults([]);
      setErrorMessage(
        error.message ||
          "Something went wrong while searching your resources."
      );
    } finally {
      setIsSearching(false);
    }
  };

  const handleSearch = (event) => {
    event.preventDefault();
    performSearch(query);
  };

  const handleSuggestion = (suggestion) => {
    setQuery(suggestion);
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
        onLogout={onLogout}
        sidebarOpen={sidebarOpen}
        onToggleSidebar={onToggleSidebar}
      />

      <main className="semantic-search-main">
        <TopBar
          onSavedResources={onSavedResources}
          onCollections={onCollections}
          onTags={onTags}
          onHelpSupport={onHelpSupport}
          onSettings={onSettings}
        />

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

              <button
                type="submit"
                disabled={!query.trim() || isSearching}
              >
                {isSearching ? "Searching..." : "Search"}
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

              {hasSearched && !isSearching && !errorMessage && (
                <span className="semantic-search-result-count">
                  {results.length} results
                </span>
              )}
            </div>

            {errorMessage && (
              <div className="semantic-search-empty" role="alert">
                <h3>Search failed</h3>
                <p>{errorMessage}</p>
              </div>
            )}

            {isSearching ? (
              <div className="semantic-search-empty" aria-live="polite">
                <h3>Searching your saved resources...</h3>
                <p>Please wait while SmartMark finds relevant results.</p>
              </div>
            ) : errorMessage ? null : results.length > 0 ? (
              <div className="semantic-search-result-list">
                {results.map((resource, index) => {
                  const resourceType =
                    resource.resource_type || "Resource";

                  const resourceUrl = resource.url || resource.source_url;

                  return (
                    <article
                      className="semantic-search-result-card"
                      key={resource.id ?? `${resource.title}-${index}`}
                    >
                      <div
                        className="semantic-search-result-icon"
                        aria-hidden="true"
                      >
                        {String(resourceType)
                          .toLowerCase()
                          .includes("video")
                          ? "▶"
                          : "↗"}
                      </div>

                      <div className="semantic-search-result-details">
                        <h3>{resource.title || "Untitled resource"}</h3>

                        <p>
                          {resource.description ||
                            resource.extracted_text?.slice(0, 200) ||
                            "No description available."}
                        </p>

                        {resource.source_domain && (
                          <span className="semantic-search-domain">
                            {resource.source_domain}
                          </span>
                        )}

                        <span className="semantic-search-domain">
                          {resourceType}
                        </span>

                        {resource.similarity_score != null && (
                          <span className="semantic-search-domain">
                            Relevance:{" "}
                            {(
                              Number(resource.similarity_score) * 100
                            ).toFixed(1)}
                            %
                          </span>
                        )}

                        {resourceUrl ? (
                          <a
                            href={resourceUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="semantic-search-open-link"
                          >
                            Open resource ↗
                          </a>
                        ) : (
                          <span className="semantic-search-domain">
                            No external URL available
                          </span>
                        )}
                      </div>
                    </article>
                  );
                })}
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
                  Try another phrase or check that you have saved resources
                  related to your search.
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
