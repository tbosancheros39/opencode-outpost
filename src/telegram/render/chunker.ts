const MAX_LENGTH = 4000;

export function chunkOutput(text: string, maxLength: number = MAX_LENGTH): string[] {
  if (!text || text.trim() === "") {
    return ["(no output)"];
  }

  if (text.length <= maxLength) {
    return [text];
  }

  const chunks: string[] = [];
  let remaining = text;

  while (remaining.length > maxLength) {
    let cutPoint = remaining.lastIndexOf("\n", maxLength);
    if (cutPoint === -1 || cutPoint === 0) {
      cutPoint = maxLength;
    }

    const upToCut = remaining.slice(0, cutPoint);
    const codeBlockCount = (upToCut.match(/```/g) ?? []).length;
    if (codeBlockCount % 2 !== 0) {
      const closingIdx = remaining.indexOf("```", cutPoint);
      cutPoint = closingIdx !== -1 ? closingIdx + 3 : maxLength;
    }

    chunks.push(remaining.slice(0, cutPoint).trim());
    remaining = remaining.slice(cutPoint).trim();
  }

  if (remaining.length > 0) {
    chunks.push(remaining);
  }

  return chunks;
}
