import React, { useEffect, useState } from "react";
import "./Notes.css";
import Sidebar from "./Sidebar";
import ThemeToggle from "./ThemeToggle";
import Notifications from "./Notifications";
import { apiRequest } from "./authApi";

const noteColors = ["purple", "blue", "green", "orange", "pink", "cyan"];

function formatNoteDate(value) {
  if (!value) return "Date unavailable";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date unavailable";

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
  }).format(date);
}

function getNoteStats(notes) {
  const now = Date.now();

  return {
    createdThisWeek: notes.filter((note) => {
      const createdAt = new Date(note.created_at);
      return !Number.isNaN(createdAt.getTime())
        && now - createdAt.getTime() <= 7 * 24 * 60 * 60 * 1000;
    }).length,
    linkedResources: notes.filter((note) => note.resource_id != null).length,
    updatedToday: notes.filter((note) => {
      const updatedAt = new Date(note.updated_at);
      return !Number.isNaN(updatedAt.getTime())
        && now - updatedAt.getTime() <= 24 * 60 * 60 * 1000;
    }).length,
  };
}

function Notes({
  onDashboard,
  onSavedResources,
  onCollections,
  onTags,
  onSemanticSearch,
  onFavorites,
  onRecent,
  onSettings,
  onHelpSupport,
  onLogout,
}) {
  const [searchTerm, setSearchTerm] = useState("");
  const [notes, setNotes] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [noteEditor, setNoteEditor] = useState(null);
  const [noteStats, setNoteStats] = useState({
    createdThisWeek: 0,
    linkedResources: 0,
    updatedToday: 0,
  });

  useEffect(() => {
    let isActive = true;

    apiRequest("notes/")
      .then((result) => {
        if (!Array.isArray(result)) {
          throw new Error("The server returned an unexpected notes response.");
        }
        if (isActive) {
          setNotes(result);
          setNoteStats(getNoteStats(result));
        }
      })
      .catch((error) => {
        if (isActive) setErrorMessage(error.message || "Unable to load notes.");
      })
      .finally(() => {
        if (isActive) setIsLoading(false);
      });

    return () => {
      isActive = false;
    };
  }, []);

  const filteredNotes = notes.filter((note) => {
    const search = searchTerm.trim().toLowerCase();

    return (
      (note.title || "").toLowerCase().includes(search) ||
      (note.content || "").toLowerCase().includes(search) ||
      (note.tags || []).some((tag) => tag.toLowerCase().includes(search))
    );
  });

  const handleCreateNote = () => {
    setErrorMessage("");
    setNoteEditor({ id: null, title: "", content: "" });
  };

  const handleEditNote = (note) => {
    setErrorMessage("");
    setNoteEditor({
      id: note.id,
      title: note.title || "",
      content: note.content || "",
    });
  };

  const handleSaveNote = async (event) => {
    event.preventDefault();
    if (!noteEditor) return;

    setErrorMessage("");
    setIsSubmitting(true);
    const payload = {
      title: noteEditor.title.trim() || null,
      content: noteEditor.content.trim(),
    };

    try {
      const savedNote = noteEditor.id
        ? await apiRequest(`notes/${noteEditor.id}`, { method: "PUT", payload })
        : await apiRequest("notes/", { method: "POST", payload });

      const nextNotes = noteEditor.id
        ? notes.map((note) => note.id === savedNote.id ? savedNote : note)
        : [savedNote, ...notes];
      setNotes(nextNotes);
      setNoteStats(getNoteStats(nextNotes));
      setNoteEditor(null);
    } catch (error) {
      setErrorMessage(error.message || "Unable to save this note.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteNote = async (note) => {
    if (!window.confirm(`Delete "${note.title || "Untitled note"}"?`)) return;

    setErrorMessage("");
    try {
      await apiRequest(`notes/${note.id}`, { method: "DELETE" });
      const nextNotes = notes.filter((item) => item.id !== note.id);
      setNotes(nextNotes);
      setNoteStats(getNoteStats(nextNotes));
    } catch (error) {
      setErrorMessage(error.message || "Unable to delete this note.");
    }
  };

  return (
    <div className="notes-container">

      <Sidebar
        activePage="notes"
        onDashboard={onDashboard}
        onSavedResources={onSavedResources}
        onCollections={onCollections}
        onTags={onTags}
        onFavorites={onFavorites}
        onRecent={onRecent}
        onSettings={onSettings}
        onHelpSupport={onHelpSupport}
        onSemanticSearch={onSemanticSearch}
        onLogout={onLogout}
      />

      {/* ================= MAIN CONTENT ================= */}
      <main className="notes-main">

        {/* Header */}
        <header className="notes-header">

          <div className="notes-header-search">

            <span>
              ⌕
            </span>

            <input
              type="text"
              placeholder="Search your saved knowledge..."
            />

          </div>


          <div className="notes-header-actions">

            <Notifications
              onSavedResources={onSavedResources}
              onCollections={onCollections}
              onTags={onTags}
            />

            <ThemeToggle />

            <div className="notes-header-divider"></div>

            <button
              aria-label="Open profile settings for Monika"
              className="notes-header-profile profile-settings-trigger"
              onClick={onSettings}
              type="button"
            >

              <div className="notes-profile-avatar small">
                M
              </div>

              <div>

                <strong>
                  Monika
                </strong>

                <span>
                  My Account
                </span>

              </div>

              <span className="notes-profile-arrow">
                ⌄
              </span>

            </button>

          </div>

        </header>


        {/* ================= PAGE CONTENT ================= */}
        <section className="notes-content">

          {/* Page Heading */}
          <div className="notes-page-heading">

            <div>

              <h1>
                My Notes
              </h1>

              <p>
                Capture ideas, thoughts and important information
                in one organized place.
              </p>

            </div>


            <button
              className="create-note-btn"
              onClick={handleCreateNote}
            >
              <span>＋</span>
              New Note
            </button>

          </div>


          {/* ================= STATS ================= */}
          <div className="notes-stats">

            <div className="notes-stat-card">

              <div className="notes-stat-icon purple">
                📝
              </div>

              <div>
                <strong>{notes.length}</strong>

                <span>
                  Total Notes
                </span>
              </div>

            </div>


            <div className="notes-stat-card">

              <div className="notes-stat-icon blue">
                📅
              </div>

              <div>
                <strong>{noteStats.createdThisWeek}</strong>

                <span>
                  Created This Week
                </span>
              </div>

            </div>


            <div className="notes-stat-card">

              <div className="notes-stat-icon green">
                🏷
              </div>

              <div>
                <strong>{noteStats.linkedResources}</strong>

                <span>
                  Linked Resources
                </span>
              </div>

            </div>


            <div className="notes-stat-card">

              <div className="notes-stat-icon orange">
                ⭐
              </div>

              <div>
                <strong>{noteStats.updatedToday}</strong>

                <span>
                  Updated Today
                </span>
              </div>

            </div>

          </div>


          {/* ================= TOOLBAR ================= */}
          <div className="notes-toolbar">

            
<div className="notes-search-box">
  <span>
    ⌕
  </span>

  <input
    type="text"
    placeholder="Search notes..."
    value={searchTerm}
    onChange={(e) => setSearchTerm(e.target.value)}
  />
</div>
            <div className="notes-toolbar-actions">

              <button className="notes-filter-btn">
                ☰
                Filter
              </button>

              <button className="notes-sort-btn">
                Latest
                <span>⌄</span>
              </button>

            </div>

          </div>


          {/* ================= NOTES HEADER ================= */}
          <div className="notes-list-heading">

            <div>

              <h2>
                All Notes
              </h2>

              <span>
                {isLoading ? "Loading..." : `${filteredNotes.length} notes`}
              </span>

            </div>

            <button className="notes-view-btn">
              ▦
            </button>

          </div>


          {/* ================= NOTES GRID ================= */}
          {errorMessage && (
            <p className="notes-api-error" role="alert">{errorMessage}</p>
          )}

          {isLoading ? (
            <p className="notes-loading" role="status">Loading your notes...</p>
          ) : filteredNotes.length > 0 ? (

            <div className="notes-grid">

              {filteredNotes.map((note, index) => (

                <article
                  className="note-card"
                  key={note.id}
                >

                  {/* Card Top */}
                  <div className="note-card-top">

                    <div
                        className={`note-card-icon ${noteColors[index % noteColors.length]}`}
                    >
                      📝
                    </div>

                    <button className="note-more-btn">
                      ⋮
                    </button>

                  </div>


                  {/* Note Content */}
                  <div className="note-card-body">

                    <h3>
                      {note.title || "Untitled note"}
                    </h3>

                    <p>
                      {note.content}
                    </p>

                  </div>


                  {/* Tags */}
                  <div className="note-tags">

                    {(note.tags || []).map((tag) => (

                      <span key={tag}>
                        #{tag}
                      </span>

                    ))}

                  </div>


                  {/* Bottom */}
                  <div className="note-card-footer">

                    <span className="note-date">
                      🕘 {formatNoteDate(note.updated_at || note.created_at)}
                    </span>

                    <div className="note-actions">

                      <button
                        onClick={() =>
                          handleEditNote(note)
                        }
                      >
                        Edit
                      </button>

                      <button
                        className="delete-note"
                        onClick={() =>
                          handleDeleteNote(note)
                        }
                      >
                        Delete
                      </button>

                    </div>

                  </div>

                </article>

              ))}

            </div>

          ) : (

            /* Empty State */
            <div className="notes-empty-state">

              <div className="notes-empty-icon">
                📝
              </div>

              <h2>
                No notes found
              </h2>

              <p>
                Try a different search or create a new note.
              </p>

              <button
                onClick={handleCreateNote}
              >
                + Create Note
              </button>

            </div>

          )}


          {/* ================= INSIGHT ================= */}
          <section className="notes-insight">

            <div className="notes-insight-icon">
              ✨
            </div>

            <div>

              <span>
                SMARTMARK TIP
              </span>

              <h3>
                Keep your thoughts connected
              </h3>

              <p>
                Add relevant tags to your notes so you can
                quickly find and connect them with your saved
                resources later.
              </p>

            </div>

          </section>


          {/* Footer */}
          <div className="notes-footer">

            <span>
              SmartMark
            </span>

            <span>
              Personal Information Retrieval & Knowledge Management System
            </span>

          </div>

        </section>

      </main>

      {noteEditor && (
        <div className="note-editor-overlay">
          <form
            aria-labelledby="note-editor-title"
            aria-modal="true"
            className="note-editor"
            onSubmit={handleSaveNote}
            role="dialog"
          >
            <h2 id="note-editor-title">
              {noteEditor.id ? "Edit note" : "Create a note"}
            </h2>
            <label htmlFor="note-title">Title</label>
            <input
              id="note-title"
              maxLength={200}
              onChange={(event) => setNoteEditor({ ...noteEditor, title: event.target.value })}
              placeholder="Give your note a title"
              value={noteEditor.title}
            />
            <label htmlFor="note-content">Note</label>
            <textarea
              autoFocus
              id="note-content"
              onChange={(event) => setNoteEditor({ ...noteEditor, content: event.target.value })}
              required
              rows={8}
              value={noteEditor.content}
            />
            <div className="note-editor-actions">
              <button
                disabled={isSubmitting}
                onClick={() => setNoteEditor(null)}
                type="button"
              >
                Cancel
              </button>
              <button disabled={isSubmitting} type="submit">
                {isSubmitting ? "Saving..." : "Save note"}
              </button>
            </div>
          </form>
        </div>
      )}

    </div>
  );
}

export default Notes;