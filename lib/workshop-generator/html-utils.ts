export const assetBaseUrl =
  process.env.NEXT_PUBLIC_WORKSHOP_ASSET_BASE_URL?.trim().replace(/\/+$/, "") || "https://workshops.thecnc.network";

export const BRAND_ASSETS = {
  headerBanner: `${assetBaseUrl}/branding/mi-page-header.jpg`,
  logo: `${assetBaseUrl}/branding/mi-logo-short.png`,
  detailsIcon: `${assetBaseUrl}/Details.png`,
  objectivesIcon: `${assetBaseUrl}/Objectives.png`,
  resourcesIcon: `${assetBaseUrl}/Learning%20Resources.png`,
  whatToDoIcon: `${assetBaseUrl}/What%20to%20Do.png`,
  submissionIcon: `${assetBaseUrl}/Details.png`,
  centerImage: "https://placehold.co/400x221/png?text=Workshop+Image",
  footerBanner: `${assetBaseUrl}/branding/mi-page-footer.jpg`
};

export function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function textOr(value: string, fallback: string) {
  const normalized = value.trim();
  return normalized ? escapeHtml(normalized).replace(/\n/g, "<br />") : fallback;
}

export function normalizeList(items: string[]) {
  return items
    .flatMap((item) => item.split(/\r?\n/))
    .map((item) => item.trim())
    .filter(Boolean);
}

export function listItemsOr(items: string[], fallbackCount = 3, options: { checklist?: boolean } = {}) {
  const normalizedItems = normalizeList(items);

  if (normalizedItems.length === 0) {
    return Array.from({ length: fallbackCount })
      .map(() => "<li>&nbsp;</li>")
      .join("");
  }

  return normalizedItems
    .map((item) => `<li>${options.checklist ? "&#9744; " : ""}${escapeHtml(item)}</li>`)
    .join("");
}

export function sectionDivider() {
  return '<hr style="margin: 22px 0; border: none; border-top: 2px solid #0e5a72;" />';
}

export function renderLink(text: string, url: string) {
  const normalizedUrl = url.trim();
  if (!normalizedUrl) return escapeHtml(text);
  return `<a href="${escapeHtml(normalizedUrl)}" target="_blank" rel="noopener">${escapeHtml(text)}</a>`;
}
