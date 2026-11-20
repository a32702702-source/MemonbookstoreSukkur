/* Memon Book Store — homepage: hero slider, quick categories, showcases. */
(function () {
  "use strict";
  var MBS = window.MBS;
  var esc = MBS.esc, icon = MBS.icon, $ = MBS.$, $$ = MBS.$$;

  /* ------------------------------------------------------------------ */
  /* Hero slider                                                         */
  /* ------------------------------------------------------------------ */
  var slider = { index: 0, timer: null, slides: [], dots: [], paused: false };
  var reducedMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function go(i, byUser) {
    var n = slider.slides.length;
    if (!n) return;
    slider.index = (i + n) % n;
    slider.slides.forEach(function (slide, k) {
      var on = k === slider.index;
      slide.classList.toggle("is-active", on);
      slide.setAttribute("aria-hidden", on ? "false" : "true");
    });
    slider.dots.forEach(function (dot, k) {
      dot.classList.toggle("is-active", k === slider.index);
      dot.setAttribute("aria-selected", k === slider.index ? "true" : "false");
    });
    if (byUser) restart();
  }

  function restart() {
    clearInterval(slider.timer);
    if (reducedMotion || slider.slides.length < 2) return;
    slider.timer = setInterval(function () {
      if (!slider.paused && !document.hidden) go(slider.index + 1, false);
    }, 6500);
  }

  function setupSlides() {
    var root = $("#hero-slides");
    var dotsRoot = $("#hero-dots");
    if (!root || !dotsRoot) return;
    slider.slides = $$(".hero__slide", root);
    dotsRoot.innerHTML = slider.slides
      .map(function (_, i) {
        return '<button class="hero__dot" type="button" role="tab" aria-label="Show slide ' + (i + 1) + '"></button>';
      })
      .join("");
    slider.dots = $$(".hero__dot", dotsRoot);
    slider.dots.forEach(function (dot, i) {
      dot.addEventListener("click", function () { go(i, true); });
    });
    var controls = $(".hero__controls");
    if (controls) controls.hidden = slider.slides.length < 2;
    go(Math.min(slider.index, Math.max(slider.slides.length - 1, 0)), false);
    restart();
  }

  function bindSliderControls() {
    var hero = $("#hero");
    if (!hero) return;
    var prev = $("#hero-prev"), next = $("#hero-next");
    if (prev) prev.addEventListener("click", function () { go(slider.index - 1, true); });
    if (next) next.addEventListener("click", function () { go(slider.index + 1, true); });
    hero.addEventListener("mouseenter", function () { slider.paused = true; });
    hero.addEventListener("mouseleave", function () { slider.paused = false; });
    hero.addEventListener("focusin", function () { slider.paused = true; });
    hero.addEventListener("focusout", function () { slider.paused = false; });
    hero.addEventListener("keydown", function (e) {
      if (e.key === "ArrowLeft") go(slider.index - 1, true);
      if (e.key === "ArrowRight") go(slider.index + 1, true);
    });
    var startX = null;
    hero.addEventListener("touchstart", function (e) { startX = e.touches[0].clientX; }, { passive: true });
    hero.addEventListener("touchend", function (e) {
      if (startX === null) return;
      var dx = e.changedTouches[0].clientX - startX;
      if (Math.abs(dx) > 50) go(slider.index + (dx < 0 ? 1 : -1), true);
      startX = null;
    }, { passive: true });
  }

  function slideHtml(s, i, site) {
    return (
      '<article class="hero__slide' + (i === 0 ? " is-active" : "") + '" aria-hidden="' + (i === 0 ? "false" : "true") + '">' +
      '<img class="hero__bg" src="' + esc(MBS.asset(s.image)) + '" alt=""' + (i === 0 ? "" : ' loading="lazy"') + ">" +
      '<div class="container hero__content">' +
      (s.eyebrow ? '<p class="hero__eyebrow">' + esc(s.eyebrow) + "</p>" : "") +
      '<h2 class="hero__title">' + esc(s.title) + "</h2>" +
      (s.text ? '<p class="hero__text">' + esc(s.text) + "</p>" : "") +
      '<div class="hero__actions">' +
      (s.ctaLabel && s.ctaHref ? '<a class="btn btn--light" href="' + esc(s.ctaHref) + '">' + esc(s.ctaLabel) + "</a>" : "") +
      '<a class="btn btn--outline-light" data-wa="general" target="_blank" rel="noopener" href="' + esc(MBS.wa(MBS.waText.general)) + '">' +
      icon("wa") + " Ask on WhatsApp</a></div>" +
      (i === 0 && site.urduTagline ? '<p class="hero__urdu urdu" lang="ur" dir="rtl">' + esc(site.urduTagline) + "</p>" : "") +
      "</div></article>"
    );
  }

  /** Re-render the slider only when the saved slides differ from the HTML already on the page. */
  function syncSlides(site) {
    var root = $("#hero-slides");
    if (!root || !site || !Array.isArray(site.slides) || !site.slides.length) return;
    var current = $$(".hero__slide", root).map(function (el) {
      var img = $(".hero__bg", el), title = $(".hero__title", el), text = $(".hero__text", el), cta = $(".hero__actions .btn--light", el);
      return [img ? img.getAttribute("src") : "", title ? title.textContent : "", text ? text.textContent : "", cta ? cta.textContent : ""].join("|");
    });
    var wanted = site.slides.map(function (s) {
      return [MBS.asset(s.image), s.title, s.text || "", s.ctaLabel && s.ctaHref ? s.ctaLabel : ""].join("|");
    });
    if (current.join("§") === wanted.join("§")) return;
    slider.index = 0;
    root.innerHTML = site.slides.map(function (s, i) { return slideHtml(s, i, site); }).join("");
    setupSlides();
  }

  /* ------------------------------------------------------------------ */
  /* Sections                                                            */
  /* ------------------------------------------------------------------ */
  function renderQuick(data) {
    var subjects = MBS.groupBy(data.books, "subject");
    var classes = MBS.groupBy(data.books, "classGroup", true);

    var qs = $("#quick-subjects");
    if (qs) {
      qs.innerHTML = subjects
        .map(function (g) {
          return '<a class="pill" href="' + MBS.listUrl({ subject: g.name }) + '">' + MBS.subjectIcon(g.name) + esc(g.name) +
            '<span class="pill__count">' + g.count + "</span></a>";
        })
        .join("");
    }
    var qc = $("#quick-classes");
    if (qc) {
      qc.innerHTML = classes
        .map(function (g) {
          return '<a class="pill" href="' + MBS.listUrl({ "class": g.name }) + '">' + esc(g.name) + "</a>";
        })
        .join("");
    }
    var select = $("#s-class");
    if (select) {
      classes.forEach(function (g) {
        var option = document.createElement("option");
        option.value = g.name;
        option.textContent = g.name;
        select.appendChild(option);
      });
    }

    var tiles = $("#home-classes");
    if (tiles) {
      tiles.innerHTML = classes
        .map(function (g) {
          return '<a class="class-tile reveal" href="' + MBS.listUrl({ "class": g.name }) + '">' +
            '<span class="class-tile__big" aria-hidden="true">' + esc(MBS.classShort(g.name)) + "</span>" +
            '<span class="class-tile__name">' + esc(g.name) + "</span>" +
            '<span class="class-tile__count">' + g.count + (g.count === 1 ? " title" : " titles") + "</span></a>";
        })
        .join("");
    }

    var subjectTiles = $("#home-subjects");
    if (subjectTiles) {
      subjectTiles.innerHTML = subjects
        .map(function (g) {
          return '<a class="subject-tile reveal" href="' + MBS.listUrl({ subject: g.name }) + '">' +
            '<span class="subject-tile__icon">' + MBS.subjectIcon(g.name) + "</span>" +
            '<span><span class="subject-tile__name">' + esc(g.name) + '</span><span class="subject-tile__count">' + g.count +
            (g.count === 1 ? " title" : " titles") + '</span></span><span class="subject-tile__arrow">' + icon("arrowRight") + "</span></a>";
        })
        .join("");
    }
  }

  function renderFeatured(data) {
    var grid = $("#home-featured"), tabs = $("#featured-tabs");
    if (!grid) return;
    var featured = data.books.filter(function (b) { return b.featured; });
    if (!featured.length) featured = MBS.sortBooks(data.books).slice(0, 8);
    featured = featured.slice(0, 12);

    function draw(slug) {
      var list = featured.filter(function (b) { return !slug || b.publisher === slug; });
      grid.innerHTML = list.map(MBS.bookCard).join("");
    }
    if (tabs) {
      var pubs = data.publishers.filter(function (p) {
        return featured.some(function (b) { return b.publisher === p.slug; });
      });
      tabs.innerHTML =
        '<button type="button" class="tab is-active" data-pub="">All</button>' +
        pubs.map(function (p) {
          return '<button type="button" class="tab" data-pub="' + esc(p.slug) + '">' + esc(p.shortName || p.name) + "</button>";
        }).join("");
      tabs.addEventListener("click", function (e) {
        var btn = e.target.closest(".tab");
        if (!btn) return;
        $$(".tab", tabs).forEach(function (t) { t.classList.toggle("is-active", t === btn); });
        draw(btn.getAttribute("data-pub"));
      });
    }
    draw("");
  }

  function renderSeries(data) {
    var root = $("#home-series");
    if (!root) return;
    var groups = MBS.groupBy(data.books.filter(function (b) { return b.kind !== "series"; }), "series").slice(0, 9);
    root.innerHTML = groups.map(MBS.seriesCard).join("");
  }

  function renderStationery(site) {
    var root = $("#home-stationery");
    if (!root || !site || !Array.isArray(site.stationery) || !site.stationery.length) return;
    root.innerHTML = site.stationery
      .map(function (s) {
        return "<li>" + icon("check") + "<div><b>" + esc(s.name) + "</b><span>" + esc(s.note || "") + "</span></div></li>";
      })
      .join("");
  }

  /* ------------------------------------------------------------------ */
  bindSliderControls();
  setupSlides();

  MBS.ready(function (data) {
    syncSlides(data.site);
    renderQuick(data);
    MBS.enhancePublisherCards(data);
    renderFeatured(data);
    renderSeries(data);
    renderStationery(data.site);
    MBS.bindWhatsApp(document);
    MBS.observeReveal(document);
  });
})();
