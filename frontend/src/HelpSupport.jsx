import React, { useState } from "react";
import "./HelpSupport.css";
import Sidebar from "./Sidebar";
import TopBar from "./TopBar";

const helpTopics = [
  {
    question: "How do I save a resource?",
    answer:
      "Open Saved Resources and choose Save Resource. Add the resource details, then save it to your library.",
  },
  {
    question: "How do collections and tags work?",
    answer:
      "Collections group related resources together. Tags label resources across collections so you can find related items quickly.",
  },
  {
    question: "Where can I find my notes?",
    answer:
      "Choose Notes in the sidebar. Use the search field to find notes by title.",
  },
  {
    question: "How do I update my account details?",
    answer:
      "Open Settings, update your profile information, and select Save Changes.",
  },
];

function HelpSupport({
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
}) {
  const [searchTerm, setSearchTerm] = useState("");

  const filteredTopics = helpTopics.filter((topic) => {
    const search = searchTerm.trim().toLowerCase();

    return `${topic.question} ${topic.answer}`
      .toLowerCase()
      .includes(search);
  });

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
        onSemanticSearch={onSemanticSearch}
        onRecent={onRecent}
        onSettings={onSettings}
        onLogout={onLogout}
      />

      <main className="help-support-main">
        <TopBar
          onSavedResources={onSavedResources}
          onCollections={onCollections}
          onTags={onTags}
          onHelpSupport={onHelpSupport}
          onSettings={onSettings}
        />

        <header className="help-page-heading">
          <div>
            <h1>Help &amp; Support</h1>
            <p>
              Find answers to common questions about using SmartMark.
            </p>
          </div>

          <div className="help-header-actions">
            <div className="help-search">
              <span aria-hidden="true">⌕</span>

              <input
                type="text"
                aria-label="Search help topics"
                placeholder="Search help topics..."
                value={searchTerm}
                onChange={(event) =>
                  setSearchTerm(event.target.value)
                }
              />
            </div>
          </div>
        </header>

        <div className="help-content-grid">
          <section
            className="help-section"
            aria-labelledby="help-faq-heading"
          >
            <div className="help-section-heading">
              <div>
                <h2 id="help-faq-heading">
                  Frequently Asked Questions
                </h2>
                <p>Quick answers about your knowledge hub.</p>
              </div>

              <span>
                {filteredTopics.length}{" "}
                {filteredTopics.length === 1 ? "topic" : "topics"}
              </span>
            </div>

            <div className="help-faq-list">
              {filteredTopics.length > 0 ? (
                filteredTopics.map((topic) => (
                  <details
                    className="help-faq-item"
                    key={topic.question}
                  >
                    <summary>{topic.question}</summary>
                    <p>{topic.answer}</p>
                  </details>
                ))
              ) : (
                <p className="help-empty">
                  No help topics match that search.
                </p>
              )}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}

export default HelpSupport;