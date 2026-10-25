import React, { useEffect, useState } from "react";
import "./Favorites.css";
import Sidebar from "./Sidebar";
import ThemeToggle from "./ThemeToggle";
import Notifications from "./Notifications";
import { apiRequest } from "./authApi";

function toFavoriteResource(resource) {
  let domain = resource.source_domain || "";
  if (!domain && resource.url) {
    try {
      domain = new URL(resource.url).hostname;
    } catch {
      domain = resource.url;
    }
  }

  const type = resource.resource_type || "Website";
  const normalizedType = type.toLowerCase();

  return {
    ...resource,
    title: resource.title || resource.url || "Untitled resource",
    description: resource.description || "",
    type,
    domain,
    tags: Array.isArray(resource.tags) ? resource.tags : [],
    icon: normalizedType.includes("video")
      ? "▶️"
      : normalizedType.includes("pdf") || normalizedType.includes("document")
        ? "📄"
        : normalizedType.includes("article")
          ? "📰"
          : "🔗",
  };
}

function Favorites({
  onDashboard,
  onSavedResources,
  onCollections,
  onTags,
  onSettings,
  onNotes,
  onRecent,
  onHelpSupport,
  onSemanticSearch,
  onLogout,
}) {
  const [searchTerm, setSearchTerm] = useState("");
  const [favorites, setFavorites] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [updatingId, setUpdatingId] = useState(null);

  useEffect(() => {
    let isActive = true;

    apiRequest("resources/favorites")
      .then((result) => {
        if (!Array.isArray(result)) {
          throw new Error("The server returned an unexpected favorites response.");
        }
        if (isActive) setFavorites(result.map(toFavoriteResource));
      })
      .catch((error) => {
        if (isActive) setErrorMessage(error.message || "Unable to load favorites.");
      })
      .finally(() => {
        if (isActive) setIsLoading(false);
      });

    return () => {
      isActive = false;
    };
  }, []);

  const filteredFavorites = favorites.filter((item) => {
    const search = searchTerm.toLowerCase();

    return (
      item.title.toLowerCase().includes(search) ||
      item.description.toLowerCase().includes(search) ||
      item.domain.toLowerCase().includes(search) ||
      item.tags.some((tag) =>
        tag.toLowerCase().includes(search)
      )
    );
  });

  const removeFavorite = async (resource) => {
    setErrorMessage("");
    setUpdatingId(resource.id);

    try {
      await apiRequest(`resources/${resource.id}/favorite`, { method: "PATCH" });
      setFavorites((currentFavorites) => (
        currentFavorites.filter((item) => item.id !== resource.id)
      ));
    } catch (error) {
      setErrorMessage(error.message || "Unable to update this favorite.");
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div className="favorites-container">

      <Sidebar
        activePage="favorites"
        onDashboard={onDashboard}
        onSavedResources={onSavedResources}
        onCollections={onCollections}
        onTags={onTags}
        onNotes={onNotes}
        onRecent={onRecent}
        onSettings={onSettings}
        onHelpSupport={onHelpSupport}
        onSemanticSearch={onSemanticSearch}
        onLogout={onLogout}
      />

      {/* ================= MAIN ================= */}
      <main className="favorites-main">

        {/* Header */}
        <header className="favorites-header">

          <div className="favorites-header-search">
            <span>⌕</span>

            <input
              type="text"
              placeholder="Search your saved knowledge..."
            />

          </div>

          <div className="favorites-header-actions">

            <Notifications
              onSavedResources={onSavedResources}
              onCollections={onCollections}
              onTags={onTags}
            />

            <ThemeToggle />

            <div className="favorites-header-divider"></div>

            <button
              aria-label="Open profile settings for Monika"
              className="favorites-header-profile profile-settings-trigger"
              onClick={onSettings}
              type="button"
            >

              <div className="favorites-profile-avatar small">
                M
              </div>

              <div>
                <strong>Monika</strong>
                <span>My Account</span>
              </div>

              <span className="favorites-profile-arrow">
                ⌄
              </span>

            </button>

          </div>
        </header>


        {/* Content */}
        <section className="favorites-content">

          {/* Heading */}
          <div className="favorites-page-heading">

            <div>

              <h1>Favorites</h1>

              <p>
                Quickly access the resources that matter most to you.
              </p>
            </div>

            <div className="favorites-count-box">
              <span>⭐</span>
              <strong>{isLoading ? "…" : favorites.length}</strong>
              <small>Favorite Resources</small>
            </div>

          </div>

          {errorMessage && (
            <p className="favorites-api-error" role="alert">{errorMessage}</p>
          )}


          {/* Search */}
          <div className="favorites-toolbar">

            
<div className="favorites-search-box">
  <span>⌕</span>

  <input
    type="text"
    placeholder="Search your favorites..."
    value={searchTerm}
    onChange={(e) => setSearchTerm(e.target.value)}
  />
</div>
            <button className="favorites-filter-btn">
              ☰ Filter
            </button>

            <button className="favorites-sort-btn">
              Latest
              <span>⌄</span>
            </button>

          </div>


          {/* Section Heading */}
          <div className="favorites-list-heading">

            <div>
              <h2>Favorite Resources</h2>
              <span>{filteredFavorites.length} resources</span>
            </div>

            <button className="favorites-view-btn">
              ▦
            </button>

          </div>


          {/* Favorites */}
          {isLoading ? (
            <p className="favorites-loading" role="status">Loading your favorites...</p>
          ) : filteredFavorites.length > 0 ? (

            <div className="favorites-grid">

              {filteredFavorites.map((item) => (

                <article
                  className="favorite-card"
                  key={item.id}
                >

                  <div className="favorite-card-top">

                    <div className="favorite-resource-icon">
                      {item.icon}
                    </div>

                    <button
                      className="favorite-star"
                      disabled={updatingId === item.id}
                      onClick={() => removeFavorite(item)}
                      aria-label={`Remove ${item.title} from favorites`}
                    >
                      {updatingId === item.id ? "…" : "★"}
                    </button>

                  </div>


                  <div className="favorite-card-body">

                    <div className="favorite-resource-type">
                      {item.type}
                    </div>

                    <h3>{item.title}</h3>

                    <p>
                      {item.description}
                    </p>

                    <div className="favorite-domain">
                      🌐 {item.domain}
                    </div>

                  </div>


                  <div className="favorite-tags">

                    {item.tags.map((tag) => (
                      <span key={tag}>
                        #{tag}
                      </span>
                    ))}

                  </div>


                  <div className="favorite-card-footer">

                    <span>🕘 Saved resource</span>

                    <a
                      className="open-resource-btn"
                      href={item.url}
                      rel="noreferrer"
                      target="_blank"
                    >
                      Open →
                    </a>

                  </div>

                </article>

              ))}

            </div>

          ) : (

            <div className="favorites-empty">

              <div className="favorites-empty-icon">
                ⭐
              </div>

              <h2>No favorites found</h2>

              <p>
                Try another search or add resources to your favorites.
              </p>

            </div>

          )}


          {/* Insight */}
          <section className="favorites-insight">

            <div className="favorites-insight-icon">
              ✨
            </div>

            <div>
              <span>SMARTMARK TIP</span>

              <h3>
                Keep your most important resources close
              </h3>

              <p>
                Favorite resources are easier to find when you
                need them for learning, projects or interviews.
              </p>
            </div>

          </section>


          <div className="favorites-footer">
            <span>SmartMark</span>
            <span>
              Personal Information Retrieval & Knowledge Management System
            </span>
          </div>

        </section>
      </main>
    </div>
  );
}

export default Favorites;