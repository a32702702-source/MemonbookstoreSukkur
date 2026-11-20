/* Memon Book Store — small page scripts: publishers, about, stationery, contact. */
(function () {
  "use strict";
  var MBS = window.MBS;
  var esc = MBS.esc, icon = MBS.icon, $ = MBS.$;

  /* ---------- Stationery list (kept in sync with the admin panel) ---------- */
  function renderStationery(site) {
    var root = $("#stationery-root");
    if (!root || !site || !Array.isArray(site.stationery) || !site.stationery.length) return;
    root.innerHTML = site.stationery
      .map(function (s, i) {
        return (
          '<article class="stationery-card reveal"><span class="stationery-card__num">' + (i < 9 ? "0" : "") + (i + 1) + "</span>" +
          "<h3>" + esc(s.name) + "</h3><p>" + esc(s.note || "") + "</p>" +
          '<a class="btn btn--ghost btn--sm" data-wa="item" data-wa-name="' + esc(s.name) + '" target="_blank" rel="noopener" href="' +
          esc(MBS.wa(MBS.waText.item(s.name))) + '">' + icon("wa") + " Ask about this</a></article>"
        );
      })
      .join("");
  }

  /* ---------- Contact form → WhatsApp ---------- */
  function bindEnquiryForm() {
    var form = $("#enquiry-form");
    if (!form) return;
    var error = $("#e-error");
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var name = $("#e-name").value.trim();
      var type = $("#e-type").value;
      var item = $("#e-item").value.trim();
      var message = $("#e-message").value.trim();
      if (!name || !message) {
        error.textContent = "Please enter your name and a short message.";
        error.hidden = false;
        (name ? $("#e-message") : $("#e-name")).focus();
        return;
      }
      error.hidden = true;
      var lines = ["Hello Memon Book Store,", "", "*" + type + "*", "Name: " + name];
      if (item) lines.push("Regarding: " + item);
      lines.push("", message);
      var url = MBS.wa(lines.join("\n"));
      var win = window.open(url, "_blank", "noopener");
      if (!win) location.href = url;
    });
  }

  bindEnquiryForm();

  MBS.ready(function (data) {
    MBS.enhancePublisherCards(data);
    renderStationery(data.site);
    MBS.bindWhatsApp(document);
    MBS.observeReveal(document);
  });
})();
