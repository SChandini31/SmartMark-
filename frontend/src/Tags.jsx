import React, { useEffect, useMemo, useState } from "react";
import "./Tags.css";
import Sidebar from "./Sidebar";
import ThemeToggle from "./ThemeToggle";
import SemanticSearch from "./SemanticSearch";
import Notifications from "./Notifications";
import { apiRequest } from "./authApi";

const tagColors = ["blue", "purple", "cyan", "green", "orange", "pink", "yellow", "indigo"];

function toTag(tag, index = 0) {
  return {
    ...tag,
    resource_count: tag.resource_count || 0,
    color: tagColors[index % tagColors.length],
  };
}

function Tags({
  onDashboard,
  onSavedResources,
  onCollections,
  onNotes,
  onFavorites,
  onRecent,
  onTags,
  onSettings,
  onHelpSupport,
  onLogout,
}) {
  const [searchTerm, setSearchTerm] = useState("");
  const [tags, setTags] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingTag, setEditingTag] = useState(null);
  const [selectedTag, setSelectedTag] = useState(null);
  const [tagResources, setTagResources] = useState([]);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [formName, setFormName] = useState("");

  useEffect(() => {
    let isActive = true;

    apiRequest("tags/")
      .then(async (result) => {
        if (!Array.isArray(result)) return;
        const tagsWithCounts = await Promise.all(result.map(async (tag, index) => {
          try {
            const resources = await apiRequest(`tags/${tag.id}/resources`);
            return toTag({ ...tag, resource_count: Array.isArray(resources) ? resources.length : 0 }, index);
          } catch {
            return toTag(tag, index);
          }
        }));
        if (isActive) setTags(tagsWithCounts);
      })
      .catch((error) => {
        if (isActive) setErrorMessage(error.message || "Unable to load tags.");
      })
      .finally(() => {
        if (isActive) setIsLoading(false);
      });

    return () => {
      isActive = false;
    };
  }, []);

  const filteredTags = useMemo(
    () => tags.filter((tag) => tag.name.toLowerCase().includes(searchTerm.toLowerCase())),
    [tags, searchTerm]
  );

  const handleSaveTag = async (event) => {
    event.preventDefault();
    setErrorMessage("");
    setStatusMessage("");
    setIsSubmitting(true);

    try {
      const result = editingTag
        ? await apiRequest(`tags/${editingTag.id}`, {
            method: "PUT",
            payload: { name: formName.trim() },
          })
        : await apiRequest("tags/", {
            method: "POST",
            payload: { name: formName.trim() },
          });

      const savedTag = toTag({ ...result, resource_count: editingTag?.resource_count || 0 });
      setTags((currentTags) => editingTag
        ? currentTags.map((tag) => tag.id === savedTag.id ? { ...savedTag, color: tag.color } : tag)
        : [...currentTags, toTag(savedTag, currentTags.length)]
      );
      setStatusMessage(editingTag ? "Tag updated." : "Tag created.");
      setFormName("");
      setEditingTag(null);
      setIsFormOpen(false);
    } catch (error) {
      setErrorMessage(error.message || "Unable to save this tag.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditTag = async (tag) => {
    setErrorMessage("");
    try {
      const detail = await apiRequest(`tags/${tag.id}`);
      setEditingTag(tag);
      setFormName(detail.name || tag.name);
      setSelectedTag(null);
      setIsFormOpen(true);
    } catch (error) {
      setErrorMessage(error.message || "Unable to load this tag.");
    }
  };

  const handleDeleteTag = async (tag) => {
    if (!window.confirm(`Delete the tag "${tag.name}"?`)) return;

    try {
      await apiRequest(`tags/${tag.id}`, { method: "DELETE" });
      setTags((currentTags) => currentTags.filter((item) => item.id !== tag.id));
      setSelectedTag(null);
      setStatusMessage("Tag deleted.");
      setErrorMessage("");
    } catch (error) {
      setErrorMessage(error.message || "Unable to delete this tag.");
    }
  };

  const handleOpenTag = async (tag) => {
    setErrorMessage("");
    setSelectedTag(tag);
    setTagResources([]);
    setIsDetailLoading(true);

    try {
      const [detail, resources] = await Promise.all([
        apiRequest(`tags/${tag.id}`),
        apiRequest(`tags/${tag.id}/resources`),
      ]);
      const items = Array.isArray(resources) ? resources : [];
      setSelectedTag(toTag({ ...detail, resource_count: items.length }, tagColors.indexOf(tag.color)));
      setTagResources(items);
      setTags((currentTags) => currentTags.map((item) => item.id === tag.id
        ? { ...item, resource_count: items.length }
        : item
      ));
    } catch (error) {
      setErrorMessage(error.message || "Unable to load tag resources.");
    } finally {
      setIsDetailLoading(false);
    }
  };

  return (
    <div className="tags-page">
      <Sidebar
        activePage="tags"
        onDashboard={onDashboard}
        onSavedResources={onSavedResources}
        onCollections={onCollections}
        onNotes={onNotes}
        onFavorites={onFavorites}
        onRecent={onRecent}
        onSettings={onSettings}
        onHelpSupport={onHelpSupport}
        onLogout={onLogout}
      />

      <main className="tags-main">
        <header className="tags-topbar">
          <div className="tags-global-search">
            <span aria-hidden="true">⌕</span>
            <input
              aria-label="Search your saved knowledge"
              placeholder="Search your saved knowledge..."
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
            />
            <SemanticSearch query={searchTerm} />
          </div>
          <div className="tags-topbar-actions">
            <Notifications
              onSavedResources={onSavedResources}
              onCollections={onCollections}
              onTags={onTags}
            />
            <ThemeToggle />
            <button
              aria-label="Open profile settings for Monika"
              className="tags-topbar-profile"
              onClick={onSettings}
              type="button"
            >
              <span className="tags-topbar-avatar">M</span>
              <span><strong>Monika</strong><small>My Account</small></span>
              <span aria-hidden="true">⌄</span>
            </button>
          </div>
        </header>

        <section className="tags-content">
          <header className="tags-header">
            <div>
              <p>PERSONAL KNOWLEDGE</p>
              <h1>Tags</h1>
              <span>Connect related resources and find ideas faster.</span>
            </div>
            <button
              className="tag-create-btn"
              onClick={() => {
                setErrorMessage("");
                setStatusMessage("");
                setEditingTag(null);
                setFormName("");
                setIsFormOpen(true);
              }}
              type="button"
            >
              <span aria-hidden="true">＋</span>
              Create Tag
            </button>
          </header>

          {statusMessage && <p className="tag-api-status" role="status">{statusMessage}</p>}
          {errorMessage && !isFormOpen && !selectedTag && <p className="tag-api-error" role="alert">{errorMessage}</p>}

        {isFormOpen && (
          <div className="tag-dialog-backdrop">
            <section className="tag-dialog" role="dialog" aria-modal="true" aria-labelledby="tag-dialog-title">
              <div className="tag-dialog-heading">
                <div>
                  <h2 id="tag-dialog-title">{editingTag ? "Edit tag" : "Create tag"}</h2>
                  <p>Use tags to connect related resources.</p>
                </div>
                <button
                  aria-label="Close tag form"
                  className="tag-dialog-close"
                  onClick={() => {
                    setIsFormOpen(false);
                    setEditingTag(null);
                  }}
                  type="button"
                >
                  ×
                </button>
              </div>
              <form className="tag-api-form" onSubmit={handleSaveTag}>
                <label>
                  Tag name
                  <input
                    autoFocus
                    maxLength={100}
                    onChange={(event) => setFormName(event.target.value)}
                    required
                    value={formName}
                  />
                </label>
                {errorMessage && <p className="tag-api-error" role="alert">{errorMessage}</p>}
                <div className="tag-dialog-actions">
                  <button
                    className="tag-cancel-btn"
                    onClick={() => {
                      setIsFormOpen(false);
                      setEditingTag(null);
                    }}
                    type="button"
                  >
                    Cancel
                  </button>
                  <button className="tag-create-btn" disabled={isSubmitting} type="submit">
                    {isSubmitting ? "Saving..." : editingTag ? "Save Changes" : "Create Tag"}
                  </button>
                </div>
              </form>
            </section>
          </div>
        )}

        {selectedTag && (
          <div className="tag-dialog-backdrop">
            <section className="tag-dialog tag-detail-dialog" role="dialog" aria-modal="true" aria-labelledby="tag-detail-title">
              <div className="tag-dialog-heading">
                <div>
                  <p className="tag-dialog-eyebrow">TAG RESOURCES</p>
                  <h2 id="tag-detail-title">#{selectedTag.name}</h2>
                  <p>{selectedTag.resource_count} resources</p>
                </div>
                <button
                  aria-label="Close tag details"
                  className="tag-dialog-close"
                  onClick={() => setSelectedTag(null)}
                  type="button"
                >
                  ×
                </button>
              </div>
              {errorMessage ? (
                <p className="tag-api-error" role="alert">{errorMessage}</p>
              ) : isDetailLoading ? (
                <p>Loading resources...</p>
              ) : tagResources.length ? (
                <div className="tag-resource-list">
                  {tagResources.map((resource) => (
                    <article key={resource.id}>
                      <h3>{resource.title || resource.url}</h3>
                      {resource.url && <a href={resource.url} target="_blank" rel="noreferrer">{resource.url}</a>}
                      {resource.description && <p>{resource.description}</p>}
                    </article>
                  ))}
                </div>
              ) : (
                <p className="tag-empty-resources">No resources use this tag yet.</p>
              )}
              <div className="tag-detail-actions">
                <button className="tag-cancel-btn" onClick={() => handleEditTag(selectedTag)} type="button">
                  Edit tag
                </button>
                <button className="tag-delete-btn" onClick={() => handleDeleteTag(selectedTag)} type="button">
                  Delete tag
                </button>
              </div>
            </section>
          </div>
        )}

          <section className="tags-summary" aria-label="Tag statistics">
            <article className="tags-stat-card">
              <span className="tags-stat-icon" aria-hidden="true">#</span>
              <div>
                <strong>{isLoading ? "..." : tags.length}</strong>
                <span>Active Tags</span>
              </div>
            </article>
            <article className="tags-stat-card">
              <span className="tags-stat-icon resources" aria-hidden="true">↗</span>
              <div>
                <strong>{tags.reduce((total, tag) => total + tag.resource_count, 0)}</strong>
                <span>Resources Organized</span>
              </div>
            </article>
          </section>

          <div className="tags-list-heading">
            <h2>All Tags</h2>
            {!isLoading && <span>{filteredTags.length} {filteredTags.length === 1 ? "tag" : "tags"}</span>}
          </div>

          <section className="tags-grid" aria-label="All tags">
            {isLoading && <p className="tags-empty">Loading tags...</p>}
            {!isLoading && errorMessage && !tags.length && <p className="tags-empty" role="alert">{errorMessage}</p>}
            {!isLoading && !tags.length && !errorMessage && <p className="tags-empty">No tags yet. Create your first tag.</p>}
            {filteredTags.map((tag) => (
              <button className="tag-card" key={tag.id} onClick={() => handleOpenTag(tag)} type="button">
                <span className={`tag-dot ${tag.color}`}>#</span>
                <strong>{tag.name}</strong>
                <small>{tag.resource_count} resources</small>
                <span className="tag-arrow" aria-hidden="true">→</span>
              </button>
            ))}
            {!isLoading && tags.length > 0 && filteredTags.length === 0 && <p className="tags-empty">No tags match your search.</p>}
          </section>
        </section>
      </main>
    </div>
  );
}

export default Tags;
