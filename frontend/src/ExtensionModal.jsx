import "./Extension.css";

export default function ExtensionModal({
  open,
  onClose,
  onInstall,
  storeSupported,
}) {
  if (!open) return null;

  return (
    <div
      className="extension-modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <section
        className="extension-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="extension-modal-title"
      >
        <button
          className="extension-modal-close"
          onClick={onClose}
          aria-label="Close extension information"
          type="button"
        >
          ×
        </button>

        <div className="extension-icon">🧩</div>

        <h2 id="extension-modal-title">
          SmartMark Chrome Extension
        </h2>

        <p>
          Save useful resources directly from your browser
          and keep your knowledge organized.
        </p>

        <h3>Features</h3>
        <ul>
          <li>Save links in one click.</li>
          <li>Capture images and notes.</li>
          <li>Automatically tag resources by topic.</li>
        </ul>

        <h3>How to install</h3>
        <ol>
          <li>Click Install Extension.</li>
          <li>Select Add to Chrome in the store.</li>
          <li>Pin SmartMark from the Extensions menu.</li>
        </ol>

        <button
          className="extension-primary-button"
          onClick={onInstall}
          disabled={!storeSupported}
          type="button"
        >
          Install Extension
        </button>

        <button
          className="extension-secondary-button"
          onClick={onClose}
          type="button"
        >
          Close
        </button>
      </section>
    </div>
  );
}