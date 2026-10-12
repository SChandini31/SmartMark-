
import React, { useEffect, useRef, useState } from "react";
import "./SavedResources.css";
import Sidebar from "./Sidebar";
import ThemeToggle from "./ThemeToggle";
import SemanticSearch from "./SemanticSearch";
import Notifications from "./Notifications";
import { apiRequest } from "./authApi";

/* ================================================================
   HELPERS
================================================================ */

function toSavedResource(resource) {
  resource = resource && typeof resource === "object" ? resource : {};

  const resourceType =
    typeof resource.resource_type === "string"
      ? resource.resource_type
      : "Website";

  const normalizedType = resourceType.toLowerCase();
  const url = typeof resource.url === "string" ? resource.url : "";

  let domain =
    typeof resource.source_domain === "string"
      ? resource.source_domain
      : "";

  if (!domain && url) {
    try {
      domain = new URL(url).hostname;
    } catch {
      domain = url;
    }
  }

  let type = resourceType;
  let icon = "🔗";

  if (
    normalizedType.includes("video") ||
    normalizedType.includes("youtube")
  ) {
    type = "Video";
    icon = "▶️";
  } else if (
    normalizedType.includes("pdf") ||
    normalizedType.includes("document")
  ) {
    type = "PDF";
    icon = "📄";
  } else if (normalizedType.includes("article")) {
    type = "Article";
    icon = "📰";
  } else if (normalizedType.includes("note")) {
    type = "Note";
    icon = "📝";
  } else if (normalizedType.includes("web")) {
    type = "Website";
    icon = "🌐";
  }

  const tags = Array.isArray(resource.tags)
    ? resource.tags
        .filter(
          (tag) =>
            typeof tag === "string" ||
            (tag && typeof tag === "object")
        )
        .map((tag) =>
          typeof tag === "string"
            ? { id: null, name: tag }
            : {
                ...tag,
                name: typeof tag.name === "string" ? tag.name : "",
              }
        )
    : [];

  return {
    ...resource,
    title:
      typeof resource.title === "string" && resource.title
        ? resource.title
        : url || "Untitled resource",
    description:
      typeof resource.description === "string"
        ? resource.description
        : "",
    type,
    domain,
    date: resource.created_at
      ? new Date(resource.created_at).toLocaleDateString()
      : "Recently saved",
    icon,
    tags,
    favorite: Boolean(
      resource.favorite ?? resource.is_favorite ?? false
    ),
  };
}

function isCollectionSuggestion(value) {
  return (
    value !== null &&
    typeof value === "object" &&
    Number.isInteger(value.collection_id) &&
    (typeof value.collection_name === "string" ||
      typeof value.name === "string") &&
    typeof value.score === "number" &&
    Number.isFinite(value.score) &&
    value.score >= 0 &&
    (value.matched_keywords === undefined ||
      (Array.isArray(value.matched_keywords) &&
        value.matched_keywords.every(
          (keyword) => typeof keyword === "string"
        )))
  );
}

function normalizeCollectionSuggestion(suggestion) {
  return {
    ...suggestion,
    collection_name:
      suggestion.collection_name || suggestion.name,
    matched_keywords: Array.isArray(suggestion.matched_keywords)
      ? suggestion.matched_keywords
      : [],
  };
}

const getSuggestionScore = (suggestion) => {
  if (!suggestion || typeof suggestion.score !== "number") {
    return 0;
  }

  return suggestion.score <= 1
    ? suggestion.score
    : suggestion.score / 100;
};

const MIN_COLLECTION_SUGGESTION_SCORE = 0.3;

function normalizeUrl(value) {
  const url = typeof value === "string" ? value.trim() : "";

  if (!url) return "";

  return /^https?:\/\//i.test(url)
    ? url
    : `https://${url}`;
}

/* ================================================================
   SAVED RESOURCES COMPONENT
================================================================ */

