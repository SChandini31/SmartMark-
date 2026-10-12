import React, { useEffect, useState } from "react";
import "./Collections.css";
import Sidebar from "./Sidebar";
import ThemeToggle from "./ThemeToggle";
import SemanticSearch from "./SemanticSearch";
import Notifications from "./Notifications";
import { apiRequest } from "./authApi";

const collectionDecorations = [
  { icon: "📁", color: "blue" },
  { icon: "📚", color: "purple" },
  { icon: "🌐", color: "green" },
  { icon: "💼", color: "orange" },
  { icon: "⚛️", color: "cyan" },
  { icon: "🗄️", color: "pink" },
];

function toCollection(collection) {
  const id = collection?.id;
  const decoration = collectionDecorations[Math.abs(Number(id) || 0) % collectionDecorations.length];
  return {
    ...collection,
    name: typeof collection?.name === "string" && collection.name
      ? collection.name
      : "Untitled collection",
    description: typeof collection?.description === "string" ? collection.description : "",
    count: Number(collection?.resource_count) || 0,
    ...decoration,
  };
}

function Collections({
  onDashboard,
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
  const [collections, setCollections] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingCollection, setEditingCollection] = useState(null);
  const [activeMenuId, setActiveMenuId] = useState(null);
  const [selectedCollection, setSelectedCollection] = useState(null);
  const [collectionResources, setCollectionResources] = useState([]);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [form, setForm] = useState({ name: "", description: "" });

useEffect(() => {
  let isActive = true;

  apiRequest("collections/")
    .then((result) => {
      if (!Array.isArray(result)) return;

      const normalizedCollections = result.map((collection) =>
        toCollection(collection)
      );

      if (isActive) {
        setCollections(normalizedCollections);
      }
    })
    .catch((error) => {
      if (isActive) {
        setErrorMessage(
          error.message || "Unable to load collections."
        );
      }
    })
    .finally(() => {
      if (isActive) {
        setIsLoading(false);
      }
    });

  return () => {
    isActive = false;
  };
}, []);

  const filteredCollections = collections.filter((collection) => {
    const search = searchTerm.trim().toLowerCase();
    return (
      collection.name.toLowerCase().includes(search) ||
      collection.description.toLowerCase().includes(search)
    );
  });

  const handleSaveCollection = async (event) => {
    event.preventDefault();
    setErrorMessage("");
    setStatusMessage("");
    setIsSubmitting(true);

    try {
      const result = editingCollection
        ? await apiRequest(`collections/${editingCollection.id}`, {
            method: "PUT",
            payload: { name: form.name.trim(), description: form.description.trim() || null },
          })
        : await apiRequest("collections/", {
            method: "POST",
            payload: { name: form.name.trim(), description: form.description.trim() || null },
          });

      const savedCollection = toCollection(result);
      setCollections((currentCollections) => (
        editingCollection
          ? currentCollections.map((collection) => collection.id === savedCollection.id ? savedCollection : collection)
          : [savedCollection, ...currentCollections]
      ));
      setForm({ name: "", description: "" });
      setEditingCollection(null);
      setIsFormOpen(false);
      setStatusMessage(editingCollection ? "Collection updated." : "Collection created.");
    } catch (error) {
      setErrorMessage(error.message || "Unable to save this collection.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditCollection = async (collection) => {
    setActiveMenuId(null);
    setErrorMessage("");
    try {
      const detail = await apiRequest(`collections/${collection.id}`);
      setEditingCollection(collection);
      setForm({ name: detail.name || "", description: detail.description || "" });
      setIsFormOpen(true);
    } catch (error) {
      setErrorMessage(error.message || "Unable to load this collection.");
    }
  };

  const handleDeleteCollection = async (collection) => {
    setActiveMenuId(null);
    if (!window.confirm(`Delete "${collection.name}"?`)) return;

    try {
      await apiRequest(`collections/${collection.id}`, { method: "DELETE" });
      setCollections((currentCollections) => currentCollections.filter((item) => item.id !== collection.id));
      setStatusMessage("Collection deleted.");
      setErrorMessage("");
    } catch (error) {
      setErrorMessage(error.message || "Unable to delete this collection.");
    }
  };

  const handleOpenCollection = async (collection) => {
    setErrorMessage("");
    setSelectedCollection(collection);
    setCollectionResources([]);
    setIsDetailLoading(true);

    try {
      const [detail, resources] = await Promise.all([
        apiRequest(`collections/${collection.id}`),
        apiRequest(`collections/${collection.id}/resources`),
      ]);
      const items = Array.isArray(resources) ? resources : [];
      setSelectedCollection(toCollection({ ...detail, resource_count: items.length }));
      setCollectionResources(items);
      setCollections((currentCollections) => currentCollections.map((item) => (
        item.id === collection.id ? { ...item, count: items.length } : item
      )));
    } catch (error) {
      setErrorMessage(error.message || "Unable to load this collection's resources.");
    } finally {
      setIsDetailLoading(false);
    }
  };

  return (
    <div className="collections-container">
      <Sidebar
        activePage="collections"
        onDashboard={onDashboard}
        onSavedResources={onSavedResources}
        onCollections={onCollections}
        onTags={onTags}
        onNotes={onNotes}
        onFavorites={onFavorites}
        onRecent={onRecent}
        onSettings={onSettings}
        onHelpSupport={onHelpSupport}
        onLogout={onLogout}
      />

      {/* Main Content */}
      <main className="collections-main">

        {/* Header */}
        <header className="collections-header">

          <div className="header-search">

            <span>⌕</span>

            <input
              type="text"
              placeholder="Search your collections..."
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
            />

            <SemanticSearch query={searchTerm} />

          </div>

          <div className="header-actions">

            <Notifications
              onSavedResources={onSavedResources}
              onCollections={onCollections}
              onTags={onTags}
            />

            <ThemeToggle />

            <div className="header-divider"></div>

            <button
              aria-label="Open profile settings for Monika"
              className="header-profile profile-settings-trigger"
              onClick={onSettings}
              type="button"
            >

              <div className="profile-avatar small">
                M
              </div>

              <div>
                <strong>Monika</strong>
                <span>My Account</span>
              </div>

              <span className="arrow">
                ⌄
              </span>

            </button>

          </div>

        </header>


        {/* Page Content */}
        <section className="collections-content">

          {/* Page Heading */}
          <div className="page-heading">

            <div>

              <p className="page-label">
                ORGANIZE YOUR KNOWLEDGE
              </p>

              <h1>
                Collections
              </h1>

              <p className="page-description">
                Group related resources together and keep your
                knowledge organized.
              </p>

            </div>

            <button
              className="create-collection-btn"
              onClick={() => {
                setErrorMessage("");
                setStatusMessage("");
                setEditingCollection(null);
                setForm({ name: "", description: "" });
                setIsFormOpen(true);
              }}
              type="button"
            >
              <span>＋</span>
              Create Collection
            </button>

          </div>

          {statusMessage && (
            <p className="collection-api-status" role="status">{statusMessage}</p>
          )}
          {errorMessage && !isFormOpen && !selectedCollection && (
            <p className="collection-api-error" role="alert">{errorMessage}</p>
          )}

          {isFormOpen && (
            <div className="collection-dialog-backdrop">
              <section className="collection-dialog" role="dialog" aria-modal="true" aria-labelledby="collection-dialog-title">
                <div className="collection-dialog-heading">
                  <div>
                    <h2 id="collection-dialog-title">{editingCollection ? "Edit collection" : "Create collection"}</h2>
                    <p>Keep related resources together.</p>
                  </div>
                  <button
                    aria-label="Close collection form"
                    className="collection-dialog-close"
                    onClick={() => {
                      setIsFormOpen(false);
                      setEditingCollection(null);
                    }}
                    type="button"
                  >
                    ×
                  </button>
                </div>
                <form className="collection-api-form" onSubmit={handleSaveCollection}>
                  <label>
                    Name
                    <input
                      autoFocus
                      maxLength={120}
                      minLength={1}
                      onChange={(event) => setForm({ ...form, name: event.target.value })}
                      required
                      value={form.name}
                    />
                  </label>
                  <label>
                    Description <span>Optional</span>
                    <textarea
                      onChange={(event) => setForm({ ...form, description: event.target.value })}
                      rows={3}
                      value={form.description}
                    />
                  </label>
                  {errorMessage && <p className="collection-api-error" role="alert">{errorMessage}</p>}
                  <div className="collection-dialog-actions">
                    <button
                      className="collection-cancel-btn"
                      onClick={() => {
                        setIsFormOpen(false);
                        setEditingCollection(null);
                      }}
                      type="button"
                    >
                      Cancel
                    </button>
                    <button className="create-collection-btn" disabled={isSubmitting} type="submit">
                      {isSubmitting ? "Saving..." : editingCollection ? "Save Changes" : "Create Collection"}
                    </button>
                  </div>
                </form>
              </section>
            </div>
          )}

          {selectedCollection && (
            <div className="collection-dialog-backdrop">
              <section className="collection-dialog collection-detail-dialog" role="dialog" aria-modal="true" aria-labelledby="collection-detail-title">
                <div className="collection-dialog-heading">
                  <div>
                    <h2 id="collection-detail-title">{selectedCollection.name}</h2>
                    <p>{selectedCollection.description || "Resources in this collection"}</p>
                  </div>
                  <button
                    aria-label="Close collection details"
                    className="collection-dialog-close"
                    onClick={() => setSelectedCollection(null)}
                    type="button"
                  >
                    ×
                  </button>
                </div>
                {isDetailLoading ? (
                  <p>Loading collection resources...</p>
                ) : errorMessage ? (
                  <p className="collection-api-error" role="alert">{errorMessage}</p>
                ) : collectionResources.length ? (
                  <div className="collection-resource-list">
                    {collectionResources.map((resource) => (
                      <article key={resource.id}>
                        <h3>{resource.title || resource.url}</h3>
                        {resource.url && <a href={resource.url} target="_blank" rel="noreferrer">{resource.url}</a>}
                        {resource.description && <p>{resource.description}</p>}
                      </article>
                    ))}
                  </div>
                ) : (
                  <p className="collection-empty-resources">No resources in this collection yet.</p>
                )}
              </section>
            </div>
          )}


          {/* Collection Stats */}
          <div className="collection-stats">

            <div className="collection-stat-card">

              <div className="collection-stat-icon">
                📁
              </div>

              <div>
                <strong>{isLoading ? "..." : collections.length}</strong>
                <span>Total Collections</span>
              </div>

            </div>


            <div className="collection-stat-card">

              <div className="collection-stat-icon">
                🔖
              </div>

              <div>
                <strong>{collections.reduce((total, collection) => total + collection.count, 0)}</strong>
                <span>Organized Resources</span>
              </div>

            </div>


            <div className="collection-stat-card">

              <div className="collection-stat-icon">
                ✨
              </div>

              <div>
                <strong>{collections.filter((collection) => collection.count > 0).length}</strong>
                <span>Updated This Week</span>
              </div>

            </div>

          </div>


          {/* Collections Header */}
          <div className="collections-toolbar">

            <div>

              <h2>
                Your Collections
              </h2>

              <p>
                {isLoading ? "Loading collections..." : `${filteredCollections.length} collections available`}
              </p>

            </div>

            <div className="collection-actions">

              <button className="sort-btn">
                ↕ Sort by Recent
              </button>

              <button className="view-btn active">
                ▦
              </button>

              <button className="view-btn">
                ☷
              </button>

            </div>

          </div>


          {/* Collection Grid */}
          <div className="collections-grid">

            {!isLoading && !filteredCollections.length && !errorMessage && (
              <p className="collection-empty-resources">
                {searchTerm ? "No collections match your search." : "No collections yet. Create your first collection."}
              </p>
            )}

            {isLoading && <p className="collection-empty-resources">Loading collections...</p>}

            {!isLoading && errorMessage && !collections.length && (
              <p className="collection-api-error" role="alert">{errorMessage}</p>
            )}

            {filteredCollections.map((collection) => (

              <div
                className="collection-card"
                key={collection.id}
              >

                {/* Card Top */}
                <div className="collection-card-top">

                  <div
                    className={`collection-card-icon ${collection.color}`}
                  >
                    {collection.icon}
                  </div>

                  <button
                    aria-expanded={activeMenuId === collection.id}
                    aria-label={`Actions for ${collection.name}`}
                    className="collection-more"
                    onClick={() => setActiveMenuId(activeMenuId === collection.id ? null : collection.id)}
                    type="button"
                  >
                    ⋮
                  </button>

                  {activeMenuId === collection.id && (
                    <div className="collection-action-menu" role="menu">
                      <button onClick={() => handleEditCollection(collection)} role="menuitem" type="button">Edit collection</button>
                      <button className="delete-collection-action" onClick={() => handleDeleteCollection(collection)} role="menuitem" type="button">Delete collection</button>
                    </div>
                  )}

                </div>


                {/* Card Content */}
                <div className="collection-card-content">

                  <h3>
                    {collection.name}
                  </h3>

                  <p>
                    {collection.description}
                  </p>

                </div>


                {/* Card Bottom */}
                <div className="collection-card-footer">

                  <div className="resource-count">

                    <span>
                      🔖
                    </span>

                    <strong>
                      {collection.count}
                    </strong>

                    <span>
                      resources
                    </span>

                  </div>

                  <button
                    aria-label={`Open ${collection.name}`}
                    className="collection-arrow collection-open-button"
                    onClick={() => handleOpenCollection(collection)}
                    type="button"
                  >
                    →
                  </button>

                </div>


                <div className="collection-updated">{collection.count} resources available</div>

              </div>

            ))}


            {/* Create New Collection Card */}
            <button
              className="new-collection-card"
              onClick={() => {
                setErrorMessage("");
                setStatusMessage("");
                setEditingCollection(null);
                setForm({ name: "", description: "" });
                setIsFormOpen(true);
              }}
              type="button"
            >

              <div className="new-collection-icon">
                ＋
              </div>

              <strong>
                Create New Collection
              </strong>

              <span>
                Organize your resources into a new collection
              </span>

            </button>

          </div>

        </section>

      </main>

    </div>
  );
}

export default Collections;