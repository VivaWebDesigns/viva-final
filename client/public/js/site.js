(function () {
  document.documentElement.classList.add("js");

  var desktopReveals = document.querySelectorAll(".reveal-desktop");
  if (desktopReveals.length && window.matchMedia("(min-width: 820px)").matches && "IntersectionObserver" in window) {
    var revealObserver = new IntersectionObserver(function (entries, observer) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      });
    }, { rootMargin: "0px 0px -12%", threshold: 0.08 });

    desktopReveals.forEach(function (section) {
      revealObserver.observe(section);
    });
  } else {
    desktopReveals.forEach(function (section) {
      section.classList.add("is-visible");
    });
  }

  var mobileMenu = document.querySelector(".mobile-menu");
  if (mobileMenu) {
    mobileMenu.querySelectorAll("a").forEach(function (link) {
      link.addEventListener("click", function () {
        mobileMenu.removeAttribute("open");
      });
    });
  }

  document.querySelectorAll('a[href^="#"]').forEach(function (link) {
    link.addEventListener("click", function (event) {
      var id = link.getAttribute("href");
      if (!id || id === "#") return;
      var target = document.querySelector(id);
      if (!target) return;
      event.preventDefault();
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });

  var activityEndpoint = "/api/business-analytics/website-activity/collect";
  var activitySessionKey = "viva_website_session_v1";
  var activityQueue = [];
  var activityFlushTimer = null;
  var activitySession = getActivitySession();
  var activeSince = document.visibilityState === "visible" ? Date.now() : null;

  function randomId() {
    if (window.crypto && typeof window.crypto.randomUUID === "function") return window.crypto.randomUUID();
    var bytes = new Uint8Array(16);
    window.crypto.getRandomValues(bytes);
    bytes[6] = (bytes[6] & 15) | 64;
    bytes[8] = (bytes[8] & 63) | 128;
    var hex = Array.prototype.map.call(bytes, function (byte) { return byte.toString(16).padStart(2, "0"); }).join("");
    return hex.slice(0, 8) + "-" + hex.slice(8, 12) + "-" + hex.slice(12, 16) + "-" + hex.slice(16, 20) + "-" + hex.slice(20);
  }

  function getActivitySession() {
    var now = Date.now();
    try {
      var saved = JSON.parse(window.sessionStorage.getItem(activitySessionKey) || "null");
      if (saved && typeof saved.id === "string" && now - Number(saved.lastSeen || 0) < 30 * 60 * 1000) {
        saved.lastSeen = now;
        window.sessionStorage.setItem(activitySessionKey, JSON.stringify(saved));
        return saved;
      }
    } catch (_error) {
      // A fresh in-memory session still provides anonymous activity without persistent storage.
    }
    var created = { id: randomId(), lastSeen: now };
    try { window.sessionStorage.setItem(activitySessionKey, JSON.stringify(created)); } catch (_error) {}
    return created;
  }

  function touchActivitySession() {
    activitySession.lastSeen = Date.now();
    try { window.sessionStorage.setItem(activitySessionKey, JSON.stringify(activitySession)); } catch (_error) {}
  }

  function activityPath() {
    return window.location.pathname || "/";
  }

  function activityReferrerHost() {
    if (!document.referrer) return null;
    try { return new URL(document.referrer).hostname.slice(0, 253); } catch (_error) { return null; }
  }

  function activitySource() {
    try {
      var params = new URLSearchParams(window.location.search);
      var source = params.get("utm_source");
      return source ? source.trim().slice(0, 80) : null;
    } catch (_error) {
      return null;
    }
  }

  function queueActivity(type, options) {
    var detail = options || {};
    activityQueue.push({
      id: randomId(),
      type: type,
      path: activityPath(),
      activeSeconds: detail.activeSeconds || 0,
      occurredAt: new Date().toISOString(),
    });
    touchActivitySession();
    if (detail.immediate) return flushActivity(true);
    if (!activityFlushTimer) activityFlushTimer = window.setTimeout(function () { flushActivity(false); }, 800);
  }

  function flushActivity(useBeacon) {
    if (activityFlushTimer) window.clearTimeout(activityFlushTimer);
    activityFlushTimer = null;
    if (!activityQueue.length) return;
    var events = activityQueue.splice(0, 20);
    var payload = JSON.stringify({
      sessionId: activitySession.id,
      referrerHost: activityReferrerHost(),
      source: activitySource(),
      events: events,
    });
    if (useBeacon && navigator.sendBeacon) {
      var sent = navigator.sendBeacon(activityEndpoint, new Blob([payload], { type: "application/json" }));
      if (sent) {
        if (activityQueue.length) flushActivity(true);
        return;
      }
    }
    window.fetch(activityEndpoint, {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: payload,
      keepalive: true,
    }).catch(function () {
      activityQueue = events.concat(activityQueue).slice(0, 20);
    });
  }

  function queueActiveTime() {
    if (activeSince === null) return;
    var seconds = Math.floor((Date.now() - activeSince) / 1000);
    activeSince = Date.now();
    while (seconds > 0) {
      var increment = Math.min(seconds, 30);
      queueActivity("active_time", { activeSeconds: increment });
      seconds -= increment;
    }
  }

  queueActivity("page_view");
  window.setTimeout(function () {
    if (document.visibilityState !== "visible") return;
    queueActiveTime();
    flushActivity(false);
  }, 10000);
  window.setInterval(function () {
    if (document.visibilityState !== "visible") return;
    queueActiveTime();
    flushActivity(false);
  }, 30000);

  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "visible") {
      activeSince = Date.now();
      return;
    }
    queueActiveTime();
    activeSince = null;
    flushActivity(true);
  });
  window.addEventListener("pagehide", function () {
    queueActiveTime();
    activeSince = null;
    flushActivity(true);
  });

  var startedForms = typeof WeakSet === "function" ? new WeakSet() : null;
  var deepScrollRecorded = false;
  window.addEventListener("scroll", function () {
    if (deepScrollRecorded) return;
    var documentHeight = Math.max(document.documentElement.scrollHeight, document.body ? document.body.scrollHeight : 0);
    if (documentHeight <= window.innerHeight) return;
    var progress = (window.scrollY + window.innerHeight) / documentHeight;
    if (progress >= 0.8) {
      deepScrollRecorded = true;
      queueActivity("deep_scroll");
    }
  }, { passive: true });

  document.addEventListener("focusin", function (event) {
    if (!event.isTrusted) return;
    var target = event.target;
    var form = target && target.closest ? target.closest("form") : null;
    if (!form || (startedForms && startedForms.has(form))) return;
    if (startedForms) startedForms.add(form);
    queueActivity("form_start");
  });
  document.addEventListener("submit", function (event) {
    if (!event.isTrusted) return;
    queueActivity("form_submit", { immediate: true });
  });

  function recordWebsiteAction(eventName, link) {
    window.dataLayer = window.dataLayer || [];
    window.gtag = window.gtag || function () { window.dataLayer.push(arguments); };
    window.gtag("event", eventName, {
      link_url: link.href,
      link_text: (link.textContent || "").trim().slice(0, 100),
      page_path: window.location.pathname,
    });
    queueActivity(eventName, { immediate: true });
  }

  document.addEventListener("click", function (event) {
    if (!event.isTrusted) return;
    var target = event.target;
    var link = target && target.closest ? target.closest("a[href]") : null;
    if (!link) return;
    var href = link.getAttribute("href") || "";
    if (href.indexOf("tel:") === 0) return recordWebsiteAction("phone_click", link);
    if (href.indexOf("mailto:") === 0) return recordWebsiteAction("email_click", link);
    if (href.indexOf("calendly.com") !== -1) return recordWebsiteAction("schedule_click", link);
    if (href === "#scan-request" || href.indexOf("/scan") === 0) return recordWebsiteAction("scan_interest", link);
    if (href.indexOf("/results") === 0) return recordWebsiteAction("results_interest", link);
    if (href === "#contact-form" || href.indexOf("/contact") === 0) return recordWebsiteAction("contact_interest", link);
  });
})();
