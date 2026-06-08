(function () {
  "use strict";

  let deferredPrompt = null;

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredPrompt = event;
    window.dispatchEvent(new CustomEvent("hwp-install-ready"));
  });

  window.HWPPwa = {
    async install() {
      if (!deferredPrompt) return false;
      deferredPrompt.prompt();
      await deferredPrompt.userChoice;
      deferredPrompt = null;
      return true;
    },
    canInstall() {
      return Boolean(deferredPrompt);
    }
  };

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("./sw.js").catch((error) => {
        console.warn("Service worker não registrado.", error);
      });
    });
  }
})();
