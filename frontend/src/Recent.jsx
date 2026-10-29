import React, { useEffect, useState } from "react";
import "./Recent.css";

import Sidebar from "./Sidebar";
import TopBar from "./TopBar";
import { apiRequest } from "./authApi";

/* Convert API resource data into the format used by this page */
function toRecentResource(resource, index) {
  const safeResource = resource || {};

  const type = safeResource.resource_type || "Website";
  const url = safeResource.url || "";
  let domain = safeResource.source_domain || "";

  if (!domain && url) {
    try {
      domain = new URL(url).hostname;
    } catch {
      domain = url;
    }
  }

  const activityDate =
    safeResource.accessed_at ||
    safeResource.last_accessed_at ||
    safeResource.updated_at ||
    safeResource.created_at;

  let time = "Date unavailable";

  if (activityDate) {
    const parsedDate = new Date(activityDate);

    if (!Number.isNaN(parsedDate.getTime())) {
      time = new Intl.DateTimeFormat(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(parsedDate);
    }
  }

  const normalizedType = String(type).toLowerCase();

  let icon = "🔗";

  if (normalizedType.includes("video")) {
    icon = "▶️";
  } else if (
    normalizedType.includes("pdf") ||
    normalizedType.includes("document")
  ) {
    icon = "📄";
  } else if (
    normalizedType.includes("image") ||
    normalizedType.includes("photo")
  ) {
    icon = "🖼️";
  } else if (normalizedType.includes("note")) {
    icon = "📝";
  }

  const tags = Array.isArray(safeResource.tags)
    ? safeResource.tags.map((tag) =>
        typeof tag === "string"
          ? tag
          : tag?.name || tag?.label || ""
      ).filter(Boolean)
    : [];

  return {
    ...safeResource,
    id: safeResource.id ?? `recent-${index}`,
    title: safeResource.title || url || "Untitled resource",
    url,
    type,
    domain,
    time,
    icon,
    tags,
  };
}

function Recent({
  onDashboard,
  onSavedResources,
  onCollections,
  onTags,
  onSettings,
  onNotes,
  onFavorites,
  onHelpSupport,
  onLogout,
}) {
  const [searchTerm, setSearchTerm] = useState("");
  const [recentItems, setRecentItems] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  /* Load the recent resources displayed on the dashboard */
  useEffect(() => {
    let isActive = true;

    async function loadRecentResources() {
      try {
        setIsLoading(true);
        setErrorMessage("");

        const result = await apiRequest("dashboard/");

        if (!result || !Array.isArray(result.recently_saved)) {
          throw new Error(
            "The dashboard response does not contain recently_saved resources."
          );
        }

        if (isActive) {
          setRecentItems(
            result.recently_saved.map((resource, index) =>
              toRecentResource(resource, index)
            )
          );
        }
      } catch (error) {
        console.error("Error loading recent resources:", error);

        if (isActive) {
          setErrorMessage(
            error?.message || "Unable to load recent resources."
          );
          setRecentItems([]);
        }
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    }

    loadRecentResources();

    return () => {
      isActive = false;
    };
  }, []);

  /* Search by title, resource type, domain, or tag */
  const normalizedSearch = searchTerm.trim().toLowerCase();

  const filteredItems = recentItems.filter((item) => {
    if (!normalizedSearch) return true;

    const title = String(item.title || "").toLowerCase();
    const type = String(item.type || "").toLowerCase();
    const domain = String(item.domain || "").toLowerCase();

    return (
      title.includes(normalizedSearch) ||
      type.includes(normalizedSearch) ||
      domain.includes(normalizedSearch) ||
      item.tags.some((tag) =>
        String(tag).toLowerCase().includes(normalizedSearch)
      )
    );
  });

  const recentByType = (type) =>
    recentItems.filter((item) =>
      String(item.type).toLowerCase().includes(type)
    ).length;

  return (
    <div className="recent-container">
      <Sidebar
        activePage="recent"
        onDashboard={onDashboard}
        onSavedResources={onSavedResources}
        onCollections={onCollections}
        onTags={onTags}
        onNotes={onNotes}
        onFavorites={onFavorites}
        onSettings={onSettings}
        onLogout={onLogout}
      />

      <main className="recent-main">
        <TopBar
          onSavedResources={onSavedResources}
          onCollections={onCollections}
          onTags={onTags}
          onHelpSupport={onHelpSupport}
          onSettings={onSettings}
        />

        {/* Main content */}
        <section className="recent-content">
          {/* Page heading */}
          <div className="recent-page-heading">
            <div>

              <h1>Recent</h1>

              <p>
                See the resources you&apos;ve recently saved and accessed.
              </p>
            </div>

            <div className="recent-activity-box">
              <span>🕘</span>

              <div>
                <strong>
                  {isLoading ? "…" : recentItems.length}
                </strong>

                <small>Recent Resources</small>
              </div>
            </div>
          </div>

          {/* Statistics */}
          <div className="recent-stats">
            <div className="recent-stat-card">
              <div className="recent-stat-icon purple">🔖</div>

              <div>
                <strong>
                  {isLoading ? "…" : recentItems.length}
                </strong>
                <span>Recent Resources</span>
              </div>
            </div>

            <div className="recent-stat-card">
              <div className="recent-stat-icon blue">👁</div>

              <div>
                <strong>
                  {isLoading ? "…" : recentByType("web")}
                </strong>
                <span>Web Resources</span>
              </div>
            </div>

            <div className="recent-stat-card">
              <div className="recent-stat-icon green">📁</div>

              <div>
                <strong>
                  {isLoading ? "…" : recentByType("video")}
                </strong>
                <span>Videos</span>
              </div>
            </div>

            <div className="recent-stat-card">
              <div className="recent-stat-icon orange">⭐</div>

              <div>
                <strong>
                  {isLoading
                    ? "…"
                    : recentByType("pdf") +
                      recentByType("document")}
                </strong>
                <span>Documents</span>
              </div>
            </div>
          </div>

          {/* Search and toolbar */}
          <div className="recent-toolbar">
            <div className="recent-search-box">
  <span>⌕</span>

  <input
    type="text"
    placeholder="Search recent activity..."
    value={searchTerm}
    onChange={(event) => setSearchTerm(event.target.value)}
    aria-label="Search recent activity"
  />
</div>
            <button
              className="recent-filter-btn"
              type="button"
              onClick={() => setSearchTerm("")}
            >
              ✕ Clear Search
            </button>

            <button className="recent-sort-btn" type="button">
              Newest First <span>⌄</span>
            </button>
          </div>

          {/* Recent activity heading */}
          <div className="recent-list-heading">
            <div>
              <h2>Recent Activity</h2>

              <span>
                {isLoading
                  ? "Loading..."
                  : `${filteredItems.length} resources`}
              </span>
            </div>
          </div>

          {/* API error */}
          {errorMessage && (
            <div className="recent-api-error" role="alert">
              <p>{errorMessage}</p>

              <button
                type="button"
                onClick={() => window.location.reload()}
              >
                Try Again
              </button>
            </div>
          )}

          {/* Resource timeline */}
          <div className="recent-timeline">
            {isLoading ? (
              <p className="recent-loading" role="status">
                Loading recent resources...
              </p>
            ) : filteredItems.length > 0 ? (
              filteredItems.map((item) => (
                <div
                  className="recent-timeline-item"
                  key={item.id}
                >
                  <div className="recent-timeline-line">
                    <div className="recent-timeline-dot">
                      {item.icon}
                    </div>
                  </div>

                  <div className="recent-activity-card">
                    <div className="recent-activity-top">
                      <div>
                        <span className="recent-resource-type">
                          {item.type}
                        </span>

                        <h3>{item.title}</h3>
                      </div>

                      <span className="recent-time">{item.time}</span>
                    </div>

                    <div className="recent-domain">
                      🌐 {item.domain || "Website"}
                    </div>

                    <div className="recent-tags">
                      {item.tags.map((tag, index) => (
                        <span key={`${tag}-${index}`}>#{tag}</span>
                      ))}
                    </div>

                    <div className="recent-card-footer">
                      <span>
                        {item.accessed_at || item.last_accessed_at
                          ? "Recently accessed"
                          : "Recently saved"}
                      </span>

                      {item.url ? (
                        <a
                          href={item.url}
                          rel="noopener noreferrer"
                          target="_blank"
                        >
                          Open Resource →
                        </a>
                      ) : (
                        <span>Link unavailable</span>
                      )}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="recent-empty">
                <div className="recent-empty-icon">🕘</div>

                <h2>
                  {recentItems.length === 0
                    ? "No recent resources found"
                    : "No matching resources found"}
                </h2>

                <p>
                  {recentItems.length === 0
                    ? "Save a resource from SmartMark and it will appear here."
                    : "Try searching with a different keyword or clear your search."}
                </p>

                {searchTerm && (
                  <button
                    type="button"
                    onClick={() => setSearchTerm("")}
                  >
                    Clear Search
                  </button>
                )}

                {!searchTerm && onSavedResources && (
                  <button
                    type="button"
                    onClick={onSavedResources}
                  >
                    View Saved Resources
                  </button>
                )}
              </div>
            )}
          </div>

          {/* SmartMark insight */}
          <section className="recent-insight">
            <div className="recent-insight-icon">✨</div>

            <div>
              <span>SMARTMARK INSIGHT</span>

              <h3>Your recent activity at a glance</h3>

              <p>
                SmartMark keeps track of your recent resources so you can
                quickly return to information you were working with.
              </p>
            </div>
          </section>

          {/* Footer */}
          <div className="recent-footer">
            <span>SmartMark</span>

            <span>
              Personal Information Retrieval &amp; Knowledge Management
              System
            </span>
          </div>
        </section>
      </main>
    </div>
  );
}

export default Recent;