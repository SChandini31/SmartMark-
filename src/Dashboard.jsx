import React, { useCallback, useEffect, useMemo, useState } from "react";
import "./Dashboard.css";
import Sidebar from "./Sidebar";
import ThemeToggle from "./ThemeToggle";
import SemanticSearch from "./SemanticSearch";
import Notifications from "./Notifications";
import { apiRequest } from "./authApi";

const resourceTypeDetails = [
  { key: "article", label: "Article", color: "#6c5ce7" },
  { key: "video", label: "Video", color: "#9b83ee" },
  { key: "github", label: "GitHub", color: "#5147b8" },
  { key: "document", label: "Document", color: "#b2a3f2" },
  { key: "image", label: "Image", color: "#d1c5f7" },
  { key: "note", label: "Note", color: "#8775d2" },
  { key: "other", label: "Other", color: "#d9dbea" },
];

const metricDestinations = {
  "Saved Resources": "saved",
  Collections: "collections",
  Tags: "tags",
  Notes: "notes",
  Favorites: "favorites",
  "Forgotten Resources": "saved",
};

function isRecord(value) {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value)
  );
}

function isNonNegativeNumber(value) {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value >= 0
  );
}

/*
 * Backend dashboard response validation
 *
 * Important:
 * recently_saved[].resource_type can be:
 * - a string
 * - null
 *
 * The backend currently returns null for some resources,
 * so null is accepted here.
 */
function isDashboardResponse(value) {
  return (
    isRecord(value) &&
    isRecord(value.stats) &&

    [
      "resources",
      "collections",
      "tags",
      "notes",
      "favorites",
      "forgotten_resources",
    ].every((key) =>
      isNonNegativeNumber(value.stats[key])
    ) &&

    Array.isArray(value.saving_activity) &&
    value.saving_activity.every((item) => (
      isRecord(item) &&
      typeof item.date === "string" &&
      isNonNegativeNumber(item.count)
    )) &&

    Array.isArray(value.resource_types) &&
    value.resource_types.every((item) => (
      isRecord(item) &&
      typeof item.type === "string" &&
      isNonNegativeNumber(item.count)
    )) &&

    Array.isArray(value.recently_saved) &&
    value.recently_saved.every((item) => (
      isRecord(item) &&
      typeof item.id === "number" &&
      typeof item.title === "string" &&
      typeof item.url === "string" &&

      // Backend may return null for resource_type
      (
        typeof item.resource_type === "string" ||
        item.resource_type === null
      ) &&

      typeof item.source_domain === "string" &&

      (
        typeof item.preview_image === "string" ||
        item.preview_image === null
      ) &&

      typeof item.created_at === "string" &&
      typeof item.is_favorite === "boolean"
    ))
  );
}

function getTimeGreeting(date = new Date()) {
  const hour = date.getHours();

  if (hour < 12) {
    return "Good morning";
  }

  if (hour < 17) {
    return "Good afternoon";
  }

  return "Good evening";
}

/*
 * Converts backend resource types into
 * user-friendly dashboard categories.
 *
 * Handles null safely.
 */
function formatResourceType(type) {
  if (!type || typeof type !== "string") {
    return "Other";
  }

  const normalized = type.toLowerCase();

  if (normalized.includes("article")) {
    return "Article";
  }

  if (
    normalized.includes("video") ||
    normalized.includes("youtube")
  ) {
    return "Video";
  }

  if (
    normalized.includes("github") ||
    normalized.includes("repository")
  ) {
    return "GitHub";
  }

  if (
    normalized.includes("document") ||
    normalized.includes("pdf")
  ) {
    return "Document";
  }

  if (
    normalized.includes("image") ||
    normalized.includes("photo")
  ) {
    return "Image";
  }

  if (normalized.includes("note")) {
    return "Note";
  }

  return "Other";
}

function resourceIcon(type) {
  const label = formatResourceType(type);

  if (label === "Article") {
    return "▤";
  }

  if (label === "Video") {
    return "▶";
  }

  if (label === "GitHub") {
    return "⌘";
  }

  if (label === "Document") {
    return "▧";
  }

  if (label === "Image") {
    return "▧";
  }

  if (label === "Note") {
    return "✎";
  }

  return "↗";
}

