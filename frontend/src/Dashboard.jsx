import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import "./Dashboard.css";
import Sidebar from "./Sidebar";
import TopBar from "./TopBar";
import { apiRequest } from "./authApi";
import useProfileName from "./useProfileName";

const resourceTypeDetails = [
  { key: "article", label: "Article", color: "#6c5ce7" },
  { key: "video", label: "Video", color: "#9b83ee" },
  { key: "github", label: "GitHub", color: "#5147b8" },
  { key: "document", label: "Document", color: "#b2a3f2" },
  { key: "image", label: "Image", color: "#d1c5f7" },
  { key: "note", label: "Note", color: "#8775d2" },
  { key: "other", label: "Other", color: "#d9dbea" },
];

function isRecord(value) {
  return value !== null &&
    typeof value === "object" &&
    !Array.isArray(value);
}

function isNonNegativeNumber(value) {
  return typeof value === "number" &&
    Number.isFinite(value) &&
    value >= 0;
}

function isStringOrNull(value) {
  return typeof value === "string" || value === null;
}

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
    value.saving_activity.every(
      (item) =>
        isRecord(item) &&
        typeof item.date === "string" &&
        isNonNegativeNumber(item.count)
    ) &&
    Array.isArray(value.resource_types) &&
    value.resource_types.every(
      (item) =>
        isRecord(item) &&
        typeof item.type === "string" &&
        isNonNegativeNumber(item.count)
    ) &&
    Array.isArray(value.recently_saved) &&
    value.recently_saved.every(
      (item) =>
        isRecord(item) &&
        typeof item.id === "number" &&
        typeof item.title === "string" &&
        isStringOrNull(item.url) &&
        isStringOrNull(item.resource_type) &&
        isStringOrNull(item.source_domain) &&
        isStringOrNull(item.preview_image) &&
        typeof item.created_at === "string" &&
        typeof item.is_favorite === "boolean"
    )
  );
}

function getTimeGreeting(date = new Date()) {
  const hour = date.getHours();

  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";

  return "Good evening";
}

function formatResourceType(type) {
  if (!type || typeof type !== "string") return "Other";

  const normalized = type.toLowerCase();

  if (normalized.includes("article")) return "Article";

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

  if (normalized.includes("note")) return "Note";

  return "Other";
}

function resourceIcon(type) {
  const label = formatResourceType(type);

  if (label === "Article") return "▤";
  if (label === "Video") return "▶";
  if (label === "GitHub") return "⌘";

  if (label === "Document" || label === "Image") {
    return "▧";
  }

  if (label === "Note") return "✎";

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
          (index * usableWidth) / (items.length - 1),

    y:
      padding.top +
      usableHeight -
      (item.count / maximum) * usableHeight,
  }));

  if (!points.length) {
    return { points, path: "" };
  }

  if (points.length === 1) {
    return {
      points,
      path: `M ${points[0].x} ${points[0].y}`,
    };
  }

  const path = points.reduce((result, point, index) => {
    if (index === 0) {
      return `M ${point.x} ${point.y}`;
    }

    const previous = points[index - 1];
    const middleX = (previous.x + point.x) / 2;

    return `${result} Q ${middleX} ${previous.y}, ${middleX} ${
      (previous.y + point.y) / 2
    } T ${point.x} ${point.y}`;
  }, "");

  return { points, path };
}

