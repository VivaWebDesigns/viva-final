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

  function recordWebsiteAction(eventName, link) {
    window.dataLayer = window.dataLayer || [];
    window.gtag = window.gtag || function () { window.dataLayer.push(arguments); };
    window.gtag("event", eventName, {
      link_url: link.href,
      link_text: (link.textContent || "").trim().slice(0, 100),
      page_path: window.location.pathname,
    });
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
