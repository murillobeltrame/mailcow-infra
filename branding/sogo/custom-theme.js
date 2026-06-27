(function () {
  "use strict";

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
})();
