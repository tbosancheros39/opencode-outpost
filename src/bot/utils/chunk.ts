/**
 * Splits output into Telegram-safe chunks (max 4000 chars)
 * and escapes HTML special characters for <pre><code> blocks.
 */
export function chunkOutput(text: string, maxLength: number = 4000): string[] {
  if (!text || text.trim() === "") {
    return ["(no output)"];
  }

  const escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  const chunks: string[] = [];
  for (let i = 0; i < escaped.length; i += maxLength) {
    chunks.push(escaped.substring(i, i + maxLength));
  }
  return chunks;
}
