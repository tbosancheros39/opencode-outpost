const MARKDOWN_V2_SPECIAL_CHARS = /[_*[\]()~`>#+=|{}.!\\-]/g;

export function escapeMd(text: string): string {
  return text.replace(MARKDOWN_V2_SPECIAL_CHARS, "\\$&");
}

export function escapeCode(text: string): string {
  return text.replace(/`/g, "'");
}
