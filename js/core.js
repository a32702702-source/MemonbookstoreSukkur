/* Memon Book Store — shared front-end core: data loading, helpers, header behaviour. */
(function () {
  "use strict";

  var cfg = window.MBS_CONFIG || {};
  var ICONS = window.MBS_ICONS || {};
  var MBS = (window.MBS = { mode: "static", data: null, site: null });

  /* ------------------------------------------------------------------ */
  /* Small helpers                                                       */
  /* ------------------------------------------------------------------ */
  var ESC = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
  var esc = (MBS.esc = function (value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (c) {
      return ESC[c];
    });
  });
  var icon = (MBS.icon = function (name) {
    return ICONS[name] || "";
  });
  MBS.$ = function (sel, root) {
    return (root || document).querySelector(sel);
  };
  MBS.$$ = function (sel, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(sel));
  };
  MBS.apiUrl = function (path) {
    var base = String(cfg.apiBase || "").replace(/\/+$/, "");
    return base ? base + "/" + path : path;
  };
  /** Uploaded images live on the backend; everything else is used as given. */
  MBS.asset = function (url) {
    if (!url) return "";
    return /^api\//.test(url) ? MBS.apiUrl(url) : url;
  };
  MBS.formatPrice = function (amount) {
    return "PKR " + Number(amount).toLocaleString("en-US");
  };
  MBS.param = function (name) {
    return new URLSearchParams(location.search).get(name) || "";
  };
  MBS.bookUrl = function (book) {
    return "book.html?id=" + encodeURIComponent(book.id);
  };
  MBS.listUrl = function (filters) {
    var q = new URLSearchParams();
    Object.keys(filters || {}).forEach(function (key) {
      if (filters[key]) q.set(key, filters[key]);
    });
    var s = q.toString();
    return "books.html" + (s ? "?" + s : "");
  };

  /* ------------------------------------------------------------------ */
  /* Classes, subjects                                                   */
  /* ------------------------------------------------------------------ */
  var CLASS_ORDER = [
    "Early Years", "Pre-Nursery", "Nursery", "Kindergarten", "Pre-Primary", "Primary",
    "Class 1", "Class 2", "Class 3", "Class 4", "Class 5", "Class 6", "Class 7", "Class 8", "Class 9", "Class 10",
    "O Level", "IGCSE", "A Level", "Multiple levels",
  ];
  MBS.classRank = function (group) {
    var i = CLASS_ORDER.indexOf(group);
    return i === -1 ? 500 : i;
  };
  MBS.classShort = function (group) {
    var m = /^Class (\d+)$/.exec(group);
    if (m) return m[1];
    var map = { "Pre-Nursery": "PN", Nursery: "N", Kindergarten: "KG", "Pre-Primary": "PP", "O Level": "O", IGCSE: "IG", "Early Years": "EY", Primary: "P", "Multiple levels": "All" };
    return map[group] || group.charAt(0);
  };
  var SUBJECT_ICONS = {
    Mathematics: "calc", English: "abc", Urdu: "pen", Science: "flask", "Computer Science": "monitor",
    Islamiyat: "moon", "Social Studies": "globe", Geography: "globe", Handwriting: "edit",
  };
  MBS.subjectIcon = function (subject) {
    return icon(SUBJECT_ICONS[subject] || "book");
  };

  /** [{ name, count, books }] grouped by a field, optionally in class order. */
  MBS.groupBy = function (books, key, classOrder) {
    var map = {};
    books.forEach(function (b) {
      var name = b[key];
      if (!name) return;
      (map[name] = map[name] || []).push(b);
    });
    var out = Object.keys(map).map(function (name) {
      return { name: name, count: map[name].length, books: map[name] };
    });
    out.sort(function (a, b) {
      if (classOrder) return MBS.classRank(a.name) - MBS.classRank(b.name) || a.name.localeCompare(b.name);
      return b.count - a.count || a.name.localeCompare(b.name);
    });
    return out;
  };

  MBS.sortBooks = function (list) {
    return list.slice().sort(function (a, b) {
      return (
        MBS.classRank(a.classGroup) - MBS.classRank(b.classGroup) ||
        a.title.localeCompare(b.title, undefined, { numeric: true })
      );
    });
  };

  /* ------------------------------------------------------------------ */
  /* WhatsApp                                                            */
  /* ------------------------------------------------------------------ */
  MBS.wa = function (text) {
    var number = String((MBS.site && MBS.site.whatsapp) || cfg.whatsapp || "923339230528").replace(/\D/g, "");
    return "https://wa.me/" + number + "?text=" + encodeURIComponent(text);
  };
  MBS.waText = {
    general: "Hello Memon Book Store, I have an enquiry.",
    stationery: "Hello Memon Book Store, I would like to ask about stationery.",
    publisher: function (name) {
      return "Hello Memon Book Store, I would like to ask about books from " + name + ".";
    },
    item: function (name) {
      return "Hello Memon Book Store, I would like to ask about: " + name + ". Is it available, and what is the price?";
    },
  };
  MBS.waBook = function (book) {
    var pub = book._pub ? book._pub.name : "";
    var lines = ["Hello Memon Book Store, I would like to ask about this " + (book.kind === "series" ? "series" : "book") + ":", "", "*" + book.title + "*"];
    if (pub) lines.push("Publisher: " + pub);
    if (book.classLabel) lines.push("Class: " + book.classLabel);
    if (book.isbn) lines.push("ISBN: " + book.isbn);
    lines.push("", "Is it available, and what is your price?");
    return MBS.wa(lines.join("\n"));
  };
  function bindWhatsApp(root) {
    MBS.$$("[data-wa]", root).forEach(function (el) {
      var kind = el.getAttribute("data-wa");
      var name = el.getAttribute("data-wa-name") || "";
      var text = MBS.waText.general;
      if (kind === "stationery") text = MBS.waText.stationery;
      else if (kind === "publisher" && name) text = MBS.waText.publisher(name);
      else if (kind === "item" && name) text = MBS.waText.item(name);
      el.setAttribute("href", MBS.wa(text));
    });
  }
  MBS.bindWhatsApp = bindWhatsApp;

  /* ------------------------------------------------------------------ */
  /* Rendering helpers                                                   */
  /* ------------------------------------------------------------------ */
  var TONES = { "javed-publishers": "burgundy", "moonlight-publishers": "navy", "oxford-university-press": "plum", "sindh-textbook-board": "emerald", "kips-publications": "navy", "quranic-islamic-studies": "emerald" };

  MBS.cover = function (book, large) {
    var src = MBS.asset(large ? book.coverUrl || book.thumbUrl : book.thumbUrl || book.coverUrl);
    var pub = book._pub || {};
    return (
      '<div class="cover' + (src ? "" : " is-missing") + '" data-tone="' + (TONES[book.publisher] || "burgundy") + '">' +
      '<div class="cover__fallback"><small>' + esc(pub.shortName || pub.name || "") + "</small><div><b>" + esc(book.title) +
      "</b><i></i><small>" + esc(book.classLabel || "") + "</small></div></div>" +
      (src
        ? '<img class="cover__img" src="' + esc(src) + '" alt="Cover of ' + esc(book.title) + '" loading="lazy" decoding="async" referrerpolicy="no-referrer">'
        : "") +
      "</div>"
    );
  };

  var AVAIL = {
    unverified: "Ask for availability",
    in_stock: "In stock at our store",
    on_order: "Available on order",
    out_of_stock: "Currently out of stock",
  };
  MBS.availLabel = function (book) {
    return AVAIL[book.availability] || AVAIL.unverified;
  };
  MBS.availHtml = function (book) {
    var key = AVAIL[book.availability] ? book.availability : "unverified";
    return '<span class="avail avail--' + key + '">' + esc(AVAIL[key]) + "</span>";
  };
  MBS.priceHtml = function (book) {
    if (book.storePrice != null) {
      return '<div class="price price--store"><span class="price__amount">' + MBS.formatPrice(book.storePrice) +
        '</span><span class="price__label">Our price</span></div>';
    }
    if (book.officialPrice != null) {
      return '<div class="price"><span class="price__amount">' + MBS.formatPrice(book.officialPrice) +
        '</span><span class="price__label">Publisher list price</span></div>';
    }
    return '<div class="price price--none"><span class="price__amount">Price on request</span></div>';
  };

  MBS.bookCard = function (book) {
    var pub = book._pub || {};
    var url = MBS.bookUrl(book);
    var chips = "";
    if (book.classGroup || book.classLabel) {
      chips += '<span class="chip">' + esc(book.classGroup && book.classGroup !== "Multiple levels" ? book.classGroup : book.classLabel) + "</span>";
    }
    if (book.subject) chips += '<span class="chip chip--subject">' + esc(book.subject) + "</span>";
    return (
      '<article class="book-card">' +
      (book.kind === "series" ? '<span class="book-card__flag">Series</span>' : "") +
      '<a class="book-card__cover" href="' + url + '" tabindex="-1" aria-hidden="true">' + MBS.cover(book) + "</a>" +
      '<div class="book-card__body">' +
      '<span class="book-card__pub">' + esc(pub.shortName || pub.name || "") + "</span>" +
      '<h3 class="book-card__title"><a href="' + url + '">' + esc(book.title) + "</a></h3>" +
      '<div class="chips">' + chips + "</div>" +
      '<div class="book-card__meta">' + MBS.priceHtml(book) + MBS.availHtml(book) + "</div>" +
      '<div class="book-card__actions"><a class="btn btn--primary btn--sm" href="' + url + '">View Details</a>' +
      '<a class="icon-btn icon-btn--wa" href="' + esc(MBS.waBook(book)) + '" target="_blank" rel="noopener" aria-label="Ask about ' +
      esc(book.title) + ' on WhatsApp" title="Ask on WhatsApp">' + icon("wa") + "</a></div>" +
      "</div></article>"
    );
  };

  MBS.emptyState = function (title, text) {
    return (
      '<div class="empty-state"><h3>' + esc(title) + "</h3><p>" + esc(text) + '</p><a class="btn btn--wa" target="_blank" rel="noopener" href="' +
      esc(MBS.wa(MBS.waText.general)) + '">' + icon("wa") + " Ask us on WhatsApp</a></div>"
    );
  };

  /** "Class 1 – Class 8" style range for a list of books. */
  MBS.classRange = function (books) {
    var groups = [];
    MBS.sortBooks(books).forEach(function (b) {
      if (b.classGroup && groups.indexOf(b.classGroup) === -1) groups.push(b.classGroup);
    });
    if (!groups.length) return "";
    return groups.length === 1 ? groups[0] : groups[0] + " – " + groups[groups.length - 1];
  };

  /** group: { name, books } */
  MBS.seriesCard = function (group) {
    var sorted = MBS.sortBooks(group.books);
    var first = sorted[0];
    var pub = first._pub || {};
    var single = sorted.length === 1 && first.kind === "series";
    var href = single ? MBS.bookUrl(first) : MBS.listUrl({ series: group.name });
    var prices = sorted
      .map(function (b) { return b.officialPrice; })
      .filter(function (p) { return p != null; });
    var meta = single
      ? esc(first.classLabel)
      : sorted.length + (sorted.length === 1 ? " title" : " titles") + (MBS.classRange(sorted) ? " · " + esc(MBS.classRange(sorted)) : "");
    if (prices.length) {
      var min = Math.min.apply(null, prices);
      var max = Math.max.apply(null, prices);
      meta += "<br>List price " + (min === max ? MBS.formatPrice(min) : MBS.formatPrice(min) + " – " + MBS.formatPrice(max));
    }
    return (
      '<a class="series-card reveal" href="' + href + '">' + MBS.cover(first) +
      '<div><span class="series-card__pub">' + esc(pub.shortName || pub.name || "") + "</span>" +
      '<h3 class="series-card__name">' + esc(group.name) + "</h3>" +
      '<p class="series-card__meta" style="margin:0">' + meta + "</p></div></a>"
    );
  };

  /** Fills the fanned cover previews and live counts on publisher cards. */
  MBS.enhancePublisherCards = function (data) {
    MBS.$$("[data-pub-covers]").forEach(function (el) {
      var slug = el.getAttribute("data-pub-covers");
      var list = MBS.sortBooks(
        data.books.filter(function (b) { return b.publisher === slug && (b.thumbUrl || b.coverUrl); })
      );
      if (!list.length) return;
      var picks = [list[0], list[Math.floor(list.length / 2)], list[list.length - 1]].filter(function (b, i, arr) {
        return arr.indexOf(b) === i;
      });
      el.innerHTML = picks.map(function (b) { return MBS.cover(b); }).join("");
    });
    MBS.$$("[data-pub-count]").forEach(function (el) {
      var slug = el.getAttribute("data-pub-count");
      el.textContent = String(data.books.filter(function (b) { return b.publisher === slug; }).length);
    });
  };

  // Show every cover in its own proportions (publishers use different cover shapes).
  document.addEventListener(
    "load",
    function (event) {
      var el = event.target;
      if (el && el.classList && el.classList.contains("cover__img") && el.naturalWidth > 0 && el.naturalHeight > 0 && el.parentNode) {
        var ratio = Math.min(1.25, Math.max(0.7, el.naturalWidth / el.naturalHeight));
        el.parentNode.style.setProperty("--ar", String(Math.round(ratio * 1000) / 1000));
        el.parentNode.classList.add("is-loaded");
      }
    },
    true
  );

  // Broken or blocked cover images fall back to the designed typographic cover.
  document.addEventListener(
    "error",
    function (event) {
      var el = event.target;
      if (el && el.classList && el.classList.contains("cover__img") && el.parentNode) {
        el.parentNode.classList.add("is-missing");
      }
    },
    true
  );

  /* ------------------------------------------------------------------ */
  /* Toast + lightbox                                                    */
  /* ------------------------------------------------------------------ */
  var toastTimer;
  MBS.toast = function (message) {
    var el = MBS.$("#toast");
    if (!el) {
      el = document.createElement("div");
      el.id = "toast";
      el.className = "toast";
      el.setAttribute("role", "status");
      document.body.appendChild(el);
    }
    el.textContent = message;
    el.classList.add("is-visible");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      el.classList.remove("is-visible");
    }, 3200);
  };

  /** items: [{ src, title, sub, href }] */
  MBS.lightbox = (function () {
    var box, items = [], index = 0, lastFocus = null;
    function build() {
      box = document.createElement("div");
      box.className = "lightbox";
      box.setAttribute("role", "dialog");
      box.setAttribute("aria-modal", "true");
      box.setAttribute("aria-label", "Book cover viewer");
      box.innerHTML =
        '<button class="lightbox__close" type="button" aria-label="Close">' + icon("close") + "</button>" +
        '<button class="lightbox__nav lightbox__nav--prev" type="button" aria-label="Previous cover">' + icon("arrowLeft") + "</button>" +
        '<button class="lightbox__nav lightbox__nav--next" type="button" aria-label="Next cover">' + icon("arrowRight") + "</button>" +
        '<div class="lightbox__panel"><img class="lightbox__img" alt=""><div class="lightbox__info"></div></div>';
      document.body.appendChild(box);
      box.addEventListener("click", function (e) {
        if (e.target === box || e.target.closest(".lightbox__close")) close();
        else if (e.target.closest(".lightbox__nav--prev")) show(index - 1);
        else if (e.target.closest(".lightbox__nav--next")) show(index + 1);
      });
      document.addEventListener("keydown", function (e) {
        if (!box.classList.contains("is-open")) return;
        if (e.key === "Escape") close();
        if (e.key === "ArrowLeft") show(index - 1);
        if (e.key === "ArrowRight") show(index + 1);
      });
    }
    function show(i) {
      if (!items.length) return;
      index = (i + items.length) % items.length;
      var item = items[index];
      var img = box.querySelector(".lightbox__img");
      img.src = item.src;
      img.alt = "Cover of " + item.title;
      box.querySelector(".lightbox__info").innerHTML =
        "<h3>" + esc(item.title) + "</h3>" + (item.sub ? "<p>" + esc(item.sub) + "</p>" : "") +
        (item.href ? '<a class="btn btn--light btn--sm" href="' + esc(item.href) + '">View details</a>' : "");
      var many = items.length > 1;
      box.querySelector(".lightbox__nav--prev").hidden = !many;
      box.querySelector(".lightbox__nav--next").hidden = !many;
    }
    function close() {
      box.classList.remove("is-open");
      document.body.style.overflow = "";
      if (lastFocus && lastFocus.focus) lastFocus.focus();
    }
    return {
      open: function (list, start) {
        if (!box) build();
        items = list || [];
        if (!items.length) return;
        lastFocus = document.activeElement;
        show(start || 0);
        box.classList.add("is-open");
        document.body.style.overflow = "hidden";
        box.querySelector(".lightbox__close").focus();
      },
    };
  })();

  /* ------------------------------------------------------------------ */
  /* Data loading: live backend first, static JSON as the fallback        */
  /* ------------------------------------------------------------------ */
  function getJson(url, timeoutMs) {
    var ctrl = typeof AbortController !== "undefined" ? new AbortController() : null;
    var timer = ctrl ? setTimeout(function () { ctrl.abort(); }, timeoutMs) : null;
    return fetch(url, { signal: ctrl ? ctrl.signal : undefined, headers: { Accept: "application/json" } })
      .then(function (res) {
        if (!res.ok) throw new Error("HTTP " + res.status);
        return res.json();
      })
      .then(
        function (data) { if (timer) clearTimeout(timer); return data; },
        function (error) { if (timer) clearTimeout(timer); throw error; }
      );
  }

  function prepare(data) {
    var bySlug = {};
    (data.publishers || []).forEach(function (p) { bySlug[p.slug] = p; });
    data.publisherBySlug = bySlug;
    (data.books || []).forEach(function (b) {
      b._pub = bySlug[b.publisher] || null;
      b._search = [b.title, b.series, b.isbn, b.subject, b.classLabel, b.author, b._pub ? b._pub.name : ""].join(" ").toLowerCase();
    });
    MBS.data = data;
    MBS.site = data.site || null;
    applySite();
    return data;
  }

  var dataPromise = null;
  MBS.loadData = function () {
    if (dataPromise) return dataPromise;
    var staticOnly =
      cfg.staticOnly || location.protocol === "file:" || (/(^|\.)github\.io$/i.test(location.hostname) && !cfg.apiBase);
    var fromStatic = function () {
      return getJson("data/catalogue.json", 20000).then(function (d) { MBS.mode = "static"; return d; });
    };
    var source = staticOnly
      ? fromStatic()
      : getJson(MBS.apiUrl("api/catalogue"), 7000)
          .then(function (d) {
            if (!d || !Array.isArray(d.books)) throw new Error("Unexpected response");
            MBS.mode = "live";
            return d;
          })
          .catch(fromStatic);
    dataPromise = source.then(prepare);
    return dataPromise;
  };

  /** Run a page initialiser once data is ready; show a friendly message if it cannot load. */
  MBS.ready = function (init) {
    MBS.loadData()
      .then(init)
      .catch(function (error) {
        if (window.console) console.warn("Catalogue could not be loaded:", error);
        var target = MBS.$("[data-load-target]") || MBS.$("main");
        if (!target) return;
        var box = document.createElement("div");
        box.className = "container";
        box.innerHTML =
          '<div class="notice" role="alert" style="margin-top:24px">' + icon("info") +
          "<p><strong>We could not load the catalogue just now.</strong> Please refresh the page, or message us on WhatsApp and we will help you directly.</p></div>";
        target.insertBefore(box, target.firstChild);
        MBS.$$(".skeleton").forEach(function (s) { s.remove(); });
      });
  };

  /* ------------------------------------------------------------------ */
  /* Site settings → page                                                */
  /* ------------------------------------------------------------------ */
  MBS.mapEmbedUrl = function (query) {
    return "https://www.google.com/maps?q=" + encodeURIComponent(query) + "&output=embed";
  };
  MBS.directionsUrl = function (query) {
    return "https://www.google.com/maps/dir/?api=1&destination=" + encodeURIComponent(query);
  };

  function applySite() {
    var site = MBS.site;
    if (site) {
      MBS.$$("[data-site]").forEach(function (el) {
        var value = site[el.getAttribute("data-site")];
        if (typeof value === "string" && value && el.textContent !== value) el.textContent = value;
      });
      if (site.mapQuery) {
        MBS.$$("[data-directions]").forEach(function (el) { el.href = MBS.directionsUrl(site.mapQuery); });
        MBS.$$("iframe[data-map]").forEach(function (frame) {
          var wanted = MBS.mapEmbedUrl(site.mapQuery);
          if (frame.getAttribute("src") !== wanted) frame.setAttribute("src", wanted);
        });
      }
    }
    bindWhatsApp(document);
  }

  /* ------------------------------------------------------------------ */
  /* Header, navigation, scroll effects                                  */
  /* ------------------------------------------------------------------ */
  function initLayout() {
    var body = document.body;
    var nav = MBS.$("#site-nav");
    var toggle = MBS.$(".nav-toggle");
    var backdrop = MBS.$(".nav-backdrop");

    function setNav(open) {
      body.classList.toggle("nav-open", open);
      if (toggle) toggle.setAttribute("aria-expanded", open ? "true" : "false");
    }
    if (toggle) toggle.addEventListener("click", function () { setNav(!body.classList.contains("nav-open")); });
    MBS.$$("[data-nav-close]").forEach(function (el) { el.addEventListener("click", function () { setNav(false); }); });
    if (backdrop) {
      backdrop.addEventListener("click", function () {
        setNav(false);
        body.classList.remove("filters-open");
      });
    }
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") {
        setNav(false);
        body.classList.remove("filters-open");
      }
    });

    var current = body.getAttribute("data-nav");
    MBS.$$("[data-nav-link]").forEach(function (a) {
      if (a.getAttribute("data-nav-link") === current) {
        a.classList.add("is-active");
        a.setAttribute("aria-current", "page");
      }
    });

    var headerBar = MBS.$(".header-bar");
    var toTop = MBS.$(".to-top");
    function onScroll() {
      var y = window.scrollY || window.pageYOffset;
      if (nav && headerBar) nav.classList.toggle("is-stuck", y > headerBar.offsetTop + headerBar.offsetHeight);
      if (toTop) toTop.classList.toggle("is-visible", y > 600);
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    if (toTop) toTop.addEventListener("click", function () { window.scrollTo({ top: 0, behavior: "smooth" }); });

    MBS.$$("[data-year]").forEach(function (el) { el.textContent = String(new Date().getFullYear()); });
    bindWhatsApp(document);
    MBS.observeReveal(document);
  }

  var revealObserver = null;
  MBS.observeReveal = function (root) {
    var items = MBS.$$(".reveal:not(.is-visible)", root);
    if (!("IntersectionObserver" in window)) {
      items.forEach(function (el) { el.classList.add("is-visible"); });
      return;
    }
    if (!revealObserver) {
      revealObserver = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (entry) {
            if (entry.isIntersecting) {
              entry.target.classList.add("is-visible");
              revealObserver.unobserve(entry.target);
            }
          });
        },
        { rootMargin: "0px 0px -8% 0px", threshold: 0.08 }
      );
    }
    items.forEach(function (el) { revealObserver.observe(el); });
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initLayout);
  else initLayout();
})();
