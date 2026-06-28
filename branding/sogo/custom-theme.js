(function () {
  "use strict";

  /* ── Angular Material theme (Nive) ── */
  angular.module("SOGo.Common").config(configure);
  configure.$inject = ["$mdThemingProvider"];

  function configure($mdThemingProvider) {
    var niveBlue = $mdThemingProvider.extendPalette("blue", {
      50: "E8EEF4",
      100: "C5D6E8",
      200: "9BB8D9",
      300: "719AD0",
      400: "22578d",
      500: "1a4f7a",
      600: "164068",
      700: "123456",
      800: "071836",
      900: "051428",
      A100: "82B1FF",
      A200: "448AFF",
      A400: "2979FF",
      A700: "2962FF",
      contrastDefaultColor: "light",
      contrastDarkColors: ["50", "100", "200", "300"],
      contrastStrongLightColors: "500",
    });

    var niveGrey = $mdThemingProvider.extendPalette("grey", {
      50: "F8FAFC",
      100: "F1F5F9",
      200: "E2E8F0",
      300: "CBD5E1",
      400: "94A3B8",
      500: "64748B",
      600: "475569",
      700: "334155",
      800: "1E293B",
      900: "0F172A",
      1000: "1E293B",
    });

    $mdThemingProvider.definePalette("nive-blue", niveBlue);
    $mdThemingProvider.definePalette("nive-grey", niveGrey);

    $mdThemingProvider
      .theme("default")
      .primaryPalette("nive-blue", {
        default: "400",
        "hue-1": "400",
        "hue-2": "600",
        "hue-3": "800",
      })
      .accentPalette("nive-blue", {
        default: "400",
        "hue-1": "200",
        "hue-2": "300",
        "hue-3": "600",
      })
      .backgroundPalette("nive-grey");

    $mdThemingProvider.generateThemesOnDemand(true);
  }

  /* ── UI fixes (DOM) ── */
  var DATE_SELECTORS = [
    ".sg-date-group",
    ".sg-date-today",
    ".sg-day",
    ".sg-month",
    ".sg-year",
    "p.sg-date-today",
    ".sg-md-display-3.sg-date-today",
  ];

  function isPreferencesView() {
    return /\/Preferences\//i.test(window.location.pathname);
  }

  function hideDateHeader() {
    DATE_SELECTORS.forEach(function (sel) {
      document.querySelectorAll(sel).forEach(function (el) {
        el.style.setProperty("display", "none", "important");
        el.style.setProperty("visibility", "hidden", "important");
        el.style.setProperty("height", "0", "important");
        el.style.setProperty("overflow", "hidden", "important");
      });
    });
  }

  function fixSidenavUserHeader() {
    document.querySelectorAll("md-sidenav md-toolbar.md-tall").forEach(function (toolbar) {
      toolbar.style.removeProperty("max-height");
      toolbar.style.removeProperty("height");
    });

    document.querySelectorAll("md-sidenav .sg-md-title").forEach(function (title) {
      title.style.setProperty("white-space", "normal", "important");
      title.style.setProperty("overflow", "visible", "important");
      title.style.setProperty("line-height", "1.35", "important");
    });
  }

  function injectWebmailBanner() {
    if (isPreferencesView()) return;
    if (document.querySelector(".nive-webmail-banner")) return;

    var path = window.location.pathname.toLowerCase();
    if (path.indexOf("/mail/") === -1 && path.indexOf("/calendar/") === -1) return;

    var content = document.querySelector("md-content");
    if (!content) return;

    var banner = document.createElement("div");
    banner.className = "nive-webmail-banner";
    banner.innerHTML =
      '<span>Para ler e enviar e-mails, use o webmail moderno.</span>' +
      '<a href="/mail/">Abrir webmail</a>';

    content.insertBefore(banner, content.firstChild);
  }

  function redirectMailToolbar() {
    document.querySelectorAll("md-toolbar md-icon").forEach(function (icon) {
      if (icon.textContent.trim() !== "mail") return;
      var btn = icon.closest(".md-button");
      if (!btn || btn.dataset.niveMailRedirect) return;
      btn.dataset.niveMailRedirect = "1";
      btn.addEventListener(
        "click",
        function (e) {
          e.preventDefault();
          e.stopPropagation();
          window.location.href = "/mail/";
        },
        true
      );
    });
  }

  function redirectSogoMailModule() {
    var path = window.location.pathname;
    var hash = window.location.hash || "";
    if (/\/Mail(\/|$)/i.test(path) || /#!\/Mail/i.test(hash)) {
      window.location.replace("/mail/");
    }
  }

  function applyUiFixes() {
    hideDateHeader();
    fixSidenavUserHeader();
    redirectSogoMailModule();
    injectWebmailBanner();
    redirectMailToolbar();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", applyUiFixes);
  } else {
    applyUiFixes();
  }

  new MutationObserver(function () {
    applyUiFixes();
  }).observe(document.documentElement, { childList: true, subtree: true });
})();
