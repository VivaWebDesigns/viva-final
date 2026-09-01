(function () {
  var caseStudies = {
    "glass-and-door-pro": {
      title: "Glass and Door Pro Case Study | Viva Web Designs",
      description: "See how Glass and Door Pro went from 2-3 calls per week to 3-6 calls per day after rebuilding its website and local search foundation."
    },
    "carolina-custom-automation": {
      title: "Carolina Custom Automation Case Study | Viva Web Designs",
      description: "See how Carolina Custom Automation gained dominant Fort Mill Google Maps visibility and began receiving calls and emails from Google every day."
    }
  };

  var selectedCase = document.documentElement.dataset.resultsCase || "glass-and-door-pro";
  var selectedData = caseStudies[selectedCase] || caseStudies["glass-and-door-pro"];

  document.querySelectorAll("[data-results-case-panel]").forEach(function (panel) {
    panel.hidden = panel.getAttribute("data-results-case-panel") !== selectedCase;
  });

  document.querySelectorAll("[data-results-case-link]").forEach(function (link) {
    var isCurrent = link.getAttribute("data-results-case-link") === selectedCase;
    if (isCurrent) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  });

  document.title = selectedData.title;

  var description = document.querySelector('meta[name="description"]');
  if (description) description.setAttribute("content", selectedData.description);

  var canonical = document.querySelector('link[rel="canonical"]');
  if (canonical) canonical.setAttribute("href", "https://vivawebdesigns.com/results/" + selectedCase);

  var openGraphTitle = document.querySelector('meta[property="og:title"]');
  if (openGraphTitle) openGraphTitle.setAttribute("content", selectedData.title);

  var openGraphDescription = document.querySelector('meta[property="og:description"]');
  if (openGraphDescription) openGraphDescription.setAttribute("content", selectedData.description);

  var openGraphUrl = document.querySelector('meta[property="og:url"]');
  if (openGraphUrl) openGraphUrl.setAttribute("content", "https://vivawebdesigns.com/results/" + selectedCase);
})();
