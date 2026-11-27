(function () {
  var links = document.querySelectorAll('.results-map a[href^="/images/"]');
  if (!links.length || typeof HTMLDialogElement !== "function") return;

  var dialog = document.createElement("dialog");
  dialog.className = "map-dialog";
  dialog.setAttribute("aria-labelledby", "map-dialog-title");
  dialog.innerHTML =
    '<div class="map-dialog-header"><span id="map-dialog-title"></span>' +
    '<button type="button" class="map-dialog-close" aria-label="Close map">&times;</button></div>' +
    '<img alt="">';
  document.body.appendChild(dialog);

  var title = dialog.querySelector("#map-dialog-title");
  var image = dialog.querySelector("img");

  dialog.querySelector(".map-dialog-close").addEventListener("click", function () {
    dialog.close();
  });

  // Clicking the dimmed area outside the map also closes it.
  dialog.addEventListener("click", function (event) {
    if (event.target === dialog) dialog.close();
  });

  links.forEach(function (link) {
    link.addEventListener("click", function (event) {
      var figure = link.closest(".results-map");
      var enlargeLink = figure.querySelector("a[aria-label]");
      var thumbnail = figure.querySelector("img");
      event.preventDefault();
      title.textContent = (enlargeLink.getAttribute("aria-label") || "").replace(/^Enlarge map:\s*/, "");
      image.src = link.getAttribute("href");
      image.alt = thumbnail ? thumbnail.alt : "";
      dialog.showModal();
    });
  });
})();
