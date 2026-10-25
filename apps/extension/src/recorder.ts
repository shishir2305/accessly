// Runs only in Chrome's isolated extension world after explicit user initiation.
(() => {
  const w = window as any;
  w.__accesslyStopRecording?.();
  const listeners: [string, EventListener][] = [];
  const seenInputs = new WeakSet<Element>();
  let sequence = 0;
  let lastActivationKey = 0;
  const emit = (step: object) => {
    void chrome.runtime
      .sendMessage({ type: "recorded-step", step })
      .catch(() => w.__accesslyStopRecording?.());
  };
  function target(el: Element) {
    const testId = el.getAttribute("data-testid");
    if (testId && /^[a-zA-Z][a-zA-Z0-9_-]{0,63}$/.test(testId))
      return { by: "testId", value: testId };
    if (/^[a-zA-Z][a-zA-Z0-9_-]{0,63}$/.test(el.id))
      return { by: "id", value: el.id };
    return null;
  }
  const id = () => `recorded_${Date.now()}_${++sequence}`;
  function listen(type: string, handler: (e: Event) => void) {
    const safeHandler: EventListener = (e) => {
      if (e.isTrusted) handler(e);
    };
    document.addEventListener(type, safeHandler, true);
    listeners.push([type, safeHandler]);
  }
  listen("click", (e) => {
    if ((e as MouseEvent).detail === 0 && Date.now() - lastActivationKey < 500)
      return;
    const el = (e.target as Element)?.closest(
      "button,a,input[type=submit],[role=button],[role=tab],[role=menuitem]",
    );
    if (!el) return;
    const locator = target(el);
    if (!locator) {
      emit({
        id: id(),
        label: "Unsupported recorded control",
        action: "unsupported",
        reason:
          "Add a stable id/testId or manually define a reviewed role/label locator.",
      });
      return;
    }
    const text = `${el.textContent} ${el.getAttribute("aria-label")} ${el.getAttribute("href")}`;
    const effect = /delete|destroy/i.test(text)
      ? "delete"
      : /purchase|checkout|pay|order/i.test(text)
        ? "purchase"
        : /send|publish/i.test(text)
          ? "message"
          : /register|create.?account/i.test(text)
            ? "account"
            : /save|update/i.test(text)
              ? "settings"
              : el.closest("form")?.method !== "dialog" &&
                  ((el instanceof HTMLButtonElement && el.type === "submit") ||
                    (el instanceof HTMLInputElement && el.type === "submit"))
                ? "submission"
                : "ui";
    emit({
      id: id(),
      label: "Recorded activation (review action boundary)",
      action: "click",
      locator,
      effect,
    });
  });
  listen("input", (e) => {
    const el = e.target as Element;
    if (seenInputs.has(el)) return;
    seenInputs.add(el);
    const locator = target(el);
    const inputId = id();
    if (locator)
      emit({
        id: inputId,
        label: "Runtime input required; value omitted",
        action: "input",
        locator,
        inputRef: `input_${++sequence}`,
      });
    else
      emit({
        id: inputId,
        label: "Unsupported input locator",
        action: "unsupported",
        reason:
          "Input value omitted. Add a stable locator and runtime input reference manually.",
      });
  });
  listen("change", (e) => {
    if (!(e.target instanceof HTMLSelectElement)) return;
    const locator = target(e.target);
    if (locator)
      emit({
        id: id(),
        label: "Runtime selection required; value omitted",
        action: "select",
        locator,
        inputRef: `selection_${++sequence}`,
      });
  });
  listen("keydown", (e) => {
    const event = e as KeyboardEvent;
    if (event.altKey || event.ctrlKey || event.metaKey || event.isComposing)
      return;
    const key =
      event.key === " "
        ? "Space"
        : event.key === "Tab" && event.shiftKey
          ? "Shift+Tab"
          : event.key;
    if (
      ![
        "Tab",
        "Shift+Tab",
        "Enter",
        "Space",
        "Escape",
        "ArrowDown",
        "ArrowUp",
        "ArrowLeft",
        "ArrowRight",
        "Home",
        "End",
      ].includes(key)
    )
      return;
    if (["Enter", "Space"].includes(key)) lastActivationKey = Date.now();
    emit({
      id: id(),
      label: "Recorded keyboard action (review effect)",
      action: "key",
      key,
      effect: ["Enter", "Space"].includes(key) ? "submission" : "ui",
    });
  });
  w.__accesslyStopRecording = () => {
    for (const [type, handler] of listeners)
      document.removeEventListener(type, handler, true);
    clearTimeout(expiry);
  };
  const expiry = setTimeout(() => w.__accesslyStopRecording(), 30 * 60 * 1000);
})();
