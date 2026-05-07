// ============================================================
// places-enricher.js
// Async Google Places API (New) enrichment for the top-4
// nearest station cards.
//
// Strategy: MutationObserver watches #station-list for new
// cards. When cards appear, we:
//   1. Grab the first 4 [data-station-id] elements.
//   2. Fetch their google_place_id from Supabase (one call).
//   3. Call Places API GET for each (parallel, non-blocking).
//   4. Inject a colored status badge into the card DOM.
//
// Never touches app.js. Reads config from window.BENZINA_CONFIG.
// ============================================================

(function () {
  "use strict";

  // ── Config ──────────────────────────────────────────────────
  function getApiKey() {
    var cfg = window.BENZINA_CONFIG || {};
    return cfg.GOOGLE_MAPS_API_KEY || "";
  }

  function getSupabase() {
    var cfg = window.BENZINA_CONFIG || {};
    return { url: cfg.SUPABASE_URL || "", key: cfg.SUPABASE_ANON_KEY || "" };
  }

  // ── Status derivation ────────────────────────────────────────
  // businessStatus × isOpen → internal status key
  function deriveStatus(businessStatus, isOpen) {
    if (businessStatus === "CLOSED_PERMANENTLY") return "closed_perm";
    if (businessStatus === "CLOSED_TEMPORARILY") return "closed_temp";
    if (businessStatus === "OPERATIONAL") {
      if (isOpen === true)  return "open";
      if (isOpen === false) return "closed";
      return "unknown"; // OPERATIONAL but no hours data
    }
    return "unknown";
  }

  // ── Badge HTML ───────────────────────────────────────────────
  function makeBadgeHtml(status) {
    switch (status) {
      case "open":
        return '<span class="places-status-badge places-status-open" aria-label="مفتوحة الآن">مفتوحة الآن 🟢</span>';
      case "closed":
        return '<span class="places-status-badge places-status-closed" aria-label="مغلقة حالياً">مغلقة حالياً 🔴</span>';
      case "closed_temp":
        return '<span class="places-status-badge places-status-closed-temp" aria-label="مغلقة مؤقتاً">مغلقة مؤقتاً ⚠️</span>';
      case "closed_perm":
        return '<span class="places-status-badge places-status-closed-perm" aria-label="مغلقة نهائياً">مغلقة نهائياً ❌</span>';
      default:
        return ""; // unknown → no badge
    }
  }

  // ── DOM injection ────────────────────────────────────────────
  function injectBadge(card, status) {
    // Remove any stale badge from a previous enrichment pass
    card.querySelectorAll(".places-status-badge").forEach(function (el) {
      el.remove();
    });

    var html = makeBadgeHtml(status);
    if (!html) return;

    // Insert immediately after the (visually hidden) .station-card-status element
    // so the badge sits in the natural position where the queue pill used to live.
    var anchor = card.querySelector(".station-card-status");
    if (anchor) {
      anchor.insertAdjacentHTML("afterend", html);
    }
  }

  // ── Supabase: fetch google_place_id for N station IDs ────────
  async function fetchPlaceIds(stationIds) {
    var sb = getSupabase();
    if (!sb.url || !sb.key) return new Map();

    var idList = stationIds.join(",");
    var url =
      sb.url +
      "/rest/v1/stations?select=id,google_place_id&id=in.(" +
      idList +
      ")";

    try {
      var res = await fetch(url, {
        headers: {
          apikey: sb.key,
          Authorization: "Bearer " + sb.key,
        },
      });
      if (!res.ok) return new Map();
      var rows = await res.json();
      return new Map(
        rows
          .filter(function (r) { return r.google_place_id; })
          .map(function (r) { return [r.id, r.google_place_id]; })
      );
    } catch (_) {
      return new Map();
    }
  }

  // ── Places API: fetch status for one place_id ─────────────────
  // GET https://places.googleapis.com/v1/places/{placeId}
  async function fetchPlaceStatus(placeId, apiKey) {
    var url =
      "https://places.googleapis.com/v1/places/" +
      encodeURIComponent(placeId);

    try {
      var res = await fetch(url, {
        headers: {
          "X-Goog-Api-Key": apiKey,
          "X-Goog-FieldMask": "businessStatus,currentOpeningHours.openNow",
        },
      });
      if (!res.ok) return null;
      return await res.json();
    } catch (_) {
      return null;
    }
  }

  // ── Main enrichment pass ─────────────────────────────────────
  var lastEnrichedIds = "";

  async function enrichTopStations() {
    var apiKey = getApiKey();
    if (!apiKey) return;

    var stationList = document.getElementById("station-list");
    if (!stationList) return;

    // Collect first 4 rendered cards (already sorted nearest-first by app.js)
    var cards = Array.from(
      stationList.querySelectorAll("[data-station-id]")
    ).slice(0, 4);
    if (!cards.length) return;

    var stationIds = cards.map(function (c) { return c.dataset.stationId; });
    var idsKey = stationIds.join(",");
    if (idsKey === lastEnrichedIds) return; // same set, nothing changed
    lastEnrichedIds = idsKey;

    // One Supabase call for all 4 place IDs
    var placeIdMap = await fetchPlaceIds(stationIds);
    if (!placeIdMap.size) return;

    // Fire Places API requests per card — each is independent and non-blocking
    cards.forEach(function (card) {
      var stationId = card.dataset.stationId;
      var placeId = placeIdMap.get(stationId);
      if (!placeId) return;

      fetchPlaceStatus(placeId, apiKey).then(function (data) {
        if (!data) return;
        var businessStatus = data.businessStatus || "";
        var isOpen = (data.currentOpeningHours && typeof data.currentOpeningHours.openNow === "boolean")
          ? data.currentOpeningHours.openNow
          : null;
        var status = deriveStatus(businessStatus, isOpen);
        injectBadge(card, status);
      });
    });
  }

  // ── Debounced scheduler ──────────────────────────────────────
  var enrichTimer = null;

  function scheduleEnrichment() {
    clearTimeout(enrichTimer);
    enrichTimer = setTimeout(enrichTopStations, 400);
  }

  // ── MutationObserver bootstrap ───────────────────────────────
  function startObserver() {
    var stationList = document.getElementById("station-list");
    if (!stationList) {
      // app.js hasn't rendered the list yet — retry
      setTimeout(startObserver, 250);
      return;
    }

    var observer = new MutationObserver(scheduleEnrichment);
    observer.observe(stationList, { childList: true, subtree: true });

    // Run once immediately in case cards are already present
    scheduleEnrichment();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", startObserver);
  } else {
    startObserver();
  }
})();