function formatSavedDate(dateValue) {
  const date = new Date(dateValue);

  if (Number.isNaN(date.getTime())) {
    return "Date unavailable";
  }

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

/*
 * Creates the SVG line chart path
 */
function buildActivityPath(
  items,
  width,
  height,
  padding,
  maximum
) {
  const usableWidth =
    width - padding.left - padding.right;

  const usableHeight =
    height - padding.top - padding.bottom;

  const points = items.map((item, index) => ({
    x:
      items.length === 1
        ? width / 2
        : padding.left +
          (index * usableWidth) /
            (items.length - 1),

    y:
      padding.top +
      usableHeight -
      (item.count / maximum) *
        usableHeight,
  }));

  if (!points.length) {
    return {
      points,
      path: "",
    };
  }

  if (points.length === 1) {
    return {
      points,
      path: `M ${points[0].x} ${points[0].y}`,
    };
  }

  const path = points.reduce(
    (result, point, index) => {
      if (index === 0) {
        return `M ${point.x} ${point.y}`;
      }

      const previous = points[index - 1];

      const middleX =
        (previous.x + point.x) / 2;

      return `${result} Q ${middleX} ${previous.y}, ${middleX} ${
        (previous.y + point.y) / 2
      } T ${point.x} ${point.y}`;
    },
    ""
  );

  return {
    points,
    path,
  };
}

/*
 * Saving Activity Chart
 */
function SavingActivityChart({ items }) {
  const width = 760;
  const height = 250;

  const padding = {
    top: 20,
    right: 18,
    bottom: 40,
    left: 38,
  };

  const maximum = Math.max(
    1,
    ...items.map((item) => item.count)
  );

  const { points, path } =
    buildActivityPath(
      items,
      width,
      height,
      padding,
      maximum
    );

  const total = items.reduce(
    (sum, item) => sum + item.count,
    0
  );

  const hasActivity = total > 0;

  const gridValues = [
    ...new Set([
      0,
      Math.ceil(maximum / 2),
      maximum,
    ]),
  ];

  const chartBottom =
    height - padding.bottom;

  return (
    <section
      className="dashboard-panel activity-panel"
      aria-labelledby="saving-activity-title"
    >
      <div className="dashboard-panel-heading">
        <div>
          <h2 id="saving-activity-title">
            Saving Activity
          </h2>

          <p>
            Resources saved over time
          </p>
        </div>

        {hasActivity && (
          <span className="activity-total">
            {total} saved
          </span>
        )}
      </div>

      {!items.length ? (
        <p className="dashboard-empty-state">
          No saving activity is available yet.
        </p>
      ) : !hasActivity ? (
        <p className="dashboard-empty-state">
          Your saving activity will appear
          here when you save resources.
        </p>
      ) : (
        <div className="activity-chart-wrap">
          <svg
            className="activity-chart"
            viewBox={`0 0 ${width} ${height}`}
            role="img"
            aria-label="Saving activity line chart. The horizontal axis shows days and the vertical axis shows resources saved."
            preserveAspectRatio="none"
          >
            {gridValues.map((value) => {
              const y =
                padding.top +
                ((maximum - value) /
                  maximum) *
                  (chartBottom -
                    padding.top);

              return (
                <g key={`grid-${value}`}>
                  <line
                    className="activity-grid-line"
                    x1={padding.left}
                    x2={width - padding.right}
                    y1={y}
                    y2={y}
                  />

                  <text
                    className="activity-axis-label"
                    x={padding.left - 10}
                    y={y + 4}
                    textAnchor="end"
                  >
                    {value}
                  </text>
                </g>
              );
            })}

            <path
              className="activity-area"
              d={`${path} L ${
                points[
                  points.length - 1
                ]?.x ?? padding.left
              } ${chartBottom} L ${
                points[0]?.x ?? padding.left
              } ${chartBottom} Z`}
            />

            <path
              className="activity-line"
              d={path}
            />

            {points.map((point, index) => (
              <g
                className="activity-point"
                key={`${items[index].date}-${index}`}
              >
                <circle
                  className="activity-point-hit-area"
                  cx={point.x}
                  cy={point.y}
                  r="12"
                />

                <circle
                  className="activity-point-dot"
                  cx={point.x}
                  cy={point.y}
                  r="4"
                />

                <title>
                  {`${items[index].date}: ${
                    items[index].count
                  } ${
                    items[index].count === 1
                      ? "resource"
                      : "resources"
                  } saved`}
                </title>
              </g>
            ))}

            {items.map((item, index) => (
              <text
                className="activity-axis-label activity-day-label"
                key={`day-${index}`}
                x={points[index].x}
                y={height - 12}
                textAnchor="middle"
              >
                {item.date}
              </text>
            ))}
          </svg>
        </div>
      )}
    </section>
  );
}

/*
 * Knowledge Mix
 */
function KnowledgeMix({
  resourceTypes,
  totalResources,
}) {
  const categorizedCounts = useMemo(() => {
    const counts = Object.fromEntries(
      resourceTypeDetails.map(
        ({ key }) => [key, 0]
      )
    );

    resourceTypes.forEach(
      ({ type, count }) => {
        const category =
          formatResourceType(type).toLowerCase();

        if (
          Object.prototype.hasOwnProperty.call(
            counts,
            category
          )
        ) {
          counts[category] += count;
        } else {
          counts.other += count;
        }
      }
    );

    return resourceTypeDetails.map(
      (category) => ({
        ...category,
        count: counts[category.key],
      })
    );
  }, [resourceTypes]);

  const presentTypes =
    categorizedCounts.filter(
      ({ count }) => count > 0
    );

  const totalByType =
    categorizedCounts.reduce(
      (sum, item) => sum + item.count,
      0
    );

  let cumulative = 0;

  const gradientStops =
    totalByType > 0
      ? presentTypes.map((item) => {
          const start = cumulative;

          cumulative +=
            (item.count / totalByType) *
            100;

          return `${item.color} ${start}% ${cumulative}%`;
        })
      : [];

  const donutStyle = gradientStops.length
    ? {
        background: `conic-gradient(${gradientStops.join(
          ", "
        )})`,
      }
    : undefined;

  return (
    <section
      className="dashboard-panel mix-panel"
      aria-labelledby="knowledge-mix-title"
    >
      <div className="dashboard-panel-heading">
        <div>
          <h2 id="knowledge-mix-title">
            Your Knowledge Mix
          </h2>

          <p>
            What you’ve been collecting
          </p>
        </div>

        <span className="mix-total">
          {totalResources} total
        </span>
      </div>

      {!totalByType ||
      !presentTypes.length ? (
        <p className="dashboard-empty-state">
          Your resource types will appear
          here as you save resources.
        </p>
      ) : (
        <div
          className={`knowledge-mix-content ${
            presentTypes.length > 4
              ? "has-many-types"
              : ""
          }`}
        >
          {presentTypes.length <= 4 ? (
            <div
              className="mix-donut"
              style={donutStyle}
              role="img"
              aria-label={`Distribution of ${totalByType} resources by type`}
            >
              <div className="mix-donut-center">
                <strong>
                  {totalByType}
                </strong>

                <span>resources</span>
              </div>
            </div>
          ) : null}

          <ul className="mix-legend">
            {presentTypes.map((item) => (
              <li key={item.key}>
                {presentTypes.length > 4 && (
                  <div className="mix-bar-track">
                    <span
                      className="mix-bar-fill"
                      style={{
                        width: `${Math.max(
                          2,
                          (item.count /
                            totalByType) *
                            100
                        )}%`,
                        backgroundColor:
                          item.color,
                      }}
                    />
                  </div>
                )}

                <span className="mix-legend-label">
                  <i
                    style={{
                      backgroundColor:
                        item.color,
                    }}
                  />

                  {item.label}
                </span>

                <strong>
                  {item.count}
                </strong>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

/*
 * Dashboard
 */
function Dashboard({
  onSavedResources,
  onCollections,
  onTags,
  onNotes,
  onFavorites,
  onRecent,
  onSettings,
  onHelpSupport,
  onLogout,
}) {
  const [greeting] = useState(
    () => getTimeGreeting()
  );

  const [searchQuery, setSearchQuery] =
    useState("");

  const [dashboardData, setDashboardData] =
    useState(null);

  const [isLoading, setIsLoading] =
    useState(true);

  const [errorMessage, setErrorMessage] =
    useState("");

  /*
   * Load dashboard data from backend
   */
  const loadDashboard =
    useCallback(async () => {
      setIsLoading(true);
      setErrorMessage("");

      try {
        /*
         * Backend endpoint:
         * GET /api/dashboard/
         */
        const result =
          await apiRequest("dashboard/");

        console.log(
          "Dashboard API response:",
          result
        );

        /*
         * Validate backend response
         */
        if (!isDashboardResponse(result)) {
          console.error(
            "Unexpected dashboard response:",
            result
          );

          throw new Error(
            "The server returned an unexpected dashboard response."
          );
        }

        setDashboardData(result);
      } catch (error) {
        console.error(
          "Dashboard loading error:",
          error
        );

        setErrorMessage(
          error.message ||
            "Unable to load your dashboard."
        );
      } finally {
        setIsLoading(false);
      }
    }, []);

  /*
   * Load dashboard when component opens
   */
  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  /*
   * Show only latest 5 resources
   */
  const displayedResources =
    useMemo(
      () =>
        dashboardData?.recently_saved.slice(
          0,
          5
        ) ?? [],
      [dashboardData]
    );

  const typeData =
    dashboardData?.resource_types ?? [];

  const stats =
    dashboardData?.stats;

  /*
   * Navigation for dashboard metrics
   */
  const navigateByMetric = {
    saved: onSavedResources,
    collections: onCollections,
    tags: onTags,
    notes: onNotes,
    favorites: onFavorites,
    forgotten: onSavedResources,
  };

  /*
   * Dashboard metric cards
   */
  const metrics = stats
    ? [
        {
          label: "Saved Resources",
          value: stats.resources,
          icon: "▤",
          destination: "saved",
        },

        {
          label: "Collections",
          value: stats.collections,
          icon: "▱",
          destination: "collections",
        },

        {
          label: "Tags",
          value: stats.tags,
          icon: "#",
          destination: "tags",
        },

        {
          label: "Notes",
          value: stats.notes,
          icon: "✎",
          destination: "notes",
        },

        {
          label: "Favorites",
          value: stats.favorites,
          icon: "♡",
          destination: "favorites",
        },

        {
          label: "Forgotten Resources",
          value:
            stats.forgotten_resources,
          icon: "↻",
          destination: "forgotten",
        },
      ]
    : [];

  return (
    <div className="dashboard-container">

      {/* ================= SIDEBAR ================= */}

      <Sidebar
        activePage="dashboard"
        onSavedResources={
          onSavedResources
        }
        onCollections={onCollections}
        onTags={onTags}
        onNotes={onNotes}
        onFavorites={onFavorites}
        onRecent={onRecent}
        onSettings={onSettings}
        onHelpSupport={onHelpSupport}
        onLogout={onLogout}
      />

      {/* ================= MAIN ================= */}

      <main className="dashboard-main">

        {/* ================= HEADER ================= */}

        <header className="dashboard-header">

          <div className="header-search">

            <span aria-hidden="true">
              ⌕
            </span>

            <input
              type="text"
              placeholder="Search your saved knowledge..."
              value={searchQuery}
              onChange={(event) =>
                setSearchQuery(
                  event.target.value
                )
              }
              aria-label="Search your saved knowledge"
            />

            <SemanticSearch
              query={searchQuery}
            />

          </div>

          <div className="header-actions">

            <Notifications
              onSavedResources={
                onSavedResources
              }
              onCollections={
                onCollections
              }
              onTags={onTags}
            />

            <ThemeToggle />

            <div className="header-divider" />

            <button
              aria-label="Open profile settings for Chandini"
              className="header-profile profile-settings-trigger"
              onClick={onSettings}
              type="button"
            >
              <div className="profile-avatar small">
                M
              </div>

              <div>
                <strong>
                  Chandini
                </strong>

                <span>
                  My Account
                </span>
              </div>

              <span className="arrow">
                ⌄
              </span>
            </button>

          </div>

        </header>

        {/* ================= CONTENT ================= */}

        <section className="dashboard-content dashboard-redesign">

          {/* ================= WELCOME ================= */}

          <div className="welcome-section">

            <div>

              <p className="welcome-label">
                YOUR KNOWLEDGE SPACE
              </p>

              <h1>
                {greeting}, Chandini{" "}
                <span aria-hidden="true">
                  👋
                </span>
              </h1>

              <p className="welcome-description">
                Everything you&apos;ve saved,
                organized and discovered —
                all in one place.
              </p>

            </div>

            <button
              className="save-resource-btn"
              onClick={onSavedResources}
              type="button"
            >
              <span aria-hidden="true">
                ＋
              </span>

              Save Resource
            </button>

          </div>

          {/* ================= ERROR ================= */}

          {errorMessage && (
            <div
              className="dashboard-load-error"
              role="alert"
            >
              <span>
                {errorMessage}
              </span>

              <button
                onClick={loadDashboard}
                type="button"
                disabled={isLoading}
              >
                {isLoading
                  ? "Retrying…"
                  : "Retry"}
              </button>
            </div>
          )}

          {/* ================= METRICS ================= */}

          <section
            className="knowledge-metrics"
            aria-label="Knowledge metrics"
          >

            {isLoading && !stats ? (
              <p
                className="dashboard-loading-state"
                role="status"
              >
                Loading your knowledge
                overview…
              </p>
            ) : (
              metrics.map((metric) => (
                <button
                  className="knowledge-metric"
                  key={metric.label}
                  onClick={
                    navigateByMetric[
                      metric.destination
                    ]
                  }
                  type="button"
                >

                  <span
                    className="knowledge-metric-icon"
                    aria-hidden="true"
                  >
                    {metric.icon}
                  </span>

                  <span className="knowledge-metric-copy">

                    <strong>
                      {metric.value}
                    </strong>

                    <span>
                      {metric.label}
                    </span>

                  </span>

                </button>
              ))
            )}

          </section>

          {/* ================= DASHBOARD DATA ================= */}

          {dashboardData && (
            <>

              {/* ================= INSIGHTS ================= */}

              <div className="dashboard-insights-grid">

                <SavingActivityChart
                  items={
                    dashboardData.saving_activity
                  }
                />

                <KnowledgeMix
                  resourceTypes={
                    typeData
                  }
                  totalResources={
                    stats.resources
                  }
                />

              </div>

              {/* ================= REDISCOVERY ================= */}

              <section className="knowledge-rediscovery">

                <div
                  className="rediscovery-symbol"
                  aria-hidden="true"
                >
                  ↻
                </div>

                <div className="knowledge-rediscovery-copy">

                  <p className="rediscovery-eyebrow">
                    A MOMENT TO REVISIT
                  </p>

                  <h2>
                    Knowledge to Rediscover
                  </h2>

                  <p>
                    You have{" "}
                    <strong>
                      {
                        stats.forgotten_resources
                      }
                    </strong>{" "}
                    {stats.forgotten_resources ===
                    1
                      ? "resource"
                      : "resources"}{" "}
                    that haven&apos;t been
                    revisited recently.

                    {stats.favorites > 0 && (
                      <>
                        {" "}
                        Keep your{" "}
                        <strong>
                          {stats.favorites}
                        </strong>{" "}
                        {stats.favorites === 1
                          ? "favorite"
                          : "favorites"}{" "}
                        close at hand.
                      </>
                    )}
                  </p>

                </div>

                <button
                  className="rediscovery-action"
                  onClick={
                    onSavedResources
                  }
                  type="button"
                >
                  View Resources{" "}
                  <span aria-hidden="true">
                    →
                  </span>
                </button>

              </section>

              {/* ================= RECENTLY SAVED ================= */}

              <section
                className="dashboard-panel recently-saved-panel"
                aria-labelledby="recently-saved-title"
              >

                <div className="dashboard-panel-heading">

                  <div>

                    <h2 id="recently-saved-title">
                      Recently Saved
                    </h2>

                    <p>
                      Your latest additions
                      to your knowledge space
                    </p>

                  </div>

                  <button
                    className="dashboard-text-action"
                    onClick={
                      onSavedResources
                    }
                    type="button"
                  >
                    View all{" "}
                    <span aria-hidden="true">
                      →
                    </span>
                  </button>

                </div>

                {displayedResources.length ? (
                  <ul className="recently-saved-list">

                    {displayedResources.map(
                      (resource) => (
                        <li
                          className="recently-saved-item"
                          key={resource.id}
                        >

                          {/* Preview image */}

                          {resource.preview_image ? (
                            <img
                              className="recently-saved-preview"
                              src={
                                resource.preview_image
                              }
                              alt=""
                              loading="lazy"
                            />
                          ) : (
                            <span
                              className="recently-saved-icon"
                              aria-hidden="true"
                            >
                              {resourceIcon(
                                resource.resource_type
                              )}
                            </span>
                          )}

                          {/* Resource information */}

                          <div className="recently-saved-info">

                            <a
                              href={resource.url}
                              target="_blank"
                              rel="noreferrer"
                              className="recently-saved-title"
                            >
                              {resource.title ||
                                resource.url ||
                                "Untitled resource"}
                            </a>

                            <div className="recently-saved-meta">

                              <span>
                                {resource.source_domain ||
                                  "Unknown source"}
                              </span>

                              <span>
                                {formatResourceType(
                                  resource.resource_type
                                )}
                              </span>

                              <time
                                dateTime={
                                  resource.created_at
                                }
                              >
                                {formatSavedDate(
                                  resource.created_at
                                )}
                              </time>

                            </div>

                          </div>

                          {/* Favorite */}

                          <span
                            className={`recently-saved-favorite ${
                              resource.is_favorite
                                ? "is-favorite"
                                : ""
                            }`}
                            aria-label={
                              resource.is_favorite
                                ? "Favorite"
                                : "Not a favorite"
                            }
                            title={
                              resource.is_favorite
                                ? "Favorite"
                                : "Not a favorite"
                            }
                          >
                            {resource.is_favorite
                              ? "★"
                              : "☆"}
                          </span>

                          {/* Open */}

                          <a
                            className="recently-saved-open"
                            href={resource.url}
                            target="_blank"
                            rel="noreferrer"
                            aria-label={`Open ${
                              resource.title ||
                              "resource"
                            }`}
                          >
                            Open
                          </a>

                        </li>
                      )
                    )}

                  </ul>
                ) : (
                  <p className="dashboard-empty-state">
                    Save a resource and it
                    will appear here.
                  </p>
                )}

              </section>

            </>
          )}

          {/* ================= QUICK ACTIONS ================= */}

          <section
            className="dashboard-quick-actions"
            aria-labelledby="quick-actions-title"
          >

            <div className="dashboard-panel-heading">

              <div>

                <h2 id="quick-actions-title">
                  Quick Actions
                </h2>

                <p>
                  Capture and organize what
                  matters
                </p>

              </div>

            </div>

            <div className="compact-quick-actions">

              <button
                onClick={
                  onSavedResources
                }
                type="button"
              >
                <span aria-hidden="true">
                  ＋
                </span>

                Save Resource
              </button>

              <button
                onClick={onCollections}
                type="button"
              >
                <span aria-hidden="true">
                  ▱
                </span>

                Create Collection
              </button>

              <button
                onClick={onNotes}
                type="button"
              >
                <span aria-hidden="true">
                  ✎
                </span>

                Add Note
              </button>

            </div>

          </section>

        </section>

      </main>

    </div>
  );
}

export default Dashboard;