import { useEffect, useState } from "react";
import { apiRequest } from "./authApi";
import "./SemanticSearch.css";

function SemanticSearch({ query }) {
  const [isOpen, setIsOpen] = useState(false);
  const [results, setResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (!isOpen || !query.trim()) {
      setResults([]);
      setIsLoading(false);
      setErrorMessage("");
      return undefined;
    }

    let isActive = true;
    const timeoutId = window.setTimeout(async () => {
      setIsLoading(true);
      setErrorMessage("");

      try {
        const params = new URLSearchParams({ q: query.trim(), limit: "10" });
        const result = await apiRequest(`search/semantic?${params.toString()}`);
        if (!Array.isArray(result)) {
          throw new Error("The server returned an unexpected semantic search response.");
        }
        if (isActive) setResults(result);
      } catch (error) {
        if (isActive) {
          setResults([]);
          setErrorMessage(error.message || "Unable to perform semantic search.");
        }
      } finally {
        if (isActive) setIsLoading(false);
      }
    }, 250);

    return () => {
      isActive = false;
      window.clearTimeout(timeoutId);
    };
  }, [isOpen, query]);

  return (
    <div className="semantic-search">
      <button
        aria-expanded={isOpen}
        className={`semantic-search-toggle${isOpen ? " active" : ""}`}
        onClick={() => setIsOpen((open) => !open)}
        type="button"
      >
        ✨ Semantic
      </button>
      {isOpen && (
        <section className="semantic-search-panel" aria-label="Semantic search results">
          {!query.trim() ? (
            <p>Enter a search phrase to find similar resources.</p>
          ) : isLoading ? (
            <p role="status">Finding related resources...</p>
          ) : errorMessage ? (
            <p className="semantic-search-error" role="alert">{errorMessage}</p>
          ) : results.length ? (
            <ul>
              {results.map((resource) => (
                <li key={resource.id}>
                  <a href={resource.url} target="_blank" rel="noreferrer">
                    <strong>{resource.title || resource.url || "Untitled resource"}</strong>
                    <span>{resource.description || resource.source_domain || resource.resource_type || "Saved resource"}</span>
                  </a>
                </li>
              ))}
            </ul>
          ) : (
            <p>No similar resources found.</p>
          )}
        </section>
      )}
    </div>
  );
}

export default SemanticSearch;
