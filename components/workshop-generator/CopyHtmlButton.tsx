"use client";

type CopyHtmlButtonProps = {
  html: string;
  onCopied: (message: string, success: boolean) => void;
};

export function CopyHtmlButton({ html, onCopied }: CopyHtmlButtonProps) {
  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(html);
      onCopied("Canvas-ready HTML copied to clipboard.", true);
    } catch {
      onCopied("Copy failed. Select and copy from the HTML panel below.", false);
    }
  }

  return (
    <button className="btn primary" type="button" onClick={handleCopy}>
      Copy HTML
    </button>
  );
}
