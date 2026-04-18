export function renderCodeBlock(lang: string | null, value: string): string {
  const language = lang ?? "";
  const safe = value.replace(/```/g, "'''");
  return `\`\`\`${language}\n${safe}\n\`\`\``;
}

export function renderInlineCode(value: string): string {
  return `\`${value.replace(/`/g, "'")}\``;
}
