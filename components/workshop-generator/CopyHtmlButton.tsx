"use client";

type CopyHtmlButtonProps = {
  disabled?: boolean;
  disabledMessage?: string;
  html: string;
  onCopied: (message: string, success: boolean) => void;
};

async function copyTextToClipboard(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.setAttribute("readonly", "");
    textArea.style.position = "fixed";
    textArea.style.left = "-9999px";
    textArea.style.top = "0";
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    textArea.setSelectionRange(0, textArea.value.length);

    try {
      return document.execCommand("copy");
    } finally {
      document.body.removeChild(textArea);
    }
  }
}

export function CopyHtmlButton({ disabled = false, disabledMessage = "Canvas HTML is not ready to copy.", html, onCopied }: CopyHtmlButtonProps) {
  async function handleCopy() {
    if (disabled) {
      onCopied(disabledMessage, false);
      return;
    }

    try {
      const copied = await copyTextToClipboard(html);
      if (!copied) {
        throw new Error("Clipboard copy returned false.");
      }
      onCopied("Canvas-ready HTML copied to clipboard.", true);
    } catch {
      onCopied("Copy failed. Select and copy from the HTML panel below.", false);
    }
  }

  return (
    <button className="btn primary" type="button" onClick={handleCopy} disabled={disabled}>
      Copy HTML
    </button>
  );
}
