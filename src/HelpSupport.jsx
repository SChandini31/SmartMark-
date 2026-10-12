import React, { useState } from "react";
import "./HelpSupport.css";
import Sidebar from "./Sidebar";
import ThemeToggle from "./ThemeToggle";
import SemanticSearch from "./SemanticSearch";
import Notifications from "./Notifications";

const discussionStorageKey = "smartmark-help-discussions";

const helpTopics = [
  {
    question: "How do I save a resource?",
    answer: "Open Saved Resources and choose Save Resource. Add the resource details, then save it to your library.",
  },
  {
    question: "How do collections and tags work?",
    answer: "Collections group related resources together. Tags label resources across collections so you can find related items quickly.",
  },
  {
    question: "Where can I find my notes?",
    answer: "Choose Notes in the sidebar. Use the search field to find notes by title, text, or tag.",
  },
  {
    question: "How do I update my account details?",
    answer: "Open Settings, update your profile information, and select Save Changes.",
  },
];

function readDiscussions() {
  try {
    const savedDiscussions = JSON.parse(
      window.localStorage.getItem(discussionStorageKey) || "[]"
    );

    return Array.isArray(savedDiscussions) ? savedDiscussions : [];
  } catch {
    return [];
  }
}

function HelpSupport({
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
  const [searchTerm, setSearchTerm] = useState("");
  const [discussions, setDiscussions] = useState(readDiscussions);
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [notice, setNotice] = useState("");

  const filteredTopics = helpTopics.filter((topic) => {
    const search = searchTerm.trim().toLowerCase();
    return `${topic.question} ${topic.answer}`.toLowerCase().includes(search);
  });

  const handleSubmit = (event) => {
    event.preventDefault();
    const trimmedTitle = title.trim();
    const trimmedMessage = message.trim();

    if (!trimmedTitle || !trimmedMessage) return;

    const updatedDiscussions = [
      {
        id: Date.now(),
        title: trimmedTitle,
        message: trimmedMessage,
        date: new Date().toLocaleDateString(),
      },
      ...discussions,
    ];

    setDiscussions(updatedDiscussions);
    setTitle("");
    setMessage("");

    try {
      window.localStorage.setItem(
        discussionStorageKey,
        JSON.stringify(updatedDiscussions)
      );
      setNotice("Discussion saved in this browser.");
    } catch {
      setNotice("Discussion added for this session, but could not be saved.");
    }
  };

  return (
    <div className="help-support-container">
      <Sidebar
        activePage="help"
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

      <main className="help-support-main">
        <header className="help-page-heading">
          <div>
            <p className="help-page-label">SMARTMARK SUPPORT</p>
            <h1>Help &amp; Discussion</h1>
            <p>Find answers or start a discussion about using SmartMark.</p>
          </div>
          <div className="help-header-actions">
            <div className="help-search">
              <span aria-hidden="true">⌕</span>
              <input
                aria-label="Search help topics"
                placeholder="Search help topics..."
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
              />
              <SemanticSearch query={searchTerm} />
            </div>
            <Notifications
              onSavedResources={onSavedResources}
              onCollections={onCollections}
              onTags={onTags}
            />
            <ThemeToggle />
          </div>
        </header>

        <div className="help-content-grid">
          <section className="help-section" aria-labelledby="help-faq-heading">
            <div className="help-section-heading">
              <div>
                <h2 id="help-faq-heading">Frequently asked questions</h2>
                <p>Quick answers about your knowledge hub.</p>
              </div>
              <span>{filteredTopics.length} topics</span>
            </div>

            <div className="help-faq-list">
              {filteredTopics.length ? (
                filteredTopics.map((topic) => (
                  <details className="help-faq-item" key={topic.question}>
                    <summary>{topic.question}</summary>
                    <p>{topic.answer}</p>
                  </details>
                ))
              ) : (
                <p className="help-empty">No help topics match that search.</p>
              )}
            </div>
          </section>

          <section className="help-section discussion-section" aria-labelledby="discussion-heading">
            <div className="help-section-heading">
              <div>
                <h2 id="discussion-heading">Discussions</h2>
                <p>Write down a question or idea to revisit.</p>
              </div>
            </div>

            <form className="discussion-form" onSubmit={handleSubmit}>
              <label>
                Topic
                <input
                  maxLength={100}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="What would you like to discuss?"
                  required
                  value={title}
                />
              </label>
              <label>
                Details
                <textarea
                  maxLength={1000}
                  onChange={(event) => setMessage(event.target.value)}
                  placeholder="Add a few details..."
                  required
                  rows={3}
                  value={message}
                />
              </label>
              <div className="discussion-form-footer">
                <span aria-live="polite">{notice}</span>
                <button type="submit">Post discussion</button>
              </div>
            </form>

            <p className="discussion-storage-note">Posts are saved only in this browser.</p>

            <div className="discussion-list" aria-live="polite">
              {discussions.map((discussion) => (
                <article className="discussion-item" key={discussion.id}>
                  <h3>{discussion.title}</h3>
                  <p>{discussion.message}</p>
                  <time>{discussion.date}</time>
                </article>
              ))}
              {!discussions.length && (
                <p className="help-empty">No discussions yet.</p>
              )}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}

export default HelpSupport;