import type { MouseEvent } from "react";
import DOMPurify from "dompurify";

let hooksReady = false;

function ensureMailLinkHooks() {
  if (hooksReady) return;
  DOMPurify.addHook("afterSanitizeAttributes", (node) => {
    if (!(node instanceof Element)) return;

    if (node.tagName === "BASE") {
      node.remove();
      return;
    }

    const opensUrl =
      (node.tagName === "A" || node.tagName === "AREA") && node.hasAttribute("href");
    const isForm = node.tagName === "FORM" && node.hasAttribute("action");
    if (!opensUrl && !isForm) return;

    node.setAttribute("target", "_blank");
    if (!isForm) node.setAttribute("rel", "noopener noreferrer");
  });
  hooksReady = true;
}

export function sanitizeMailHtml(html: string) {
  ensureMailLinkHooks();
  return DOMPurify.sanitize(html, {
    USE_PROFILES: { html: true },
    ADD_ATTR: ["target", "rel"],
    FORBID_TAGS: ["base"],
  });
}

const URL_RE = /(https?:\/\/[^\s<]+)/gi;

export function splitTextLinks(text: string) {
  return text.split(URL_RE).map((part) => ({
    text: part,
    href: /^https?:\/\//i.test(part) ? part.replace(/[),.;!?]+$/, "") : null,
  }));
}

export function openMailLink(event: MouseEvent<HTMLElement>) {
  const anchor = (event.target as HTMLElement | null)?.closest?.("a");
  if (!anchor || !anchor.href) return;
  if (anchor.getAttribute("download") !== null) return;

  event.preventDefault();
  window.open(anchor.href, "_blank", "noopener,noreferrer");
}
