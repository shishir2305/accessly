import { journeyStep } from "../../../packages/contracts/src/journeys";
import { safeUrl } from "@accessly/contracts";
type Recording = {
  active: boolean;
  tabId: number;
  origin: string;
  startUrl: string;
  createdAt: number;
  steps: unknown[];
  limitation?: string;
};
let writing = Promise.resolve();
function navigationStep(url: string, id: string) {
  const parsed = new URL(url);
  if (parsed.search || parsed.hash)
    return {
      id,
      label: "Unsupported route inputs omitted",
      action: "unsupported",
      reason:
        "Query/fragment route inputs were omitted for privacy. Define a dedicated safe test route; this navigation was not faithfully recorded.",
    };
  return {
    id,
    label: "Recorded same-origin navigation",
    action: "navigate",
    url: safeUrl(url),
  };
}
async function read() {
  return (
    await chrome.storage.local.get<{ recording?: Recording }>("recording")
  ).recording;
}
async function inject(tabId: number) {
  await chrome.scripting.executeScript({
    target: { tabId },
    files: ["recorder.js"],
  });
}
async function performAction(type: string, tab?: { id: number; url: string }) {
  let recording = await read();
  if (recording && Date.now() - recording.createdAt > 30 * 60 * 1000) {
    await stop(recording);
    await chrome.storage.local.remove("recording");
    recording = undefined;
    if (type === "record-status")
      return {
        active: false,
        steps: [],
        limitation: "Recording draft expired and was deleted after 30 minutes.",
      };
  }
  if (type === "record-start" && tab) {
    await stop(recording);
    recording = {
      active: true,
      tabId: tab.id,
      origin: new URL(tab.url).origin,
      startUrl: safeUrl(tab.url),
      createdAt: Date.now(),
      steps:
        new URL(tab.url).search || new URL(tab.url).hash
          ? [navigationStep(tab.url, "unsupported_start_route")]
          : [],
    };
    await chrome.storage.local.set({ recording });
    try {
      await inject(tab.id);
    } catch {
      recording.active = false;
      recording.limitation =
        "Recording injection was denied. Invoke the extension on a supported tab.";
      await chrome.storage.local.set({ recording });
    }
  }
  if (type === "record-discard") {
    await stop(recording);
    await chrome.storage.local.remove("recording");
    return undefined;
  }
  if (
    type === "record-stop" ||
    (recording && Date.now() - recording.createdAt > 30 * 60 * 1000)
  ) {
    await stop(recording);
    recording = await read();
  }
  return recording;
}
export async function recordingAction(
  type: string,
  tab?: { id: number; url: string },
) {
  const result = writing.then(() => performAction(type, tab));
  writing = result.then(
    () => {},
    () => {},
  );
  return result;
}
async function stop(r?: Recording) {
  if (!r) return;
  await chrome.scripting
    .executeScript({
      target: { tabId: r.tabId },
      func: () => (window as any).__accesslyStopRecording?.(),
    })
    .catch(() => {});
  await chrome.storage.local.set({ recording: { ...r, active: false } });
}
export function recordMessage(
  raw: unknown,
  sender: chrome.runtime.MessageSender,
  respond: (v: unknown) => void,
) {
  writing = writing
    .then(async () => {
      const r = await read();
      if (
        !r?.active ||
        Date.now() - r.createdAt > 30 * 60 * 1000 ||
        r.tabId !== sender.tab?.id ||
        !sender.url ||
        new URL(sender.url).origin !== r.origin ||
        sender.frameId !== 0
      )
        throw new Error();
      const step = journeyStep.parse(raw);
      if (r.steps.length >= 55) {
        await stop({
          ...r,
          limitation: "Recording limit reached. Review the partial draft.",
        });
        return;
      }
      await chrome.storage.local.set({
        recording: { ...r, steps: [...r.steps, step] },
      });
    })
    .then(() => {
      respond({ ok: true });
    })
    .catch(() => {
      respond({ ok: false, error: "Recording source or step denied." });
    });
}
chrome.tabs.onUpdated.addListener((tabId, change, tab) => {
  if (
    change.status !== "complete" &&
    !(change.url && tab.status === "complete")
  )
    return;
  writing = writing
    .then(async () => {
      const r = await read();
      if (!r?.active || r.tabId !== tabId) return;
      if (!tab.url) {
        await stop({
          ...r,
          limitation:
            "Navigation scope could not be validated after a permission/origin change. Draft retained; later interactions were not recorded.",
        });
        return;
      }
      if (
        Date.now() - r.createdAt > 30 * 60 * 1000 ||
        new URL(tab.url!).origin !== r.origin
      ) {
        await stop({
          ...r,
          limitation:
            "Recording stopped at the origin or time boundary; remaining navigation is unrecorded.",
        });
        return;
      }
      if (r.steps.length >= 55) {
        await stop(r);
        return;
      }
      await chrome.storage.local.set({
        recording: {
          ...r,
          steps: [
            ...r.steps,
            navigationStep(
              tab.url,
              `navigation_${Date.now()}_${r.steps.length}`,
            ),
          ],
        },
      });
      await inject(tabId).catch(async () => {
        await stop({
          ...r,
          limitation:
            "Navigation could not be reattached. Reinvoke the extension and review the partial draft.",
        });
      });
    })
    .catch(() => {});
});
chrome.tabs.onRemoved.addListener((tabId) => {
  writing = writing
    .then(() => read())
    .then((r) =>
      r?.tabId === tabId
        ? stop({ ...r, limitation: "The recorded tab closed. Draft retained." })
        : undefined,
    )
    .catch(() => {});
});
