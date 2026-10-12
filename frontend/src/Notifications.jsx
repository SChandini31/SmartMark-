import { useEffect, useRef, useState } from "react";
import { apiRequest } from "./authApi";
import "./Notifications.css";

function Notifications({
  onSavedResources,
  onCollections,
  onTags,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [items, setItems] = useState([]);
  const [errorMessage, setErrorMessage] = useState("");

  // Keep the latest callback functions without making
  // the notification-fetching effect rerun when App re-renders.
  const onSavedResourcesRef = useRef(onSavedResources);
  const onCollectionsRef = useRef(onCollections);
  const onTagsRef = useRef(onTags);

  useEffect(() => {
    onSavedResourcesRef.current = onSavedResources;
  }, [onSavedResources]);

  useEffect(() => {
    onCollectionsRef.current = onCollections;
  }, [onCollections]);

  useEffect(() => {
    onTagsRef.current = onTags;
  }, [onTags]);

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    let isActive = true;

    setIsLoading(true);
    setErrorMessage("");

    const loadNotifications = async () => {
      const params = new URLSearchParams({
        days: "30",
        limit: "10",
      });

      try {
        const requests = await Promise.allSettled([
          apiRequest("resources/"),
          apiRequest("collections/"),
          apiRequest("tags/"),
          apiRequest(`rediscovery/?${params.toString()}`),
        ]);

        const labels = [
          "resources",
          "collections",
          "tags",
          "rediscovery",
        ];

        const failures = [];

        const data = requests.map((request, index) => {
          if (request.status === "rejected") {
            failures.push(`Could not load ${labels[index]}.`);
            return null;
          }

          if (!Array.isArray(request.value)) {
            failures.push(
              `The server returned an unexpected ${labels[index]} response.`
            );
            return null;
          }

          return request.value;
        });

        if (!isActive) {
          return;
        }

        const nextItems = [];

        // Resources
        if (data[0]) {
          nextItems.push({
            id: "resources",
            icon: "🔖",
            message: `${data[0].length} ${
              data[0].length === 1 ? "resource is" : "resources are"
            } in your library.`,
            action: onSavedResourcesRef.current,
          });
        }

        // Collections
        if (data[1]) {
          nextItems.push({
            id: "collections",
            icon: "📁",
            message: `${data[1].length} ${
              data[1].length === 1 ? "collection is" : "collections are"
            } organizing your knowledge.`,
            action: onCollectionsRef.current,
          });
        }

        // Tags
        if (data[2]) {
          nextItems.push({
            id: "tags",
            icon: "🏷",
            message: `${data[2].length} ${
              data[2].length === 1 ? "tag is" : "tags are"
            } helping organize your resources.`,
            action:
              onTagsRef.current || onSavedResourcesRef.current,
          });
        }

        // Rediscovery
        if (data[3]) {
          nextItems.push({
            id: "rediscovery",
            icon: "✨",
            message: data[3].length
              ? `${data[3].length} ${
                  data[3].length === 1
                    ? "resource is"
                    : "resources are"
                } ready to rediscover.`
              : "No resources are ready to rediscover yet.",
            action: onSavedResourcesRef.current,
          });
        }

        setItems(nextItems);
        setErrorMessage(failures.join(" "));
      } catch (error) {
        if (!isActive) {
          return;
        }

        setItems([]);
        setErrorMessage(
          error.message || "Unable to load notifications."
        );
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    };

    loadNotifications();

    return () => {
      isActive = false;
    };
  }, [isOpen]);

  return (
    <div className="smartmark-notifications">
      <button
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        aria-label="Show notifications"
        className="smartmark-notifications-trigger"
        onClick={() => setIsOpen((open) => !open)}
        type="button"
      >
        🔔
        <span className="smartmark-notifications-dot" />
      </button>

      {isOpen && (
        <section
          className="smartmark-notifications-panel"
          aria-label="Notifications"
          role="dialog"
        >
          <div className="smartmark-notifications-heading">
            <div>
              <h2>Notifications</h2>
              <p>Your SmartMark library overview</p>
            </div>

            <button
              aria-label="Close notifications"
              onClick={() => setIsOpen(false)}
              type="button"
            >
              ×
            </button>
          </div>

          {isLoading ? (
            <p
              className="smartmark-notifications-status"
              role="status"
            >
              Checking your library...
            </p>
          ) : (
            <>
              {errorMessage && (
                <p
                  className="smartmark-notifications-error"
                  role="alert"
                >
                  {errorMessage}
                </p>
              )}

              {items.length ? (
                <ul>
                  {items.map((item) => (
                    <li key={item.id}>
                      <button
                        disabled={!item.action}
                        onClick={() => {
                          setIsOpen(false);
                          item.action?.();
                        }}
                        type="button"
                      >
                        <span aria-hidden="true">
                          {item.icon}
                        </span>

                        <span>{item.message}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : !errorMessage ? (
                <p
                  className="smartmark-notifications-status"
                  role="status"
                >
                  No updates right now.
                </p>
              ) : null}
            </>
          )}
        </section>
      )}
    </div>
  );
}

export default Notifications;