import React from "react";
import "./SmartMarkWorkspace.css";

function SmartMarkWorkspace() {
  return (
    <div className="workspace-panel" aria-label="SmartMark knowledge workspace illustration">
      <div className="workspace-brand">
        <span className="workspace-logo">S</span>
        <span className="workspace-brand-name">SmartMark</span>
      </div>

      <div className="workspace-copy">
        <p className="workspace-eyebrow">PERSONAL KNOWLEDGE SYSTEM</p>
        <h2>Your knowledge, organized.</h2>
        <p>Save it. Organize it. Rediscover it.</p>
      </div>

      <div className="workspace-visual" aria-hidden="true">
        <span className="workspace-line workspace-line-one" />
        <span className="workspace-line workspace-line-two" />
        <span className="workspace-line workspace-line-three" />

        <div className="workspace-hub">
          <span className="hub-logo">S</span>
          <strong>SmartMark</strong>
          <small>knowledge hub</small>
        </div>

        <div className="workspace-card workspace-card-saved">
          <span className="card-icon card-icon-bookmark">&#9733;</span>
          <span><strong>Saved Resources</strong><small>24 new this week</small></span>
        </div>

        <div className="workspace-card workspace-card-collections">
          <span className="card-icon card-icon-folder">&#9670;</span>
          <span><strong>Collections</strong><small>Design references</small></span>
        </div>

        <div className="workspace-card workspace-card-tags">
          <span className="card-icon card-icon-tag">#</span>
          <span><strong>Tags</strong><small>12 connected topics</small></span>
        </div>

        <div className="workspace-card workspace-card-notes">
          <span className="card-icon card-icon-note">&#9998;</span>
          <span><strong>Notes</strong><small>Ideas to revisit</small></span>
        </div>

        <div className="workspace-card workspace-card-favorites">
          <span className="card-icon card-icon-favorite">&#9829;</span>
          <span><strong>Favorites</strong><small>Worth remembering</small></span>
        </div>

        <div className="workspace-sources">
          <span className="source-chip source-web">Web</span>
          <span className="source-chip source-video">Video</span>
          <span className="source-chip source-pdf">PDF</span>
          <span className="source-chip source-git">GitHub</span>
          <span className="source-chip source-note">Note</span>
        </div>
      </div>
    </div>
  );
}

export default SmartMarkWorkspace;
