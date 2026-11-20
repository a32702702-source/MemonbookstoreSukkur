/* Memon Book Store — catalogue: search, filters, sorting and "Load more". */
(function () {
  "use strict";
  var MBS = window.MBS;
  var esc = MBS.esc, icon = MBS.icon, $ = MBS.$;

  var root = $("#catalogue");
  if (!root) return;

  var PAGE_SIZE = 24;
  var fixedPublisher = root.getAttribute("data-publisher") || "";
  var el = {
    q: $("#f-q"), publisher: $("#f-publisher"), cls: $("#f-class"), subject: $("#f-subject"), series: $("#f-series"),
    language: $("#f-language"), availability: $("#f-availability"), min: $("#f-min"), max: $("#f-max"),
    priced: $("#f-priced"), sort: $("#f-sort"), grid: $("#r-grid"), count: $("#r-count"), chips: $("#r-chips"),
    more: $("#r-more"), moreBtn: $("#r-more-btn"), progress: $("#r-progress"), empty: $("#r-empty"),
  };
  var KEYS = ["q", "publisher", "class", "subject", "series", "language", "availability", "min", "max", "sort"];
  var state = {};
  var base = [];
  var results = [];
  var shown = PAGE_SIZE;
  var noun = "titles";

  function readUrl() {
    var p = new URLSearchParams(location.search);
    KEYS.forEach(function (k) { state[k] = (p.get(k) || "").trim(); });
    state.priced = p.get("priced") === "1";
    if (fixedPublisher) state.publisher = fixedPublisher;
    if (!state.sort) state.sort = "class";
  }

  function writeUrl() {
    var p = new URLSearchParams();
    KEYS.forEach(function (k) {
      if (!state[k]) return;
      if (k === "publisher" && fixedPublisher) return;
      if (k === "sort" && state.sort === "class") return;
      p.set(k, state[k]);
    });
    if (state.priced) p.set("priced", "1");
    var qs = p.toString();
    try {
      history.replaceState(null, "", location.pathname + (qs ? "?" + qs : ""));
    } catch (e) { /* file:// */ }
  }

  function priceOf(book) {
    return book.storePrice != null ? book.storePrice : book.officialPrice;
  }

  function fillSelect(select, values, current, labelFn) {
    if (!select) return;
    var first = select.options[0];
    select.innerHTML = "";
    select.appendChild(first);
    values.forEach(function (v) {
      var o = document.createElement("option");
      o.value = v.value;
      o.textContent = labelFn ? labelFn(v) : v.label + " (" + v.count + ")";
      select.appendChild(o);
    });
    if (current && !values.some(function (v) { return v.value === current; })) {
      var extra = document.createElement("option");
      extra.value = current;
      extra.textContent = current;
      select.appendChild(extra);
    }
    select.value = current || "";
  }

  function options(key, classOrder) {
    var groups = MBS.groupBy(base, key, classOrder);
    if (!classOrder) groups.sort(function (a, b) { return a.name.localeCompare(b.name); });
    return groups.map(function (g) { return { value: g.name, label: g.name, count: g.count }; });
  }

  function setupControls(data) {
    if (el.publisher) {
      fillSelect(
        el.publisher,
        data.publishers.map(function (p) {
          return { value: p.slug, label: p.name, count: data.books.filter(function (b) { return b.publisher === p.slug; }).length };
        }),
        state.publisher
      );
    }
    fillSelect(el.cls, options("classGroup", true), state["class"]);
    fillSelect(el.subject, options("subject"), state.subject);
    fillSelect(el.series, options("series"), state.series);
    fillSelect(el.language, options("language"), state.language);
    if (el.availability) el.availability.value = state.availability;
    if (el.q) el.q.value = state.q;
    if (el.min) el.min.value = state.min;
    if (el.max) el.max.value = state.max;
    if (el.priced) el.priced.checked = state.priced;
    if (el.sort) el.sort.value = state.sort;
  }

  function filterBooks() {
    var terms = state.q.toLowerCase().split(/\s+/).filter(Boolean);
    var isbnQuery = state.q.replace(/[^0-9Xx]/g, "");
    var min = state.min === "" ? null : Number(state.min);
    var max = state.max === "" ? null : Number(state.max);

    var list = base.filter(function (b) {
      if (terms.length) {
        var textMatch = terms.every(function (t) { return b._search.indexOf(t) !== -1; });
        var isbnMatch = isbnQuery.length >= 4 && b.isbn && b.isbn.replace(/[^0-9Xx]/g, "").indexOf(isbnQuery) !== -1;
        if (!textMatch && !isbnMatch) return false;
      }
      if (state.publisher && b.publisher !== state.publisher) return false;
      if (state["class"] && b.classGroup !== state["class"]) return false;
      if (state.subject && b.subject !== state.subject) return false;
      if (state.series && b.series !== state.series) return false;
      if (state.language && b.language !== state.language) return false;
      if (state.availability && (b.availability || "unverified") !== state.availability) return false;
      var price = priceOf(b);
      if (state.priced && price == null) return false;
      if (min !== null && !isNaN(min) && (price == null || price < min)) return false;
      if (max !== null && !isNaN(max) && (price == null || price > max)) return false;
      return true;
    });

    if (state.sort === "title") {
      list.sort(function (a, b) { return a.title.localeCompare(b.title, undefined, { numeric: true }); });
    } else if (state.sort === "price-asc" || state.sort === "price-desc") {
      var dir = state.sort === "price-asc" ? 1 : -1;
      list.sort(function (a, b) {
        var pa = priceOf(a), pb = priceOf(b);
        if (pa == null && pb == null) return a.title.localeCompare(b.title, undefined, { numeric: true });
        if (pa == null) return 1;
        if (pb == null) return -1;
        return (pa - pb) * dir || a.title.localeCompare(b.title, undefined, { numeric: true });
      });
    } else {
      list = MBS.sortBooks(list);
    }
    return list;
  }

  var CHIP_LABELS = {
    q: "Search", publisher: "Publisher", "class": "Class", subject: "Subject", series: "Series", language: "Language",
    availability: "Availability", min: "Min price", max: "Max price",
  };
  var AVAIL_LABELS = { in_stock: "In stock", on_order: "On order", unverified: "Not yet confirmed", out_of_stock: "Out of stock" };

  function renderChips() {
    var html = "";
    KEYS.forEach(function (k) {
      if (!state[k] || k === "sort") return;
      if (k === "publisher" && fixedPublisher) return;
      var value = state[k];
      if (k === "publisher" && MBS.data.publisherBySlug[value]) value = MBS.data.publisherBySlug[value].name;
      if (k === "availability") value = AVAIL_LABELS[value] || value;
      if (k === "min" || k === "max") value = "PKR " + value;
      html += '<button type="button" class="filter-chip" data-clear="' + k + '" aria-label="Remove filter: ' + esc(CHIP_LABELS[k] + " " + value) + '">' +
        esc(CHIP_LABELS[k] + ": " + value) + icon("close") + "</button>";
    });
    if (state.priced) {
      html += '<button type="button" class="filter-chip" data-clear="priced" aria-label="Remove filter: listed price only">With listed price' + icon("close") + "</button>";
    }
    el.chips.innerHTML = html;
  }

  function render() {
    results = filterBooks();
    var total = results.length;
    var visible = results.slice(0, shown);

    el.count.textContent =
      total === 0 ? "No " + noun + " found" : total === base.length ? total + " " + noun : total + " of " + base.length + " " + noun;
    renderChips();

    if (!total) {
      el.grid.innerHTML = "";
      el.grid.hidden = true;
      el.more.hidden = true;
      el.empty.hidden = false;
      el.empty.innerHTML =
        '<div class="empty-state"><h3>No ' + noun + " match these filters</h3><p>Try a different spelling or remove a filter. You can also send us the title on WhatsApp — we will check for you.</p>" +
        '<div class="btn-row" style="justify-content:center"><button type="button" class="btn btn--navy" data-reset>Reset filters</button>' +
        '<a class="btn btn--wa" target="_blank" rel="noopener" href="' + esc(MBS.wa(state.q ? MBS.waText.item(state.q) : MBS.waText.general)) + '">' + icon("wa") + " Ask on WhatsApp</a></div></div>";
      return;
    }

    el.empty.hidden = true;
    el.grid.hidden = false;
    el.grid.innerHTML = visible.map(MBS.bookCard).join("");
    el.more.hidden = total <= shown;
    el.progress.textContent = "Showing " + visible.length + " of " + total;
    if (el.moreBtn) el.moreBtn.textContent = "Load " + Math.min(PAGE_SIZE, total - shown) + " more";
  }

  function update(resetPaging) {
    if (resetPaging !== false) shown = PAGE_SIZE;
    writeUrl();
    render();
  }

  function resetAll() {
    KEYS.forEach(function (k) { state[k] = ""; });
    state.priced = false;
    state.sort = "class";
    if (fixedPublisher) state.publisher = fixedPublisher;
    setupControls(MBS.data);
    update();
  }

  function bind() {
    var debounce;
    function onType(key, input) {
      if (!input) return;
      input.addEventListener("input", function () {
        clearTimeout(debounce);
        debounce = setTimeout(function () {
          state[key] = input.value.trim();
          update();
        }, 180);
      });
    }
    function onChange(key, input) {
      if (!input) return;
      input.addEventListener("change", function () {
        state[key] = input.value;
        update();
      });
    }
    onType("q", el.q);
    onType("min", el.min);
    onType("max", el.max);
    onChange("publisher", el.publisher);
    onChange("class", el.cls);
    onChange("subject", el.subject);
    onChange("series", el.series);
    onChange("language", el.language);
    onChange("availability", el.availability);
    onChange("sort", el.sort);
    if (el.priced) {
      el.priced.addEventListener("change", function () {
        state.priced = el.priced.checked;
        update();
      });
    }
    if (el.moreBtn) {
      el.moreBtn.addEventListener("click", function () {
        var before = shown;
        shown += PAGE_SIZE;
        update(false);
        var firstNew = el.grid.children[before];
        var link = firstNew && firstNew.querySelector(".book-card__title a");
        if (link) link.focus({ preventScroll: true });
      });
    }
    $("#f-reset").addEventListener("click", resetAll);
    el.chips.addEventListener("click", function (e) {
      var chip = e.target.closest("[data-clear]");
      if (!chip) return;
      var key = chip.getAttribute("data-clear");
      if (key === "priced") state.priced = false;
      else state[key] = "";
      setupControls(MBS.data);
      update();
    });
    el.empty.addEventListener("click", function (e) {
      if (e.target.closest("[data-reset]")) resetAll();
    });
    var open = $("#f-open"), close = $("#f-close");
    if (open) open.addEventListener("click", function () { document.body.classList.add("filters-open"); });
    if (close) close.addEventListener("click", function () { document.body.classList.remove("filters-open"); });
    // Keep the form from submitting if someone presses Enter in a field.
    $("#filters").addEventListener("keydown", function (e) {
      if (e.key === "Enter" && e.target.tagName === "INPUT") e.preventDefault();
    });
  }

  MBS.ready(function (data) {
    base = fixedPublisher ? data.books.filter(function (b) { return b.publisher === fixedPublisher; }) : data.books.slice();
    if (base.length && base.every(function (b) { return b.kind === "series"; })) noun = "series";
    readUrl();
    setupControls(data);
    bind();
    render();
  });
})();
