import React, { useEffect, useRef, useState } from "react";
import "./SavedResources.css";
import Sidebar from "./Sidebar";
import TopBar from "./TopBar";
import { apiRequest, openResourceFile } from "./authApi";

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
    normalizedType.includes("document") ||
    normalizedType.includes("docx") ||
    normalizedType.includes("txt")
  ) {
    type = "Documents";
    icon = "📄";
  } else if (normalizedType.includes("article")) {
    type = "Article";
    icon = "📰";
  } else if (normalizedType.includes("note")) {
    type = "Note";
    icon = "📝";
  } else if (normalizedType.includes("image")) {
    type = "Image";
    icon = "🖼️";
  } else if (
    normalizedType.includes("github") ||
    normalizedType.includes("repository")
  ) {
    type = "GitHub Repository";
    icon = "🐙";
  } else if (
    normalizedType.includes("web") ||
    normalizedType.includes("website") ||
    normalizedType.includes("url")
  ) {
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

function isDisplayableResource(resource) {
  if (!resource || typeof resource !== "object") return false;

  const hasTitle =
    typeof resource.title === "string" &&
    resource.title.trim().length > 0;

  const hasUrl =
    typeof resource.url === "string" &&
    resource.url.trim().length > 0;

  const hasContent =
    typeof resource.extracted_text === "string" &&
    resource.extracted_text.trim().length > 0;

  const isCode =
    typeof resource.resource_type === "string" &&
    resource.resource_type.toLowerCase().startsWith("code:");

  return hasTitle || hasUrl || hasContent || isCode;
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

function getResourceId(result, resource) {
  return (
    resource?.id ??
    resource?.resource_id ??
    result?.resource_id ??
    result?.id ??
    null
  );
}

function getResourceFilename(resource) {
  return [
    resource.file_name,
    resource.filename,
    resource.original_filename,
    resource.title,
  ].find((value) => typeof value === "string" && value.trim()) || "document";
}

function getResourceFileMimeType(file, extension) {
  const mimeType = file.type.toLowerCase();
  if (mimeType && mimeType !== "application/octet-stream") {
    return mimeType;
  }

  const inferredMimeTypes = {
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    jpeg: "image/jpeg",
    jpg: "image/jpeg",
    pdf: "application/pdf",
    png: "image/png",
    svg: "image/svg+xml",
    txt: "text/plain",
    webp: "image/webp",
  };

  return inferredMimeTypes[extension] || mimeType;
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function sanitizeDocumentHtml(value) {
  const parsed = new DOMParser().parseFromString(value, "text/html");
  const allowedElements = new Set([
    "blockquote",
    "br",
    "code",
    "em",
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "hr",
    "li",
    "ol",
    "p",
    "pre",
    "s",
    "strong",
    "sub",
    "sup",
    "table",
    "tbody",
    "td",
    "th",
    "thead",
    "tr",
    "u",
    "ul",
  ]);

  const serialize = (node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      return escapeHtml(node.nodeValue || "");
    }

    if (node.nodeType !== Node.ELEMENT_NODE) return "";

    const tagName = node.tagName.toLowerCase();
    const children = Array.from(node.childNodes, serialize).join("");
    if (!allowedElements.has(tagName)) return children;
    if (tagName === "br" || tagName === "hr") {
      return `<${tagName}>`;
    }

    return `<${tagName}>${children}</${tagName}>`;
  };

  return Array.from(parsed.body.childNodes, serialize).join("");
}

function showDocumentPreview(targetWindow, title, content) {
  targetWindow.document.open();
  targetWindow.document.write(`<!doctype html>
    <html lang="en">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'">
        <title>${escapeHtml(title)}</title>
        <style>
          body { max-width: 860px; margin: 40px auto; padding: 0 24px; color: #24243a; font: 16px/1.65 Arial, sans-serif; }
          img { max-width: 100%; }
          table { width: 100%; border-collapse: collapse; }
          td, th { padding: 8px; border: 1px solid #d8d8e2; text-align: left; }
          pre { overflow-x: auto; padding: 16px; background: #f4f4f8; }
        </style>
      </head>
      <body><main>${content}</main></body>
    </html>`);
  targetWindow.document.close();
}

async function uploadResourceFile(file, endpoint) {
  const formData = new FormData();
  formData.append("file", file);

  return apiRequest(endpoint, {
    method: "POST",
    payload: formData,
  });
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
  const [selectedTagFilter, setSelectedTagFilter] = useState("");

  const [resources, setResources] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [createMessage, setCreateMessage] = useState("");
  const [favoriteToast, setFavoriteToast] = useState("");
  const [collectionAssignmentToast, setCollectionAssignmentToast] =
    useState("");
  const [selectedResourceIds, setSelectedResourceIds] = useState(
    () => new Set()
  );
  const [isBulkSelectionMode, setIsBulkSelectionMode] = useState(false);
  const [bulkCollections, setBulkCollections] = useState([]);
  const [bulkCollectionsLoaded, setBulkCollectionsLoaded] = useState(false);
  const [isBulkCollectionsLoading, setIsBulkCollectionsLoading] =
    useState(false);
  const bulkCollectionsRequestRef = useRef(null);
  const [bulkCollectionId, setBulkCollectionId] = useState("");
  const [bulkError, setBulkError] = useState("");
  const [bulkOperation, setBulkOperation] = useState("");
  const [isBulkCollectionModalOpen, setIsBulkCollectionModalOpen] =
    useState(false);
  const [bulkCollectionForm, setBulkCollectionForm] = useState({
    name: "",
    description: "",
  });
  const [isBulkDeleteConfirmOpen, setIsBulkDeleteConfirmOpen] =
    useState(false);

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingResource, setEditingResource] = useState(null);
  const [activeResourceMenu, setActiveResourceMenu] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [updatingFavoriteIds, setUpdatingFavoriteIds] = useState(
    () => new Set()
  );

  const [form, setForm] = useState({
    resourceMode: "link",
    resourceFile: null,
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
  const collectionSuggestionRequestsRef = useRef(new Map());
  const bulkSuggestionActionRef = useRef(false);
  const bulkCollectionCreationRef = useRef(false);

  /* Tags */

  const [tagResource, setTagResource] = useState(null);
  const [availableTags, setAvailableTags] = useState([]);
  const [resourceTags, setResourceTags] = useState([]);
  const [suggestedTags, setSuggestedTags] = useState([]);
  const [suggestedTagKeywords, setSuggestedTagKeywords] = useState([]);
  const [tagSearch, setTagSearch] = useState("");
  const [isSavingResourceTags, setIsSavingResourceTags] = useState(false);
  const [tagManagerError, setTagManagerError] = useState("");
  const [tagManagerStatus, setTagManagerStatus] = useState("");
  const resourceTagsBeforeEditRef = useRef([]);
  const resourceTagsByResourceIdRef = useRef(new Map());
  const saveResourceTagsInProgressRef = useRef(false);
  const [selectedSaveTagIds, setSelectedSaveTagIds] = useState([]);
  const [saveTagSearch, setSaveTagSearch] = useState("");
  const [isCreatingSaveTag, setIsCreatingSaveTag] = useState(false);
  const saveTagIdsBeforeEditRef = useRef([]);
  const availableTagsRequestRef = useRef(null);

  const loadAvailableTags = async () => {
    if (availableTagsRequestRef.current) {
      return availableTagsRequestRef.current;
    }

    const request = apiRequest("tags/").then((result) => {
      if (!Array.isArray(result)) {
        throw new Error("The server returned an unexpected tags response.");
      }

      setAvailableTags(result);
      return result;
    });

    availableTagsRequestRef.current = request;
    try {
      return await request;
    } finally {
      if (availableTagsRequestRef.current === request) {
        availableTagsRequestRef.current = null;
      }
    }
  };

  const loadResourceTagIndex = async (tags) => {
    const results = await Promise.allSettled(
      tags.map(async (tag) => {
        const taggedResources = await apiRequest(
          `tags/${encodeURIComponent(tag.id)}/resources`
        );
        if (!Array.isArray(taggedResources)) {
          throw new Error(
            `The server returned an unexpected resource list for the "${tag.name}" tag.`
          );
        }

        return { tag, resources: taggedResources };
      })
    );

    const tagIndex = new Map();
    const failures = [];

    results.forEach((result, tagPosition) => {
      if (result.status === "rejected") {
        failures.push(
          result.reason?.message ||
            `Unable to load tag ${tags[tagPosition].name}.`
        );
        return;
      }

      const { tag, resources: taggedResources } = result.value;
      taggedResources.forEach((resource) => {
        const resourceId = resource?.id ?? resource?.resource_id;
        if (resourceId == null) return;

        const key = String(resourceId);
        const associatedTags = tagIndex.get(key) || [];
        associatedTags.push(tag);
        tagIndex.set(key, associatedTags);
      });
    });

    return { index: tagIndex, failures };
  };

  const addTagsToResources = (items, tagIndex = resourceTagsByResourceIdRef.current) =>
    items.map((resource) =>
      toSavedResource({
        ...resource,
        tags: tagIndex.get(String(resource.id)) || resource.tags || [],
      })
    );

  const updateResourceTagIndex = (resourceId, tags) => {
    const next = new Map(resourceTagsByResourceIdRef.current);
    next.set(String(resourceId), tags);
    resourceTagsByResourceIdRef.current = next;
  };

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

  const loadBulkCollections = async () => {
    if (bulkCollectionsLoaded) return;
    if (bulkCollectionsRequestRef.current) {
      await bulkCollectionsRequestRef.current;
      return;
    }

    setIsBulkCollectionsLoading(true);
    setBulkError("");

    const request = (async () => {
      try {
        const result = await apiRequest("collections/");
        if (!Array.isArray(result)) {
          throw new Error(
            "The server returned an unexpected collections response."
          );
        }

        setBulkCollections(result);
        setBulkCollectionsLoaded(true);
      } catch (error) {
        setBulkError(
          `Could not load your collections. ${error.message || "Please try again."}`
        );
      } finally {
        setIsBulkCollectionsLoading(false);
        bulkCollectionsRequestRef.current = null;
      }
    })();

    bulkCollectionsRequestRef.current = request;
    await request;
  };

  const refreshBulkData = async () => {
    const [resourceResult, collectionResult] = await Promise.all([
      apiRequest("resources/"),
      apiRequest("collections/"),
    ]);

    if (!Array.isArray(resourceResult) || !Array.isArray(collectionResult)) {
      throw new Error("The server returned an unexpected refresh response.");
    }

    const refreshedResources = addTagsToResources(resourceResult);
    const resourcesById = new Map(
      refreshedResources.map((resource) => [String(resource.id), resource])
    );

    setResources(refreshedResources);
    setSearchResults((current) =>
      current === null
        ? null
        : current.map((resource) => {
            const refreshed = resourcesById.get(String(resource.id));
            return refreshed
              ? {
                  ...refreshed,
                  tags:
                    resourceTagsByResourceIdRef.current.get(
                      String(resource.id)
                    ) || refreshed.tags,
                }
              : resource;
          })
    );
    setBulkCollections(collectionResult);
    setBulkCollectionsLoaded(true);
  };

  const clearBulkSelection = () => {
    setSelectedResourceIds(new Set());
    setBulkCollectionId("");
    setBulkError("");
  };

  const getVisibleResourceIds = () =>
    filteredResources
      .filter((resource) => resource.id != null)
      .map((resource) => String(resource.id));

  const toggleResourceSelection = (resourceId) => {
    const id = String(resourceId);
    const next = new Set(selectedResourceIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedResourceIds(next);
    if (next.size >= 2) {
      void loadBulkCollections();
    }
  };

  const toggleVisibleResourceSelection = () => {
    const visibleIds = getVisibleResourceIds();
    const allVisibleSelected =
      visibleIds.length > 0 &&
      visibleIds.every((id) => selectedResourceIds.has(id));

    const next = new Set(selectedResourceIds);
    visibleIds.forEach((id) => {
      if (allVisibleSelected) {
        next.delete(id);
      } else {
        next.add(id);
      }
    });
    setSelectedResourceIds(next);
    if (next.size >= 2) {
      void loadBulkCollections();
    }
  };

  const getSelectedResourceIds = () => {
    const resourcesById = new Map(
      [...resources, ...(searchResults ?? [])]
        .filter((resource) => resource.id != null)
        .map((resource) => [String(resource.id), resource.id])
    );

    return [...selectedResourceIds]
      .map((id) => resourcesById.get(id))
      .filter((id) => id != null);
  };

  const handleSuggestSelectedCollections = async () => {
    if (selectedResourceIds.size < 2 || bulkSuggestionActionRef.current) {
      return;
    }

    const selectedIds = getSelectedResourceIds();
    if (selectedIds.length < 2) {
      setBulkError("Select at least two resources to get suggestions.");
      return;
    }

    bulkSuggestionActionRef.current = true;
    setBulkOperation("suggest");
    setBulkError("");
    setCollectionSuggestionSelectedId("");
    setCollectionSuggestionModal({
      source: "bulk",
      resourceIds: selectedIds,
      suggestions: [],
      recommendNewCollection: false,
      suggestedCollectionName: "",
      message: "",
      isLoading: true,
      error: "",
    });

    try {
      const result = await apiRequest(
        "resources/bulk/collection-suggestions",
        {
          method: "POST",
          payload: { resource_ids: selectedIds },
        }
      );

      if (
        !result ||
        typeof result !== "object" ||
        !Array.isArray(result.suggested_collections)
      ) {
        throw new Error(
          "The server returned an unexpected collection-suggestions response."
        );
      }

      const suggestions = result.suggested_collections;
      if (suggestions.some((suggestion) => !isCollectionSuggestion(suggestion))) {
        throw new Error(
          "The server returned an invalid collection recommendation."
        );
      }

      setCollectionSuggestionModal((current) =>
        current?.source === "bulk"
          ? {
              ...current,
              suggestions: suggestions.map(normalizeCollectionSuggestion),
              recommendNewCollection:
                result.recommend_new_collection === true,
              suggestedCollectionName:
                typeof result.suggested_collection_name === "string"
                  ? result.suggested_collection_name.trim()
                  : "",
              message:
                typeof result.message === "string" ? result.message : "",
              isLoading: false,
            }
          : current
      );
    } catch (error) {
      setCollectionSuggestionModal((current) =>
        current?.source === "bulk"
          ? {
              ...current,
              isLoading: false,
              error:
                error.message || "Unable to load collection suggestions.",
            }
          : current
      );
    } finally {
      bulkSuggestionActionRef.current = false;
      setBulkOperation("");
    }
  };

  const handleAssignBulkSuggestion = async (suggestion) => {
    if (
      !collectionSuggestionModal ||
      collectionSuggestionModal.source !== "bulk" ||
      !Number.isInteger(suggestion?.collection_id) ||
      bulkSuggestionActionRef.current
    ) {
      return;
    }

    const resourceIds = collectionSuggestionModal.resourceIds;
    if (!Array.isArray(resourceIds) || resourceIds.length < 2) {
      setCollectionSuggestionModal((current) => ({
        ...current,
        error: "Select at least two resources to apply this suggestion.",
      }));
      return;
    }

    bulkSuggestionActionRef.current = true;
    setBulkOperation("suggest-move");
    setCollectionSuggestionModal((current) => ({
      ...current,
      error: "",
      applyingCollectionId: suggestion.collection_id,
    }));

    try {
      await apiRequest(
        `collections/${encodeURIComponent(suggestion.collection_id)}/resources/bulk`,
        {
          method: "POST",
          payload: { resource_ids: resourceIds },
        }
      );

      setCollectionSuggestionModal(null);
      setCollectionSuggestionSelectedId("");
      await completeBulkAction(
        `Moved ${resourceIds.length} ${resourceIds.length === 1 ? "resource" : "resources"} to ${suggestion.collection_name}.`
      );
    } catch (error) {
      setCollectionSuggestionModal((current) =>
        current?.source === "bulk"
          ? {
              ...current,
              error: error.message || "Unable to move the selected resources.",
              applyingCollectionId: null,
            }
          : current
      );
    } finally {
      bulkSuggestionActionRef.current = false;
      setBulkOperation("");
    }
  };

  const handleCreateCollectionFromBulkSuggestion = () => {
    if (
      !collectionSuggestionModal ||
      collectionSuggestionModal.source !== "bulk" ||
      bulkSuggestionActionRef.current
    ) {
      return;
    }

    setBulkError("");
    setBulkCollectionForm({
      name: collectionSuggestionModal.suggestedCollectionName || "",
      description: "",
    });
    closeCollectionSuggestionModal();
    setIsBulkCollectionModalOpen(true);
  };

  const completeBulkAction = async (successMessage) => {
    clearBulkSelection();
    setIsBulkSelectionMode(false);
    setCollectionAssignmentToast(successMessage);

    try {
      await refreshBulkData();
    } catch (error) {
      setBulkError(
        `The action succeeded, but your resources and collection counts could not be refreshed. ${error.message || "Please reload the page."}`
      );
    }
  };

  const handleMoveSelectedResources = async () => {
    if (!bulkCollectionId || selectedResourceIds.size < 2) return;

    const collection = bulkCollections.find(
      (item) => String(item.id) === bulkCollectionId
    );
    if (!collection) {
      setBulkError("Choose a valid destination collection.");
      return;
    }

    const selectedIds = getSelectedResourceIds();
    if (selectedIds.length < 2) {
      setBulkError("Select at least two resources to move.");
      return;
    }

    setBulkOperation("move");
    setBulkError("");

    try {
      await apiRequest(
        `collections/${encodeURIComponent(collection.id)}/resources/bulk`,
        {
          method: "POST",
          payload: { resource_ids: selectedIds },
        }
      );
      await completeBulkAction(
        `Moved ${selectedIds.length} ${selectedIds.length === 1 ? "resource" : "resources"} to ${collection.name}.`
      );
    } catch (error) {
      setBulkError(error.message || "Unable to move the selected resources.");
    } finally {
      setBulkOperation("");
    }
  };

  const handleCreateCollectionAndAssign = async (event) => {
    event.preventDefault();
    if (bulkCollectionCreationRef.current) return;
    const name = bulkCollectionForm.name.trim();

    if (!name) {
      setBulkError("Please enter a collection name.");
      return;
    }

    const selectedIds = getSelectedResourceIds();
    if (selectedIds.length < 2) {
      setBulkError("Select at least two resources to assign.");
      return;
    }

    bulkCollectionCreationRef.current = true;
    setBulkOperation("create");
    setBulkError("");

    let createdCollection;
    try {
      const result = await apiRequest("collections/", {
        method: "POST",
        payload: {
          name,
          description: bulkCollectionForm.description.trim() || null,
        },
      });

      createdCollection =
        result?.collection && typeof result.collection === "object"
          ? result.collection
          : result;
      if (createdCollection?.id == null) {
        throw new Error("The server returned an invalid collection.");
      }
    } catch (error) {
      setBulkError(error.message || "Unable to create the collection.");
      setBulkOperation("");
      bulkCollectionCreationRef.current = false;
      return;
    }

    try {
      await apiRequest(
        `collections/${encodeURIComponent(createdCollection.id)}/resources/bulk`,
        {
          method: "POST",
          payload: { resource_ids: selectedIds },
        }
      );
      setIsBulkCollectionModalOpen(false);
      setBulkCollectionForm({ name: "", description: "" });
      await completeBulkAction(
        `Created "${createdCollection.name || name}" and assigned ${selectedIds.length} ${selectedIds.length === 1 ? "resource" : "resources"}.`
      );
    } catch (error) {
      setIsBulkCollectionModalOpen(false);
      setBulkCollectionForm({ name: "", description: "" });
      setBulkError(
        `Collection "${createdCollection.name || name}" was created, but the selected resources were not assigned. The collection was not recreated. ${error.message || "Choose the new collection and retry the assignment."}`
      );
      try {
        const collections = await apiRequest("collections/");
        if (!Array.isArray(collections)) {
          throw new Error(
            "The server returned an unexpected collections response."
          );
        }
        setBulkCollections(collections);
        setBulkCollectionsLoaded(true);
      } catch (refreshError) {
        setBulkCollectionsLoaded(false);
        setBulkError(
          `Collection "${createdCollection.name || name}" was created, but the selected resources were not assigned. ${refreshError.message || "Refresh collections and retry the assignment."}`
        );
      }
    } finally {
      setBulkOperation("");
      bulkCollectionCreationRef.current = false;
    }
  };

  const handleDeleteSelectedResources = async () => {
    const selectedIds = getSelectedResourceIds();
    if (!selectedIds.length) {
      setBulkError("Select at least one resource to delete.");
      return;
    }

    setBulkOperation("delete");
    setBulkError("");

    try {
      await apiRequest("resources/bulk", {
        method: "DELETE",
        payload: { resource_ids: selectedIds },
      });

      const deletedIds = new Set(selectedIds.map(String));
      setResources((current) =>
        current.filter((resource) => !deletedIds.has(String(resource.id)))
      );
      setSearchResults((current) =>
        current === null
          ? null
          : current.filter(
              (resource) => !deletedIds.has(String(resource.id))
            )
      );
      setIsBulkDeleteConfirmOpen(false);
      await completeBulkAction(
        `Permanently deleted ${selectedIds.length} ${selectedIds.length === 1 ? "resource" : "resources"}.`
      );
    } catch (error) {
      setBulkError(error.message || "Unable to delete the selected resources.");
    } finally {
      setBulkOperation("");
    }
  };

  useEffect(() => {
    let active = true;

    const loadResourcesAndTags = async () => {
      try {
        const result = await apiRequest("resources/");
        if (!Array.isArray(result)) {
          throw new Error("The server returned an unexpected resources response.");
        }

        const loadedResources = result.map(toSavedResource);
        if (active) setResources(loadedResources);

        const tags = await loadAvailableTags();
        const { index, failures } = await loadResourceTagIndex(tags);
        if (!active) return;

        resourceTagsByResourceIdRef.current = index;
        const resourcesWithTags = addTagsToResources(loadedResources, index);
        setResources(resourcesWithTags);
        setSearchResults((current) =>
          current === null ? null : addTagsToResources(current, index)
        );

        if (failures.length) {
          setErrorMessage(
            `Some resource tags could not be loaded. ${failures[0]}`
          );
        }
      } catch (error) {
        if (active) {
          setErrorMessage(error.message || "Unable to load resources.");
        }
      } finally {
        if (active) setIsLoading(false);
      }
    };

    void loadResourcesAndTags();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    loadAvailableTags().catch((error) => {
      console.warn("SmartMark tags failed to load:", error);
    });
  }, []);

  useEffect(() => {
    if (!collectionAssignmentToast) return undefined;

    const timeoutId = window.setTimeout(
      () => setCollectionAssignmentToast(""),
      3200
    );
    return () => window.clearTimeout(timeoutId);
  }, [collectionAssignmentToast]);

  /* ================================================================
     SEARCH
  ================================================================ */

  useEffect(() => {
    const query = search.trim();

    if (!query) {
      setSearchResults(null);
      setSearchPage(1);
      setHasMoreSearchResults(false);
      setIsSearching(false);
      setSearchError("");
      return undefined;
    }

    let active = true;

    const timeoutId = window.setTimeout(async () => {
      setIsSearching(true);
      setSearchError("");

      const params = new URLSearchParams({
        q: query,
        page: String(searchPage),
        limit: "100",
        sort_by: "newest",
      });

      try {
        const response = await apiRequest(
          `search/?${params.toString()}`
        );

        if (!response || !Array.isArray(response.results)) {
          throw new Error(
            "Unexpected search response. Expected an object containing results."
          );
        }

        const mappedResources = response.results
          .map((item) => {
            const resource = getResultResource(item);

            if (
              !resource ||
              typeof resource !== "object" ||
              resource.id == null
            ) {
              return null;
            }

            return addTagsToResources([resource])[0];
          })
          .filter(Boolean);

        if (!active) return;

        setSearchResults((current) =>
          searchPage === 1
            ? mappedResources
            : [...(current ?? []), ...mappedResources]
        );

        const total = Number(response.total) || 0;

        setHasMoreSearchResults(searchPage * 100 < total);
      } catch (error) {
        if (!active) return;

        if (searchPage === 1) {
          setSearchResults([]);
        }

        setHasMoreSearchResults(false);
        setSearchError(
          error.message || "Unable to search saved resources."
        );
      } finally {
        if (active) {
          setIsSearching(false);
        }
      }
    }, 300);

    return () => {
      active = false;
      window.clearTimeout(timeoutId);
    };
  }, [search, searchPage]);

  const filters = [
    "All",
    "Websites",
    "Articles",
    "Videos",
    "Documents",
    "Images",
    "GitHub Repositories",
    "Code Snippets",
  ];

  const filteredResources = (searchResults ?? resources)
    .filter(isDisplayableResource)
    .filter((resource) => {
      const query = search.trim().toLowerCase();

      const matchesSearch =
        searchResults !== null ||
        !query ||
        resource.title.toLowerCase().includes(query) ||
        resource.description.toLowerCase().includes(query) ||
        resource.domain.toLowerCase().includes(query) ||
        resource.language?.toLowerCase().includes(query) ||
        resource.tags.some((tag) =>
          tag.name.toLowerCase().includes(query)
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

      if (activeFilter === "Documents") {
        matchesFilter = resource.type === "Documents";
      }

      if (activeFilter === "Images") {
        matchesFilter = resource.type === "Image";
      }

      if (activeFilter === "GitHub Repositories") {
        matchesFilter = resource.type === "GitHub Repository";
      }

      if (activeFilter === "Code Snippets") {
        matchesFilter = resource.isCode;
      }

      const matchesTag =
        !selectedTagFilter ||
        resource.tags.some(
          (tag) => String(tag.id) === selectedTagFilter
        );

      return matchesSearch && matchesFilter && matchesTag;
    });

  const visibleResourceIds = filteredResources
    .filter((resource) => resource.id != null)
    .map((resource) => String(resource.id));
  const allVisibleResourcesSelected =
    visibleResourceIds.length > 0 &&
    visibleResourceIds.every((id) => selectedResourceIds.has(id));
  const showBulkToolbar =
    selectedResourceIds.size >= 2 || isBulkSelectionMode;

  /* ================================================================
     CREATE / EDIT RESOURCE
  ================================================================ */

  const resetForm = () => {
    setForm({
      resourceMode: "link",
      resourceFile: null,
      url: "",
      title: "",
      description: "",
      resource_type: "Website",
      language: "python",
      code: "",
    });
    setSelectedSaveTagIds([]);
    setSaveTagSearch("");
    saveTagIdsBeforeEditRef.current = [];
  };

  const syncSavedResourceTags = async (resourceId, selectedTags) => {
    const previousTags = saveTagIdsBeforeEditRef.current;
    const previousIds = new Set(previousTags.map((tag) => String(tag.id)));
    const selectedIds = new Set(selectedTags.map((tag) => String(tag.id)));
    const changes = [
      ...selectedTags
        .filter((tag) => !previousIds.has(String(tag.id)))
        .map((tag) => ({ tag, method: "POST" })),
      ...previousTags
        .filter((tag) => !selectedIds.has(String(tag.id)))
        .map((tag) => ({ tag, method: "DELETE" })),
    ];
    const results = await Promise.allSettled(
      changes.map(({ tag, method }) =>
        apiRequest(
          `resources/${resourceId}/tags/${tag.id}`,
          { method }
        )
      )
    );

    const updatedTags = new Map(
      previousTags.map((tag) => [String(tag.id), tag])
    );
    results.forEach((result, index) => {
      if (result.status !== "fulfilled") return;

      const { tag, method } = changes[index];
      if (method === "POST") {
        updatedTags.set(String(tag.id), tag);
      } else {
        updatedTags.delete(String(tag.id));
      }
    });

    return {
      tags: [...updatedTags.values()],
      hasFailures: results.some((result) => result.status === "rejected"),
    };
  };

  const handleCreateSaveTag = async () => {
    const name = saveTagSearch.trim();
    if (!name) return;

    setIsCreatingSaveTag(true);
    setErrorMessage("");

    try {
      const result = await apiRequest("tags/", {
        method: "POST",
        payload: { name },
      });
      const createdTag =
        result?.tag && typeof result.tag === "object"
          ? result.tag
          : result;

      if (!Number.isInteger(createdTag?.id) || !createdTag.name) {
        throw new Error("The server returned an invalid tag.");
      }

      setAvailableTags((current) => [
        ...current.filter((tag) => tag.id !== createdTag.id),
        createdTag,
      ]);
      setSelectedSaveTagIds((current) => [
        ...new Set([...current, String(createdTag.id)]),
      ]);
      setSaveTagSearch("");
    } catch (error) {
      setErrorMessage(error.message || "Unable to create this tag.");
    } finally {
      setIsCreatingSaveTag(false);
    }
  };

  const handleOpenSaveForm = async () => {
    setErrorMessage("");
    setEditingResource(null);
    resetForm();
    setIsCreateOpen(true);

    try {
      await loadAvailableTags();
    } catch (error) {
      setErrorMessage(error.message || "Unable to load tags.");
    }
  };

  const handleCreateResource = async (event) => {
    event.preventDefault();
    setErrorMessage("");
    setCreateMessage("");
    setIsSubmitting(true);

    try {
      let result;

      if (
        form.resourceMode === "image" ||
        form.resourceMode === "document"
      ) {
        const isDocument = form.resourceMode === "document";
        const file = form.resourceFile;

        if (!file) {
          throw new Error(
            `Please select a ${isDocument ? "PDF document" : "image"} to upload.`
          );
        }

        if (
          isDocument &&
          file.type !== "application/pdf" &&
          !file.name.toLowerCase().endsWith(".pdf")
        ) {
          throw new Error("Please select a PDF document.");
        }

const uploadResult = await uploadResourceFile(
  file,
  isDocument ? "documents/upload" : "images/upload"
);

if (!uploadResult || typeof uploadResult !== "object") {
  throw new Error(
    `The server returned an invalid ${isDocument ? "document" : "image"} upload response.`
  );
}

const resourceId = uploadResult.resource_id ?? uploadResult.id;

if (resourceId == null) {
  throw new Error(
    `The ${isDocument ? "document" : "image"} was uploaded, but the server response did not include a resource ID.`
  );
}

// Upload endpoints return metadata, not necessarily a complete Resource object.
// Fetch the saved resource using its ID.
const savedResult = await apiRequest(`resources/${resourceId}`);
const returnedResource = getResultResource(savedResult);

if (
  !returnedResource ||
  typeof returnedResource !== "object" ||
  returnedResource.id == null
) {
  throw new Error(
    "The file was uploaded, but its saved resource details could not be loaded."
  );
}

result = {
  ...returnedResource,
  resource_type: isDocument
    ? "document"
    : returnedResource.resource_type || "image",
  title: returnedResource.title || uploadResult.filename || file.name,
};
      } else if (form.resourceMode === "code") {
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

      const responseResource = getResultResource(result);
      const resourceId = getResourceId(result, responseResource);
      const returnedResource =
        resourceId == null
          ? responseResource
          : { ...responseResource, id: resourceId };
      const selectedTags = availableTags.filter((tag) =>
        selectedSaveTagIds.includes(String(tag.id))
      );
      const tagSync =
        resourceId == null
          ? { tags: [], hasFailures: selectedTags.length > 0 }
          : await syncSavedResourceTags(resourceId, selectedTags);
      const savedResource = toSavedResource({
        ...returnedResource,
        tags: tagSync.tags,
      });
      if (resourceId != null) {
        updateResourceTagIndex(resourceId, tagSync.tags);
      }

      if (editingResource) {
        setResources((current) =>
          current.map((item) =>
            item.id === editingResource.id ? savedResource : item
          )
        );
      } else {
        setResources((current) => [savedResource, ...current]);
        void checkAutomaticCollectionSuggestions(returnedResource);
      }

      resetForm();
      setIsCreateOpen(false);
      setEditingResource(null);
      setCreateMessage(
        tagSync.hasFailures
          ? "Resource saved, but some tag changes could not be applied."
          : editingResource
          ? "Resource updated successfully."
          : savedResource.isCode
          ? "Code snippet saved successfully."
          : form.resourceMode === "image" ||
            form.resourceMode === "document"
          ? `${form.resourceMode === "document" ? "Document" : "Image"} uploaded successfully.`
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
      const [detailResult, attachedTagsResult] = await Promise.all([
        apiRequest(`resources/${resource.id}`),
        loadAvailableTags().then(() =>
          apiRequest(`resources/${resource.id}/tags`)
        ),
      ]);
      const detail = getResultResource(detailResult);
      const attachedTags = Array.isArray(attachedTagsResult)
        ? attachedTagsResult
        : [];
      saveTagIdsBeforeEditRef.current = attachedTags;
      setSelectedSaveTagIds(attachedTags.map((tag) => String(tag.id)));
      setSaveTagSearch("");
      setEditingResource(resource);

      setForm({
        resourceMode: "link",
        resourceFile: null,
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
      setSelectedResourceIds((current) => {
        const next = new Set(current);
        next.delete(String(resource.id));
        return next;
      });

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
    setTagManagerError("");
    setTagManagerStatus("");
    setTagSearch("");
    setSuggestedTags([]);
    setSuggestedTagKeywords([]);
    setTagResource(null);

    try {
      const [, attachedTags] = await Promise.all([
        loadAvailableTags(),
        apiRequest(`resources/${resource.id}/tags`),
      ]);

      const currentTags = Array.isArray(attachedTags) ? attachedTags : [];
      resourceTagsBeforeEditRef.current = currentTags;
      setResourceTags(currentTags);
      updateResourceTagIndex(resource.id, currentTags);

      const updateTags = (items) =>
        items.map((item) =>
          item.id === resource.id ? { ...item, tags: currentTags } : item
        );
      setResources(updateTags);
      setSearchResults((current) =>
        current === null ? null : updateTags(current)
      );
      setTagResource(resource);
    } catch (error) {
      setTagResource(null);
      setErrorMessage(error.message || "Unable to load resource tags.");
    }
  };

  const handleToggleResourceTag = (tag) => {
    if (!tagResource || !tag?.id || isSavingResourceTags) return;

    setTagManagerError("");
    setTagManagerStatus("");
    setResourceTags((current) =>
      current.some((item) => String(item.id) === String(tag.id))
        ? current.filter((item) => String(item.id) !== String(tag.id))
        : [...current, tag]
    );
  };

  const handleSaveResourceTags = async (event) => {
    event.preventDefault();
    if (!tagResource || saveResourceTagsInProgressRef.current) return;

    const originalTags = resourceTagsBeforeEditRef.current;
    const requestedTags = resourceTags;
    const originalIds = new Set(originalTags.map((tag) => String(tag.id)));
    const requestedIds = new Set(requestedTags.map((tag) => String(tag.id)));
    const changes = [
      ...requestedTags
        .filter((tag) => !originalIds.has(String(tag.id)))
        .map((tag) => ({ tag, method: "POST" })),
      ...originalTags
        .filter((tag) => !requestedIds.has(String(tag.id)))
        .map((tag) => ({ tag, method: "DELETE" })),
    ];

    if (!changes.length) {
      setTagManagerStatus("No tag changes to save.");
      return;
    }

    saveResourceTagsInProgressRef.current = true;
    setIsSavingResourceTags(true);
    setTagManagerError("");
    setTagManagerStatus("");

    try {
      const results = await Promise.allSettled(
        changes.map(({ tag, method }) =>
          apiRequest(
            `resources/${encodeURIComponent(tagResource.id)}/tags/${encodeURIComponent(tag.id)}`,
            { method }
          )
        )
      );

      const savedTags = new Map(
        originalTags.map((tag) => [String(tag.id), tag])
      );
      const failures = [];

      results.forEach((result, index) => {
        const { tag, method } = changes[index];
        if (result.status === "rejected") {
          failures.push(
            result.reason?.message || `Unable to update "${tag.name}".`
          );
        } else if (method === "POST") {
          savedTags.set(String(tag.id), tag);
        } else {
          savedTags.delete(String(tag.id));
        }
      });

      const actualTags = [...savedTags.values()];
      resourceTagsBeforeEditRef.current = actualTags;
      setResourceTags(actualTags);
      updateResourceTagIndex(tagResource.id, actualTags);

      const updateTags = (items) =>
        items.map((resource) =>
          resource.id === tagResource.id
            ? { ...resource, tags: actualTags }
            : resource
        );
      setResources(updateTags);
      setSearchResults((current) =>
        current === null ? null : updateTags(current)
      );

      if (failures.length) {
        setTagManagerError(
          `Some tag changes could not be saved. ${failures.join(" ")}`
        );
      } else {
        setTagManagerStatus(
          "Tags saved successfully. They are now visible on the resource card and available in tag filters."
        );
      }
    } finally {
      saveResourceTagsInProgressRef.current = false;
      setIsSavingResourceTags(false);
    }
  };

  const handleSuggestTags = async () => {
    if (!tagResource) return;

    try {
      const result = await apiRequest(
        `resources/${tagResource.id}/suggest-tags`,
        { method: "POST" }
      );

      const suggestions = result?.existing_tag_matches ?? result?.suggested_tags;
      const availableMatches = Array.isArray(suggestions)
        ? suggestions
            .map((suggestion) => {
              if (typeof suggestion === "string") {
                return availableTags.find(
                  (tag) =>
                    tag.name.toLowerCase() === suggestion.toLowerCase()
                );
              }

              return (
                availableTags.find(
                  (tag) =>
                    tag.id === suggestion?.id ||
                    tag.id === suggestion?.tag_id ||
                    tag.name?.toLowerCase() ===
                      (suggestion?.name || suggestion?.tag_name || "")
                        .toLowerCase()
                ) || suggestion
              );
            })
            .filter((tag) => Number.isInteger(tag?.id) && tag.name)
        : [];

      setSuggestedTags(availableMatches);
      setSuggestedTagKeywords(
        Array.isArray(result?.keywords)
          ? [
              ...new Set(
                result.keywords
                  .filter(
                    (keyword) =>
                      typeof keyword === "string" && keyword.trim()
                  )
                  .map((keyword) => keyword.trim())
              ),
            ]
          : []
      );
    } catch (error) {
      setTagManagerError(error.message || "Unable to suggest tags.");
    }
  };

  const handleCreateSuggestedTag = async (name) => {
    const tagName = name.trim();
    if (!tagResource || !tagName) return;

    try {
      const existingTag = availableTags.find(
        (tag) => tag.name.toLowerCase() === tagName.toLowerCase()
      );

      if (existingTag) {
        if (
          !resourceTags.some(
            (tag) => String(tag.id) === String(existingTag.id)
          )
        ) {
          handleToggleResourceTag(existingTag);
        }
        setSuggestedTagKeywords((current) =>
          current.filter(
            (keyword) => keyword.toLowerCase() !== tagName.toLowerCase()
          )
        );
        setTagManagerStatus(
          "Tag selection updated. Select Save Changes to apply it."
        );
        return;
      }

      const result = await apiRequest("tags/", {
        method: "POST",
        payload: { name: tagName },
      });
      const createdTag =
        result?.tag && typeof result.tag === "object"
          ? result.tag
          : result;

      if (!Number.isInteger(createdTag?.id) || !createdTag.name) {
        throw new Error("The server returned an invalid tag.");
      }

      setAvailableTags((current) => [
        ...current.filter((tag) => tag.id !== createdTag.id),
        createdTag,
      ]);
      setResourceTags((current) =>
        current.some((tag) => String(tag.id) === String(createdTag.id))
          ? current
          : [...current, createdTag]
      );
      setTagManagerStatus(
        `Created "${createdTag.name}". Select Save Changes to add it to this resource.`
      );
      setSuggestedTagKeywords((current) =>
        current.filter(
          (keyword) => keyword.toLowerCase() !== tagName.toLowerCase()
        )
      );
    } catch (error) {
      setTagManagerError(
        error.message || "Unable to create and select this tag."
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

  const fetchCollectionSuggestions = (resourceId) => {
    const requestKey = String(resourceId);
    const pendingRequest =
      collectionSuggestionRequestsRef.current.get(requestKey);

    if (pendingRequest) return pendingRequest;

    const request = apiRequest(
      `resources/${encodeURIComponent(resourceId)}/collection-suggestions`
    ).then((result) => {
      const suggestions = Array.isArray(result)
        ? result
        : result?.suggested_collections ?? result?.suggestions;

      if (!Array.isArray(suggestions)) {
        throw new Error(
          "The server returned an unexpected collection-suggestions response."
        );
      }

      return {
        suggestions: suggestions
          .filter(isCollectionSuggestion)
          .map(normalizeCollectionSuggestion)
          .sort((a, b) => getSuggestionScore(b) - getSuggestionScore(a)),
        recommendNewCollection:
          result?.recommend_new_collection === true,
        suggestedCollectionName:
          typeof result?.suggested_collection_name === "string" &&
          result.suggested_collection_name.trim()
            ? result.suggested_collection_name.trim()
            : "",
      };
    });

    collectionSuggestionRequestsRef.current.set(requestKey, request);
    return request.finally(() => {
      if (
        collectionSuggestionRequestsRef.current.get(requestKey) === request
      ) {
        collectionSuggestionRequestsRef.current.delete(requestKey);
      }
    });
  };

  const getMeaningfulCollectionSuggestions = (suggestions) =>
    suggestions
      .filter(
        (suggestion) =>
          getSuggestionScore(suggestion) >= MIN_COLLECTION_SUGGESTION_SCORE
      )
      .slice(0, 3);

  const openCollectionSuggestionModal = (
    resource,
    suggestions,
    source,
    recommendation
  ) => {
    setCollectionSuggestionSelectedId(
      suggestions.length ? String(suggestions[0].collection_id) : ""
    );
    setCollectionSuggestionModal({
      resource: toSavedResource(resource),
      suggestions,
      recommendNewCollection: recommendation.recommendNewCollection,
      suggestedCollectionName: recommendation.suggestedCollectionName,
      isLoading: false,
      error: "",
      source,
    });
  };

  const checkAutomaticCollectionSuggestions = async (resource) => {
    const resourceId = getResourceId(resource, resource);
    if (resourceId == null) return;

    const requestKey = String(resourceId);
    if (checkedAutoCollectionSuggestionIdsRef.current.has(requestKey)) return;

    checkedAutoCollectionSuggestionIdsRef.current.add(requestKey);

    try {
      const response = await fetchCollectionSuggestions(resourceId);
      const meaningful = getMeaningfulCollectionSuggestions(
        response.suggestions
      );

      if (!meaningful.length && !response.recommendNewCollection) return;

      openCollectionSuggestionModal(resource, meaningful, "auto", response);
    } catch (error) {
      console.warn("SmartMark collection suggestion failed:", error);
    }
  };

  const handleSuggestCollections = async (resource) => {
    setActiveResourceMenu(null);
    setErrorMessage("");
    setCreateMessage("");

    try {
      const response = await fetchCollectionSuggestions(resource.id);
      const meaningful = getMeaningfulCollectionSuggestions(
        response.suggestions
      );

      if (!meaningful.length && !response.recommendNewCollection) {
        setCreateMessage("No suitable collection suggestions found.");
        return;
      }

      openCollectionSuggestionModal(resource, meaningful, "manual", response);
    } catch (error) {
      setErrorMessage(
        error.message || "Unable to load collection suggestions."
      );
    }
  };

  const handleCreateCollectionFromSuggestion = () => {
    if (!collectionSuggestionModal || typeof onCollections !== "function") {
      return;
    }

    const recommendedName =
      collectionSuggestionModal.suggestedCollectionName || "";
    closeCollectionSuggestionModal();
    onCollections(recommendedName);
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
      setCollectionAssignmentToast(
        `Added "${resource.title}" to ${collectionName}.`
      );
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

    const isStoredFile =
      resource.type === "Image" || resource.type === "Documents";
    const newTab = window.open("", "_blank");

    try {
      if (isStoredFile) {
        if (!newTab) {
          throw new Error("Allow pop-ups to open this uploaded file.");
        }

        const file = await openResourceFile(resource.id);
        const filename = getResourceFilename(resource);
        const extension = filename.includes(".")
          ? filename.split(".").pop().toLowerCase()
          : "";
        const mimeType = getResourceFileMimeType(file, extension);
        const isDocx =
          extension === "docx" ||
          mimeType.includes(
            "application/vnd.openxmlformats-officedocument.wordprocessingml"
          );
        const isPreviewable =
          resource.type === "Image" ||
          mimeType.startsWith("image/") ||
          mimeType === "application/pdf" ||
          extension === "pdf" ||
          mimeType.startsWith("text/") ||
          extension === "txt";
        const fileBlob =
          mimeType && mimeType !== file.type
            ? new Blob([file], { type: mimeType })
            : file;

        if (isDocx) {
          const mammoth = await import("mammoth");
          const { value: html } = await mammoth.convertToHtml({
            arrayBuffer: await file.arrayBuffer(),
          });
          const safeHtml = sanitizeDocumentHtml(html);

          if (!safeHtml.trim()) {
            throw new Error("This document does not contain previewable text.");
          }

          showDocumentPreview(newTab, filename, safeHtml);
          return;
        }

        const fileUrl = URL.createObjectURL(fileBlob);

        if (!isPreviewable) {
          const downloadLink = document.createElement("a");
          downloadLink.href = fileUrl;
          downloadLink.download = filename;
          document.body.appendChild(downloadLink);
          downloadLink.click();
          downloadLink.remove();
          newTab.close();
          window.setTimeout(() => URL.revokeObjectURL(fileUrl), 60_000);
          return;
        }

        newTab.opener = null;
        newTab.location.href = fileUrl;
        window.setTimeout(() => URL.revokeObjectURL(fileUrl), 60_000);
        return;
      }

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
      setErrorMessage(
        error.message ||
          (isStoredFile
            ? "Unable to open this uploaded file."
            : "Unable to open this resource.")
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

  const modalResourceId = collectionSuggestionModal?.resource?.id;

  const isModalSaving = Boolean(
    modalResourceId &&
      collectionAssignmentLoadingByResourceId[modalResourceId]
  );

  const isBulkSuggestionApplying = bulkOperation === "suggest-move";
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
        onLogout={onLogout}
      />

      <main className="saved-main">
        {(favoriteToast || collectionAssignmentToast) && (
          <div className="favorite-toast" role="status">
            <span>{collectionAssignmentToast || favoriteToast}</span>
            <button
              type="button"
              aria-label="Close notification"
              onClick={() => {
                setFavoriteToast("");
                setCollectionAssignmentToast("");
              }}
            >
              ×
            </button>
          </div>
        )}

        <TopBar
          onSavedResources={onSavedResources}
          onCollections={onCollections}
          onTags={onTags}
          onHelpSupport={onHelpSupport}
          onSettings={onSettings}
        />

        <section className="saved-content">
          <div className="saved-heading">
            <div>
            <h1>Saved Resources</h1>
              <p>All your useful digital resources, organized in one place.</p>
            </div>

            <button
              className="add-resource-button"
              onClick={handleOpenSaveForm}
              type="button"
            >
              ＋ Save Resource
            </button>
          </div>

          <div className="saved-page-search">
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
                      Save a link, upload an image or document, or keep a code snippet.
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
                  {!editingResource && (
                    <label>
                      Resource type
                      <select
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            resourceMode: event.target.value,
                            resourceFile: null,
                          }))
                        }
                        value={form.resourceMode}
                      >
                        <option value="link">Link</option>
                        <option value="image">Image</option>
                        <option value="document">Documents</option>
                        <option value="code">Code Snippet</option>
                      </select>
                    </label>
                  )}

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
                  ) : (form.resourceMode === "image" ||
                      form.resourceMode === "document") &&
                    !editingResource ? (
                    <label>
                      {form.resourceMode === "document"
                        ? "Document file (PDF)"
                        : "Image file"}
                      <input
                        accept={
                          form.resourceMode === "document"
                            ? "application/pdf,.pdf"
                            : "image/*"
                        }
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            resourceFile: event.target.files?.[0] ?? null,
                          }))
                        }
                        required
                        type="file"
                      />
                    </label>
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
                          <option>Documents</option>
                          <option>GitHub Repository</option>
                        </select>
                      </label>
                    </>
                  )}

                  <fieldset className="save-resource-tags">
                    <legend>Tags <span>Optional</span></legend>

                    <div className="save-resource-selected-tags">
                      {availableTags
                        .filter((tag) =>
                          selectedSaveTagIds.includes(String(tag.id))
                        )
                        .map((tag) => (
                          <button
                            aria-label={`Remove ${tag.name} tag`}
                            className="save-resource-tag-chip"
                            key={tag.id}
                            onClick={() =>
                              setSelectedSaveTagIds((current) =>
                                current.filter(
                                  (id) => id !== String(tag.id)
                                )
                              )
                            }
                            type="button"
                          >
                            {tag.name} <span aria-hidden="true">×</span>
                          </button>
                        ))}
                    </div>

                    <label className="save-resource-tag-search">
                      <span className="sr-only">Find or create a tag</span>
                      <input
                        autoComplete="off"
                        onChange={(event) =>
                          setSaveTagSearch(event.target.value)
                        }
                        placeholder="Search tags..."
                        value={saveTagSearch}
                      />
                    </label>

                    <div
                      aria-label="Available tags"
                      className="save-resource-tag-options"
                      role="group"
                    >
                      {availableTags
                        .filter(
                          (tag) =>
                            !selectedSaveTagIds.includes(String(tag.id)) &&
                            tag.name
                              .toLowerCase()
                              .includes(saveTagSearch.trim().toLowerCase())
                        )
                        .map((tag) => (
                          <button
                            key={tag.id}
                            onClick={() =>
                              setSelectedSaveTagIds((current) => [
                                ...current,
                                String(tag.id),
                              ])
                            }
                            type="button"
                          >
                            + {tag.name}
                          </button>
                        ))}
                      {saveTagSearch.trim() &&
                        !availableTags.some(
                          (tag) =>
                            tag.name.toLowerCase() ===
                            saveTagSearch.trim().toLowerCase()
                        ) && (
                          <button
                            disabled={isCreatingSaveTag}
                            onClick={handleCreateSaveTag}
                            type="button"
                          >
                            {isCreatingSaveTag
                              ? "Creating..."
                              : `+ Create "${saveTagSearch.trim()}"`}
                          </button>
                        )}
                      {!availableTags.length && !saveTagSearch.trim() && (
                        <p>No tags yet. Search above to create one.</p>
                      )}
                    </div>
                  </fieldset>

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
                        : form.resourceMode === "image" ||
                          form.resourceMode === "document"
                        ? `Upload ${form.resourceMode === "document" ? "Document" : "Image"}`
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
                    disabled={isSavingResourceTags}
                    onClick={() => setTagResource(null)}
                    type="button"
                  >
                    ×
                  </button>
                </div>

                <form
                  className="tag-manager-form"
                  onSubmit={handleSaveResourceTags}
                >
                  <button
                    className="suggest-tags-button"
                    disabled={isSavingResourceTags}
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
                          (item) => String(item.id) === String(tag.id)
                        );

                        return (
                          <button
                            className="suggested-tag-button"
                            disabled={attached || isSavingResourceTags}
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

                  {suggestedTagKeywords.length > 0 && (
                    <div className="suggested-tags-list">
                      <h3>Resource keywords</h3>
                      <p>Select a keyword to create it as a tag and add it.</p>
                      {suggestedTagKeywords.map((keyword) => (
                        <button
                          className="suggested-tag-button"
                          disabled={isSavingResourceTags}
                          key={keyword}
                          onClick={() => handleCreateSuggestedTag(keyword)}
                          type="button"
                        >
                          + Create “{keyword}”
                        </button>
                      ))}
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
                              (item) => String(item.id) === String(tag.id)
                            )}
                            disabled={isSavingResourceTags}
                            onChange={() => handleToggleResourceTag(tag)}
                            type="checkbox"
                          />
                          <span>{tag.name}</span>
                        </label>
                      ))}
                  </div>

                  {tagManagerError && (
                    <p className="resource-api-error" role="alert">
                      {tagManagerError}
                    </p>
                  )}
                  {tagManagerStatus && (
                    <p className="resource-api-status" role="status">
                      {tagManagerStatus}
                    </p>
                  )}

                  <div className="resource-dialog-actions">
                    <button
                      className="resource-cancel-button"
                      disabled={isSavingResourceTags}
                      onClick={() => setTagResource(null)}
                      type="button"
                    >
                      Cancel
                    </button>
                    <button
                      className="add-resource-button"
                      disabled={isSavingResourceTags}
                      type="submit"
                    >
                      {isSavingResourceTags ? "Saving tags..." : "Save Changes"}
                    </button>
                  </div>
                </form>
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
                  !isModalSaving &&
                  !isBulkSuggestionApplying &&
                  !collectionSuggestionModal.isLoading
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
                      {collectionSuggestionModal.source === "bulk"
                        ? "Suggested Collections"
                        : "Suggested Collection"}
                    </h2>
                    <p>
                      {collectionSuggestionModal.source === "bulk"
                        ? `${collectionSuggestionModal.resourceIds.length} selected resources`
                        : "This resource looks related to:"}
                    </p>
                  </div>

                  <button
                    aria-label="Close collection suggestion"
                    className="resource-dialog-close"
                    disabled={
                      isModalSaving ||
                      isBulkSuggestionApplying ||
                      collectionSuggestionModal.isLoading
                    }
                    onClick={closeCollectionSuggestionModal}
                    type="button"
                  >
                    ×
                  </button>
                </div>

                {collectionSuggestionModal.source === "bulk" ? (
                  <>
                    {collectionSuggestionModal.message && (
                      <p className="collection-suggestion-message" role="status">
                        {collectionSuggestionModal.message}
                      </p>
                    )}
                    {collectionSuggestionModal.error && (
                      <p className="resource-api-error" role="alert">
                        {collectionSuggestionModal.error}
                      </p>
                    )}
                  </>
                ) : (
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
                )}

                <div className="collection-suggestion-modal-list">
                  <h3>Suggested collections</h3>

                  {collectionSuggestionModal.isLoading ? (
                    <p role="status">Finding collection suggestions...</p>
                  ) : collectionSuggestionModal.source === "bulk" &&
                    collectionSuggestionModal.error ? null : collectionSuggestionModal.suggestions.length === 0 ? (
                    <p>No existing collections seem to fit this resource.</p>
                  ) : collectionSuggestionModal.source === "bulk" ? (
                    collectionSuggestionModal.suggestions.map((suggestion) => (
                      <div
                        className="collection-suggestion-bulk-choice"
                        key={suggestion.collection_id}
                      >
                        <span className="collection-suggestion-folder">
                          📁
                        </span>
                        <span className="collection-suggestion-choice-copy">
                          <strong>{suggestion.collection_name}</strong>
                          {suggestion.matched_keywords.length > 0 && (
                            <small>
                              Matches:{" "}
                              {suggestion.matched_keywords.join(" • ")}
                            </small>
                          )}
                        </span>
                        <span className="collection-suggestion-score">
                          {Math.round(getSuggestionScore(suggestion) * 100)}%
                        </span>
                        <button
                          className="collection-suggestion-move-button"
                          disabled={isBulkSuggestionApplying}
                          onClick={() =>
                            handleAssignBulkSuggestion(suggestion)
                          }
                          type="button"
                        >
                          {collectionSuggestionModal.applyingCollectionId ===
                          suggestion.collection_id
                            ? "Moving..."
                            : "Move Selected Resources"}
                        </button>
                      </div>
                    ))
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

                {collectionSuggestionModal.recommendNewCollection && (
                  <div className="collection-suggestion-new">
                    <strong>Try a new collection</strong>
                    <p>
                      {collectionSuggestionModal.suggestedCollectionName
                        ? `Suggested name: ${collectionSuggestionModal.suggestedCollectionName}`
                        : "Create a collection that better fits this resource."}
                    </p>
                    {collectionSuggestionModal.source === "bulk" && (
                      <button
                        className="collection-suggestion-move-button"
                        disabled={
                          collectionSuggestionModal.isLoading ||
                          isBulkSuggestionApplying
                        }
                        onClick={handleCreateCollectionFromBulkSuggestion}
                        type="button"
                      >
                        Create New Collection
                      </button>
                    )}
                  </div>
                )}

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

                {collectionSuggestionModal.source !== "bulk" &&
                  errorMessage && (
                  <p className="resource-api-error" role="alert">
                    {errorMessage}
                  </p>
                  )}

                <div className="collection-suggestion-modal-actions">
                  <button
                    className="suggestion-dismiss-button"
                    disabled={
                      isModalSaving ||
                      isBulkSuggestionApplying ||
                      collectionSuggestionModal.isLoading
                    }
                    onClick={closeCollectionSuggestionModal}
                    type="button"
                  >
                    Dismiss
                  </button>

                  {collectionSuggestionModal.source !== "bulk" &&
                    typeof onCollections === "function" && (
                    <button
                      className="suggestion-change-button"
                      disabled={isModalSaving}
                      onClick={handleCreateCollectionFromSuggestion}
                      type="button"
                    >
                      Create new collection
                    </button>
                  )}

                  {collectionSuggestionModal.source !== "bulk" && (
                    <button
                      className="suggestion-change-button"
                      disabled={isModalSaving}
                      onClick={handleChangeCollectionClick}
                      type="button"
                    >
                      {isModalChanging ? "Save Selection" : "Change"}
                    </button>
                  )}

                  {collectionSuggestionModal.source !== "bulk" &&
                    !isModalChanging && (
                      <button
                        className="suggestion-accept-button"
                        disabled={
                          isModalSaving || !collectionSuggestionSelectedId
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
            <div className="resource-tag-actions">
              <label className="resource-tag-filter">
                <select
                  aria-label="Filter resources by tag"
                  onChange={(event) => {
                    setSelectedTagFilter(event.target.value);
                    setSearchPage(1);
                  }}
                  value={selectedTagFilter}
                >
                  <option value="">All tags</option>
                  {availableTags.map((tag) => (
                    <option key={tag.id} value={String(tag.id)}>
                      {tag.name}
                    </option>
                  ))}
                </select>
              </label>
              <button
                aria-label="Select resources for bulk deletion"
                className={`bulk-delete-mode-button${isBulkSelectionMode ? " active" : ""}`}
                onClick={() => {
                  setIsBulkSelectionMode(true);
                  setBulkError("");
                }}
                title="Select resources to delete"
                type="button"
              >
                <svg
                  aria-hidden="true"
                  fill="none"
                  height="18"
                  viewBox="0 0 24 24"
                  width="18"
                >
                  <path
                    d="M4 7h16M10 11v6m4-6v6M6 7l1 14h10l1-14M9 7V4h6v3"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="1.8"
                  />
                </svg>
              </button>
            </div>
          </div>

          {bulkError && (
            <p className="bulk-management-error" role="alert">
              {bulkError}
              {selectedResourceIds.size >= 2 && !bulkCollectionsLoaded && (
                <>
                  {" "}
                  <button
                    disabled={isBulkCollectionsLoading}
                    onClick={() => void loadBulkCollections()}
                    type="button"
                  >
                    {isBulkCollectionsLoading
                      ? "Loading collections..."
                      : "Retry loading collections"}
                  </button>
                </>
              )}
            </p>
          )}

          {selectedResourceIds.size === 1 && !isBulkSelectionMode && (
            <div className="bulk-single-selection-status" role="status">
              <span>1 resource selected. Select another to enable bulk actions.</span>
              <button onClick={clearBulkSelection} type="button">
                Clear Selection
              </button>
            </div>
          )}

          {showBulkToolbar && (
            <section
              aria-label="Bulk resource actions"
              className="bulk-resource-toolbar"
            >
              <div className="bulk-resource-summary">
                <strong>
                  {selectedResourceIds.size} selected
                </strong>
                {isBulkSelectionMode && selectedResourceIds.size === 0 && (
                  <span>
                    Select resources you want to permanently delete.
                  </span>
                )}
                <button
                  disabled={!visibleResourceIds.length || Boolean(bulkOperation)}
                  onClick={toggleVisibleResourceSelection}
                  type="button"
                >
                  {allVisibleResourcesSelected
                    ? "Deselect shown"
                    : "Select all shown"}
                </button>
                <button
                  disabled={!selectedResourceIds.size || Boolean(bulkOperation)}
                  onClick={clearBulkSelection}
                  type="button"
                >
                  Clear Selection
                </button>
                {isBulkSelectionMode && (
                  <button
                    disabled={Boolean(bulkOperation)}
                    onClick={() => {
                      clearBulkSelection();
                      setIsBulkSelectionMode(false);
                    }}
                    type="button"
                  >
                    Cancel
                  </button>
                )}
              </div>

              <div className="bulk-resource-actions">
                {selectedResourceIds.size >= 2 && (
                  <>
                    <label className="bulk-collection-select">
                      <select
                        aria-label="Destination collection"
                        disabled={
                          isBulkCollectionsLoading ||
                          Boolean(bulkOperation) ||
                          !bulkCollections.length
                        }
                        onChange={(event) =>
                          setBulkCollectionId(event.target.value)
                        }
                        value={bulkCollectionId}
                      >
                        <option value="">
                          {isBulkCollectionsLoading
                            ? "Loading collections..."
                            : bulkCollections.length
                              ? "Move to collection..."
                              : "No collections available"}
                        </option>
                        {bulkCollections.map((collection) => (
                          <option
                            key={collection.id}
                            value={String(collection.id)}
                          >
                            {collection.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <button
                      className="bulk-action-primary"
                      disabled={
                        !bulkCollectionId ||
                        Boolean(bulkOperation) ||
                        isBulkCollectionsLoading
                      }
                      onClick={handleMoveSelectedResources}
                      type="button"
                    >
                      {bulkOperation === "move" ? "Moving..." : "Move"}
                    </button>
                    <button
                      aria-busy={bulkOperation === "suggest"}
                      disabled={Boolean(bulkOperation)}
                      onClick={handleSuggestSelectedCollections}
                      type="button"
                    >
                      <svg
                        aria-hidden="true"
                        fill="none"
                        height="15"
                        viewBox="0 0 24 24"
                        width="15"
                      >
                        <path
                          d="m12 3 1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Zm7 12 .9 2.1L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.9L19 15Z"
                          stroke="currentColor"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="1.7"
                        />
                      </svg>
                      {bulkOperation === "suggest"
                        ? "Suggesting..."
                        : "Suggest Collections"}
                    </button>
                    <button
                      disabled={Boolean(bulkOperation)}
                      onClick={() => {
                        setBulkError("");
                        setBulkCollectionForm({
                          name: "",
                          description: "",
                        });
                        setIsBulkCollectionModalOpen(true);
                      }}
                      type="button"
                    >
                      Create New Collection
                    </button>
                  </>
                )}
                {(isBulkSelectionMode || selectedResourceIds.size >= 2) && (
                  <button
                    className="bulk-action-danger"
                    disabled={
                      !selectedResourceIds.size || Boolean(bulkOperation)
                    }
                    onClick={() => setIsBulkDeleteConfirmOpen(true)}
                    type="button"
                  >
                    Delete Selected
                  </button>
                )}
              </div>
            </section>
          )}

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
                    className={`saved-resource-card${selectedResourceIds.has(String(resource.id)) ? " selected" : ""}`}
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
                          {(resource.collection_name ||
                            resource.collection?.name) && (
                            <span>
                              📁 {resource.collection_name ||
                                resource.collection.name}
                            </span>
                          )}
                          {resource.tags.map((tag) => (
                            <button
                              aria-label={`Filter by ${tag.name} tag`}
                              key={tag.id ?? tag.name}
                              onClick={(event) => {
                                event.stopPropagation();
                                if (tag.id != null) {
                                  setSelectedTagFilter(String(tag.id));
                                }
                              }}
                              type="button"
                            >
                              #{tag.name}
                            </button>
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
                      <input
                        aria-label={`Select ${resource.title}`}
                        checked={selectedResourceIds.has(String(resource.id))}
                        className="resource-select-checkbox"
                        disabled={Boolean(bulkOperation)}
                        onChange={() => toggleResourceSelection(resource.id)}
                        onClick={(event) => event.stopPropagation()}
                        type="checkbox"
                      />
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
                        onClick={(event) => {
                          event.stopPropagation();
                          handleToggleFavorite(resource);
                        }}
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
                            onClick={() =>
                              handleSuggestCollections(resource)
                            }
                            role="menuitem"
                            type="button"
                          >
                            Suggest collections
                          </button>

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

          {isBulkCollectionModalOpen && (
            <div className="resource-dialog-backdrop">
              <section
                aria-labelledby="bulk-collection-dialog-title"
                aria-describedby="bulk-collection-dialog-description"
                aria-modal="true"
                className="resource-dialog bulk-management-dialog"
                role="dialog"
              >
                <div className="resource-dialog-heading">
                  <div>
                    <h2 id="bulk-collection-dialog-title">
                      Create collection
                    </h2>
                    <p id="bulk-collection-dialog-description">
                      Create a collection and assign the{" "}
                      {selectedResourceIds.size} selected resources to it.
                    </p>
                  </div>
                  <button
                    aria-label="Close create collection dialog"
                    className="resource-dialog-close"
                    disabled={bulkOperation === "create"}
                    onClick={() => setIsBulkCollectionModalOpen(false)}
                    type="button"
                  >
                    ×
                  </button>
                </div>

                {bulkError && (
                  <p className="bulk-management-error" role="alert">
                    {bulkError}
                  </p>
                )}

                <form
                  className="resource-create-form"
                  onSubmit={handleCreateCollectionAndAssign}
                >
                  <label>
                    Collection name
                    <input
                      autoFocus
                      onChange={(event) =>
                        setBulkCollectionForm((current) => ({
                          ...current,
                          name: event.target.value,
                        }))
                      }
                      required
                      value={bulkCollectionForm.name}
                    />
                  </label>
                  <label>
                    Description <span>Optional</span>
                    <textarea
                      onChange={(event) =>
                        setBulkCollectionForm((current) => ({
                          ...current,
                          description: event.target.value,
                        }))
                      }
                      rows={3}
                      value={bulkCollectionForm.description}
                    />
                  </label>
                  <div className="resource-dialog-actions">
                    <button
                      className="resource-cancel-button"
                      disabled={bulkOperation === "create"}
                      onClick={() => setIsBulkCollectionModalOpen(false)}
                      type="button"
                    >
                      Cancel
                    </button>
                    <button
                      className="add-resource-button"
                      disabled={
                        bulkOperation === "create" ||
                        !bulkCollectionForm.name.trim()
                      }
                      type="submit"
                    >
                      {bulkOperation === "create"
                        ? "Creating and assigning..."
                        : "Create and assign"}
                    </button>
                  </div>
                </form>
              </section>
            </div>
          )}

          {isBulkDeleteConfirmOpen && (
            <div className="resource-dialog-backdrop">
              <section
                aria-labelledby="bulk-delete-dialog-title"
                aria-describedby="bulk-delete-dialog-description"
                aria-modal="true"
                className="resource-dialog bulk-management-dialog"
                role="alertdialog"
              >
                <div className="resource-dialog-heading">
                  <div>
                    <h2 id="bulk-delete-dialog-title">
                      Permanently delete resources?
                    </h2>
                    <p id="bulk-delete-dialog-description">
                      This will permanently delete{" "}
                      <strong>{selectedResourceIds.size}</strong>{" "}
                      {selectedResourceIds.size === 1
                        ? "resource"
                        : "resources"}. This action cannot be undone.
                    </p>
                  </div>
                </div>
                {bulkError && (
                  <p className="bulk-management-error" role="alert">
                    {bulkError}
                  </p>
                )}
                <div className="resource-dialog-actions">
                  <button
                    autoFocus
                    className="resource-cancel-button"
                    disabled={bulkOperation === "delete"}
                    onClick={() => setIsBulkDeleteConfirmOpen(false)}
                    type="button"
                  >
                    Cancel
                  </button>
                  <button
                    className="bulk-action-danger"
                    disabled={
                      bulkOperation === "delete" ||
                      selectedResourceIds.size === 0
                    }
                    onClick={handleDeleteSelectedResources}
                    type="button"
                  >
                    {bulkOperation === "delete"
                      ? "Deleting..."
                      : "Permanently delete"}
                  </button>
                </div>
              </section>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

export default SavedResources;