function SavedResources({
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
  /* Search and filters */

  const [activeFilter, setActiveFilter] = useState("All");
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState(null);
  const [searchPage, setSearchPage] = useState(1);
  const [hasMoreSearchResults, setHasMoreSearchResults] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState("");

  /* Related resources */

  const [activeRelatedResourceId, setActiveRelatedResourceId] =
    useState(null);
  const [relatedResourcesById, setRelatedResourcesById] = useState({});
  const [relatedLoadingById, setRelatedLoadingById] = useState({});
  const [relatedErrorsById, setRelatedErrorsById] = useState({});

  /* Collection suggestion popup */

  const [collectionSuggestionModal, setCollectionSuggestionModal] =
    useState(null);
  const [collectionSuggestionSelectedId, setCollectionSuggestionSelectedId] =
    useState("");
  const [changingCollectionSuggestionId, setChangingCollectionSuggestionId] =
    useState(null);
  const [collectionOptionsByResourceId, setCollectionOptionsByResourceId] =
    useState({});
  const [
    collectionAssignmentLoadingByResourceId,
    setCollectionAssignmentLoadingByResourceId,
  ] = useState({});

  const checkedAutoCollectionSuggestionIdsRef = useRef(new Set());

  /* Resources and dialogs */

  const [resources, setResources] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingResource, setEditingResource] = useState(null);
  const [activeResourceMenu, setActiveResourceMenu] = useState(null);

  /* Tags */

  const [tagResource, setTagResource] = useState(null);
  const [availableTags, setAvailableTags] = useState([]);
  const [resourceTags, setResourceTags] = useState([]);
  const [suggestedTags, setSuggestedTags] = useState([]);
  const [tagSearch, setTagSearch] = useState("");

  /* Form and messages */

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [updatingFavoriteIds, setUpdatingFavoriteIds] = useState(
    () => new Set()
  );
  const [errorMessage, setErrorMessage] = useState("");
  const [createMessage, setCreateMessage] = useState("");

  // NEW: Favorites success notification
  const [favoriteToast, setFavoriteToast] = useState("");

  const [form, setForm] = useState({
    url: "",
    title: "",
    description: "",
    resource_type: "Website",
  });

  /* ================================================================
     LOAD RESOURCES
  ================================================================ */

  useEffect(() => {
    let isActive = true;

    apiRequest("resources/")
      .then((result) => {
        if (isActive) {
          setResources(
            Array.isArray(result) ? result.map(toSavedResource) : []
          );
        }
      })
      .catch((error) => {
        if (isActive) {
          setErrorMessage(error.message || "Unable to load resources.");
        }
      })
      .finally(() => {
        if (isActive) setIsLoading(false);
      });

    return () => {
      isActive = false;
    };
  }, []);

  /* ================================================================
     SEARCH
  ================================================================ */

  useEffect(() => {
    const query = search.trim();

    if (!query) {
      setSearchResults(null);
      setHasMoreSearchResults(false);
      setIsSearching(false);
      setSearchError("");
      return undefined;
    }

    let isActive = true;

    setIsSearching(true);

    if (searchPage === 1) {
      setSearchResults([]);
    }

    setSearchError("");

    const timeoutId = window.setTimeout(async () => {
      const params = new URLSearchParams({
        q: query,
        page: String(searchPage),
        limit: "100",
      });

      const resourceTypeByFilter = {
        Websites: "Website",
        Articles: "Article",
        Videos: "Video",
        PDFs: "PDF",
        Notes: "Note",
      };

      const resourceType = resourceTypeByFilter[activeFilter];

      if (resourceType) {
        params.set("resource_type", resourceType);
      }

      try {
        const result = await apiRequest(`search/?${params.toString()}`);

        if (!Array.isArray(result)) {
          throw new Error(
            "The server returned an unexpected search response."
          );
        }

        if (isActive) {
          const mappedResults = result.map(toSavedResource);

          setSearchResults((currentResults) =>
            searchPage === 1
              ? mappedResults
              : [...(currentResults ?? []), ...mappedResults]
          );

          setHasMoreSearchResults(result.length === 100);
        }
      } catch (error) {
        if (isActive) {
          if (searchPage === 1) setSearchResults([]);

          setHasMoreSearchResults(false);
          setSearchError(
            error.message || "Unable to search resources."
          );
        }
      } finally {
        if (isActive) setIsSearching(false);
      }
    }, 250);

    return () => {
      isActive = false;
      window.clearTimeout(timeoutId);
    };
  }, [search, activeFilter, searchPage]);

  const filters = [
    "All",
    "Websites",
    "Articles",
    "Videos",
    "PDFs",
    "Notes",
  ];

  const filteredResources = (searchResults ?? resources).filter(
    (resource) => {
      const normalizedSearch = search.trim().toLowerCase();

      const matchesSearch =
        searchResults !== null ||
        !normalizedSearch ||
        resource.title.toLowerCase().includes(normalizedSearch) ||
        resource.description.toLowerCase().includes(normalizedSearch) ||
        resource.domain.toLowerCase().includes(normalizedSearch) ||
        resource.tags.some((tag) =>
          tag.name.toLowerCase().includes(normalizedSearch)
        );

      let matchesFilter = true;

      if (activeFilter === "Websites") {
        matchesFilter = resource.type === "Website";
      }
      if (activeFilter === "Articles") {
        matchesFilter = resource.type === "Article";
      }
      if (activeFilter === "Videos") {
        matchesFilter = resource.type === "Video";
      }
      if (activeFilter === "PDFs") {
        matchesFilter = resource.type === "PDF";
      }
      if (activeFilter === "Notes") {
        matchesFilter = resource.type === "Note";
      }

      return matchesSearch && matchesFilter;
    }
  );

  /* ================================================================
     COLLECTION SUGGESTIONS
  ================================================================ */

  const closeCollectionSuggestionModal = () => {
    setCollectionSuggestionModal(null);
    setCollectionSuggestionSelectedId("");
    setChangingCollectionSuggestionId(null);
  };

  const loadCollectionOptions = async (resourceId) => {
    if (
      Object.prototype.hasOwnProperty.call(
        collectionOptionsByResourceId,
        resourceId
      )
    ) {
      return collectionOptionsByResourceId[resourceId];
    }

    const collections = await apiRequest("collections/");

    const options = Array.isArray(collections)
      ? collections.filter(
          (collection) =>
            Number.isInteger(collection?.id) &&
            typeof collection.name === "string"
        )
      : [];

    setCollectionOptionsByResourceId((current) => ({
      ...current,
      [resourceId]: options,
    }));

    return options;
  };

  const fetchCollectionSuggestions = async (resourceId) => {
    const result = await apiRequest(
      `resources/${resourceId}/collection-suggestions`
    );

    const suggestions = Array.isArray(result)
      ? result
      : result?.suggestions;

    if (!Array.isArray(suggestions)) {
      throw new Error(
        "The server returned an unexpected collection-suggestions response."
      );
    }

    return suggestions
      .filter(isCollectionSuggestion)
      .map(normalizeCollectionSuggestion)
      .sort(
        (a, b) => getSuggestionScore(b) - getSuggestionScore(a)
      );
  };

  const checkAutomaticCollectionSuggestions = async (resource) => {
    const resourceId = resource?.id;

    if (!resourceId) return;

    const requestKey = String(resourceId);

    if (
      checkedAutoCollectionSuggestionIdsRef.current.has(requestKey)
    ) {
      return;
    }

    checkedAutoCollectionSuggestionIdsRef.current.add(requestKey);

    try {
      const suggestions =
        await fetchCollectionSuggestions(resourceId);

      const meaningfulSuggestions = suggestions
        .filter(
          (suggestion) =>
            getSuggestionScore(suggestion) >=
            MIN_COLLECTION_SUGGESTION_SCORE
        )
        .slice(0, 3);

      if (meaningfulSuggestions.length === 0) return;

      setCollectionSuggestionSelectedId(
        String(meaningfulSuggestions[0].collection_id)
      );

      setChangingCollectionSuggestionId(null);

      setCollectionSuggestionModal({
        resource: toSavedResource(resource),
        suggestions: meaningfulSuggestions,
        isLoading: false,
        error: "",
        source: "auto",
      });
    } catch (error) {
      console.warn(
        "SmartMark collection suggestion failed:",
        error
      );
    }
  };

  /* ================================================================
     ASSIGN SUGGESTED COLLECTION
  ================================================================ */

  const handleAssignSuggestedCollection = async (
    resource,
    collectionId,
    collectionName
  ) => {
    if (!Number.isInteger(collectionId)) return;

    setCollectionAssignmentLoadingByResourceId((current) => ({
      ...current,
      [resource.id]: true,
    }));

    setErrorMessage("");
    setCreateMessage("");

    try {
      const result = await apiRequest(
        `resources/${resource.id}`,
        {
          method: "PUT",
          payload: {
            collection_id: collectionId,
          },
        }
      );

      const returnedResource =
        result?.resource && typeof result.resource === "object"
          ? result.resource
          : result && typeof result === "object"
          ? result
          : {};

      const updatedResource = toSavedResource({
        ...resource,
        ...returnedResource,
        collection_id: collectionId,
        collection_name: collectionName,
      });

      const updateResource = (currentResources) =>
        currentResources.map((item) =>
          item.id === resource.id ? updatedResource : item
        );

      setResources(updateResource);

      setSearchResults((currentResults) =>
        currentResults === null
          ? null
          : updateResource(currentResults)
      );

      closeCollectionSuggestionModal();

      setCreateMessage(
        `Added "${resource.title}" to ${collectionName}.`
      );
    } catch (error) {
      setErrorMessage(
        error.message ||
          "Unable to assign this resource to the collection."
      );
    } finally {
      setCollectionAssignmentLoadingByResourceId((current) => ({
        ...current,
        [resource.id]: false,
      }));
    }
  };

  /* ================================================================
     CHANGE COLLECTION
  ================================================================ */

  const handleChangeCollectionClick = async () => {
    if (!collectionSuggestionModal) return;

    const resource = collectionSuggestionModal.resource;
    const resourceId = resource.id;

    if (changingCollectionSuggestionId === "modal-change") {
      const selectedCollection = (
        collectionOptionsByResourceId[resourceId] || []
      ).find(
        (collection) =>
          String(collection.id) === collectionSuggestionSelectedId
      );

      if (!selectedCollection) return;

      await handleAssignSuggestedCollection(
        resource,
        selectedCollection.id,
        selectedCollection.name
      );

      return;
    }

    try {
      const options = await loadCollectionOptions(resourceId);

      if (options.length === 0) {
        setErrorMessage(
          "You don't have any collections yet. Create one first."
        );
        return;
      }

      const alternative =
        options.find(
          (collection) =>
            String(collection.id) !== collectionSuggestionSelectedId
        ) || options[0];

      setCollectionSuggestionSelectedId(String(alternative.id));
      setChangingCollectionSuggestionId("modal-change");
    } catch (error) {
      setErrorMessage(
        error.message || "Unable to load your collections."
      );
    }
  };

  const handleAcceptCollectionSuggestion = () => {
    if (!collectionSuggestionModal) return;

    const selectedSuggestion =
      collectionSuggestionModal.suggestions.find(
        (suggestion) =>
          String(suggestion.collection_id) ===
          collectionSuggestionSelectedId
      );

    if (!selectedSuggestion) return;

    handleAssignSuggestedCollection(
      collectionSuggestionModal.resource,
      selectedSuggestion.collection_id,
      selectedSuggestion.collection_name
    );
  };

  /* ================================================================
     CREATE AND EDIT RESOURCE
  ================================================================ */

  const handleCreateResource = async (event) => {
    event.preventDefault();

    setErrorMessage("");
    setCreateMessage("");
    setIsSubmitting(true);

    const payload = {
      url: form.url.trim(),
      title: form.title.trim() || null,
      description: form.description.trim() || null,
      resource_type: form.resource_type || null,
    };

    try {
      const result = editingResource
        ? await apiRequest(`resources/${editingResource.id}`, {
            method: "PUT",
            payload,
          })
        : await apiRequest("resources/", {
            method: "POST",
            payload,
          });

      const createdResource =
        result?.resource && typeof result.resource === "object"
          ? result.resource
          : result;

      if (editingResource) {
        setResources((currentResources) =>
          currentResources.map((resource) =>
            resource.id === editingResource.id
              ? toSavedResource(createdResource)
              : resource
          )
        );
      } else {
        setResources((currentResources) => [
          toSavedResource(createdResource),
          ...currentResources,
        ]);

        void checkAutomaticCollectionSuggestions(createdResource);
      }

      setForm({
        url: "",
        title: "",
        description: "",
        resource_type: "Website",
      });

      setIsCreateOpen(false);

      setCreateMessage(
        editingResource
          ? "Resource updated successfully."
          : "Resource saved successfully."
      );

      setEditingResource(null);
    } catch (error) {
      setErrorMessage(
        error.message || "Unable to save this resource."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditResource = async (resource) => {
    setErrorMessage("");
    setActiveResourceMenu(null);
    setIsSubmitting(true);

    try {
      const detail = await apiRequest(`resources/${resource.id}`);

      setEditingResource(resource);

      setForm({
        url: detail.url || "",
        title: detail.title || "",
        description: detail.description || "",
        resource_type: detail.resource_type || "Website",
      });

      setIsCreateOpen(true);
    } catch (error) {
      setErrorMessage(
        error.message || "Unable to load this resource."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  /* ================================================================
     DELETE RESOURCE
  ================================================================ */

  const handleDeleteResource = async (resource) => {
    setActiveResourceMenu(null);

    if (!window.confirm(`Delete "${resource.title}"?`)) return;

    try {
      await apiRequest(`resources/${resource.id}`, {
        method: "DELETE",
      });

      setResources((currentResources) =>
        currentResources.filter((item) => item.id !== resource.id)
      );

      setSearchResults((currentResults) =>
        currentResults === null
          ? null
          : currentResults.filter((item) => item.id !== resource.id)
      );

      setCreateMessage("Resource deleted.");
      setErrorMessage("");
    } catch (error) {
      setErrorMessage(
        error.message || "Unable to delete this resource."
      );
    }
  };

  /* ================================================================
     FAVORITES — FIXED
  ================================================================ */

  const handleToggleFavorite = async (resource) => {
    if (!resource?.id) {
      setErrorMessage("Unable to identify this resource.");
      return;
    }

    // Prevent duplicate requests for the same resource.
    if (updatingFavoriteIds.has(resource.id)) return;

    const wasFavorite = Boolean(resource.favorite);

    setErrorMessage("");

    setUpdatingFavoriteIds((currentIds) => {
      const nextIds = new Set(currentIds);
      nextIds.add(resource.id);
      return nextIds;
    });

    try {
      // Keep the existing backend endpoint and PATCH method.
      const result = await apiRequest(
        `resources/${resource.id}/favorite`,
        {
          method: "PATCH",
        }
      );

      // Support common backend response formats.
      const responseResource =
        result?.resource && typeof result.resource === "object"
          ? result.resource
          : result;

      let isFavorite;

      if (typeof responseResource?.favorite === "boolean") {
        isFavorite = responseResource.favorite;
      } else if (
        typeof responseResource?.is_favorite === "boolean"
      ) {
        isFavorite = responseResource.is_favorite;
      } else {
        // If the endpoint returns no favorite status,
        // use the inverse of the previous state.
        isFavorite = !wasFavorite;
      }

      const updateFavorite = (items) =>
        items.map((item) =>
          item.id === resource.id
            ? { ...item, favorite: isFavorite }
            : item
        );

      setResources(updateFavorite);

      setSearchResults((currentResults) =>
        currentResults === null
          ? null
          : updateFavorite(currentResults)
      );

      // Show success only after the API request succeeds.
      setFavoriteToast(
        isFavorite
          ? "⭐ Added to favorites!"
          : "Removed from favorites."
      );

      // Notify the Favorites page if it needs to refresh.
      if (typeof onFavorites === "function") {
        // The callback is navigation-oriented in this app,
        // so do not invoke it here.
      }
    } catch (error) {
      setErrorMessage(
        error.message || "Unable to update favorites."
      );
    } finally {
      setUpdatingFavoriteIds((currentIds) => {
        const nextIds = new Set(currentIds);
        nextIds.delete(resource.id);
        return nextIds;
      });
    }
  };

  /* ================================================================
     TAGS
  ================================================================ */

  const handleOpenTagManager = async (resource) => {
    setActiveResourceMenu(null);
    setErrorMessage("");
    setTagSearch("");
    setSuggestedTags([]);
    setTagResource(resource);

    try {
      const [allTags, attachedTags] = await Promise.all([
        apiRequest("tags/"),
        apiRequest(`resources/${resource.id}/tags`),
      ]);

      setAvailableTags(Array.isArray(allTags) ? allTags : []);
      setResourceTags(
        Array.isArray(attachedTags) ? attachedTags : []
      );
    } catch (error) {
      setTagResource(null);
      setErrorMessage(
        error.message || "Unable to load resource tags."
      );
    }
  };

  const handleToggleResourceTag = async (tag) => {
    if (!tagResource || !tag?.id) return;

    const isAttached = resourceTags.some(
      (currentTag) => currentTag.id === tag.id
    );

    try {
      await apiRequest(
        `resources/${tagResource.id}/tags/${tag.id}`,
        {
          method: isAttached ? "DELETE" : "POST",
        }
      );

      setResourceTags((currentTags) =>
        isAttached
          ? currentTags.filter((currentTag) => currentTag.id !== tag.id)
          : [...currentTags, tag]
      );

      const updateTags = (currentResources) =>
        currentResources.map((resource) => {
          if (resource.id !== tagResource.id) return resource;

          const tags = isAttached
            ? resource.tags.filter(
                (currentTag) => currentTag.id !== tag.id
              )
            : [
                ...resource.tags.filter(
                  (currentTag) => currentTag.id !== tag.id
                ),
                tag,
              ];

          return { ...resource, tags };
        });

      setResources(updateTags);

      setSearchResults((currentResults) =>
        currentResults === null
          ? null
          : updateTags(currentResults)
      );
    } catch (error) {
      setErrorMessage(
        error.message || "Unable to update resource tags."
      );
    }
  };

  const handleSuggestTags = async () => {
    if (!tagResource) return;

    try {
      const result = await apiRequest(
        `resources/${tagResource.id}/suggest-tags`,
        {
          method: "POST",
        }
      );

      setSuggestedTags(
        Array.isArray(result?.suggested_tags)
          ? result.suggested_tags
          : []
      );
    } catch (error) {
      setErrorMessage(
        error.message || "Unable to suggest tags."
      );
    }
  };

  /* ================================================================
     RELATED RESOURCES
  ================================================================ */

  const handleToggleRelatedResources = async (resource) => {
    if (activeRelatedResourceId === resource.id) {
      setActiveRelatedResourceId(null);
      return;
    }

    setActiveRelatedResourceId(resource.id);

    if (
      Object.prototype.hasOwnProperty.call(
        relatedResourcesById,
        resource.id
      )
    ) {
      return;
    }

    setRelatedLoadingById((current) => ({
      ...current,
      [resource.id]: true,
    }));

    setRelatedErrorsById((current) => ({
      ...current,
      [resource.id]: "",
    }));

    try {
      const params = new URLSearchParams({ limit: "5" });

      const result = await apiRequest(
        `resources/${resource.id}/related?${params.toString()}`
      );

      if (!Array.isArray(result)) {
        throw new Error(
          "The server returned an unexpected related-resources response."
        );
      }

      setRelatedResourcesById((current) => ({
        ...current,
        [resource.id]: result.map(toSavedResource),
      }));
    } catch (error) {
      setRelatedErrorsById((current) => ({
        ...current,
        [resource.id]:
          error.message || "Unable to load related resources.",
      }));
    } finally {
      setRelatedLoadingById((current) => ({
        ...current,
        [resource.id]: false,
      }));
    }
  };

  /* ================================================================
     OPEN RESOURCE
  ================================================================ */

  const handleOpenResource = async (resource) => {
    if (activeResourceMenu !== null) {
      setActiveResourceMenu(null);
      return;
    }

    const directUrl = normalizeUrl(resource.url);

    if (directUrl) {
      window.open(directUrl, "_blank", "noopener,noreferrer");
      return;
    }

    const newTab = window.open("", "_blank");

    try {
      const detail = await apiRequest(`resources/${resource.id}`);
      const detailUrl = normalizeUrl(detail?.url);

      if (!detailUrl) {
        throw new Error("This resource has no link to open.");
      }

      if (newTab) {
        newTab.opener = null;
        newTab.location.href = detailUrl;
      }

      const addUrl = (list) =>
        list.map((item) =>
          item.id === resource.id ? { ...item, url: detailUrl } : item
        );

      setResources(addUrl);

      setSearchResults((current) =>
        current === null ? null : addUrl(current)
      );
    } catch (error) {
      if (newTab) newTab.close();

      setErrorMessage(
        error.message || "Unable to open this resource."
      );
    }
  };

  const handleCardKeyDown = (event, resource) => {
    if (event.target !== event.currentTarget) return;

    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      handleOpenResource(resource);
    }
  };

  /* ================================================================
     MODAL STATE
  ================================================================ */

  const modalResourceId = collectionSuggestionModal?.resource?.id;

  const isModalSaving = Boolean(
    modalResourceId &&
      collectionAssignmentLoadingByResourceId[modalResourceId]
  );

  const isModalChanging =
    changingCollectionSuggestionId === "modal-change";

  /* ================================================================
     RENDER
  ================================================================ */

  return (
    <div className="saved-page">
      <Sidebar
        activePage="saved"
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

      <main className="saved-main">
        {/* FAVORITES SUCCESS POPUP */}
        {favoriteToast && (
          <div className="favorite-toast" role="status">
            <span>{favoriteToast}</span>

            <button
              type="button"
              aria-label="Close notification"
              onClick={() => setFavoriteToast("")}
            >
              ×
            </button>
          </div>
        )}

        {/* HEADER */}
        <header className="saved-header">
          <div className="saved-search">
            <span>⌕</span>

            <input
              type="text"
              placeholder="Search your saved resources..."
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setSearchPage(1);
              }}
            />

            <SemanticSearch query={search} />
          </div>

          <div className="saved-header-right">
            <Notifications
              onSavedResources={onSavedResources}
              onCollections={onCollections}
              onTags={onTags}
            />

            <ThemeToggle />

            <div className="header-line" />

            <button
              aria-label="Open profile settings"
              className="saved-header-profile profile-settings-trigger"
              onClick={onSettings}
              type="button"
            >
              <div className="saved-avatar small">M</div>

              <div>
                <strong>Monika</strong>
                <span>My Account</span>
              </div>

              <span>⌄</span>
            </button>
          </div>
        </header>

        {/* PAGE CONTENT */}
        <section className="saved-content">
          <div className="saved-heading">
            <div>
              <span className="page-label">YOUR KNOWLEDGE</span>
              <h1>Saved Resources</h1>
              <p>
                All your useful digital resources, organized in one place.
              </p>
            </div>

            <button
              className="add-resource-button"
              onClick={() => {
                setErrorMessage("");
                setEditingResource(null);
                setForm({
                  url: "",
                  title: "",
                  description: "",
                  resource_type: "Website",
                });
                setIsCreateOpen(true);
              }}
              type="button"
            >
              ＋ Save Resource
            </button>
          </div>

          {createMessage && (
            <p className="resource-api-status" role="status">
              {createMessage}
            </p>
          )}

          {errorMessage && !isCreateOpen && resources.length > 0 && (
            <p className="resource-api-error" role="alert">
              {errorMessage}
            </p>
          )}

          {/* SAVE / EDIT DIALOG */}
          {isCreateOpen && (
            <div className="resource-dialog-backdrop">
              <section
                aria-labelledby="resource-dialog-title"
                aria-modal="true"
                className="resource-dialog"
                role="dialog"
              >
                <div className="resource-dialog-heading">
                  <div>
                    <h2 id="resource-dialog-title">
                      {editingResource ? "Edit resource" : "Save a resource"}
                    </h2>
                    <p>
                      {editingResource
                        ? "Update this resource in your library."
                        : "Add a URL to your SmartMark library."}
                    </p>
                  </div>

                  <button
                    aria-label="Close form"
                    className="resource-dialog-close"
                    onClick={() => {
                      setIsCreateOpen(false);
                      setEditingResource(null);
                    }}
                    type="button"
                  >
                    ×
                  </button>
                </div>

                <form
                  className="resource-create-form"
                  onSubmit={handleCreateResource}
                >
                  <label>
                    URL
                    <input
                      autoFocus
                      onChange={(event) =>
                        setForm({ ...form, url: event.target.value })
                      }
                      placeholder="https://example.com/article"
                      required
                      type="url"
                      value={form.url}
                    />
                  </label>

                  <label>
                    Title <span>Optional</span>
                    <input
                      maxLength={300}
                      onChange={(event) =>
                        setForm({ ...form, title: event.target.value })
                      }
                      placeholder="Resource title"
                      value={form.title}
                    />
                  </label>

                  <label>
                    Description <span>Optional</span>
                    <textarea
                      onChange={(event) =>
                        setForm({
                          ...form,
                          description: event.target.value,
                        })
                      }
                      placeholder="What is useful about this resource?"
                      rows={3}
                      value={form.description}
                    />
                  </label>

                  <label>
                    Type
                    <select
                      onChange={(event) =>
                        setForm({
                          ...form,
                          resource_type: event.target.value,
                        })
                      }
                      value={form.resource_type}
                    >
                      <option>Website</option>
                      <option>Article</option>
                      <option>Video</option>
                      <option>PDF</option>
                      <option>Note</option>
                    </select>
                  </label>

                  {errorMessage && (
                    <p className="resource-api-error" role="alert">
                      {errorMessage}
                    </p>
                  )}

                  <div className="resource-dialog-actions">
                    <button
                      className="resource-cancel-button"
                      onClick={() => {
                        setIsCreateOpen(false);
                        setEditingResource(null);
                      }}
                      type="button"
                    >
                      Cancel
                    </button>

                    <button
                      className="add-resource-button"
                      disabled={isSubmitting}
                      type="submit"
                    >
                      {isSubmitting
                        ? "Saving..."
                        : editingResource
                        ? "Update Resource"
                        : "Save Resource"}
                    </button>
                  </div>
                </form>
              </section>
            </div>
          )}

          {/* TAG MANAGER */}
          {tagResource && (
            <div className="resource-dialog-backdrop">
              <section
                aria-labelledby="resource-tags-title"
                aria-modal="true"
                className="resource-dialog tag-manager-dialog"
                role="dialog"
              >
                <div className="resource-dialog-heading">
                  <div>
                    <h2 id="resource-tags-title">Manage tags</h2>
                    <p>{tagResource.title}</p>
                  </div>

                  <button
                    aria-label="Close tag manager"
                    className="resource-dialog-close"
                    onClick={() => setTagResource(null)}
                    type="button"
                  >
                    ×
                  </button>
                </div>

                <button
                  className="suggest-tags-button"
                  onClick={handleSuggestTags}
                  type="button"
                >
                  Suggest tags for this resource
                </button>

                {suggestedTags.length > 0 && (
                  <div className="suggested-tags-list">
                    <h3>Suggested tags</h3>

                    {suggestedTags.map((tag) => {
                      const isAttached = resourceTags.some(
                        (item) => item.id === tag.id
                      );

                      return (
                        <button
                          className="suggested-tag-button"
                          disabled={isAttached}
                          key={tag.id}
                          onClick={() => handleToggleResourceTag(tag)}
                          type="button"
                        >
                          {isAttached ? "✓ " : "+ "}
                          {tag.name}
                        </button>
                      );
                    })}
                  </div>
                )}

                <label className="tag-manager-search">
                  Find a tag
                  <input
                    onChange={(event) => setTagSearch(event.target.value)}
                    placeholder="Search available tags..."
                    value={tagSearch}
                  />
                </label>

                <div className="available-tags-list">
                  {availableTags
                    .filter((tag) =>
                      tag.name
                        .toLowerCase()
                        .includes(tagSearch.toLowerCase())
                    )
                    .map((tag) => (
                      <label className="resource-tag-option" key={tag.id}>
                        <input
                          checked={resourceTags.some(
                            (item) => item.id === tag.id
                          )}
                          onChange={() => handleToggleResourceTag(tag)}
                          type="checkbox"
                        />
                        <span>{tag.name}</span>
                      </label>
                    ))}
                </div>

                {errorMessage && (
                  <p className="resource-api-error" role="alert">
                    {errorMessage}
                  </p>
                )}
              </section>
            </div>
          )}

          {/* COLLECTION SUGGESTION POPUP */}
          {collectionSuggestionModal && (
            <div
              className="collection-suggestion-modal-backdrop"
              onClick={(event) => {
                if (
                  event.target === event.currentTarget &&
                  !isModalSaving
                ) {
                  closeCollectionSuggestionModal();
                }
              }}
            >
              <section
                aria-labelledby="collection-suggestion-modal-title"
                aria-modal="true"
                className="collection-suggestion-modal"
                role="dialog"
              >
                <div className="collection-suggestion-modal-heading">
                  <div>
                    <span className="collection-suggestion-badge">
                      ✨ SMART SUGGESTION
                    </span>

                    <h2 id="collection-suggestion-modal-title">
                      Suggested Collection
                    </h2>

                    <p>This resource looks related to:</p>
                  </div>

                  <button
                    aria-label="Close collection suggestion"
                    className="resource-dialog-close"
                    disabled={isModalSaving}
                    onClick={closeCollectionSuggestionModal}
                    type="button"
                  >
                    ×
                  </button>
                </div>

                <div className="collection-suggestion-resource">
                  <span>
                    {collectionSuggestionModal.resource.icon || "🔗"}
                  </span>

                  <div>
                    <strong>
                      {collectionSuggestionModal.resource.title}
                    </strong>

                    {collectionSuggestionModal.resource.domain && (
                      <small>
                        {collectionSuggestionModal.resource.domain}
                      </small>
                    )}
                  </div>
                </div>

                <div className="collection-suggestion-modal-list">
                  <h3>Suggested collections</h3>

                  {collectionSuggestionModal.isLoading ? (
                    <p role="status">Finding matching collections...</p>
                  ) : collectionSuggestionModal.error ? (
                    <p className="resource-api-error" role="alert">
                      {collectionSuggestionModal.error}
                    </p>
                  ) : collectionSuggestionModal.suggestions.length === 0 ? (
                    <p>No matching collections found.</p>
                  ) : (
                    collectionSuggestionModal.suggestions.map(
                      (suggestion) => {
                        const score = Math.round(
                          getSuggestionScore(suggestion) * 100
                        );

                        const isSelected =
                          String(suggestion.collection_id) ===
                          collectionSuggestionSelectedId;

                        return (
                          <button
                            className={`collection-suggestion-choice${
                              isSelected ? " selected" : ""
                            }`}
                            key={suggestion.collection_id}
                            onClick={() => {
                              setChangingCollectionSuggestionId(null);
                              setCollectionSuggestionSelectedId(
                                String(suggestion.collection_id)
                              );
                            }}
                            type="button"
                          >
                            <span className="collection-suggestion-folder">
                              📁
                            </span>

                            <span className="collection-suggestion-choice-copy">
                              <strong>
                                {suggestion.collection_name}
                              </strong>

                              {suggestion.matched_keywords?.length > 0 && (
                                <small>
                                  Matches:{" "}
                                  {suggestion.matched_keywords.join(" • ")}
                                </small>
                              )}
                            </span>

                            <span className="collection-suggestion-score">
                              {score}%
                            </span>
                          </button>
                        );
                      }
                    )
                  )}
                </div>

                {isModalChanging && (
                  <div className="collection-suggestion-change modal-change">
                    <label>
                      Choose another collection

                      <select
                        disabled={isModalSaving}
                        onChange={(event) =>
                          setCollectionSuggestionSelectedId(
                            event.target.value
                          )
                        }
                        value={collectionSuggestionSelectedId}
                      >
                        {(
                          collectionOptionsByResourceId[modalResourceId] ||
                          []
                        ).map((collection) => (
                          <option
                            key={collection.id}
                            value={String(collection.id)}
                          >
                            {collection.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                )}

                {errorMessage && (
                  <p className="resource-api-error" role="alert">
                    {errorMessage}
                  </p>
                )}

                <div className="collection-suggestion-modal-actions">
                  <button
                    className="suggestion-dismiss-button"
                    disabled={isModalSaving}
                    onClick={closeCollectionSuggestionModal}
                    type="button"
                  >
                    Dismiss
                  </button>

                  <button
                    className="suggestion-change-button"
                    disabled={
                      isModalSaving ||
                      collectionSuggestionModal.isLoading
                    }
                    onClick={handleChangeCollectionClick}
                    type="button"
                  >
                    {isModalChanging
                      ? isModalSaving
                        ? "Saving..."
                        : "Save Selection"
                      : "Change"}
                  </button>

                  {!isModalChanging && (
                    <button
                      className="suggestion-accept-button"
                      disabled={
                        isModalSaving ||
                        collectionSuggestionModal.isLoading ||
                        !collectionSuggestionSelectedId
                      }
                      onClick={handleAcceptCollectionSuggestion}
                      type="button"
                    >
                      {isModalSaving ? "Saving..." : "Accept"}
                    </button>
                  )}
                </div>
              </section>
            </div>
          )}

          {/* MINI STATS */}
          <div className="saved-mini-stats">
            <div>
              <span>🔖</span>
              <div>
                <strong>{resources.length}</strong>
                <p>Total Saved</p>
              </div>
            </div>

            <div>
              <span>🌐</span>
              <div>
                <strong>
                  {
                    resources.filter(
                      (resource) => resource.type === "Website"
                    ).length
                  }
                </strong>
                <p>Web Resources</p>
              </div>
            </div>

            <div>
              <span>📄</span>
              <div>
                <strong>
                  {
                    resources.filter(
                      (resource) => resource.type === "PDF"
                    ).length
                  }
                </strong>
                <p>Documents</p>
              </div>
            </div>

            <div>
              <span>⭐</span>
              <div>
                <strong>
                  {resources.filter((resource) => resource.favorite).length}
                </strong>
                <p>Favorites</p>
              </div>
            </div>
          </div>

          {/* FILTERS */}
          <div className="resource-toolbar">
            <div className="filter-buttons">
              {filters.map((filter) => (
                <button
                  key={filter}
                  className={
                    activeFilter === filter ? "filter active" : "filter"
                  }
                  onClick={() => {
                    setActiveFilter(filter);
                    setSearchPage(1);
                  }}
                  type="button"
                >
                  {filter}
                </button>
              ))}
            </div>

            <button className="sort-button" type="button">
              ↕ Sort by: Recent
            </button>
          </div>

          {/* RESOURCE LIST */}
          <div className="saved-resource-container">
            <div className="resource-list-header">
              <div>
                <h2>{activeFilter} Resources</h2>

                <p>
                  {isLoading
                    ? "Loading resources..."
                    : isSearching
                    ? "Searching resources..."
                    : `${filteredResources.length} resources found`}
                </p>
              </div>

              <button className="view-button" type="button">
                ▦ Grid
              </button>
            </div>

            {searchError && (
              <p className="resource-api-error" role="alert">
                {searchError}
              </p>
            )}

            <div className="saved-resource-list">
              {isLoading ? (
                <div className="no-resources">
                  <p>Loading your resources...</p>
                </div>
              ) : isSearching && searchPage === 1 ? (
                <div className="no-resources" role="status">
                  <p>Searching your resources...</p>
                </div>
              ) : filteredResources.length === 0 ? (
                <div className="no-resources">
                  <div>🔎</div>

                  <h3>
                    {searchError
                      ? "Search failed"
                      : errorMessage
                      ? "Could not load resources"
                      : "No resources found"}
                  </h3>

                  <p>
                    {searchError
                      ? "Please try your search again."
                      : errorMessage ||
                        "Save your first resource or try a different search."}
                  </p>
                </div>
              ) : (
                filteredResources.map((resource) => (
                  <div
                    className="saved-resource-card"
                    key={resource.id}
                    role="link"
                    tabIndex={0}
                    aria-label={`Open ${resource.title}`}
                    onClick={() => handleOpenResource(resource)}
                    onKeyDown={(event) =>
                      handleCardKeyDown(event, resource)
                    }
                    style={{
                      cursor: "pointer",
                      ...(activeResourceMenu === resource.id
                        ? { position: "relative", zIndex: 20 }
                        : {}),
                    }}
                  >
                    <div className="resource-type-icon">
                      {resource.icon}
                    </div>

                    <div className="saved-resource-info">
                      <div className="resource-title-row">
                        <h3>{resource.title}</h3>

                        <span className="resource-type">
                          {resource.type}
                        </span>
                      </div>

                      <p className="resource-description">
                        {resource.description}
                      </p>

                      <div className="resource-bottom">
                        <div className="resource-details">
                          <span>🌐 {resource.domain}</span>
                          <span>•</span>
                          <span>{resource.date}</span>
                        </div>

                        <div className="resource-tags">
                          {resource.tags.map((tag) => (
                            <span key={tag.id ?? tag.name}>
                              #{tag.name}
                            </span>
                          ))}
                        </div>
                      </div>

                      {/* RELATED RESOURCES */}
                      {activeRelatedResourceId === resource.id && (
                        <section
                          className="related-resources"
                          aria-label={`Related resources for ${resource.title}`}
                          onClick={(event) => event.stopPropagation()}
                        >
                          <h4>🔗 Related Resources</h4>

                          {relatedLoadingById[resource.id] ? (
                            <p role="status">
                              Finding related resources...
                            </p>
                          ) : relatedErrorsById[resource.id] ? (
                            <p
                              className="related-resources-error"
                              role="alert"
                            >
                              {relatedErrorsById[resource.id]}
                            </p>
                          ) : relatedResourcesById[resource.id]?.length ? (
                            <ul>
                              {relatedResourcesById[resource.id].map(
                                (relatedResource) => (
                                  <li key={relatedResource.id}>
                                    <a
                                      href={normalizeUrl(relatedResource.url)}
                                      target="_blank"
                                      rel="noreferrer"
                                      onClick={(event) =>
                                        event.stopPropagation()
                                      }
                                    >
                                      {relatedResource.title ||
                                        relatedResource.url ||
                                        "Untitled resource"}
                                    </a>

                                    {relatedResource.description && (
                                      <span>
                                        {relatedResource.description}
                                      </span>
                                    )}
                                  </li>
                                )
                              )}
                            </ul>
                          ) : (
                            <p>No related resources found.</p>
                          )}
                        </section>
                      )}
                    </div>

                    {/* RESOURCE ACTIONS */}
                    <div
                      className="resource-actions"
                      onClick={(event) => event.stopPropagation()}
                      onKeyDown={(event) => event.stopPropagation()}
                    >
                      <button
                        aria-expanded={
                          activeRelatedResourceId === resource.id
                        }
                        aria-label={`Show related resources for ${resource.title}`}
                        className="related-resources-toggle"
                        onClick={() =>
                          handleToggleRelatedResources(resource)
                        }
                        type="button"
                      >
                        Related
                      </button>

                      {/* FIXED STAR BUTTON */}
                      <button
                        aria-label={
                          resource.favorite
                            ? `Remove ${resource.title} from favorites`
                            : `Add ${resource.title} to favorites`
                        }
                        aria-pressed={Boolean(resource.favorite)}
                        disabled={updatingFavoriteIds.has(resource.id)}
                        className={
                          resource.favorite
                            ? "favorite active"
                            : "favorite"
                        }
                        onClick={() => handleToggleFavorite(resource)}
                        type="button"
                      >
                        {updatingFavoriteIds.has(resource.id)
                          ? "…"
                          : resource.favorite
                          ? "★"
                          : "☆"}
                      </button>

                      {/* THREE-DOT MENU */}
                      <button
                        aria-expanded={activeResourceMenu === resource.id}
                        aria-label={`Actions for ${resource.title}`}
                        className="more-button"
                        onClick={() =>
                          setActiveResourceMenu(
                            activeResourceMenu === resource.id
                              ? null
                              : resource.id
                          )
                        }
                        type="button"
                      >
                        ⋮
                      </button>

                      {activeResourceMenu === resource.id && (
                        <div
                          className="resource-action-menu"
                          role="menu"
                          style={{ zIndex: 30 }}
                        >
                          <button
                            onClick={() => handleEditResource(resource)}
                            role="menuitem"
                            type="button"
                          >
                            Edit resource
                          </button>

                          <button
                            onClick={() => handleOpenTagManager(resource)}
                            role="menuitem"
                            type="button"
                          >
                            Manage tags
                          </button>

                          {/* NEW FAVORITES MENU ACTION */}
                          <button
                            disabled={updatingFavoriteIds.has(resource.id)}
                            onClick={() => {
                              setActiveResourceMenu(null);
                              handleToggleFavorite(resource);
                            }}
                            role="menuitem"
                            type="button"
                          >
                            {updatingFavoriteIds.has(resource.id)
                              ? "Updating favorites..."
                              : resource.favorite
                              ? "★ Remove from favorites"
                              : "☆ Add to favorites"}
                          </button>

                          <button
                            className="delete-resource-action"
                            onClick={() => handleDeleteResource(resource)}
                            role="menuitem"
                            type="button"
                          >
                            Delete resource
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* LOAD MORE SEARCH RESULTS */}
            {searchResults !== null &&
              hasMoreSearchResults &&
              !isSearching && (
                <button
                  className="view-button"
                  type="button"
                  onClick={() =>
                    setSearchPage((currentPage) => currentPage + 1)
                  }
                >
                  Load more results
                </button>
              )}
          </div>
        </section>
      </main>
    </div>
  );
}

export default SavedResources;