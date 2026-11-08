/* Quality-control layer: offline copy, offline note, recovery screen, gesture guard. Client only. */

let recoveryShown = false;

export function clearCopiesAndReload() {
  const jobs: Promise<unknown>[] = [];
  try {
    if ("caches" in window) {
      jobs.push(
        caches
          .keys()
          .then((ks) => Promise.all(ks.filter((k) => k.indexOf("meridian-") === 0).map((k) => caches.delete(k)))),
      );
    }
  } catch {}
  try {
    if (navigator.serviceWorker) {
      jobs.push(navigator.serviceWorker.getRegistrations().then((rs) => Promise.all(rs.map((r) => r.unregister()))));
    }
  } catch {}
  Promise.all(jobs).then(
    () => location.reload(),
    () => location.reload(),
  );
}

export function showRecovery(message: string) {
  if (recoveryShown || !document.body) return;
  recoveryShown = true;
  const box = document.createElement("div");
  box.id = "qcRecover";
  box.setAttribute("role", "alert");
  box.innerHTML =
    '<div class="qc-box"><h2>Something went wrong</h2><p class="qc-msg"></p>' +
    '<p class="qc-sub">Your pinned place and settings are kept on this device.</p>' +
    '<button type="button" id="qcR1" class="qc-primary">Restart</button>' +
    '<button type="button" id="qcR2">Restart with a fresh copy</button></div>';
  (box.querySelector(".qc-msg") as HTMLElement).textContent = message;
  document.body.appendChild(box);
  document.getElementById("qcR1")!.onclick = () => location.reload();
  document.getElementById("qcR2")!.onclick = () => clearCopiesAndReload();
  try {
    document.getElementById("qcR1")!.focus();
  } catch {}
}

function offlineBar() {
  let b = document.getElementById("qcOffline");
  if (!b) {
    b = document.createElement("div");
    b.id = "qcOffline";
    b.setAttribute("role", "status");
    b.textContent = "Offline. The globe still works. Place search and music need a signal.";
    document.body.appendChild(b);
  }
  b.hidden = navigator.onLine !== false;
}

export function initQc() {
  offlineBar();
  window.addEventListener("online", offlineBar);
  window.addEventListener("offline", offlineBar);

  let times: number[] = [];
  window.addEventListener(
    "error",
    (e) => {
      const t = e && (e.target as HTMLElement | null);
      if (t && (t as unknown) !== window && (t as HTMLElement).tagName) return;
      const now = Date.now();
      times.push(now);
      times = times.filter((x) => now - x < 5000);
      if (times.length >= 20) showRecovery("The app hit a problem. Restart to get going again.");
    },
    true,
  );

  window.setTimeout(() => {
    if (!document.querySelector("canvas")) {
      showRecovery("The globe did not finish loading. Check your signal and restart.");
    }
  }, 20000);

  document.addEventListener("gesturestart", (e) => e.preventDefault());

  if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost")) {
    const reg = () => navigator.serviceWorker.register("/sw.js").catch(() => {});
    if (document.readyState === "complete") reg();
    else window.addEventListener("load", reg);
  }
}
