import React, { useEffect, useRef, useState } from "react";
import "./SavedResources.css";
import Sidebar from "./Sidebar";
import ThemeToggle from "./ThemeToggle";
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
  const isCode = normalizedType.startsWith("code:");
  const language = isCode
    ? resourceType.slice(resourceType.indexOf(":") + 1)
    : "";

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

  if (isCode) {
    type = "Code Snippet";
    icon = "💻";
  } else if (
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
  } else if (
    normalizedType.includes("web") ||
    normalizedType.includes("github")
  ) {
    type = normalizedType.includes("github") ? "GitHub" : "Website";
    icon = normalizedType.includes("github") ? "🐙" : "🌐";
  } else if (normalizedType.includes("image")) {
    type = "Image";
    icon = "🖼️";
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
    language,
    isCode,
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

function normalizeUrl(value) {
  const url = typeof value === "string" ? value.trim() : "";
  if (!url) return "";
  return /^https?:\/\//i.test(url) ? url : `https://${url}`;
}

function getResultResource(result) {
  return result?.resource && typeof result.resource === "object"
    ? result.resource
    : result;
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
    collection_name: suggestion.collection_name || suggestion.name,
    matched_keywords: Array.isArray(suggestion.matched_keywords)
      ? suggestion.matched_keywords
      : [],
  };
}

const getSuggestionScore = (suggestion) => {
  if (!suggestion || typeof suggestion.score !== "number") return 0;
  return suggestion.score <= 1 ? suggestion.score : suggestion.score / 100;
};

const MIN_COLLECTION_SUGGESTION_SCORE = 0.3;

const languageOptions = [
  { label: "Python", value: "python" },
  { label: "Java", value: "java" },
  { label: "JavaScript", value: "javascript" },
  { label: "TypeScript", value: "typescript" },
  { label: "C", value: "c" },
  { label: "C++", value: "cpp" },
  { label: "SQL", value: "sql" },
  { label: "HTML", value: "html" },
  { label: "CSS", value: "css" },
  { label: "Bash", value: "bash" },
  { label: "Other", value: "other" },
];

/* ================================================================
   SAVED RESOURCES
================================================================ */

