import { createHash } from "node:crypto";
import type { ScanResult, Check } from "@accessly/contracts";
export function fingerprint(scan: ScanResult, rule: string, locator: string) {
  return createHash("sha256")
    .update(
      JSON.stringify([
        scan.applicationId,
        scan.environmentId,
        scan.context.url,
        scan.context.state,
        scan.context.role,
        scan.context.authentication,
        rule,
        locator,
      ]),
    )
    .digest("hex");
}
const guidance: Record<string, { impact: string; remedy: string }> = {
  "button-name": {
    impact:
      "A person using assistive technology may be unable to identify what this button does.",
    remedy:
      "Give the button a meaningful accessible name that matches its intended action. Confirm wording with the product owner when intent is unknown.",
  },
  "link-name": {
    impact:
      "A person using assistive technology may be unable to identify the link destination or purpose.",
    remedy:
      "Provide link text or an accessible name that describes its purpose in context. Do not invent the destination’s meaning.",
  },
  label: {
    impact:
      "A person may be unable to identify which information a form control expects.",
    remedy:
      "Associate a visible, descriptive label with the control. Preserve instructions and validate the actual form behavior.",
  },
  "image-alt": {
    impact:
      "Information conveyed by an image may be unavailable to people who cannot see it.",
    remedy:
      "Determine whether the image conveys information or is decorative. Provide a contextual alternative or an empty alt attribute as appropriate; human intent is required.",
  },
  "color-contrast": {
    impact:
      "Text may be difficult to read for people with low vision or color perception differences.",
    remedy:
      "Adjust the relevant text and background colors while preserving design meaning. Reassess the same presentation state and review visual context.",
  },
  "html-has-lang": {
    impact:
      "Assistive technology may use an unsuitable pronunciation for this document.",
    remedy:
      "Set the document language to the language actually used. Review mixed-language content separately.",
  },
};
export function explain(check: Check) {
  const known = guidance[check.rule];
  return {
    impact:
      known?.impact ??
      "This rule identifies a potential barrier for people relying on accessible structure or interaction. The affected task and actual user impact require contextual review.",
    remedy:
      known?.remedy ??
      `${check.description} Review the linked rule documentation and the intended user experience before changing the application.`,
    certainty:
      check.outcome === "incomplete"
        ? "Requires human review"
        : "Automated rule observation; task impact is contextual",
    severity: check.impact ?? "unrated",
  };
}

export * from "./verification";
