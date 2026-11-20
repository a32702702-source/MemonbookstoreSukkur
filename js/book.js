/* Memon Book Store — book details page. */
(function () {
  "use strict";
  var MBS = window.MBS;
  var esc = MBS.esc, icon = MBS.icon, $ = MBS.$;

  var NA = '<span class="na">Not published by the publisher</span>';

  function row(label, value, html) {
    return '<tr><th scope="row">' + esc(label) + "</th><td>" + (value ? (html ? value : esc(value)) : NA) + "</td></tr>";
  }

  function setMeta(book, pub) {
    var title = book.title + " — " + pub.name + " | Memon Book Store";
    var desc = [book.title, pub.name, book.classLabel, book.subject, book.isbn ? "ISBN " + book.isbn : ""].filter(Boolean).join(" · ") +
      ". Ask Memon Book Store, Sukkur, about price and availability on WhatsApp.";
    document.title = title;
    var url = location.origin + location.pathname + "?id=" + encodeURIComponent(book.id);
    function upsert(selector, create, attr, value) {
      var node = document.head.querySelector(selector);
      if (!node) {
        node = create();
        document.head.appendChild(node);
      }
      node.setAttribute(attr, value);
    }
    upsert('meta[name="description"]', function () { var m = document.createElement("meta"); m.name = "description"; return m; }, "content", desc);
    upsert('meta[property="og:title"]', function () { var m = document.createElement("meta"); m.setAttribute("property", "og:title"); return m; }, "content", title);
    upsert('meta[property="og:description"]', function () { var m = document.createElement("meta"); m.setAttribute("property", "og:description"); return m; }, "content", desc);
    upsert('link[rel="canonical"]', function () { var l = document.createElement("link"); l.rel = "canonical"; return l; }, "href", url);

    if (book.kind !== "series") {
      var ld = { "@context": "https://schema.org", "@type": "Book", name: book.title, url: url, publisher: { "@type": "Organization", name: pub.name } };
      if (book.isbn) ld.isbn = book.isbn;
      if (book.edition) ld.bookEdition = book.edition;
      if (book.author) ld.author = book.author;
      if (book.language) ld.inLanguage = book.language;
      if (book.coverUrl && /^https?:/.test(book.coverUrl)) ld.image = book.coverUrl;
      var script = document.createElement("script");
      script.type = "application/ld+json";
      script.textContent = JSON.stringify(ld);
      document.head.appendChild(script);
    }
  }

  function render(book, data) {
    var pub = book._pub || { name: "Publisher", slug: "", shortName: "" };
    var isSeries = book.kind === "series";
    var thing = isSeries ? "series" : "book";
    var root = $("#book-root");

    var chips = "";
    if (isSeries) chips += '<span class="chip">Series</span>';
    if (book.classGroup) chips += '<a class="chip" href="' + MBS.listUrl({ "class": book.classGroup }) + '">' + esc(book.classGroup) + "</a>";
    if (book.subject) chips += '<a class="chip chip--subject" href="' + MBS.listUrl({ subject: book.subject }) + '">' + esc(book.subject) + "</a>";

    var official = book.officialPrice != null
      ? '<div class="price-box__value">' + MBS.formatPrice(book.officialPrice) + "</div>"
      : '<div class="price-box__value price-box__value--ask">Not published</div>';
    var store = book.storePrice != null
      ? '<div class="price-box__value price-box__value--store">' + MBS.formatPrice(book.storePrice) + "</div>"
      : '<div class="price-box__value price-box__value--ask">Ask us on WhatsApp</div>';

    var seriesLink = book.series && !isSeries
      ? '<a href="' + MBS.listUrl({ series: book.series }) + '">' + esc(book.series) + "</a>"
      : esc(book.series);

    root.innerHTML =
      '<div class="detail">' +
      '<div class="detail__media"><div class="detail__stage"><div id="cover-zoom" role="button" tabindex="0" aria-label="View larger cover of ' + esc(book.title) + '">' +
      MBS.cover(book, true) + "</div></div>" +
      (book.coverUrl || book.thumbUrl
        ? '<button type="button" class="link-btn detail__zoom" id="cover-zoom-btn">View larger cover</button>' +
          '<p class="detail__credit">Cover image © ' + esc(pub.name) + ", shown from the publisher's official website.</p>"
        : '<p class="detail__credit">No cover image is available for this ' + thing + ".</p>") +
      "</div>" +
      '<div class="detail__info">' +
      (pub.slug ? '<a class="detail__pub" href="' + esc(pub.slug) + '.html">' + esc(pub.name) + "</a>" : "") +
      '<h1 class="detail__title">' + esc(book.title) + "</h1>" +
      '<div class="chips">' + chips + "</div>" +
      '<div class="price-box">' +
      '<div class="price-box__row"><div class="price-box__label">Publisher list price<small>' +
      esc(book.officialPrice != null ? book.officialPriceLabel || "From the publisher's official website" : "The publisher does not publish a price for this " + thing) +
      "</small></div>" + official + "</div>" +
      '<div class="price-box__row"><div class="price-box__label">Memon Book Store price<small>Our own selling price</small></div>' + store + "</div>" +
      '<div class="price-box__row"><div class="price-box__label">Availability at our store</div><div>' + MBS.availHtml(book) + "</div></div>" +
      "</div>" +
      '<div class="btn-row">' +
      '<a class="btn btn--wa" target="_blank" rel="noopener" href="' + esc(MBS.waBook(book)) + '">' + icon("wa") + " Ask about this " + thing + " on WhatsApp</a>" +
      (book.sourceUrl ? '<a class="btn btn--ghost" target="_blank" rel="noopener" href="' + esc(book.sourceUrl) + '">Official publisher page ' + icon("external") + "</a>" : "") +
      "</div>" +
      "<h2>About this " + thing + "</h2>" +
      '<p class="detail__desc">' + (book.description ? esc(book.description) : "The publisher has not published a description for this " + thing + ".") + "</p>" +
      (book.descriptionSource === "summary"
        ? '<p class="note-line">Summary compiled by Memon Book Store from the publisher\'s official listing.</p>'
        : "") +
      "<h2>" + (isSeries ? "Series" : "Book") + " details</h2>" +
      '<table class="spec"><tbody>' +
      row("Publisher", pub.name) +
      row("Series", seriesLink, true) +
      row("Class / level", book.classLabel) +
      row("Subject", book.subject) +
      row("Edition", book.edition) +
      row("ISBN", book.isbn) +
      row("Language", book.language) +
      row("Author(s)", book.author) +
      row("Binding", book.binding) +
      "</tbody></table>" +
      '<button type="button" class="link-btn" id="copy-link">' + "Copy link to this page</button>" +
      "</div></div>";

    // Breadcrumb
    var crumbs = $("#book-crumbs");
    if (crumbs) {
      crumbs.insertAdjacentHTML(
        "beforeend",
        (pub.slug ? '<li><a href="' + esc(pub.slug) + '.html">' + esc(pub.name) + "</a></li>" : "") +
          '<li aria-current="page">' + esc(book.title) + "</li>"
      );
    }

    // Cover gallery: this cover first, then the rest of the series.
    var siblings = MBS.sortBooks(
      data.books.filter(function (b) { return b.id !== book.id && book.series && b.series === book.series && b.publisher === book.publisher && (b.coverUrl || b.thumbUrl); })
    );
    var gallery = [book].concat(siblings).filter(function (b) { return b.coverUrl || b.thumbUrl; }).map(function (b) {
      return { src: MBS.asset(b.coverUrl || b.thumbUrl), title: b.title, sub: pub.name + (b.classLabel ? " · " + b.classLabel : ""), href: b.id === book.id ? "" : MBS.bookUrl(b) };
    });
    function openZoom() {
      if (gallery.length && (book.coverUrl || book.thumbUrl)) MBS.lightbox.open(gallery, 0);
    }
    var zoom = $("#cover-zoom"), zoomBtn = $("#cover-zoom-btn");
    if (zoom) {
      zoom.addEventListener("click", openZoom);
      zoom.addEventListener("keydown", function (e) {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          openZoom();
        }
      });
    }
    if (zoomBtn) zoomBtn.addEventListener("click", openZoom);

    $("#copy-link").addEventListener("click", function () {
      var url = location.href;
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(url).then(
          function () { MBS.toast("Link copied"); },
          function () { MBS.toast(url); }
        );
      } else {
        MBS.toast(url);
      }
    });

    // Related books: same series first, then same class and subject.
    var related = siblings.slice();
    if (related.length < 8) {
      MBS.sortBooks(data.books).forEach(function (b) {
        if (related.length >= 8 || b.id === book.id || related.indexOf(b) !== -1) return;
        if (book.classGroup && b.classGroup === book.classGroup && (!book.subject || b.subject === book.subject)) related.push(b);
      });
    }
    if (related.length < 4) {
      MBS.sortBooks(data.books).forEach(function (b) {
        if (related.length >= 8 || b.id === book.id || related.indexOf(b) !== -1) return;
        if (b.publisher === book.publisher) related.push(b);
      });
    }
    if (related.length) {
      $("#related-grid").innerHTML = related.slice(0, 8).map(MBS.bookCard).join("");
      $("#related-section").hidden = false;
    }

    setMeta(book, pub);
  }

  MBS.ready(function (data) {
    var id = MBS.param("id");
    var book = null;
    for (var i = 0; i < data.books.length; i += 1) {
      if (data.books[i].id === id) {
        book = data.books[i];
        break;
      }
    }
    if (!book) {
      $("#book-root").innerHTML =
        '<div class="empty-state"><h3>We could not find that book</h3><p>The link may be old, or the book may have been removed from the catalogue.</p>' +
        '<div class="btn-row" style="justify-content:center"><a class="btn btn--primary" href="books.html">Browse all books</a>' +
        '<a class="btn btn--wa" target="_blank" rel="noopener" href="' + esc(MBS.wa(MBS.waText.general)) + '">' + icon("wa") + " Ask on WhatsApp</a></div></div>";
      document.title = "Book not found | Memon Book Store";
      return;
    }
    render(book, data);
  });
})();