function SavedResources({
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
  const [activeFilter, setActiveFilter] = useState("All");
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState(null);
  const [searchPage, setSearchPage] = useState(1);
  const [hasMoreSearchResults, setHasMoreSearchResults] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState("");

  const [resources, setResources] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [createMessage, setCreateMessage] = useState("");
  const [favoriteToast, setFavoriteToast] = useState("");

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingResource, setEditingResource] = useState(null);
  const [activeResourceMenu, setActiveResourceMenu] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [updatingFavoriteIds, setUpdatingFavoriteIds] = useState(
    () => new Set()
  );

  const [form, setForm] = useState({
    resourceMode: "link",
    url: "",
    title: "",
    description: "",
    resource_type: "Website",
    language: "python",
    code: "",
  });

  /* Code preview */

  const [codeResource, setCodeResource] = useState(null);
  const [codeLoading, setCodeLoading] = useState(false);
  const [codeError, setCodeError] = useState("");
  const [copyMessage, setCopyMessage] = useState("");

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

  /* Tags */

  const [tagResource, setTagResource] = useState(null);
  const [availableTags, setAvailableTags] = useState([]);
  const [resourceTags, setResourceTags] = useState([]);
  const [suggestedTags, setSuggestedTags] = useState([]);
  const [tagSearch, setTagSearch] = useState("");

  /* ================================================================
     LOAD RESOURCES
  ================================================================ */

  const loadResources = async () => {
    setIsLoading(true);
    setErrorMessage("");

    try {
      const result = await apiRequest("resources/");
      setResources(
        Array.isArray(result) ? result.map(toSavedResource) : []
      );
    } catch (error) {
      setErrorMessage(error.message || "Unable to load resources.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    let active = true;

    apiRequest("resources/")
      .then((result) => {
        if (active) {
          setResources(
            Array.isArray(result) ? result.map(toSavedResource) : []
          );
        }
      })
      .catch((error) => {
        if (active) {
          setErrorMessage(error.message || "Unable to load resources.");
        }
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
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

    let active = true;
    setIsSearching(true);
    setSearchError("");

    const timeoutId = window.setTimeout(async () => {
      const params = new URLSearchParams({
        q: query,
        page: String(searchPage),
        limit: "100",
      });

      const filterTypes = {
        Websites: "Website",
        Articles: "Article",
        Videos: "Video",
        PDFs: "PDF",
        Notes: "Note",
        "Code Snippets": "Code Snippet",
      };

      if (filterTypes[activeFilter]) {
        params.set("resource_type", filterTypes[activeFilter]);
      }

      try {
        const result = await apiRequest(`search/?${params.toString()}`);

        if (!Array.isArray(result)) {
          throw new Error("The server returned an unexpected search response.");
        }

        if (active) {
          const mapped = result.map(toSavedResource);
          setSearchResults((current) =>
            searchPage === 1 ? mapped : [...(current ?? []), ...mapped]
          );
          setHasMoreSearchResults(result.length === 100);
        }
      } catch (error) {
        if (active) {
          if (searchPage === 1) setSearchResults([]);
          setHasMoreSearchResults(false);
          setSearchError(error.message || "Unable to search resources.");
        }
      } finally {
        if (active) setIsSearching(false);
      }
    }, 250);

    return () => {
      active = false;
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
    "Code Snippets",
  ];

  const filteredResources = (searchResults ?? resources).filter((resource) => {
    const query = search.trim().toLowerCase();

    const matchesSearch =
      searchResults !== null ||
      !query ||
      resource.title.toLowerCase().includes(query) ||
      resource.description.toLowerCase().includes(query) ||
      resource.domain.toLowerCase().includes(query) ||
      resource.language?.toLowerCase().includes(query) ||
      resource.tags.some((tag) => tag.name.toLowerCase().includes(query));

    let matchesFilter = true;

    if (activeFilter === "Websites") matchesFilter = resource.type === "Website";
    if (activeFilter === "Articles") matchesFilter = resource.type === "Article";
    if (activeFilter === "Videos") matchesFilter = resource.type === "Video";
    if (activeFilter === "PDFs") matchesFilter = resource.type === "PDF";
    if (activeFilter === "Notes") matchesFilter = resource.type === "Note";
    if (activeFilter === "Code Snippets") matchesFilter = resource.isCode;

    return matchesSearch && matchesFilter;
  });

  /* ================================================================
     CREATE / EDIT RESOURCE
  ================================================================ */

  const resetForm = () => {
    setForm({
      resourceMode: "link",
      url: "",
      title: "",
      description: "",
      resource_type: "Website",
      language: "python",
      code: "",
    });
  };

  const handleCreateResource = async (event) => {
    event.preventDefault();
    setErrorMessage("");
    setCreateMessage("");
    setIsSubmitting(true);

    try {
      let result;

      if (form.resourceMode === "code") {
        if (!form.title.trim()) {
          throw new Error("Please enter a title for your code snippet.");
        }

        if (!form.code.trim()) {
          throw new Error("Please enter your code before saving.");
        }

        if (editingResource) {
          throw new Error(
            "Editing an existing code snippet is not supported by this form yet. Use View Code to inspect it."
          );
        }

        result = await apiRequest("resources/snippets", {
          method: "POST",
          payload: {
            title: form.title.trim(),
            code: form.code,
            language: form.language,
            description: form.description.trim() || null,
            collection_id: null,
          },
        });
      } else {
        if (!form.url.trim()) {
          throw new Error("Please enter a resource URL.");
        }

        const payload = {
          url: form.url.trim(),
          title: form.title.trim() || null,
          description: form.description.trim() || null,
          resource_type: form.resource_type || null,
        };

        result = editingResource
          ? await apiRequest(`resources/${editingResource.id}`, {
              method: "PUT",
              payload,
            })
          : await apiRequest("resources/", {
              method: "POST",
              payload,
            });
      }

      const returnedResource = getResultResource(result);
      const savedResource = toSavedResource(returnedResource);

      if (editingResource) {
        setResources((current) =>
          current.map((item) =>
            item.id === editingResource.id ? savedResource : item
          )
        );
      } else {
        setResources((current) => [savedResource, ...current]);

        if (!savedResource.isCode) {
          void checkAutomaticCollectionSuggestions(returnedResource);
        }
      }

      resetForm();
      setIsCreateOpen(false);
      setEditingResource(null);
      setCreateMessage(
        editingResource
          ? "Resource updated successfully."
          : savedResource.isCode
          ? "Code snippet saved successfully."
          : "Resource saved successfully."
      );
    } catch (error) {
      setErrorMessage(error.message || "Unable to save this resource.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditResource = async (resource) => {
    setErrorMessage("");
    setActiveResourceMenu(null);

    if (resource.isCode) {
      setErrorMessage(
        "Code snippet editing is not available in the URL resource form."
      );
      return;
    }

    setIsSubmitting(true);

    try {
      const detail = await apiRequest(`resources/${resource.id}`);
      setEditingResource(resource);

      setForm({
        resourceMode: "link",
        url: detail.url || "",
        title: detail.title || "",
        description: detail.description || "",
        resource_type: detail.resource_type || "Website",
        language: "python",
        code: "",
      });

      setIsCreateOpen(true);
    } catch (error) {
      setErrorMessage(error.message || "Unable to load this resource.");
    } finally {
      setIsSubmitting(false);
    }
  };

  /* ================================================================
     CODE SNIPPET PREVIEW
  ================================================================ */

  const handleViewCode = async (resource) => {
    setActiveResourceMenu(null);
    setCodeResource({
      ...resource,
      extracted_text: resource.extracted_text || "",
    });
    setCodeError("");
    setCopyMessage("");

    if (resource.extracted_text) return;

    setCodeLoading(true);

    try {
      const result = await apiRequest(`resources/${resource.id}`);
      const detail = getResultResource(result);

      const code =
        typeof detail.extracted_text === "string"
          ? detail.extracted_text
          : typeof detail.code === "string"
          ? detail.code
          : typeof detail.content === "string"
          ? detail.content
          : "";

      if (!code) {
        throw new Error(
          "The code was not included in the resource details. Check that GET resources/{id} returns extracted_text."
        );
      }

      const updated = {
        ...toSavedResource({ ...resource, ...detail }),
        extracted_text: code,
      };

      setCodeResource(updated);

      const updateResource = (items) =>
        items.map((item) =>
          item.id === resource.id ? { ...item, ...updated } : item
        );

      setResources(updateResource);
      setSearchResults((current) =>
        current === null ? null : updateResource(current)
      );
    } catch (error) {
      setCodeError(error.message || "Unable to load the code snippet.");
    } finally {
      setCodeLoading(false);
    }
  };

  const handleCopyCode = async () => {
    const code = codeResource?.extracted_text;

    if (typeof code !== "string" || !code) {
      setCodeError("There is no code available to copy.");
      return;
    }

    try {
      await navigator.clipboard.writeText(code);
      setCopyMessage("Code copied to clipboard!");
    } catch {
      setCodeError(
        "Unable to copy automatically. Select the code and copy it manually."
      );
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

      setResources((current) =>
        current.filter((item) => item.id !== resource.id)
      );

      setSearchResults((current) =>
        current === null
          ? null
          : current.filter((item) => item.id !== resource.id)
      );

      setCreateMessage("Resource deleted.");
      setErrorMessage("");
    } catch (error) {
      setErrorMessage(error.message || "Unable to delete this resource.");
    }
  };

  /* ================================================================
     FAVORITES
  ================================================================ */

  const handleToggleFavorite = async (resource) => {
    if (!resource?.id || updatingFavoriteIds.has(resource.id)) return;

    const wasFavorite = Boolean(resource.favorite);
    setErrorMessage("");

    setUpdatingFavoriteIds((current) => new Set(current).add(resource.id));

    try {
      const result = await apiRequest(
        `resources/${resource.id}/favorite`,
        { method: "PATCH" }
      );

      const responseResource = getResultResource(result);

      const isFavorite =
        typeof responseResource?.favorite === "boolean"
          ? responseResource.favorite
          : typeof responseResource?.is_favorite === "boolean"
          ? responseResource.is_favorite
          : !wasFavorite;

      const updateFavorite = (items) =>
        items.map((item) =>
          item.id === resource.id ? { ...item, favorite: isFavorite } : item
        );

      setResources(updateFavorite);
      setSearchResults((current) =>
        current === null ? null : updateFavorite(current)
      );

      setFavoriteToast(
        isFavorite ? "⭐ Added to favorites!" : "Removed from favorites."
      );
    } catch (error) {
      setErrorMessage(error.message || "Unable to update favorites.");
    } finally {
      setUpdatingFavoriteIds((current) => {
        const next = new Set(current);
        next.delete(resource.id);
        return next;
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
      setResourceTags(Array.isArray(attachedTags) ? attachedTags : []);
    } catch (error) {
      setTagResource(null);
      setErrorMessage(error.message || "Unable to load resource tags.");
    }
  };

  const handleToggleResourceTag = async (tag) => {
    if (!tagResource || !tag?.id) return;

    const isAttached = resourceTags.some((item) => item.id === tag.id);

    try {
      await apiRequest(
        `resources/${tagResource.id}/tags/${tag.id}`,
        { method: isAttached ? "DELETE" : "POST" }
      );

      setResourceTags((current) =>
        isAttached
          ? current.filter((item) => item.id !== tag.id)
          : [...current, tag]
      );

      const updateTags = (items) =>
        items.map((resource) => {
          if (resource.id !== tagResource.id) return resource;

          const tags = isAttached
            ? resource.tags.filter((item) => item.id !== tag.id)
            : [
                ...resource.tags.filter((item) => item.id !== tag.id),
                tag,
              ];

          return { ...resource, tags };
        });

      setResources(updateTags);
      setSearchResults((current) =>
        current === null ? null : updateTags(current)
      );
    } catch (error) {
      setErrorMessage(error.message || "Unable to update resource tags.");
    }
  };

  const handleSuggestTags = async () => {
    if (!tagResource) return;

    try {
      const result = await apiRequest(
        `resources/${tagResource.id}/suggest-tags`,
        { method: "POST" }
      );

      setSuggestedTags(
        Array.isArray(result?.suggested_tags) ? result.suggested_tags : []
      );
    } catch (error) {
      setErrorMessage(error.message || "Unable to suggest tags.");
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
      const result = await apiRequest(
        `resources/${resource.id}/related?limit=5`
      );

      if (!Array.isArray(result)) {
        throw new Error("The server returned an unexpected related-resources response.");
      }

      setRelatedResourcesById((current) => ({
        ...current,
        [resource.id]: result.map(toSavedResource),
      }));
    } catch (error) {
      setRelatedErrorsById((current) => ({
        ...current,
        [resource.id]: error.message || "Unable to load related resources.",
      }));
    } finally {
      setRelatedLoadingById((current) => ({
        ...current,
        [resource.id]: false,
      }));
    }
  };

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

    const result = await apiRequest("collections/");
    const options = Array.isArray(result)
      ? result.filter(
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
      throw new Error("The server returned an unexpected collection-suggestions response.");
    }

    return suggestions
      .filter(isCollectionSuggestion)
      .map(normalizeCollectionSuggestion)
      .sort((a, b) => getSuggestionScore(b) - getSuggestionScore(a));
  };

  const checkAutomaticCollectionSuggestions = async (resource) => {
    if (!resource?.id) return;

    const requestKey = String(resource.id);
    if (checkedAutoCollectionSuggestionIdsRef.current.has(requestKey)) return;

    checkedAutoCollectionSuggestionIdsRef.current.add(requestKey);

    try {
      const suggestions = await fetchCollectionSuggestions(resource.id);
      const meaningful = suggestions
        .filter(
          (suggestion) =>
            getSuggestionScore(suggestion) >= MIN_COLLECTION_SUGGESTION_SCORE
        )
        .slice(0, 3);

      if (!meaningful.length) return;

      setCollectionSuggestionSelectedId(
        String(meaningful[0].collection_id)
      );

      setCollectionSuggestionModal({
        resource: toSavedResource(resource),
        suggestions: meaningful,
        isLoading: false,
        error: "",
        source: "auto",
      });
    } catch (error) {
      console.warn("SmartMark collection suggestion failed:", error);
    }
  };

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
      const result = await apiRequest(`resources/${resource.id}`, {
        method: "PUT",
        payload: { collection_id: collectionId },
      });

      const returnedResource = getResultResource(result) || {};

      const updatedResource = toSavedResource({
        ...resource,
        ...returnedResource,
        collection_id: collectionId,
        collection_name: collectionName,
      });

      const update = (items) =>
        items.map((item) =>
          item.id === resource.id ? updatedResource : item
        );

      setResources(update);
      setSearchResults((current) =>
        current === null ? null : update(current)
      );

      closeCollectionSuggestionModal();
      setCreateMessage(`Added "${resource.title}" to ${collectionName}.`);
    } catch (error) {
      setErrorMessage(error.message || "Unable to assign this resource to the collection.");
    } finally {
      setCollectionAssignmentLoadingByResourceId((current) => ({
        ...current,
        [resource.id]: false,
      }));
    }
  };

  const handleChangeCollectionClick = async () => {
    if (!collectionSuggestionModal) return;

    const resource = collectionSuggestionModal.resource;
    const resourceId = resource.id;

    if (changingCollectionSuggestionId === "modal-change") {
      const selected = (
        collectionOptionsByResourceId[resourceId] || []
      ).find(
        (collection) =>
          String(collection.id) === collectionSuggestionSelectedId
      );

      if (selected) {
        await handleAssignSuggestedCollection(
          resource,
          selected.id,
          selected.name
        );
      }
      return;
    }

    try {
      const options = await loadCollectionOptions(resourceId);

      if (!options.length) {
        setErrorMessage("You don't have any collections yet. Create one first.");
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
      setErrorMessage(error.message || "Unable to load your collections.");
    }
  };

  const handleAcceptCollectionSuggestion = () => {
    if (!collectionSuggestionModal) return;

    const selected = collectionSuggestionModal.suggestions.find(
      (suggestion) =>
        String(suggestion.collection_id) === collectionSuggestionSelectedId
    );

    if (selected) {
      handleAssignSuggestedCollection(
        collectionSuggestionModal.resource,
        selected.collection_id,
        selected.collection_name
      );
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

    if (resource.isCode) {
      await handleViewCode(resource);
      return;
    }

    const directUrl = normalizeUrl(resource.url);

    if (directUrl) {
      window.open(directUrl, "_blank", "noopener,noreferrer");
      return;
    }

    const newTab = window.open("", "_blank");

    try {
      const detail = getResultResource(
        await apiRequest(`resources/${resource.id}`)
      );

      const detailUrl = normalizeUrl(detail?.url);
      if (!detailUrl) throw new Error("This resource has no link to open.");

      if (newTab) {
        newTab.opener = null;
        newTab.location.href = detailUrl;
      }

      const updateUrl = (items) =>
        items.map((item) =>
          item.id === resource.id ? { ...item, url: detailUrl } : item
        );

      setResources(updateUrl);
      setSearchResults((current) =>
        current === null ? null : updateUrl(current)
      );
    } catch (error) {
      if (newTab) newTab.close();
      setErrorMessage(error.message || "Unable to open this resource.");
    }
  };

  const handleCardKeyDown = (event, resource) => {
    if (event.target !== event.currentTarget) return;

    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      handleOpenResource(resource);
    }
  };

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
        onSemanticSearch={onSemanticSearch}
        onRecent={onRecent}
        onSettings={onSettings}
        onHelpSupport={onHelpSupport}
        onLogout={onLogout}
      />

      <main className="saved-main">
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

        <section className="saved-content">
          <div className="saved-heading">
            <div>
              <h1>Saved Resources</h1>
              <p>All your useful digital resources, organized in one place.</p>
            </div>

            <button
              className="add-resource-button"
              onClick={() => {
                setErrorMessage("");
                setEditingResource(null);
                resetForm();
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

          {/* SAVE RESOURCE DIALOG */}

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
                      Save a link or keep a code snippet in your library.
                    </p>
                  </div>

                  <button
                    aria-label="Close form"
                    className="resource-dialog-close"
                    onClick={() => {
                      setIsCreateOpen(false);
                      setEditingResource(null);
                      setErrorMessage("");
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
                  {form.resourceMode === "code" && !editingResource ? (
                    <>
                      <label>
                        Title
                        <input
                          autoFocus
                          maxLength={300}
                          onChange={(event) =>
                            setForm((current) => ({
                              ...current,
                              title: event.target.value,
                            }))
                          }
                          placeholder="e.g. Python Factorial"
                          required
                          value={form.title}
                        />
                      </label>

                      <label>
                        Programming language
                        <select
                          onChange={(event) =>
                            setForm((current) => ({
                              ...current,
                              language: event.target.value,
                            }))
                          }
                          value={form.language}
                        >
                          {languageOptions.map((language) => (
                            <option
                              key={language.value}
                              value={language.value}
                            >
                              {language.label}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label>
                        Code
                        <textarea
                          className="code-editor-textarea"
                          onChange={(event) =>
                            setForm((current) => ({
                              ...current,
                              code: event.target.value,
                            }))
                          }
                          placeholder={"def factorial(n):\n    if n <= 1:\n        return 1\n    return n * factorial(n - 1)"}
                          required
                          rows={10}
                          spellCheck={false}
                          value={form.code}
                        />
                      </label>

                      <label>
                        Description <span>Optional</span>
                        <textarea
                          onChange={(event) =>
                            setForm((current) => ({
                              ...current,
                              description: event.target.value,
                            }))
                          }
                          placeholder="What does this code do?"
                          rows={3}
                          value={form.description}
                        />
                      </label>
                    </>
                  ) : (
                    <>
                      <label>
                        URL
                        <input
                          autoFocus
                          onChange={(event) =>
                            setForm((current) => ({
                              ...current,
                              url: event.target.value,
                            }))
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
                            setForm((current) => ({
                              ...current,
                              title: event.target.value,
                            }))
                          }
                          placeholder="Resource title"
                          value={form.title}
                        />
                      </label>

                      <label>
                        Description <span>Optional</span>
                        <textarea
                          onChange={(event) =>
                            setForm((current) => ({
                              ...current,
                              description: event.target.value,
                            }))
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
                            setForm((current) => ({
                              ...current,
                              resource_type: event.target.value,
                            }))
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
                    </>
                  )}

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
                        setErrorMessage("");
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
                        : form.resourceMode === "code"
                        ? "Save Code Snippet"
                        : "Save Resource"}
                    </button>
                  </div>
                </form>
              </section>
            </div>
          )}

          {/* CODE PREVIEW DIALOG */}

          {codeResource && (
            <div className="resource-dialog-backdrop">
              <section
                aria-labelledby="code-preview-title"
                aria-modal="true"
                className="resource-dialog code-preview-dialog"
                role="dialog"
              >
                <div className="resource-dialog-heading">
                  <div>
                    <h2 id="code-preview-title">{codeResource.title}</h2>
                    <p>
                      {(codeResource.language || "text").toUpperCase()} code
                      snippet
                    </p>
                  </div>

                  <button
                    aria-label="Close code preview"
                    className="resource-dialog-close"
                    onClick={() => {
                      setCodeResource(null);
                      setCodeError("");
                      setCopyMessage("");
                    }}
                    type="button"
                  >
                    ×
                  </button>
                </div>

                {codeResource.description && (
                  <p className="code-preview-description">
                    {codeResource.description}
                  </p>
                )}

                {codeLoading ? (
                  <p role="status">Loading code...</p>
                ) : codeError ? (
                  <p className="resource-api-error" role="alert">
                    {codeError}
                  </p>
                ) : (
                  <pre className="code-preview-block">
                    <code>{codeResource.extracted_text}</code>
                  </pre>
                )}

                {copyMessage && (
                  <p className="resource-api-status" role="status">
                    {copyMessage}
                  </p>
                )}

                <div className="resource-dialog-actions">
                  <button
                    className="resource-cancel-button"
                    onClick={() => setCodeResource(null)}
                    type="button"
                  >
                    Close
                  </button>

                  <button
                    className="add-resource-button"
                    disabled={
                      codeLoading ||
                      !codeResource.extracted_text ||
                      Boolean(codeError)
                    }
                    onClick={handleCopyCode}
                    type="button"
                  >
                    Copy Code
                  </button>
                </div>
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
                      const attached = resourceTags.some(
                        (item) => item.id === tag.id
                      );

                      return (
                        <button
                          className="suggested-tag-button"
                          disabled={attached}
                          key={tag.id}
                          onClick={() => handleToggleResourceTag(tag)}
                          type="button"
                        >
                          {attached ? "✓ " : "+ "}
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
                      tag.name.toLowerCase().includes(tagSearch.toLowerCase())
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
                  <span>{collectionSuggestionModal.resource.icon || "🔗"}</span>
                  <div>
                    <strong>{collectionSuggestionModal.resource.title}</strong>
                    {collectionSuggestionModal.resource.domain && (
                      <small>{collectionSuggestionModal.resource.domain}</small>
                    )}
                  </div>
                </div>

                <div className="collection-suggestion-modal-list">
                  <h3>Suggested collections</h3>

                  {collectionSuggestionModal.suggestions.length === 0 ? (
                    <p>No matching collections found.</p>
                  ) : (
                    collectionSuggestionModal.suggestions.map((suggestion) => {
                      const score = Math.round(
                        getSuggestionScore(suggestion) * 100
                      );
                      const selected =
                        String(suggestion.collection_id) ===
                        collectionSuggestionSelectedId;

                      return (
                        <button
                          className={`collection-suggestion-choice${selected ? " selected" : ""}`}
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
                            <strong>{suggestion.collection_name}</strong>
                            {suggestion.matched_keywords.length > 0 && (
                              <small>
                                Matches: {suggestion.matched_keywords.join(" • ")}
                              </small>
                            )}
                          </span>
                          <span className="collection-suggestion-score">
                            {score}%
                          </span>
                        </button>
                      );
                    })
                  )}
                </div>

                {isModalChanging && (
                  <div className="collection-suggestion-change modal-change">
                    <label>
                      Choose another collection
                      <select
                        disabled={isModalSaving}
                        onChange={(event) =>
                          setCollectionSuggestionSelectedId(event.target.value)
                        }
                        value={collectionSuggestionSelectedId}
                      >
                        {(collectionOptionsByResourceId[modalResourceId] || [])
                          .map((collection) => (
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
                    disabled={isModalSaving}
                    onClick={handleChangeCollectionClick}
                    type="button"
                  >
                    {isModalChanging ? "Save Selection" : "Change"}
                  </button>

                  {!isModalChanging && (
                    <button
                      className="suggestion-accept-button"
                      disabled={isModalSaving || !collectionSuggestionSelectedId}
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
                  {resources.filter((resource) => resource.type === "Website").length}
                </strong>
                <p>Web Resources</p>
              </div>
            </div>

            <div>
              <span>💻</span>
              <div>
                <strong>{resources.filter((resource) => resource.isCode).length}</strong>
                <p>Code Snippets</p>
              </div>
            </div>

            <div>
              <span>⭐</span>
              <div>
                <strong>{resources.filter((resource) => resource.favorite).length}</strong>
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
                  className={activeFilter === filter ? "filter active" : "filter"}
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
                    aria-label={
                      resource.isCode
                        ? `View code: ${resource.title}`
                        : `Open ${resource.title}`
                    }
                    onClick={() => handleOpenResource(resource)}
                    onKeyDown={(event) => handleCardKeyDown(event, resource)}
                    style={{
                      cursor: "pointer",
                      ...(activeResourceMenu === resource.id
                        ? { position: "relative", zIndex: 20 }
                        : {}),
                    }}
                  >
                    <div className="resource-type-icon">{resource.icon}</div>

                    <div className="saved-resource-info">
                      <div className="resource-title-row">
                        <h3>{resource.title}</h3>
                        <span className="resource-type">{resource.type}</span>
                      </div>

                      {resource.isCode && (
                        <span className="code-language-badge">
                          {resource.language || "text"}
                        </span>
                      )}

                      <p className="resource-description">
                        {resource.description}
                      </p>

                      <div className="resource-bottom">
                        <div className="resource-details">
                          {resource.isCode ? (
                            <span>💻 Code snippet</span>
                          ) : (
                            <span>🌐 {resource.domain || "Saved resource"}</span>
                          )}
                          <span>•</span>
                          <span>{resource.date}</span>
                        </div>

                        <div className="resource-tags">
                          {resource.tags.map((tag) => (
                            <span key={tag.id ?? tag.name}>#{tag.name}</span>
                          ))}
                        </div>
                      </div>

                      {resource.isCode && (
                        <button
                          className="view-button view-code-button"
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            handleViewCode(resource);
                          }}
                        >
                          View Code
                        </button>
                      )}

                      {activeRelatedResourceId === resource.id && (
                        <section
                          className="related-resources"
                          aria-label={`Related resources for ${resource.title}`}
                          onClick={(event) => event.stopPropagation()}
                        >
                          <h4>🔗 Related Resources</h4>

                          {relatedLoadingById[resource.id] ? (
                            <p role="status">Finding related resources...</p>
                          ) : relatedErrorsById[resource.id] ? (
                            <p className="related-resources-error" role="alert">
                              {relatedErrorsById[resource.id]}
                            </p>
                          ) : relatedResourcesById[resource.id]?.length ? (
                            <ul>
                              {relatedResourcesById[resource.id].map((related) => (
                                <li key={related.id}>
                                  {related.url ? (
                                    <a
                                      href={normalizeUrl(related.url)}
                                      target="_blank"
                                      rel="noreferrer"
                                      onClick={(event) => event.stopPropagation()}
                                    >
                                      {related.title || related.url}
                                    </a>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={(event) => {
                                        event.stopPropagation();
                                        handleOpenResource(related);
                                      }}
                                    >
                                      {related.title || "Untitled resource"}
                                    </button>
                                  )}
                                  {related.description && (
                                    <span>{related.description}</span>
                                  )}
                                </li>
                              ))}
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
                        aria-expanded={activeRelatedResourceId === resource.id}
                        aria-label={`Show related resources for ${resource.title}`}
                        className="related-resources-toggle"
                        onClick={() => handleToggleRelatedResources(resource)}
                        type="button"
                      >
                        Related
                      </button>

                      <button
                        aria-label={
                          resource.favorite
                            ? `Remove ${resource.title} from favorites`
                            : `Add ${resource.title} to favorites`
                        }
                        aria-pressed={Boolean(resource.favorite)}
                        disabled={updatingFavoriteIds.has(resource.id)}
                        className={resource.favorite ? "favorite active" : "favorite"}
                        onClick={() => handleToggleFavorite(resource)}
                        type="button"
                      >
                        {updatingFavoriteIds.has(resource.id)
                          ? "…"
                          : resource.favorite
                          ? "★"
                          : "☆"}
                      </button>

                      <button
                        aria-expanded={activeResourceMenu === resource.id}
                        aria-label={`Actions for ${resource.title}`}
                        className="more-button"
                        onClick={() =>
                          setActiveResourceMenu((current) =>
                            current === resource.id ? null : resource.id
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
                          {resource.isCode ? (
                            <button
                              onClick={() => handleViewCode(resource)}
                              role="menuitem"
                              type="button"
                            >
                              View code
                            </button>
                          ) : (
                            <button
                              onClick={() => handleEditResource(resource)}
                              role="menuitem"
                              type="button"
                            >
                              Edit resource
                            </button>
                          )}

                          <button
                            onClick={() => handleOpenTagManager(resource)}
                            role="menuitem"
                            type="button"
                          >
                            Manage tags
                          </button>

                          <button
                            disabled={updatingFavoriteIds.has(resource.id)}
                            onClick={() => handleToggleFavorite(resource)}
                            role="menuitem"
                            type="button"
                          >
                            {resource.favorite
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

            {searchResults !== null && hasMoreSearchResults && !isSearching && (
              <button
                className="view-button"
                type="button"
                onClick={() => setSearchPage((current) => current + 1)}
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