import { recordingAction, recordMessage } from "./recording";
import {
  extensionMessage,
  scanSchema,
  safeUrl,
  type ScanOptions,
} from "@accessly/contracts";
const ORIGIN = __WEB_ORIGIN__;
const PENDING_LIFE = 30 * 60 * 1000;
const ALARM = "accessly-recover";
async function restrict() {
  await chrome.storage.local.setAccessLevel({
    accessLevel: "TRUSTED_CONTEXTS",
  });
  await chrome.storage.session.setAccessLevel({
    accessLevel: "TRUSTED_CONTEXTS",
  });
  await chrome.alarms.create(ALARM, { periodInMinutes: 1 });
}
void restrict();
chrome.runtime.onInstalled.addListener(() => void restrict());
chrome.runtime.onStartup.addListener(() => void restrict());
async function credentials() {
  const { connection } =
    await chrome.storage.local.get<Record<string, any>>("connection");
  if (!connection || new Date(connection.expiresAt).getTime() < Date.now()) {
    await chrome.storage.local.remove("connection");
    throw new Error("Connect to Accessly to continue.");
  }
  return connection;
}
async function request(path: string, options: RequestInit = {}) {
  const connection = await credentials();
  const response = await fetch(`${ORIGIN}/api/v1/${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${connection.token}`,
      "Content-Type": "application/json",
    },
    signal: AbortSignal.timeout(25000),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error ?? "Request failed.");
  return data;
}
const random = () => {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
};
async function connect() {
  const verifier = random(),
    state = random();
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(verifier),
  );
  const challenge = btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
  await chrome.storage.session.set({
    auth: { verifier, state, createdAt: Date.now() },
  });
  try {
    const callback = await chrome.identity.launchWebAuthFlow({
      url: `${ORIGIN}/extension/connect?challenge=${challenge}&state=${state}&extensionId=${chrome.runtime.id}`,
      interactive: true,
    });
    const returned = new URL(callback!);
    const { auth } =
      await chrome.storage.session.get<Record<string, any>>("auth");
    if (
      !auth ||
      auth.state !== returned.searchParams.get("state") ||
      returned.origin !== new URL(chrome.identity.getRedirectURL()).origin ||
      Date.now() - auth.createdAt > 10 * 60 * 1000
    )
      throw new Error("Connection callback could not be validated.");
    const response = await fetch(`${ORIGIN}/api/v1/extension/exchange`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code: returned.searchParams.get("code"),
        verifier: auth.verifier,
      }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error);
    await chrome.storage.local.set({ connection: data });
    return { connected: true };
  } finally {
    await chrome.storage.session.remove("auth");
  }
}
async function activeTab() {
  const [tab] = await chrome.tabs.query({
    active: true,
    lastFocusedWindow: true,
  });
  if (!tab?.id || !tab.url || !/^https?:/.test(tab.url))
    throw new Error(
      "Open an ordinary HTTP or HTTPS application page before scanning.",
    );
  return tab as chrome.tabs.Tab & { id: number; url: string };
}
async function state(tabId: number) {
  const [result] = await chrome.scripting.executeScript({
    target: { tabId },
    func: () => {
      const w = window as any;
      if (!w.__accesslyObserver) {
        w.__accesslyRevision = 0;
        w.__accesslyObserver = new MutationObserver(
          () => w.__accesslyRevision++,
        );
        w.__accesslyObserver.observe(document.documentElement, {
          childList: true,
          subtree: true,
          attributes: true,
          characterData: true,
        });
      }
      return {
        url: location.href,
        timeOrigin: performance.timeOrigin,
        revision: w.__accesslyRevision,
        scrollX,
        scrollY,
        width: innerWidth,
        height: innerHeight,
      };
    },
  });
  return result.result;
}
async function scan(options: ScanOptions) {
  await credentials();
  const tab = await activeTab();
  const retest = options.retestId
    ? await request(`retests/${options.retestId}`)
    : null;
  if (
    retest &&
    (retest.applicationId !== options.applicationId ||
      retest.environmentId !== options.environmentId ||
      retest.status !== "requested")
  )
    throw new Error(
      "The requested retest is unavailable or has already been assessed.",
    );
  const apps = await request("applications");
  const app = apps.find((a: any) => a.id === options.applicationId);
  const env = app?.environments.find(
    (e: any) => e.id === options.environmentId,
  );
  if (!env || new URL(tab.url).origin !== env.origin)
    throw new Error(
      "The active page is outside this application’s permitted origin.",
    );
  if (
    options.expectedProtected &&
    options.authentication !== "user-confirmed-signed-in"
  )
    throw new Error(
      "Confirm that the intended signed-in page and role are visible before scanning.",
    );
  const login = /\/(login|signin|sign-in|auth)(\/|$)/i.test(
    new URL(tab.url).pathname,
  );
  if (options.expectedProtected && login)
    throw new Error(
      "This looks like a sign-in page. Reach the intended protected page first.",
    );
  const id = crypto.randomUUID();
  await chrome.storage.local.set({
    pending: { status: "scanning", id, createdAt: Date.now(), tabId: tab.id },
  });
  await chrome.storage.session.remove("capture");
  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["scanner.js"],
    });
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: async (payload) => {
        const context = {
          ...payload.context,
          viewport: {
            width: innerWidth,
            height: innerHeight,
            deviceScale: devicePixelRatio,
          },
        };
        return (window as any).__accesslyScan({ ...payload, context });
      },
      args: [
        {
          clientScanId: id,
          retestId: options.retestId,
          target: retest?.target,
          applicationId: options.applicationId,
          environmentId: options.environmentId,
          mode: "extension",
          excludeSelectors: options.excludeSelectors,
          context: {
            url: safeUrl(tab.url),
            title: "Page title omitted",
            state: options.state,
            role: options.role,
            preconditions: options.preconditions,
            authentication: options.authentication,
            appVersion: options.appVersion,
            viewport: { width: 1, height: 1, deviceScale: 1 },
          },
        },
      ],
    });
    const result = scanSchema.parse(results[0].result);
    if (login) {
      result.completion = "partial";
      result.context.authentication = "unknown";
      result.limitations.push(
        "The URL resembles a sign-in page. Protected content and target role were not established.",
      );
    }
    if (options.role === "unknown" || options.authentication === "unknown")
      result.limitations.push(
        "Target identity or authentication context is unknown; do not infer protected-page coverage.",
      );
    const stamp = await state(tab.id);
    await chrome.storage.local.set({
      pending: {
        status: "preview",
        id,
        createdAt: Date.now(),
        tabId: tab.id,
        result,
        stamp,
        attempts: 0,
      },
    });
    return { ready: true };
  } catch (e) {
    await chrome.storage.local.set({
      pending: {
        status: "failed",
        id,
        createdAt: Date.now(),
        error: (e as Error).message,
      },
    });
    throw e;
  }
}
async function capture() {
  const { pending } =
    await chrome.storage.local.get<Record<string, any>>("pending");
  if (!pending?.result)
    throw new Error("Scan the page before capturing evidence.");
  const tab = await activeTab();
  if (tab.id !== pending.tabId)
    throw new Error("Return to the scanned tab first.");
  const before = await state(tab.id);
  if (JSON.stringify(before) !== JSON.stringify(pending.stamp))
    throw new Error(
      "The document, scroll position, or viewport changed. Scan this state again before capturing evidence.",
    );
  if (pending.result.exclusions.length)
    throw new Error(
      "Screenshot capture is disabled when scan exclusions are configured. Omit the image, or rescan and mask all sensitive content in the preview. Excluding scanner content alone cannot guarantee screenshot redaction.",
    );
  const data = await chrome.tabs.captureVisibleTab(tab.windowId, {
    format: "png",
  });
  const after = await state(tab.id);
  if (JSON.stringify(before) !== JSON.stringify(after))
    throw new Error(
      "The page changed during capture. Screenshot discarded; scan again.",
    );
  await chrome.storage.session.set({
    capture: { data, createdAt: Date.now() },
  });
  return { data };
}
let uploading = false;
async function upload() {
  if (uploading) return { queued: true };
  uploading = true;
  try {
    const { pending } =
      await chrome.storage.local.get<Record<string, any>>("pending");
    if (!pending?.result || !pending.approvedAt)
      throw new Error("Review and approve the scan preview first.");
    if (Date.now() - pending.createdAt > PENDING_LIFE)
      throw new Error("Pending scan expired. Discard it and scan again.");
    await chrome.storage.local.set({
      pending: {
        ...pending,
        status: "uploading",
        attempts: (pending.attempts ?? 0) + 1,
      },
    });
    try {
      const run = await request("runs", {
        method: "POST",
        body: JSON.stringify(pending.result),
      });
      if (pending.image) {
        const response = await fetch(pending.image);
        const bitmap = await createImageBitmap(await response.blob());
        await request(`runs/${run.id}/evidence`, {
          method: "POST",
          body: JSON.stringify({
            data: pending.image,
            description: pending.description,
            masked: pending.masked,
            width: bitmap.width,
            height: bitmap.height,
          }),
        });
        bitmap.close();
      }
      await chrome.storage.local.set({
        lastRun: { id: run.id, url: `${ORIGIN}/runs/${run.id}` },
      });
      await chrome.storage.local.remove("pending");
      await chrome.storage.session.remove("capture");
      return { url: `${ORIGIN}/runs/${run.id}` };
    } catch (e) {
      await chrome.storage.local.set({
        pending: {
          ...pending,
          status: "retry",
          attempts: (pending.attempts ?? 0) + 1,
          error: (e as Error).message,
        },
      });
      throw e;
    }
  } finally {
    uploading = false;
  }
}
async function recover() {
  const { pending } =
    await chrome.storage.local.get<Record<string, any>>("pending");
  const { capture } =
    await chrome.storage.session.get<Record<string, any>>("capture");
  if (capture && Date.now() - capture.createdAt > 10 * 60 * 1000)
    await chrome.storage.session.remove("capture");
  if (!pending) return;
  if (Date.now() - pending.createdAt > PENDING_LIFE) {
    await chrome.storage.local.remove("pending");
    await chrome.storage.session.remove("capture");
    return;
  }
  if (pending.status === "scanning" && Date.now() - pending.createdAt > 60000) {
    await chrome.storage.local.set({
      pending: {
        ...pending,
        status: "failed",
        error:
          "Assessment was interrupted. Reach the intended state and scan again.",
      },
    });
    return;
  }
  if (
    pending.approvedAt &&
    ["retry", "uploading"].includes(pending.status) &&
    (pending.attempts ?? 0) < 5
  )
    await upload().catch(() => {});
}
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === ALARM) {
    void recover();
    void recordingAction("record-status");
  }
});
chrome.runtime.onMessage.addListener((raw, sender, respond) => {
  if (
    raw?.type === "recorded-step" &&
    sender.id === chrome.runtime.id &&
    sender.tab
  ) {
    recordMessage(raw.step, sender, respond);
    return true;
  }
  if (
    sender.id !== chrome.runtime.id ||
    !sender.url?.startsWith(chrome.runtime.getURL("popup.html"))
  ) {
    respond({ ok: false, error: "Message source denied." });
    return false;
  }
  void (async () => {
    const message = extensionMessage.parse(raw);
    switch (message.type) {
      case "record-start":
        await credentials();
        return recordingAction(message.type, await activeTab());
      case "record-stop":
      case "record-status":
      case "record-discard":
        return recordingAction(message.type);
      case "connect":
        return connect();
      case "disconnect":
        await request("extension/session", { method: "DELETE" });
        await recordingAction("record-discard");
        await chrome.storage.local.clear();
        await chrome.storage.session.clear();
        return { disconnected: true };
      case "status":
        await recover();
        {
          const { connection, pending, lastRun } =
            await chrome.storage.local.get<Record<string, any>>([
              "connection",
              "pending",
              "lastRun",
            ]);
          return {
            connected:
              !!connection &&
              new Date(connection.expiresAt).getTime() > Date.now(),
            pending: pending
              ? {
                  ...pending,
                  image: undefined,
                  stamp: undefined,
                  tabId: undefined,
                }
              : undefined,
            lastRun,
          };
        }
      case "applications":
        return request("applications");
      case "retests":
        return request("retests");
      case "scan":
        return scan(message.options);
      case "capture":
        return capture();
      case "discard":
        await chrome.storage.local.remove("pending");
        await chrome.storage.session.remove("capture");
        return { discarded: true };
      case "upload": {
        const { pending } =
          await chrome.storage.local.get<Record<string, any>>("pending");
        if (!pending?.result) throw new Error("No scan is ready.");
        if (
          pending.approvedAt &&
          ["retry", "uploading"].includes(pending.status)
        )
          return upload();
        if (message.image && !message.description.trim())
          throw new Error("Describe the screenshot for nonvisual access.");
        await chrome.storage.local.set({
          pending: {
            ...pending,
            approvedAt: Date.now(),
            image: message.image,
            description: message.description,
            masked: message.masked,
          },
        });
        return upload();
      }
      case "highlight": {
        const tab = await activeTab();
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: (locator) => {
            document.querySelector("[data-accessly-overlay]")?.remove();
            const element = document.querySelector(locator);
            if (!element) throw new Error("Element no longer exists.");
            const b = element.getBoundingClientRect();
            const overlay = document.createElement("button");
            overlay.setAttribute("data-accessly-overlay", "");
            overlay.setAttribute(
              "aria-label",
              "Remove Accessly element highlight",
            );
            overlay.textContent = "×";
            Object.assign(overlay.style, {
              position: "fixed",
              left: `${b.x}px`,
              top: `${b.y}px`,
              width: `${Math.max(24, b.width)}px`,
              height: `${Math.max(24, b.height)}px`,
              border: "3px solid #b54a15",
              background: "#ff990022",
              zIndex: "2147483647",
              color: "#000",
              cursor: "pointer",
            });
            overlay.onclick = () => overlay.remove();
            overlay.onkeydown = (e) => {
              if (e.key === "Escape") overlay.remove();
            };
            document.body.append(overlay);
            setTimeout(() => overlay.remove(), 15000);
          },
          args: [message.locator],
        });
        return { highlighted: true };
      }
      default: {
        const unhandled: never = message;
        void unhandled;
        throw new Error("Unsupported extension action.");
      }
    }
  })()
    .then((data) => respond({ ok: true, data }))
    .catch((error) =>
      respond({
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "The action could not complete.",
      }),
    );
  return true;
});
