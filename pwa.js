(function () {
  "use strict";

  let deferredPrompt = null;

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredPrompt = event;
    document.getElementById("installButton")?.removeAttribute("hidden");
  });

  const init = () => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("./sw.js").catch((error) => console.warn("Service worker indisponivel.", error));
    }
    document.getElementById("installButton")?.addEventListener("click", async () => {
      if (!deferredPrompt) return;
      deferredPrompt.prompt();
      await deferredPrompt.userChoice;
      deferredPrompt = null;
    });
  };

  window.HWPPWA = { init };
})();
