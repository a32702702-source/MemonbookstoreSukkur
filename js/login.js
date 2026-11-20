/* Memon Book Store — staff login. All password checks happen on the server. */
(function () {
  "use strict";
  var MBS = window.MBS;
  var $ = MBS.$;
  var cfg = window.MBS_CONFIG || {};

  var title = $("#auth-title"), sub = $("#auth-sub"), msg = $("#auth-msg");
  var loginForm = $("#login-form"), setupForm = $("#setup-form"), staticBox = $("#auth-static");

  MBS.loadData().catch(function () { /* header details simply stay as built */ });

  function showMessage(text, kind) {
    msg.textContent = text;
    msg.className = "form-msg" + (kind ? " form-msg--" + kind : "");
    msg.hidden = !text;
  }

  function request(path, body) {
    return fetch("api/auth/" + path, {
      method: body ? "POST" : "GET",
      credentials: "same-origin",
      headers: body ? { "Content-Type": "application/json", "X-Requested-With": "mbs-admin" } : { Accept: "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    }).then(function (res) {
      return res
        .json()
        .catch(function () { return {}; })
        .then(function (data) { return { ok: res.ok, status: res.status, data: data }; });
    });
  }

  function busy(form, on) {
    var button = form.querySelector("button[type=submit]");
    if (button) button.disabled = on;
  }

  function showStatic() {
    title.textContent = "Staff Login";
    sub.textContent = "Secure sign-in needs the backend server.";
    staticBox.hidden = false;
    var base = String(cfg.apiBase || "").replace(/\/+$/, "");
    var link = $("#auth-backend-link");
    if (base && link) {
      link.href = base + "/login.html";
      link.hidden = false;
    }
  }

  // Static hosts (GitHub Pages, opened from disk) have no backend to ask.
  var staticHost = cfg.staticOnly || location.protocol === "file:" || /(^|\.)github\.io$/i.test(location.hostname);

  (staticHost ? Promise.resolve({ ok: false, status: 0, data: {} }) : request("status"))
    .then(function (res) {
      if (!res.ok || !res.data || res.data.backend !== true) {
        if (res.status === 503) {
          sub.textContent = "The server is running but its database is not reachable.";
          showMessage("Please try again in a moment.", "");
          return;
        }
        showStatic();
        return;
      }
      if (res.data.authenticated) {
        location.replace("admin.html");
        return;
      }
      if (res.data.setupRequired) {
        title.textContent = "Set Up the Admin Panel";
        sub.textContent = "First-time setup for Memon Book Store.";
        $("#s-code-field").hidden = !res.data.setupCodeRequired;
        setupForm.hidden = false;
        $("#s-user").focus();
      } else {
        sub.textContent = "Sign in to manage books, prices and website content.";
        loginForm.hidden = false;
        $("#l-user").focus();
      }
    })
    .catch(showStatic);

  loginForm.addEventListener("submit", function (e) {
    e.preventDefault();
    var username = $("#l-user").value.trim();
    var password = $("#l-pass").value;
    if (!username || !password) {
      showMessage("Enter your username and password.");
      return;
    }
    busy(loginForm, true);
    showMessage("");
    request("login", { username: username, password: password })
      .then(function (res) {
        if (res.ok) {
          location.href = "admin.html";
          return;
        }
        busy(loginForm, false);
        $("#l-pass").value = "";
        showMessage(res.data.error || "Sign-in failed. Please try again.");
      })
      .catch(function () {
        busy(loginForm, false);
        showMessage("Could not reach the server. Check your connection and try again.");
      });
  });

  setupForm.addEventListener("submit", function (e) {
    e.preventDefault();
    var username = $("#s-user").value.trim();
    var password = $("#s-pass").value;
    if (password !== $("#s-pass2").value) {
      showMessage("The two passwords do not match.");
      return;
    }
    busy(setupForm, true);
    showMessage("");
    request("setup", { username: username, password: password, setupCode: $("#s-code").value })
      .then(function (res) {
        if (res.ok) {
          location.href = "admin.html";
          return;
        }
        busy(setupForm, false);
        showMessage(res.data.error || "Setup failed. Please try again.");
      })
      .catch(function () {
        busy(setupForm, false);
        showMessage("Could not reach the server. Check your connection and try again.");
      });
  });
})();
