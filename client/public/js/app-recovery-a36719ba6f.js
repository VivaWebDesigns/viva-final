(() => {
        document.documentElement.classList.add("js");
        const retryKey = "__viva_asset_retry";
        let assetFailed = false;
        const isBuildAsset = (url) => {
          const asset = new URL(url, location.href);
          return asset.origin === location.origin && /^\/assets\/.+\.(?:css|js)$/.test(asset.pathname);
        };
        const showRecovery = () => {
          const show = () => {
            if (document.getElementById("app-recovery")) return;
            const prompt = document.createElement("div");
            prompt.id = "app-recovery";
            prompt.setAttribute("role", "alert");
            prompt.style.cssText = "position:fixed;inset:0;z-index:2147483647;padding:20vh 24px;background:#fff;color:#061a3d;text-align:center;font:18px/1.5 system-ui,sans-serif";
            prompt.append("This page could not finish loading.", document.createElement("br"));
            const reload = document.createElement("a");
            reload.href = location.href;
            reload.textContent = "Reload page";
            reload.addEventListener("click", (event) => {
              event.preventDefault();
              location.reload();
            });
            reload.style.cssText = "color:inherit;text-decoration:underline";
            prompt.append(reload);
            document.body.append(prompt);
          };
          if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", show, { once: true });
          else show();
        };
        const recover = () => {
          if (assetFailed) return;
          assetFailed = true;
          const page = new URL(location.href);
          if (page.searchParams.has(retryKey)) {
            showRecovery();
            return;
          }
          page.searchParams.set(retryKey, "1");
          location.replace(page.href);
        };
        const checkStylesheets = () => {
          if (document.readyState !== "complete") return;
          const missing = [...document.querySelectorAll('link[rel="stylesheet"]')].some(
            (link) => isBuildAsset(link.href) && !link.sheet,
          );
          if (missing) recover();
        };
        window.addEventListener("error", (event) => {
          const asset = event.target;
          if (asset instanceof HTMLLinkElement && isBuildAsset(asset.href)) recover();
          if (asset instanceof HTMLScriptElement && isBuildAsset(asset.src)) recover();
        }, true);
        window.addEventListener("vite:preloadError", (event) => {
          event.preventDefault();
          recover();
        });
        window.addEventListener("pageshow", checkStylesheets);
        window.addEventListener("pageshow", () => {
          setTimeout(() => {
            const root = document.querySelector('[id="root"], [id^="root-"]');
            if (root && !root.firstElementChild) recover();
          }, 8000);
        });
        document.addEventListener("visibilitychange", () => {
          if (!document.hidden) checkStylesheets();
        });
        window.addEventListener("viva:page-ready", () => {
          if (assetFailed) return;
          document.getElementById("app-recovery")?.remove();
          const page = new URL(location.href);
          if (!page.searchParams.has(retryKey)) return;
          page.searchParams.delete(retryKey);
          history.replaceState(history.state, "", page.pathname + page.search + page.hash);
        });
      })();
