/* Memon Book Store — class-wise, subject-wise, series catalogue and book gallery pages. */
(function () {
  "use strict";
  var MBS = window.MBS;
  var esc = MBS.esc, icon = MBS.icon, $ = MBS.$, $$ = MBS.$$;

  var pageName = document.body.getAttribute("data-page");
  var root = $("#browse-root");
  if (!root) return;

  var PREVIEW = 8;
  var slug = function (s) {
    return "g-" + String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  };
  var plural = function (n, one, many) {
    return n + " " + (n === 1 ? one : many);
  };

  /* ---------- Class-wise & subject-wise ---------- */
  function renderGroups(data, key, classOrder, paramName) {
    var groups = MBS.groupBy(data.books, key, classOrder);
    var jump = $("#browse-jump");
    if (jump) {
      jump.innerHTML = groups
        .map(function (g) {
          return '<a class="pill" href="#' + slug(g.name) + '">' + (key === "subject" ? MBS.subjectIcon(g.name) : "") + esc(g.name) +
            '<span class="pill__count">' + g.count + "</span></a>";
        })
        .join("");
    }

    var store = {};
    root.innerHTML = groups
      .map(function (g) {
        var id = slug(g.name);
        var sorted = MBS.sortBooks(g.books);
        store[id] = sorted;
        var filter = {};
        filter[paramName] = g.name;
        return (
          '<section class="group-block" id="' + id + '">' +
          '<div class="group-block__head"><h2>' + esc(g.name) + '<span class="group-block__count">' + plural(g.count, "title", "titles") + "</span></h2>" +
          '<a class="section-link" href="' + MBS.listUrl(filter) + '">Open with filters ' + icon("arrowRight") + "</a></div>" +
          '<div class="book-grid">' + sorted.slice(0, PREVIEW).map(MBS.bookCard).join("") + "</div>" +
          (sorted.length > PREVIEW
            ? '<div class="load-more" style="margin-top:24px"><button type="button" class="btn btn--ghost btn--sm" data-expand="' + id + '">Show all ' + sorted.length + " titles</button></div>"
            : "") +
          "</section>"
        );
      })
      .join("");

    if (key === "subject") {
      var unlisted = data.books.filter(function (b) { return !b.subject; });
      if (unlisted.length) {
        root.insertAdjacentHTML(
          "beforeend",
          '<div class="notice notice--plain">' + icon("info") + "<p>" + plural(unlisted.length, "catalogue entry is", "catalogue entries are") +
            ' listed by the publisher as a series without a subject. See <a href="javed-publishers.html">Javed Publishers</a> or the <a href="series.html">Series Catalogue</a>.</p></div>'
        );
      }
    }

    root.addEventListener("click", function (e) {
      var btn = e.target.closest("[data-expand]");
      if (!btn) return;
      var id = btn.getAttribute("data-expand");
      var section = document.getElementById(id);
      var grid = section && $(".book-grid", section);
      if (!grid || !store[id]) return;
      grid.insertAdjacentHTML("beforeend", store[id].slice(PREVIEW).map(MBS.bookCard).join(""));
      btn.parentNode.remove();
    });

    if (location.hash) {
      var target = document.getElementById(decodeURIComponent(location.hash.slice(1)));
      if (target) target.scrollIntoView();
    }
  }

  /* ---------- Publisher tabs (series + gallery) ---------- */
  function renderTabs(data, onChange) {
    var tabs = $("#browse-tabs");
    if (!tabs) return;
    var wanted = MBS.param("publisher");
    tabs.innerHTML =
      '<button type="button" class="tab' + (wanted ? "" : " is-active") + '" data-pub="">All publishers</button>' +
      data.publishers
        .map(function (p) {
          return '<button type="button" class="tab' + (wanted === p.slug ? " is-active" : "") + '" data-pub="' + esc(p.slug) + '">' + esc(p.name) + "</button>";
        })
        .join("");
    tabs.addEventListener("click", function (e) {
      var btn = e.target.closest(".tab");
      if (!btn) return;
      $$(".tab", tabs).forEach(function (t) { t.classList.toggle("is-active", t === btn); });
      onChange(btn.getAttribute("data-pub"));
    });
    onChange(data.publisherBySlug[wanted] ? wanted : "");
  }

  /* ---------- Series catalogue ---------- */
  function renderSeries(data) {
    renderTabs(data, function (pubSlug) {
      var html = "";
      data.publishers.forEach(function (p) {
        if (pubSlug && p.slug !== pubSlug) return;
        var groups = MBS.groupBy(data.books.filter(function (b) { return b.publisher === p.slug; }), "series");
        if (!groups.length) return;
        groups.sort(function (a, b) { return a.name.localeCompare(b.name); });
        html +=
          '<section class="group-block"><div class="group-block__head"><h2>' + esc(p.name) + '<span class="group-block__count">' +
          plural(groups.length, "series", "series") + '</span></h2><a class="section-link" href="' + esc(p.slug) + '.html">Publisher page ' +
          icon("arrowRight") + '</a></div><div class="series-grid">' + groups.map(MBS.seriesCard).join("") + "</div></section>";
      });
      root.innerHTML = html || MBS.emptyState("No series found", "Please choose another publisher.");
      MBS.observeReveal(root);
    });
  }

  /* ---------- Gallery ---------- */
  function renderGallery(data) {
    var current = [];
    renderTabs(data, function (pubSlug) {
      current = MBS.sortBooks(
        data.books.filter(function (b) { return (b.coverUrl || b.thumbUrl) && (!pubSlug || b.publisher === pubSlug); })
      );
      root.innerHTML = current.length
        ? '<div class="gallery-grid">' +
          current
            .map(function (b, i) {
              return '<button type="button" class="gallery-item" data-index="' + i + '" aria-label="View cover of ' + esc(b.title) + '">' +
                MBS.cover(b) + '<span class="gallery-item__title">' + esc(b.title) + "</span></button>";
            })
            .join("") +
          "</div>"
        : MBS.emptyState("No covers to show", "Please choose another publisher.");
    });
    root.addEventListener("click", function (e) {
      var item = e.target.closest(".gallery-item");
      if (!item) return;
      MBS.lightbox.open(
        current.map(function (b) {
          return {
            src: MBS.asset(b.coverUrl || b.thumbUrl),
            title: b.title,
            sub: (b._pub ? b._pub.name : "") + (b.classLabel ? " · " + b.classLabel : ""),
            href: MBS.bookUrl(b),
          };
        }),
        Number(item.getAttribute("data-index"))
      );
    });
  }

  MBS.ready(function (data) {
    if (pageName === "classes") renderGroups(data, "classGroup", true, "class");
    else if (pageName === "subjects") renderGroups(data, "subject", false, "subject");
    else if (pageName === "series") renderSeries(data);
    else if (pageName === "gallery") renderGallery(data);
    MBS.observeReveal(document);
  });
})();
