const riskyMentionPatterns = [
  /\(met\)[^)]+\(met\)/gi,
  /\(rol\)[^)]+\(rol\)/gi,
  /\(chn\)[^)]+\(chn\)/gi,
  /\(emj\)[^)]+\(emj\)/gi,
  /@everyone/gi,
  /@here/gi
];

export function sanitizeKookText(value: string | number | null | undefined, maxLength = 800): string {
  let text = String(value ?? "").replace(/\s+/g, " ").trim();

  for (const pattern of riskyMentionPatterns) {
    text = text.replace(pattern, "[mention removed]");
  }

  return text.slice(0, maxLength);
}

export function formatSourceLine(sourceName: string, freshness: string, updated?: string): string {
  const updatedText = updated ? ` · ${updated}` : "";
  return `Source: ${sanitizeKookText(sourceName, 120)} · ${sanitizeKookText(freshness, 40)}${updatedText}`;
}