function SavingActivityChart({ items = [] }) {
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

  const { points, path } = buildActivityPath(
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

  const chartBottom = height - padding.bottom;

  const gridValues = [
    ...new Set([
      0,
      Math.ceil(maximum / 2),
      maximum,
    ]),
  ];

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
          <p>Resources saved over time</p>
        </div>

        {total > 0 && (
          <span className="activity-total">
            {total} saved
          </span>
        )}
      </div>

      {!items.length || total === 0 ? (
        <p className="dashboard-empty-state">
          Your saving activity will appear here when you save resources.
        </p>
      ) : (
        <div className="activity-chart-wrap">
          <svg
            className="activity-chart"
            viewBox={`0 0 ${width} ${height}`}
            role="img"
            aria-label="Saving activity chart"
            preserveAspectRatio="none"
          >
            {gridValues.map((value) => {
              const y =
                padding.top +
                ((maximum - value) / maximum) *
                  (chartBottom - padding.top);

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
                points[points.length - 1]?.x ?? padding.left
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
                  {`${items[index].date}: ${items[index].count} resources saved`}
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

function KnowledgeMix({
  resourceTypes = [],
  totalResources = 0,
}) {
  const categorizedCounts = useMemo(() => {
    const counts = Object.fromEntries(
      resourceTypeDetails.map(({ key }) => [key, 0])
    );

    resourceTypes.forEach(({ type, count }) => {
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
    });

    return resourceTypeDetails.map((category) => ({
      ...category,
      count: counts[category.key],
    }));
  }, [resourceTypes]);

  const presentTypes = categorizedCounts.filter(
    ({ count }) => count > 0
  );

  const totalByType = categorizedCounts.reduce(
    (sum, item) => sum + item.count,
    0
  );

  let cumulative = 0;

  const gradientStops =
    totalByType > 0
      ? presentTypes.map((item) => {
          const start = cumulative;

          cumulative +=
            (item.count / totalByType) * 100;

          return `${item.color} ${start}% ${cumulative}%`;
        })
      : [];

  const donutStyle = gradientStops.length
    ? {
        background: `conic-gradient(${gradientStops.join(", ")})`,
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
          <p>What you’ve been collecting</p>
        </div>

        <span className="mix-total">
          {totalResources} total
        </span>
      </div>

      {!presentTypes.length ? (
        <p className="dashboard-empty-state">
          Your resource types will appear here as you save resources.
        </p>
      ) : (
        <div
          className={`knowledge-mix-content ${
            presentTypes.length > 4 ? "has-many-types" : ""
          }`}
        >
          {presentTypes.length <= 4 && (
            <div
              className="mix-donut"
              style={donutStyle}
              role="img"
              aria-label={`Distribution of ${totalByType} resources by type`}
            >
              <div className="mix-donut-center">
                <strong>{totalByType}</strong>
                <span>resources</span>
              </div>
            </div>
          )}

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
                          (item.count / totalByType) * 100
                        )}%`,
                        backgroundColor: item.color,
                      }}
                    />
                  </div>
                )}

                <span className="mix-legend-label">
                  <i
                    style={{
                      backgroundColor: item.color,
                    }}
                  />
                  {item.label}
                </span>

                <strong>{item.count}</strong>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

/* Installation guide shared by the extension buttons */
function ExtensionInstallGuide({ onClose }) {
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  const copyExtensionsAddress = async () => {
    try {
      await navigator.clipboard.writeText(
        "chrome://extensions/"
      );

      window.alert(
        "Copied! Paste chrome://extensions/ into your Chrome address bar."
      );
    } catch {
      window.alert(
        "Open a new Chrome tab and type chrome://extensions/ in the address bar."
      );
    }
  };

  return (
    <div
      className="extension-modal-overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <section
        className="extension-install-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="extension-guide-title"
      >
        <button
          className="extension-modal-close"
          type="button"
          onClick={onClose}
          aria-label="Close installation guide"
        >
          ×
        </button>

        <div
          className="extension-modal-icon"
          aria-hidden="true"
        >
          ✦
        </div>

        <span className="extension-eyebrow">
          SMARTMARK EXTENSION
        </span>

        <h2 id="extension-guide-title">
          Install SmartMark Extension
        </h2>

        <p className="extension-modal-description">
          Follow these simple steps to get started.
        </p>

        <ol className="extension-install-steps">
          <li>
            <span className="extension-step-number">1</span>
            <div>
              <strong>Open Chrome Extensions</strong>
              <p>
                Open a new Chrome tab and visit:
              </p>
              <code>chrome://extensions/</code>
            </div>
          </li>

          <li>
            <span className="extension-step-number">2</span>
            <div>
              <strong>Enable Developer mode</strong>
              <p>
                Turn on Developer mode, then click
                <b> Load unpacked</b>.
              </p>
            </div>
          </li>

          <li>
            <span className="extension-step-number">3</span>
            <div>
              <strong>Select your extension folder</strong>
              <p>
                Choose your local{" "}
                <b>SmartMark-extension</b> folder.
                Make sure it contains a valid manifest.json file.
              </p>
            </div>
          </li>

          <li>
            <span className="extension-step-number">4</span>
            <div>
              <strong>Pin and start saving</strong>
              <p>
                Pin SmartMark using Chrome’s Extensions menu
                and use it while browsing.
              </p>
            </div>
          </li>
        </ol>

        <div className="extension-modal-actions">
          <button
            type="button"
            className="extension-install-btn"
            onClick={copyExtensionsAddress}
          >
            Copy Extensions Address
          </button>

          <button
            type="button"
            className="extension-learn-btn"
            onClick={onClose}
          >
            Got it!
          </button>
        </div>

        <p className="extension-modal-note">
          Local installation is for testing. The Chrome Web Store
          listing can be added after the extension is published.
        </p>
      </section>
    </div>
  );
}

/* Small glowing popup below the welcome section */
function ExtensionShiningPopup({
  onLearnMore,
  onClose,
}) {
  return (
    <section
      className="extension-shining-popup"
      aria-label="SmartMark Chrome Extension promotion"
    >
      <div
        className="extension-popup-symbol"
        aria-hidden="true"
      >
        ✦
      </div>

      <div className="extension-popup-copy">
        <span className="extension-eyebrow">
          SMARTMARK EXTENSION
        </span>

        <h2>✨ Save resources faster!</h2>

        <p>
          Capture links, images and notes directly from your browser.
        </p>
      </div>

      <div className="extension-popup-actions">
        <button
          className="extension-install-btn"
          type="button"
          onClick={onLearnMore}
        >
          Install Extension{" "}
          <span aria-hidden="true">↗</span>
        </button>

        <button
          className="extension-learn-btn"
          type="button"
          onClick={onLearnMore}
        >
          Learn more <span aria-hidden="true">→</span>
        </button>
      </div>

      <button
        type="button"
        className="extension-popup-close"
        onClick={onClose}
        aria-label="Dismiss extension promotion"
      >
        ×
      </button>
    </section>
  );
}

/* Large extension card at the bottom of the dashboard */
function ChromeExtensionBanner({ onLearnMore }) {
  return (
    <section
      className="extension-banner"
      aria-labelledby="extension-banner-title"
    >
      <div
        className="extension-banner-icon"
        aria-hidden="true"
      >
        <span>↗</span>
      </div>

      <div className="extension-banner-content">
        <span className="extension-eyebrow">
          SMARTMARK EXTENSION
        </span>

        <h2 id="extension-banner-title">
          Save faster with Chrome Extension
        </h2>

        <p>
          Capture links, images and notes directly from your
          browser and keep everything organized in SmartMark.
        </p>

        <div className="extension-banner-actions">
          <button
            type="button"
            className="extension-install-btn"
            onClick={onLearnMore}
          >
            Install Extension{" "}
            <span aria-hidden="true">↗</span>
          </button>

          <button
            type="button"
            className="extension-learn-btn"
            onClick={onLearnMore}
          >
            Learn more <span aria-hidden="true">→</span>
          </button>
        </div>
      </div>

      <div
        className="extension-banner-illustration"
        aria-hidden="true"
      >
        <div className="extension-browser">
          <div className="extension-browser-top">
            <i />
            <i />
            <i />
          </div>

          <div className="extension-bookmark">N</div>
          <div className="extension-line" />
          <div className="extension-line short" />
          <div className="extension-line" />
        </div>
      </div>
    </section>
  );
}

function Dashboard({
  onDashboard,
  onSavedResources,
  onCollections,
  onTags,
  onNotes,
  onFavorites,
  onRecent,
  onSettings,
  onSemanticSearch,
  onHelpSupport,
  onLogout,
  sidebarOpen = true,
  onToggleSidebar,
}) {
  const profileName = useProfileName();
  const [greeting] = useState(() => getTimeGreeting());

  const [dashboardData, setDashboardData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [updatingFavoriteIds, setUpdatingFavoriteIds] = useState(
    () => new Set()
  );

  const [showExtensionPopup, setShowExtensionPopup] =
    useState(true);

  const [showInstallGuide, setShowInstallGuide] =
    useState(false);

  const openInstallGuide = useCallback(() => {
    setShowInstallGuide(true);
  }, []);

  const closeInstallGuide = useCallback(() => {
    setShowInstallGuide(false);
  }, []);

  const loadDashboard = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage("");

    try {
      const result = await apiRequest("dashboard/");

      console.log("Dashboard API response:", result);

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
      console.error("Dashboard loading error:", error);

      setErrorMessage(
        error?.message || "Unable to load your dashboard."
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const handleToggleFavorite = async (resource) => {
    if (updatingFavoriteIds.has(resource.id)) return;

    setErrorMessage("");
    setUpdatingFavoriteIds((current) => new Set(current).add(resource.id));

    try {
      const result = await apiRequest(
        `resources/${resource.id}/favorite`,
        { method: "PATCH" }
      );
      const responseResource = result?.resource ?? result;
      const isFavorite =
        typeof responseResource?.favorite === "boolean"
          ? responseResource.favorite
          : typeof responseResource?.is_favorite === "boolean"
            ? responseResource.is_favorite
            : !resource.is_favorite;

      setDashboardData((previous) => {
        if (!previous) return previous;

        const currentResource = previous.recently_saved.find(
          (item) => item.id === resource.id
        );
        const previousFavorite = Boolean(currentResource?.is_favorite);

        return {
          ...previous,
          recently_saved: previous.recently_saved.map((item) =>
            item.id === resource.id
              ? { ...item, is_favorite: isFavorite }
              : item
          ),
          stats: {
            ...previous.stats,
            favorites: Math.max(
              0,
              previous.stats.favorites +
                Number(isFavorite) -
                Number(previousFavorite)
            ),
          },
        };
      });
    } catch (error) {
      setErrorMessage(
        error?.message || "Unable to update favorites."
      );
    } finally {
      setUpdatingFavoriteIds((current) => {
        const next = new Set(current);
        next.delete(resource.id);
        return next;
      });
    }
  };

  const displayedResources = useMemo(
    () => dashboardData?.recently_saved?.slice(0, 5) ?? [],
    [dashboardData]
  );

  const stats = dashboardData?.stats;
  const typeData = dashboardData?.resource_types ?? [];

  const navigateByMetric = {
    saved: onSavedResources,
    collections: onCollections,
    tags: onTags,
    notes: onNotes,
    favorites: onFavorites,
  };

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
      ]
    : [];

  return (
    <div className="dashboard-container">
      <Sidebar
        activePage="dashboard"
        onDashboard={onDashboard}
        onSavedResources={onSavedResources}
        onCollections={onCollections}
        onTags={onTags}
        onNotes={onNotes}
        onFavorites={onFavorites}
        onRecent={onRecent}
        onSettings={onSettings}
        onSemanticSearch={onSemanticSearch}
        onLogout={onLogout}
        sidebarOpen={sidebarOpen}
        onToggleSidebar={onToggleSidebar}
      />

      <main className="dashboard-main">
        <TopBar
          onSavedResources={onSavedResources}
          onCollections={onCollections}
          onTags={onTags}
          onHelpSupport={onHelpSupport}
          onSettings={onSettings}
        />

        <section className="dashboard-content dashboard-redesign">
          {/* Welcome heading and both buttons */}
          <div className="welcome-section">
            <div>
              <h1>
                {greeting}, {profileName}{" "}
                <span aria-hidden="true">👋</span>
              </h1>

              <p className="welcome-description">
                Everything you&apos;ve saved, organized and discovered
                — all in one place.
              </p>
            </div>

            <div className="welcome-action-buttons">
  <button
    className="save-resource-btn"
    onClick={onSavedResources}
    type="button"
  >
    <span aria-hidden="true">＋</span> Save Resource
  </button>

  <button
    className="extension-install-btn welcome-install-btn"
    onClick={openInstallGuide}
    type="button"
  >
    Install Extension <span aria-hidden="true">↗</span>
  </button>
</div>
          </div>

          {/* Dashboard error */}
          {errorMessage && (
            <div
              className="dashboard-load-error"
              role="alert"
            >
              <span>{errorMessage}</span>

              <button
                onClick={loadDashboard}
                type="button"
                disabled={isLoading}
              >
                {isLoading ? "Retrying…" : "Retry"}
              </button>
            </div>
          )}

          {/* Knowledge metrics */}
          <section
            className="knowledge-metrics"
            aria-label="Knowledge metrics"
          >
            {isLoading && !stats ? (
              <p
                className="dashboard-loading-state"
                role="status"
              >
                Loading your knowledge overview…
              </p>
            ) : (
              metrics.map((metric) => (
                <button
                  className="knowledge-metric"
                  key={metric.label}
                  onClick={
                    navigateByMetric[metric.destination]
                  }
                  type="button"
                  disabled={
                    !navigateByMetric[metric.destination]
                  }
                >
                  <span
                    className="knowledge-metric-icon"
                    aria-hidden="true"
                  >
                    {metric.icon}
                  </span>

                  <span className="knowledge-metric-copy">
                    <strong>{metric.value}</strong>
                    <span>{metric.label}</span>
                  </span>
                </button>
              ))
            )}
          </section>

          {dashboardData && (
            <>
              {/* Charts */}
              <div className="dashboard-insights-grid">
                <SavingActivityChart
                  items={dashboardData.saving_activity}
                />

                <KnowledgeMix
                  resourceTypes={typeData}
                  totalResources={stats.resources}
                />
              </div>

              {/* Rediscovery */}
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

                  <h2>Knowledge to Rediscover</h2>

                  <p>
                    You have{" "}
                    <strong>
                      {stats.forgotten_resources}
                    </strong>{" "}
                    {stats.forgotten_resources === 1
                      ? "resource"
                      : "resources"}{" "}
                    that haven&apos;t been revisited recently.

                    {stats.favorites > 0 && (
                      <>
                        {" "}Keep your{" "}
                        <strong>{stats.favorites}</strong>{" "}
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
                  onClick={onSavedResources}
                  type="button"
                >
                  View Resources{" "}
                  <span aria-hidden="true">→</span>
                </button>
              </section>

              {/* Recently saved resources */}
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
                      Your latest additions to your knowledge space
                    </p>
                  </div>

                  <button
                    className="dashboard-text-action"
                    onClick={onSavedResources}
                    type="button"
                  >
                    View all{" "}
                    <span aria-hidden="true">→</span>
                  </button>
                </div>

                {displayedResources.length ? (
                  <ul className="recently-saved-list">
                    {displayedResources.map((resource) => {
                      const resourceUrl =
                        typeof resource.url === "string" &&
                        resource.url.trim()
                          ? resource.url
                          : null;

                      return (
                        <li
                          className="recently-saved-item"
                          key={resource.id}
                        >
                          {resource.preview_image ? (
                            <img
                              className="recently-saved-preview"
                              src={resource.preview_image}
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

                          <div className="recently-saved-info">
                            {resourceUrl ? (
                              <a
                                href={resourceUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="recently-saved-title"
                              >
                                {resource.title ||
                                  resourceUrl ||
                                  "Untitled resource"}
                              </a>
                            ) : (
                              <span className="recently-saved-title">
                                {resource.title ||
                                  "Untitled resource"}
                              </span>
                            )}

                            <div className="recently-saved-meta">
                              <span>
                                {resource.source_domain ||
                                  "Local file / unknown source"}
                              </span>

                              <span>
                                {formatResourceType(
                                  resource.resource_type
                                )}
                              </span>

                              <time
                                dateTime={resource.created_at}
                              >
                                {formatSavedDate(
                                  resource.created_at
                                )}
                              </time>
                            </div>
                          </div>

                        
<button
  type="button"
  className={`recently-saved-favorite ${
    resource.is_favorite ? "is-favorite" : ""
  }`}
  aria-pressed={resource.is_favorite}
  aria-label={
    resource.is_favorite
      ? "Remove from favorites"
      : "Add to favorites"
  }
  disabled={updatingFavoriteIds.has(resource.id)}
  title={
    resource.is_favorite
      ? "Remove from favorites"
      : "Add to favorites"
  }
  onClick={() => handleToggleFavorite(resource)}
>
  {resource.is_favorite ? "★" : "☆"}
</button>

                          {resourceUrl ? (
                            <a
                              className="recently-saved-open"
                              href={resourceUrl}
                              target="_blank"
                              rel="noreferrer"
                              aria-label={`Open ${
                                resource.title || "resource"
                              }`}
                            >
                              Open
                            </a>
                          ) : (
                            <span
                              className="recently-saved-open"
                              aria-disabled="true"
                              title="This resource has no external URL"
                            >
                              File
                            </span>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p className="dashboard-empty-state">
                    Save a resource and it will appear here.
                  </p>
                )}
              </section>
            </>
          )}

          {/* Quick actions */}
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
                  Capture and organize what matters
                </p>
              </div>
            </div>

            <div className="compact-quick-actions">
              <button
                onClick={onSavedResources}
                type="button"
              >
                <span aria-hidden="true">＋</span>
                Save Resource
              </button>

              <button
                onClick={onCollections}
                type="button"
              >
                <span aria-hidden="true">▱</span>
                Create Collection
              </button>

              <button
                onClick={onNotes}
                type="button"
              >
                <span aria-hidden="true">✎</span>
                Add Note
              </button>
            </div>
          </section>

          {/* Extension banner at the bottom */}
          <ChromeExtensionBanner
            onLearnMore={openInstallGuide}
          />
        </section>
      </main>

      {/* Installation guide modal */}
      {showInstallGuide && (
        <ExtensionInstallGuide
          onClose={closeInstallGuide}
        />
      )}
    </div>
  );
}

export default Dashboard;