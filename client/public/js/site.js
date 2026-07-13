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
})();
