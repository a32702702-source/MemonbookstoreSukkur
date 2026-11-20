/* Memon Book Store — admin panel. Every action is checked again on the server. */
(function () {
  "use strict";

  var ICONS = window.MBS_ICONS || {};
  var icon = function (name) { return ICONS[name] || ""; };
  var ESC = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
  var esc = function (v) { return String(v == null ? "" : v).replace(/[&<>"']/g, function (c) { return ESC[c]; }); };
  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  var AVAIL = [["unverified", "Not confirmed"], ["in_stock", "In stock"], ["on_order", "On order"], ["out_of_stock", "Out of stock"]];
  var TITLES = {
    dashboard: "Dashboard", books: "Books", featured: "Featured Books", publishers: "Publishers",
    slider: "Homepage Slider", content: "Website Content", stationery: "Stationery", account: "Account & Security",
  };
  var PER_PAGE = 20;
  var state = { view: "dashboard", user: "", books: [], publishers: [], site: null, q: "", pub: "", avail: "", page: 1 };
  var content = $("#adm-content");
  var draft = null; // working copy for the slider / stationery editors

  /* ------------------------------------------------------------------ */
  /* Server communication                                                */
  /* ------------------------------------------------------------------ */
  function api(path, opts) {
    if (state.demo) {
      opts = opts || {};
      if (path === "admin/dashboard") {
        return Promise.resolve({
          stats: {
            books: state.books.length,
            publishers: state.publishers.length,
            unverified: state.books.filter(function (b) { return b.availability === "unverified"; }).length,
            withStorePrice: state.books.filter(function (b) { return b.storePrice != null; }).length
          },
          activity: [
            { action: "Catalogue Loaded", detail: "219 titles across 6 educational publishers", time: "Just now" },
            { action: "KIPS & MDCAT Added", detail: "Entry test and Quranic studies sections active", time: "Today" },
            { action: "Sukkur Board Curricula", detail: "Class 9 to 12 STBB books verified", time: "Today" }
          ]
        });
      }
      if (path === "admin/settings" && opts.method === "PUT") {
        if (opts.body && opts.body.site) {
          state.site = Object.assign({}, state.site, opts.body.site);
        }
        return Promise.resolve({ ok: true, site: state.site });
      }
      if (path.indexOf("admin/books") === 0) {
        if (opts.method === "POST") {
          var newB = Object.assign({ dbId: Date.now() }, opts.body);
          state.books.unshift(newB);
          return Promise.resolve({ ok: true, book: newB });
        }
        if (opts.method === "PUT") {
          return Promise.resolve({ ok: true, book: opts.body });
        }
        if (opts.method === "DELETE") {
          return Promise.resolve({ ok: true });
        }
      }
      if (path === "auth/password") {
        return Promise.resolve({ ok: true });
      }
      if (path === "auth/logout") {
        location.href = "login.html";
        return Promise.resolve({ ok: true });
      }
      return Promise.resolve({ ok: true });
    }
    opts = opts || {};
    var headers = { "X-Requested-With": "mbs-admin", Accept: "application/json" };
    var body = opts.body;
    if (body instanceof Blob) headers["Content-Type"] = body.type || "application/octet-stream";
    else if (body !== undefined) {
      headers["Content-Type"] = "application/json";
      body = JSON.stringify(body);
    }
    return fetch("api/" + path, { method: opts.method || "GET", credentials: "same-origin", headers: headers, body: body }).then(function (res) {
      if (res.status === 401) {
        location.replace("login.html");
        throw new Error("Your session has ended. Please sign in again.");
      }
      return res
        .json()
        .catch(function () { return {}; })
        .then(function (data) {
          if (!res.ok) throw new Error(data.error || "The request failed (" + res.status + ").");
          return data;
        });
    });
  }

  function uploadImage(file) {
    if (!file) return Promise.reject(new Error("No image chosen."));
    if (state.demo) {
      return new Promise(function (resolve) {
        var reader = new FileReader();
        reader.onload = function (e) { resolve(e.target.result); };
        reader.readAsDataURL(file);
      });
    }
    if (!/^image\/(png|jpeg|webp)$/.test(file.type)) return Promise.reject(new Error("Please choose a JPG, PNG or WebP image."));
    if (file.size > 3 * 1024 * 1024) return Promise.reject(new Error("Images must be smaller than 3 MB."));
    return api("admin/upload", { method: "POST", body: file }).then(function (d) { return d.url; });
  }

  var toastTimer;
  function toast(message, isError) {
    var el = $("#toast");
    if (!el) {
      el = document.createElement("div");
      el.id = "toast";
      el.className = "toast";
      el.setAttribute("role", "status");
      document.body.appendChild(el);
    }
    el.textContent = message;
    el.style.background = isError ? "#9b2c2c" : "";
    el.classList.add("is-visible");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.remove("is-visible"); }, isError ? 5200 : 3000);
  }
  var fail = function (error) { toast(error && error.message ? error.message : "Something went wrong.", true); };

  /* ------------------------------------------------------------------ */
  /* Helpers                                                             */
  /* ------------------------------------------------------------------ */
  function pubName(slug) {
    for (var i = 0; i < state.publishers.length; i += 1) if (state.publishers[i].slug === slug) return state.publishers[i].name;
    return slug;
  }
  function pubShort(slug) {
    for (var i = 0; i < state.publishers.length; i += 1) if (state.publishers[i].slug === slug) return state.publishers[i].shortName || state.publishers[i].name;
    return slug;
  }
  function bookById(id) {
    for (var i = 0; i < state.books.length; i += 1) if (state.books[i].dbId === id) return state.books[i];
    return null;
  }
  function replaceBook(book) {
    for (var i = 0; i < state.books.length; i += 1) {
      if (state.books[i].dbId === book.dbId) {
        state.books[i] = book;
        return;
      }
    }
    state.books.unshift(book);
  }
  function money(n) { return n == null ? "—" : "PKR " + Number(n).toLocaleString("en-US"); }
  function timeAgo(iso) {
    var s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
    if (s < 60) return "just now";
    if (s < 3600) return Math.floor(s / 60) + " min ago";
    if (s < 86400) return Math.floor(s / 3600) + " h ago";
    if (s < 86400 * 14) return Math.floor(s / 86400) + " d ago";
    return new Date(iso).toLocaleDateString();
  }
  function unique(key) {
    var seen = {};
    state.books.forEach(function (b) { if (b[key]) seen[b[key]] = true; });
    return Object.keys(seen).sort(function (a, b) { return a.localeCompare(b, undefined, { numeric: true }); });
  }
  function datalist(id, values) {
    return '<datalist id="' + id + '">' + values.map(function (v) { return '<option value="' + esc(v) + '">'; }).join("") + "</datalist>";
  }
  function field(label, inner, hint) {
    return '<div class="field"><label>' + esc(label) + inner + "</label>" + (hint ? '<span class="field__hint">' + esc(hint) + "</span>" : "") + "</div>";
  }
  function input(name, value, attrs) {
    return '<input name="' + name + '" value="' + esc(value == null ? "" : value) + '" ' + (attrs || 'type="text"') + ">";
  }
  function thumb(url) {
    return url
      ? '<img class="adm-thumb" src="' + esc(url) + '" alt="" loading="lazy" referrerpolicy="no-referrer">'
      : '<span class="adm-thumb adm-thumb--empty"></span>';
  }
  function card(title, sub, body) {
    return '<section class="adm-card">' + (title ? "<h2>" + esc(title) + "</h2>" : "") + (sub ? '<p class="adm-card__sub">' + sub + "</p>" : "") + body + "</section>";
  }

  /* ------------------------------------------------------------------ */
  /* Modal                                                               */
  /* ------------------------------------------------------------------ */
  var modal = $("#adm-modal");
  function openModal(title, html) {
    $("#adm-modal-title").textContent = title;
    $("#adm-modal-body").innerHTML = html;
    modal.hidden = false;
    document.body.style.overflow = "hidden";
    var first = $("input, select, textarea", $("#adm-modal-body"));
    if (first) first.focus();
  }
  function closeModal() {
    modal.hidden = true;
    document.body.style.overflow = "";
    $("#adm-modal-body").innerHTML = "";
  }

  /* ------------------------------------------------------------------ */
  /* Views                                                               */
  /* ------------------------------------------------------------------ */
  var views = {};

  function show(view) {
    if (!TITLES[view]) view = "dashboard";
    state.view = view;
    draft = null;
    $$(".adm-nav button").forEach(function (b) { b.classList.toggle("is-active", b.getAttribute("data-view") === view); });
    $("#adm-title").textContent = TITLES[view];
    document.body.classList.remove("adm-open");
    try { history.replaceState(null, "", "#" + view); } catch (e) { /* ignore */ }
    views[view]();
    window.scrollTo(0, 0);
  }

  /* ---------- Dashboard ---------- */
  views.dashboard = function () {
    content.innerHTML = card("", "", '<p class="adm-muted">Loading the dashboard…</p>');
    api("admin/dashboard")
      .then(function (d) {
        if (state.view !== "dashboard") return;
        var s = d.stats;
        var stat = function (label, value, note) {
          return '<div class="adm-stat"><span>' + esc(label) + "</span><b>" + esc(value) + "</b>" + (note ? "<small>" + esc(note) + "</small>" : "") + "</div>";
        };
        var maxCount = Math.max.apply(null, d.publishers.map(function (p) { return p.count; }).concat([1]));
        content.innerHTML =
          '<div class="adm-stats">' +
          stat("Total books", s.books, s.seriesEntries ? s.seriesEntries + " listed as series" : "catalogue entries") +
          stat("Total publishers", s.publishers, "official sources") +
          stat("Total categories", s.categories, s.subjects + " subjects · " + s.classes + " class levels") +
          stat("Series", s.series, "book series") +
          stat("Featured", s.featured, "on the homepage") +
          stat("Store prices set", s.withStorePrice, "of " + s.books + " entries") +
          stat("Stock confirmed", s.stockVerified, "of " + s.books + " entries") +
          "</div>" +
          (s.withStorePrice === 0 || s.stockVerified === 0
            ? '<div class="adm-note">' + icon("info") + "<p><strong>Next step:</strong> the public website only shows a Memon Book Store price or an “In stock” label after you set it here. Open <a href=\"#books\" data-go=\"books\">Books</a>, edit a title and enter your selling price and availability.</p></div>"
            : "") +
          '<div class="adm-cols">' +
          card("Recent updates", "The latest changes made in this admin panel.",
            '<ul class="adm-activity">' +
              (d.activity.length
                ? d.activity.map(function (a) {
                    return "<li><span><strong>" + esc(a.action) + "</strong>" + (a.detail ? " — " + esc(a.detail) : "") + '</span><time datetime="' + esc(a.at) + '">' + esc(timeAgo(a.at)) + "</time></li>";
                  }).join("")
                : "<li>No activity yet.</li>") +
              "</ul>") +
          '<div class="adm-stack">' +
          card("Books by publisher", "",
            d.publishers.map(function (p) {
              return '<div class="adm-bar"><div class="adm-bar__label"><span>' + esc(p.name) + "</span><b>" + p.count + '</b></div><div class="adm-bar__track"><span style="width:' + Math.round((p.count / maxCount) * 100) + '%"></span></div></div>';
            }).join("")) +
          card("Quick actions", "",
            '<div class="adm-actions"><button type="button" class="btn btn--primary btn--sm" data-act="add-book">' + icon("plus") + " Add a book</button>" +
              '<a class="btn btn--ghost btn--sm" href="api/admin/export" download="catalogue.json">' + icon("download") + " Export catalogue.json</a>" +
              '<a class="btn btn--ghost btn--sm" href="index.html" target="_blank" rel="noopener">' + icon("external") + " View website</a></div>" +
              '<p class="adm-card__sub" style="margin:14px 0 0">Using a static copy on GitHub Pages? Export <code>catalogue.json</code> and replace <code>data/catalogue.json</code> in your repository to publish these changes there.</p>') +
          "</div></div>";
      })
      .catch(function (error) {
        content.innerHTML = card("Dashboard", "", '<p class="form-msg">' + esc(error.message) + "</p>");
      });
  };

  /* ---------- Books ---------- */
  function filteredBooks() {
    var terms = state.q.toLowerCase().split(/\s+/).filter(Boolean);
    return state.books.filter(function (b) {
      if (state.pub && b.publisher !== state.pub) return false;
      if (state.avail && b.availability !== state.avail) return false;
      if (!terms.length) return true;
      var hay = [b.title, b.isbn, b.series, b.subject, b.classLabel].join(" ").toLowerCase();
      return terms.every(function (t) { return hay.indexOf(t) !== -1; });
    });
  }

  function drawBooks() {
    var holder = $("#b-table");
    if (!holder) return;
    var list = filteredBooks();
    var pages = Math.max(1, Math.ceil(list.length / PER_PAGE));
    state.page = Math.min(Math.max(1, state.page), pages);
    var rows = list.slice((state.page - 1) * PER_PAGE, state.page * PER_PAGE).map(function (b) {
      return (
        "<tr><td>" + thumb(b.thumbUrl || b.coverUrl) + "</td>" +
        '<td><div class="adm-title">' + esc(b.title) + "<small>" + esc(pubShort(b.publisher) + " · " + (b.isbn ? "ISBN " + b.isbn : b.kind === "series" ? "Series entry" : "No ISBN published")) + "</small></div></td>" +
        '<td><div class="adm-title adm-title--plain">' + esc(b.classGroup || b.classLabel || "—") + "<small>" + esc(b.subject || "No subject listed") + "</small></div></td>" +
        "<td>" + money(b.officialPrice) + "</td><td>" + (b.storePrice == null ? '<span class="adm-muted">Not set</span>' : "<strong>" + money(b.storePrice) + "</strong>") + "</td>" +
        '<td><select class="adm-select-sm" data-avail="' + b.dbId + '" aria-label="Availability of ' + esc(b.title) + '">' +
        AVAIL.map(function (a) { return '<option value="' + a[0] + '"' + (b.availability === a[0] ? " selected" : "") + ">" + a[1] + "</option>"; }).join("") + "</select></td>" +
        '<td><button type="button" class="adm-icon-btn adm-star' + (b.featured ? " is-on" : "") + '" data-act="toggle-featured" data-id="' + b.dbId + '" aria-pressed="' + (b.featured ? "true" : "false") + '" title="' + (b.featured ? "Remove from featured" : "Feature on homepage") + '">' + icon("star") + "</button></td>" +
        '<td class="adm-row-actions"><button type="button" class="adm-icon-btn" data-act="edit-book" data-id="' + b.dbId + '" title="Edit" aria-label="Edit ' + esc(b.title) + '">' + icon("edit") + "</button>" +
        '<a class="adm-icon-btn" href="book.html?id=' + encodeURIComponent(b.id) + '" target="_blank" rel="noopener" title="View on website" aria-label="View ' + esc(b.title) + ' on the website">' + icon("external") + "</a>" +
        '<button type="button" class="adm-icon-btn adm-icon-btn--danger" data-act="delete-book" data-id="' + b.dbId + '" title="Delete" aria-label="Delete ' + esc(b.title) + '">' + icon("trash") + "</button></td></tr>"
      );
    });
    holder.innerHTML =
      '<div class="adm-table-wrap"><table class="adm-table"><thead><tr><th>Cover</th><th>Title</th><th>Class / Subject</th><th>List price</th><th>Store price</th><th>Availability</th><th>Featured</th><th>Actions</th></tr></thead><tbody>' +
      (rows.length ? rows.join("") : '<tr><td colspan="8" class="adm-empty">No books match your search.</td></tr>') +
      "</tbody></table></div>" +
      '<div class="adm-pager"><span>' + list.length + " of " + state.books.length + " entries · page " + state.page + " of " + pages + "</span>" +
      '<span class="adm-actions"><button type="button" class="btn btn--ghost btn--sm" data-act="page" data-dir="-1"' + (state.page <= 1 ? " disabled" : "") + ">Previous</button>" +
      '<button type="button" class="btn btn--ghost btn--sm" data-act="page" data-dir="1"' + (state.page >= pages ? " disabled" : "") + ">Next</button></span></div>";
  }

  views.books = function () {
    content.innerHTML = card("", "",
      '<div class="adm-toolbar">' +
        '<div class="field"><label for="b-q">Search</label><input id="b-q" type="search" placeholder="Title, ISBN, series or subject" value="' + esc(state.q) + '"></div>' +
        '<div class="field"><label for="b-pub">Publisher</label><select id="b-pub"><option value="">All publishers</option>' +
        state.publishers.map(function (p) { return '<option value="' + esc(p.slug) + '"' + (state.pub === p.slug ? " selected" : "") + ">" + esc(p.name) + "</option>"; }).join("") + "</select></div>" +
        '<div class="field"><label for="b-avail">Availability</label><select id="b-avail"><option value="">Any</option>' +
        AVAIL.map(function (a) { return '<option value="' + a[0] + '"' + (state.avail === a[0] ? " selected" : "") + ">" + a[1] + "</option>"; }).join("") + "</select></div>" +
        '<button type="button" class="btn btn--primary" data-act="add-book">' + icon("plus") + " Add book</button>" +
      "</div><div id=\"b-table\"></div>");
    $("#b-q").addEventListener("input", function (e) { state.q = e.target.value; state.page = 1; drawBooks(); });
    $("#b-pub").addEventListener("change", function (e) { state.pub = e.target.value; state.page = 1; drawBooks(); });
    $("#b-avail").addEventListener("change", function (e) { state.avail = e.target.value; state.page = 1; drawBooks(); });
    drawBooks();
  };

  var BOOK_FIELDS = ["title", "kind", "publisher", "classLabel", "classGroup", "subject", "series", "edition", "isbn", "language", "author", "binding", "officialPrice", "officialPriceLabel", "storePrice", "availability", "coverUrl", "sourceUrl", "description", "featured"];

  function openBookForm(book) {
    var b = book || { kind: "book", publisher: state.publishers[0] ? state.publishers[0].slug : "", availability: "unverified", featured: false };
    var select = function (name, options, value) {
      return '<select name="' + name + '">' + options.map(function (o) { return '<option value="' + esc(o[0]) + '"' + (o[0] === value ? " selected" : "") + ">" + esc(o[1]) + "</option>"; }).join("") + "</select>";
    };
    openModal(book ? "Edit book" : "Add a book",
      '<form class="adm-form" id="book-form" novalidate>' +
        field("Book title", input("title", b.title, 'type="text" required maxlength="300"')) +
        '<div class="adm-grid-3">' +
          field("Publisher", select("publisher", state.publishers.map(function (p) { return [p.slug, p.name]; }), b.publisher)) +
          field("Entry type", select("kind", [["book", "Individual book"], ["series", "Series"]], b.kind)) +
          field("Availability at our store", select("availability", AVAIL, b.availability)) +
        "</div>" +
        '<div class="adm-grid-2">' +
          field("Class / level (as shown)", input("classLabel", b.classLabel, 'type="text" list="dl-label" maxlength="80"'), "For example: Class 3") +
          field("Class group (for filters)", input("classGroup", b.classGroup, 'type="text" list="dl-group" maxlength="80"'), "Leave empty to use the class above.") +
          field("Subject", input("subject", b.subject, 'type="text" list="dl-subject" maxlength="80"')) +
          field("Series", input("series", b.series, 'type="text" list="dl-series" maxlength="160"')) +
          field("Edition", input("edition", b.edition, 'type="text" maxlength="120"')) +
          field("ISBN", input("isbn", b.isbn, 'type="text" inputmode="numeric" maxlength="40"')) +
          field("Language", input("language", b.language, 'type="text" list="dl-language" maxlength="40"')) +
          field("Author(s)", input("author", b.author, 'type="text" maxlength="300"')) +
        "</div>" +
        '<div class="adm-grid-3">' +
          field("Publisher list price (PKR)", input("officialPrice", b.officialPrice, 'type="number" min="0" step="1" inputmode="numeric"'), "The publisher's own price.") +
          field("Our store price (PKR)", input("storePrice", b.storePrice, 'type="number" min="0" step="1" inputmode="numeric"'), "Shown as “Our price” on the website.") +
          field("Binding", input("binding", b.binding, 'type="text" maxlength="60"')) +
        "</div>" +
        field("List price label", input("officialPriceLabel", b.officialPriceLabel, 'type="text" maxlength="120"'), "For example: Recommended retail price (OUP Pakistan)") +
        '<div class="adm-upload">' +
          '<img class="adm-upload__preview" id="bf-preview" alt="" referrerpolicy="no-referrer"' + (b.coverUrl ? ' src="' + esc(b.coverUrl) + '"' : "") + ">" +
          "<div>" + field("Cover image link", input("coverUrl", b.coverUrl, 'type="text" maxlength="600" placeholder="https://… or upload an image"')) +
          '<div class="adm-actions" style="margin-top:10px"><label class="btn btn--ghost btn--sm">' + icon("image") + ' Upload cover<input type="file" id="bf-file" accept="image/png,image/jpeg,image/webp" hidden></label><span class="field__hint">JPG, PNG or WebP, up to 3 MB. Only upload covers you are allowed to use.</span></div></div>' +
        "</div>" +
        field("Official publisher page", input("sourceUrl", b.sourceUrl, 'type="url" maxlength="600" placeholder="https://…"')) +
        '<div class="field"><label>Description<textarea name="description" maxlength="4000" rows="5">' + esc(b.description || "") + "</textarea></label></div>" +
        '<label class="check"><input type="checkbox" name="featured"' + (b.featured ? " checked" : "") + "> Feature this book on the homepage</label>" +
        '<div class="form-msg" id="bf-error" role="alert" hidden></div>' +
        '<div class="adm-actions"><button type="submit" class="btn btn--primary">' + (book ? "Save changes" : "Add book") + '</button><button type="button" class="btn btn--ghost" data-act="close-modal">Cancel</button></div>' +
        datalist("dl-label", unique("classLabel")) + datalist("dl-group", unique("classGroup")) + datalist("dl-subject", unique("subject")) +
        datalist("dl-series", unique("series")) + datalist("dl-language", unique("language")) +
      "</form>");

    var form = $("#book-form");
    var error = $("#bf-error");
    form.elements.coverUrl.addEventListener("input", function (e) { $("#bf-preview").src = e.target.value; });
    $("#bf-file").addEventListener("change", function (e) {
      var file = e.target.files[0];
      if (!file) return;
      toast("Uploading image…");
      uploadImage(file)
        .then(function (url) {
          form.elements.coverUrl.value = url;
          $("#bf-preview").src = url;
          toast("Cover uploaded — remember to save.");
        })
        .catch(fail);
    });

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var values = {};
      BOOK_FIELDS.forEach(function (name) {
        var elx = form.elements[name];
        if (!elx) return;
        if (elx.type === "checkbox") values[name] = elx.checked;
        else if (elx.type === "number") values[name] = elx.value === "" ? null : Number(elx.value);
        else values[name] = elx.value.trim();
      });
      if (!values.title) {
        error.textContent = "Please enter the book title.";
        error.hidden = false;
        return;
      }
      var payload = values;
      if (book) {
        payload = {};
        BOOK_FIELDS.forEach(function (name) {
          var before = book[name] == null ? (typeof values[name] === "string" ? "" : null) : book[name];
          if (values[name] !== before) payload[name] = values[name];
        });
        if (!Object.keys(payload).length) {
          closeModal();
          return;
        }
      }
      error.hidden = true;
      var button = form.querySelector("button[type=submit]");
      button.disabled = true;
      api(book ? "admin/books/" + book.dbId : "admin/books", { method: book ? "PUT" : "POST", body: payload })
        .then(function (d) {
          replaceBook(d.book);
          closeModal();
          toast(book ? "Book updated." : "Book added.");
          views[state.view]();
        })
        .catch(function (err) {
          button.disabled = false;
          error.textContent = err.message;
          error.hidden = false;
        });
    });
  }

  function patchBook(id, body, message) {
    return api("admin/books/" + id, { method: "PUT", body: body }).then(function (d) {
      replaceBook(d.book);
      toast(message);
      return d.book;
    });
  }

  /* ---------- Featured ---------- */
  views.featured = function () {
    var featured = state.books.filter(function (b) { return b.featured; });
    var line = function (b, action, label) {
      return '<li class="adm-line">' + thumb(b.thumbUrl || b.coverUrl) + '<div class="adm-title">' + esc(b.title) + "<small>" + esc(pubName(b.publisher)) + (b.classGroup ? " · " + esc(b.classGroup) : "") + "</small></div>" +
        '<button type="button" class="btn btn--ghost btn--sm" data-act="' + action + '" data-id="' + b.dbId + '">' + label + "</button></li>";
    };
    content.innerHTML =
      card("Featured on the homepage (" + featured.length + ")", "These books appear in the “Featured Books” section. The homepage shows up to 12.",
        '<ul class="adm-lines">' + (featured.length ? featured.map(function (b) { return line(b, "unfeature", "Remove"); }).join("") : '<li class="adm-empty">No featured books yet.</li>') + "</ul>") +
      card("Add a featured book", "Search the catalogue and press “Feature”.",
        '<div class="field"><label for="ft-q">Find a book</label><input id="ft-q" type="search" placeholder="Type a title, series or ISBN"></div><ul class="adm-lines" id="ft-results" style="margin-top:14px"></ul>');
    var results = $("#ft-results");
    var draw = function (q) {
      var terms = q.toLowerCase().split(/\s+/).filter(Boolean);
      if (!terms.length) {
        results.innerHTML = '<li class="adm-empty">Start typing to search.</li>';
        return;
      }
      var found = state.books.filter(function (b) {
        if (b.featured) return false;
        var hay = [b.title, b.isbn, b.series].join(" ").toLowerCase();
        return terms.every(function (t) { return hay.indexOf(t) !== -1; });
      }).slice(0, 12);
      results.innerHTML = found.length ? found.map(function (b) { return line(b, "feature", "Feature"); }).join("") : '<li class="adm-empty">No matching books.</li>';
    };
    $("#ft-q").addEventListener("input", function (e) { draw(e.target.value); });
    draw("");
  };

  /* ---------- Publishers ---------- */
  views.publishers = function () {
    content.innerHTML =
      '<div class="adm-note">' + icon("info") + "<p>The catalogue is limited to these three publishers. You can edit their details here; publishers cannot be added or removed.</p></div>" +
      state.publishers.map(function (p) {
        return card(p.name, p.bookCount + " catalogue entries",
          '<form class="adm-form" data-publisher-form="' + p.dbId + '" novalidate>' +
            '<div class="adm-grid-3">' + field("Publisher name", input("name", p.name, 'type="text" required maxlength="120"')) +
              field("Short name", input("shortName", p.shortName, 'type="text" maxlength="40"')) + field("Location", input("location", p.location, 'type="text" maxlength="120"')) + "</div>" +
            '<div class="adm-grid-2">' + field("Official website", input("website", p.website, 'type="url" maxlength="600"')) +
              field("Official catalogue page", input("catalogueUrl", p.catalogueUrl, 'type="url" maxlength="600"')) + "</div>" +
            '<div class="field"><label>Description<textarea name="description" rows="3" maxlength="1200">' + esc(p.description) + "</textarea></label></div>" +
            '<div class="field"><label>Source note (shown on the publisher page)<textarea name="catalogueNote" rows="3" maxlength="1200">' + esc(p.catalogueNote) + "</textarea></label></div>" +
            '<div class="adm-upload">' + (p.logoUrl ? '<img class="adm-upload__preview adm-upload__preview--logo" src="' + esc(p.logoUrl) + '" alt="">' : '<span class="adm-upload__preview adm-upload__preview--logo"></span>') +
              "<div>" + field("Publisher logo link", input("logoUrl", p.logoUrl, 'type="text" maxlength="600" placeholder="Empty = no logo shown"')) +
              '<div class="adm-actions" style="margin-top:10px"><label class="btn btn--ghost btn--sm">' + icon("image") + ' Upload logo<input type="file" data-logo-file accept="image/png,image/jpeg,image/webp" hidden></label><span class="field__hint">Only use a publisher\'s logo if the publisher has authorised it.</span></div></div></div>' +
            '<div class="adm-actions"><button type="submit" class="btn btn--primary btn--sm">Save ' + esc(p.shortName || "publisher") + "</button></div>" +
          "</form>");
      }).join("");
  };

  function savePublisher(form) {
    var id = Number(form.getAttribute("data-publisher-form"));
    var body = {};
    ["name", "shortName", "location", "website", "catalogueUrl", "description", "catalogueNote", "logoUrl"].forEach(function (name) {
      body[name] = form.elements[name].value.trim();
    });
    var button = form.querySelector("button[type=submit]");
    button.disabled = true;
    api("admin/publishers/" + id, { method: "PUT", body: body })
      .then(function (d) {
        state.publishers = state.publishers.map(function (p) {
          if (p.dbId !== id) return p;
          d.publisher.bookCount = p.bookCount;
          return d.publisher;
        });
        toast("Publisher saved.");
        views.publishers();
      })
      .catch(function (err) {
        button.disabled = false;
        fail(err);
      });
  }

  /* ---------- Settings helpers ---------- */
  function saveSite(patch, section, message) {
    return api("admin/settings", { method: "PUT", body: { site: patch, section: section } }).then(function (d) {
      state.site = d.site;
      toast(message);
    });
  }

  /* ---------- Homepage slider ---------- */
  views.slider = function () {
    if (!draft) draft = JSON.parse(JSON.stringify(state.site.slides || []));
    content.innerHTML =
      card("Homepage slider", "Large banners at the top of the homepage. Each slide needs an image and a heading. Recommended image size: 1920 × 1080 px.",
        '<div class="adm-stack">' +
          draft.map(function (s, i) {
            return '<div class="adm-slide" data-slide="' + i + '">' +
              '<div><img class="adm-slide__img" src="' + esc(s.image) + '" alt="">' +
              '<div class="adm-actions" style="margin-top:10px"><label class="btn btn--ghost btn--sm">' + icon("image") + ' Upload image<input type="file" data-slide-file accept="image/png,image/jpeg,image/webp" hidden></label></div></div>' +
              '<div class="adm-form">' +
                '<div class="adm-grid-2">' + field("Small heading", input("eyebrow", s.eyebrow, 'type="text" maxlength="80"')) + field("Main heading", input("title", s.title, 'type="text" maxlength="120"')) + "</div>" +
                '<div class="field"><label>Text<textarea name="text" rows="2" maxlength="320">' + esc(s.text) + "</textarea></label></div>" +
                '<div class="adm-grid-3">' + field("Button label", input("ctaLabel", s.ctaLabel, 'type="text" maxlength="40"')) + field("Button link", input("ctaHref", s.ctaHref, 'type="text" maxlength="300" placeholder="books.html"')) +
                  field("Image link", input("image", s.image, 'type="text" maxlength="600"')) + "</div>" +
                '<div class="adm-actions"><button type="button" class="btn btn--ghost btn--sm" data-act="slide-move" data-dir="-1"' + (i === 0 ? " disabled" : "") + ">Move up</button>" +
                  '<button type="button" class="btn btn--ghost btn--sm" data-act="slide-move" data-dir="1"' + (i === draft.length - 1 ? " disabled" : "") + ">Move down</button>" +
                  '<button type="button" class="btn btn--ghost btn--sm" data-act="slide-remove"' + (draft.length <= 1 ? " disabled" : "") + ">" + icon("trash") + " Remove</button></div>" +
              "</div></div>";
          }).join("") +
        "</div>" +
        '<div class="adm-actions" style="margin-top:20px"><button type="button" class="btn btn--primary" data-act="slider-save">Save slider</button>' +
        '<button type="button" class="btn btn--ghost" data-act="slide-add"' + (draft.length >= 8 ? " disabled" : "") + ">" + icon("plus") + " Add slide</button></div>");
  };

  /* ---------- Website content ---------- */
  views.content = function () {
    var s = state.site;
    content.innerHTML =
      '<form class="adm-stack" id="content-form" novalidate>' +
        card("Announcement and brand", "Shown in the bar at the very top of every page, and in the header and footer.",
          '<div class="adm-form">' + field("Top announcement bar", input("announcement", s.announcement, 'type="text" maxlength="220"'), "Leave empty to keep the bar minimal.") +
            '<div class="adm-grid-2">' + field("Store name", input("name", s.name, 'type="text" maxlength="80"')) + field("Slogan", input("slogan", s.slogan, 'type="text" maxlength="120"')) + "</div>" +
            field("Urdu tagline", input("urduTagline", s.urduTagline, 'type="text" maxlength="160" dir="rtl" lang="ur" class="urdu"')) + "</div>") +
        card("Contact details and opening hours", "Used across the website, in the WhatsApp buttons and on the map.",
          '<div class="adm-form"><div class="adm-grid-2">' +
            field("WhatsApp number (digits, with country code)", input("whatsapp", s.whatsapp, 'type="text" inputmode="numeric" maxlength="20"'), "Example: 923339230528") +
            field("WhatsApp number as displayed", input("whatsappDisplay", s.whatsappDisplay, 'type="text" maxlength="30"')) +
            field("Opening hours", input("hours", s.hours, 'type="text" maxlength="120"')) +
            field("Address", input("address", s.address, 'type="text" maxlength="200"')) + "</div>" +
            field("Google Maps search text", input("mapQuery", s.mapQuery, 'type="text" maxlength="200"'), "The map and the Directions button search Google Maps for this text.") + "</div>") +
        card("About text", "The introduction on the About Us page.",
          '<div class="field"><label>About Memon Book Store<textarea name="aboutText" rows="6" maxlength="2000">' + esc(s.aboutText) + "</textarea></label></div>") +
        '<div class="adm-actions"><button type="submit" class="btn btn--primary">Save website content</button></div>' +
      "</form>";
  };

  /* ---------- Stationery ---------- */
  views.stationery = function () {
    if (!draft) draft = JSON.parse(JSON.stringify(state.site.stationery || []));
    content.innerHTML = card("Stationery categories", "Shown on the homepage and the Stationery page. Each one gets its own WhatsApp enquiry button.",
      '<div class="adm-stack" id="st-rows">' +
        (draft.length
          ? draft.map(function (s, i) {
              return '<div class="adm-list-row" data-st="' + i + '"><input name="name" aria-label="Category name" value="' + esc(s.name) + '" maxlength="80" placeholder="Category name">' +
                '<input name="note" aria-label="Short description" value="' + esc(s.note) + '" maxlength="200" placeholder="Short description">' +
                '<button type="button" class="adm-icon-btn adm-icon-btn--danger" data-act="st-remove" aria-label="Remove ' + esc(s.name) + '">' + icon("trash") + "</button></div>";
            }).join("")
          : '<p class="adm-empty">No categories yet.</p>') +
      "</div>" +
      '<div class="adm-actions" style="margin-top:20px"><button type="button" class="btn btn--primary" data-act="st-save">Save stationery</button>' +
      '<button type="button" class="btn btn--ghost" data-act="st-add">' + icon("plus") + " Add category</button></div>");
  };

  /* ---------- Account ---------- */
  views.account = function () {
    content.innerHTML =
      '<div class="adm-cols">' +
      card("Change password", "Signed in as <strong>" + esc(state.user) + "</strong>. Changing your password signs out every other device.",
        '<form class="adm-form" id="password-form" novalidate>' +
          field("Current password", '<input name="current" type="password" autocomplete="current-password" required>') +
          field("New password", '<input name="next" type="password" autocomplete="new-password" required>', "At least 10 characters, with a letter and a number.") +
          field("Repeat new password", '<input name="repeat" type="password" autocomplete="new-password" required>') +
          '<div class="form-msg" id="pw-msg" role="alert" hidden></div>' +
          '<div class="adm-actions"><button type="submit" class="btn btn--primary">Change password</button></div></form>') +
      '<div class="adm-stack">' +
      card("Sessions", "You stay signed in on this device for up to 12 hours.",
        '<div class="adm-actions"><button type="button" class="btn btn--ghost btn--sm" data-act="logout-others">Sign out other devices</button>' +
        '<button type="button" class="btn btn--navy btn--sm" data-act="logout">' + icon("logout") + " Log out</button></div>") +
      card("How your account is protected", "",
        '<ul class="adm-bullets"><li>Your password is never stored — only a salted scrypt hash is kept in the database.</li>' +
        "<li>The login session lives in an HttpOnly cookie that page scripts cannot read.</li>" +
        "<li>Repeated wrong passwords are temporarily blocked.</li>" +
        "<li>No password or secret exists in the website's HTML or JavaScript files.</li></ul>") +
      "</div></div>";
  };

  /* ------------------------------------------------------------------ */
  /* Events                                                              */
  /* ------------------------------------------------------------------ */
  function syncSlideDraft() {
    if (state.view !== "slider" || !draft) return;
    $$("[data-slide]", content).forEach(function (row) {
      var s = draft[Number(row.getAttribute("data-slide"))];
      if (!s) return;
      ["eyebrow", "title", "text", "ctaLabel", "ctaHref", "image"].forEach(function (name) {
        var elx = row.querySelector('[name="' + name + '"]');
        if (elx) s[name] = elx.value.trim();
      });
    });
  }
  function syncStationeryDraft() {
    if (state.view !== "stationery" || !draft) return;
    $$("[data-st]", content).forEach(function (row) {
      var s = draft[Number(row.getAttribute("data-st"))];
      if (!s) return;
      s.name = row.querySelector('[name="name"]').value.trim();
      s.note = row.querySelector('[name="note"]').value.trim();
    });
  }

  function onClick(e) {
    var go = e.target.closest("[data-go]");
    if (go) {
      e.preventDefault();
      show(go.getAttribute("data-go"));
      return;
    }
    var btn = e.target.closest("[data-act]");
    if (!btn) return;
    var act = btn.getAttribute("data-act");
    var id = Number(btn.getAttribute("data-id"));
    var book = id ? bookById(id) : null;

    if (act === "add-book") openBookForm(null);
    else if (act === "edit-book" && book) openBookForm(book);
    else if (act === "close-modal") closeModal();
    else if (act === "delete-book" && book) {
      if (!window.confirm("Delete “" + book.title + "” from the catalogue? This cannot be undone.")) return;
      api("admin/books/" + id, { method: "DELETE" })
        .then(function () {
          state.books = state.books.filter(function (b) { return b.dbId !== id; });
          toast("Book deleted.");
          drawBooks();
        })
        .catch(fail);
    } else if ((act === "toggle-featured" || act === "feature" || act === "unfeature") && book) {
      var next = act === "feature" ? true : act === "unfeature" ? false : !book.featured;
      patchBook(id, { featured: next }, next ? "Featured on the homepage." : "Removed from featured.")
        .then(function () {
          if (state.view === "featured") views.featured();
          else drawBooks();
        })
        .catch(fail);
    } else if (act === "page") {
      state.page += Number(btn.getAttribute("data-dir"));
      drawBooks();
    } else if (act === "slide-add") {
      syncSlideDraft();
      draft.push({ image: "assets/images/hero-books.jpg", eyebrow: "", title: "New slide", text: "", ctaLabel: "Browse All Books", ctaHref: "books.html" });
      views.slider();
    } else if (act === "slide-remove" || act === "slide-move") {
      syncSlideDraft();
      var index = Number(btn.closest("[data-slide]").getAttribute("data-slide"));
      if (act === "slide-remove") draft.splice(index, 1);
      else {
        var to = index + Number(btn.getAttribute("data-dir"));
        if (to >= 0 && to < draft.length) draft.splice(to, 0, draft.splice(index, 1)[0]);
      }
      views.slider();
    } else if (act === "slider-save") {
      syncSlideDraft();
      if (draft.some(function (s) { return !s.image || !s.title; })) {
        toast("Every slide needs an image and a main heading.", true);
        return;
      }
      btn.disabled = true;
      saveSite({ slides: draft }, "Homepage slider", "Slider saved.")
        .then(function () { draft = null; views.slider(); })
        .catch(function (err) { btn.disabled = false; fail(err); });
    } else if (act === "st-add") {
      syncStationeryDraft();
      draft.push({ name: "", note: "" });
      views.stationery();
      var inputs = $$('#st-rows [name="name"]');
      if (inputs.length) inputs[inputs.length - 1].focus();
    } else if (act === "st-remove") {
      syncStationeryDraft();
      draft.splice(Number(btn.closest("[data-st]").getAttribute("data-st")), 1);
      views.stationery();
    } else if (act === "st-save") {
      syncStationeryDraft();
      btn.disabled = true;
      saveSite({ stationery: draft.filter(function (s) { return s.name; }) }, "Stationery", "Stationery saved.")
        .then(function () { draft = null; views.stationery(); })
        .catch(function (err) { btn.disabled = false; fail(err); });
    } else if (act === "logout-others") {
      api("auth/logout-others", { method: "POST", body: {} })
        .then(function (d) { toast(d.removed ? d.removed + " other session(s) signed out." : "No other devices were signed in."); })
        .catch(fail);
    } else if (act === "logout") logout();
  }

  function onChange(e) {
    var t = e.target;
    if (t.hasAttribute("data-avail")) {
      var id = Number(t.getAttribute("data-avail"));
      patchBook(id, { availability: t.value }, "Availability updated.").catch(function (err) {
        fail(err);
        drawBooks();
      });
    } else if (t.hasAttribute("data-slide-file") && t.files[0]) {
      syncSlideDraft();
      var index = Number(t.closest("[data-slide]").getAttribute("data-slide"));
      toast("Uploading image…");
      uploadImage(t.files[0])
        .then(function (url) {
          draft[index].image = url;
          views.slider();
          toast("Image uploaded — remember to save the slider.");
        })
        .catch(fail);
    } else if (t.hasAttribute("data-logo-file") && t.files[0]) {
      var form = t.closest("form");
      toast("Uploading logo…");
      uploadImage(t.files[0])
        .then(function (url) {
          form.elements.logoUrl.value = url;
          toast("Logo uploaded — press Save to apply.");
        })
        .catch(fail);
    }
  }

  function onSubmit(e) {
    var form = e.target;
    if (form.hasAttribute("data-publisher-form")) {
      e.preventDefault();
      savePublisher(form);
    } else if (form.id === "content-form") {
      e.preventDefault();
      var patch = {};
      ["announcement", "name", "slogan", "urduTagline", "whatsapp", "whatsappDisplay", "hours", "address", "mapQuery", "aboutText"].forEach(function (name) {
        patch[name] = form.elements[name].value.trim();
      });
      var digits = patch.whatsapp.replace(/\D/g, "");
      if (digits.length < 8 || digits.length > 15) {
        toast("Enter the WhatsApp number with country code, digits only (for example 923339230528).", true);
        return;
      }
      patch.whatsapp = digits;
      var button = form.querySelector("button[type=submit]");
      button.disabled = true;
      saveSite(patch, "Contact details and content", "Website content saved.")
        .then(function () { views.content(); })
        .catch(function (err) { button.disabled = false; fail(err); });
    } else if (form.id === "password-form") {
      e.preventDefault();
      var msg = $("#pw-msg");
      var show = function (text, ok) {
        msg.textContent = text;
        msg.className = "form-msg" + (ok ? " form-msg--ok" : "");
        msg.hidden = false;
      };
      if (form.elements.next.value !== form.elements.repeat.value) {
        show("The two new passwords do not match.");
        return;
      }
      var submit = form.querySelector("button[type=submit]");
      submit.disabled = true;
      api("auth/password", { method: "POST", body: { currentPassword: form.elements.current.value, newPassword: form.elements.next.value } })
        .then(function () {
          form.reset();
          submit.disabled = false;
          show("Your password has been changed.", true);
        })
        .catch(function (err) {
          submit.disabled = false;
          show(err.message);
        });
    }
  }

  function logout() {
    api("auth/logout", { method: "POST", body: {} })
      .catch(function () { /* go to login either way */ })
      .then(function () { location.href = "login.html"; });
  }

  function bindShell() {
    $$(".adm-nav button").forEach(function (b) {
      b.addEventListener("click", function () { show(b.getAttribute("data-view")); });
    });
    $("#adm-logout").addEventListener("click", logout);
    $("#adm-menu").addEventListener("click", function () { document.body.classList.toggle("adm-open"); });
    $("#adm-backdrop").addEventListener("click", function () { document.body.classList.remove("adm-open"); });
    $("#adm-modal-close").addEventListener("click", closeModal);
    modal.addEventListener("mousedown", function (e) { if (e.target === modal) closeModal(); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape" && !modal.hidden) closeModal(); });
    document.addEventListener("click", onClick);
    document.addEventListener("change", onChange);
    document.addEventListener("submit", onSubmit);
  }

  /* ------------------------------------------------------------------ */
  /* Start                                                               */
  /* ------------------------------------------------------------------ */
  function bootError(message) {
    $("#adm-loading").innerHTML =
      '<img src="assets/logo/logo-mark.svg" width="64" height="64" alt=""><p>' + esc(message) + '</p><p><a class="btn btn--primary btn--sm" href="admin.html">Try again</a> <a class="btn btn--ghost btn--sm" href="index.html">Back to website</a></p>';
  }

  var cfg = window.MBS_CONFIG || {};
  var staticHost = cfg.staticOnly || location.protocol === "file:" || /(^|\.)github\.io$/i.test(location.hostname);

  (staticHost
    ? Promise.resolve(null)
    : fetch("api/auth/status", { credentials: "same-origin", headers: { Accept: "application/json" } })
        .then(function (res) { return res.ok ? res.json() : null; })
        .catch(function () { return null; })
  )
    .then(function (status) {
      if (!status || status.backend !== true || !status.authenticated) {
        location.replace("login.html");
        return;
      }
      state.user = status.username || "admin";
      return Promise.all([api("admin/books"), api("admin/publishers"), api("admin/settings")])
        .then(function (res) {
          state.books = res[0].books;
          state.publishers = res[1].publishers;
          state.site = res[2].site;
          $("#adm-loading").hidden = true;
          $("#adm").hidden = false;
          $("#adm-user").innerHTML = icon("user") + "<span>" + esc(state.user) + "</span>";
          bindShell();
          show(location.hash.slice(1));
        })
        .catch(function (error) { bootError(error.message || "The admin panel could not be loaded."); });
    });
})();
