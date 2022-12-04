export function hashString(value: string) {
  let hash = 0;
  if (value.length === 0) {
    return hash;
  }
  for (let i = 0; i < value.length; i++) {
    const char = value.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash &= hash; // Convert to 32bit integer
  }
  return hash;
}

export function mapLineOffsets(text: string): Map<number, number> {
  const indexes = new Map<number, number>();
  indexes.set(1, 0);
  let line = 2;
  for (let index = 0; index < text.length; index++) {
    if (text[index] === "\n") {
      indexes.set(line, index + 1);
      line++;
    }
  }

  return indexes;
}

// Assign a CSS class based on a rule's category ID
export function getSeverityClassName(severity: string) {
  switch (severity) {
    case "warning":
      return "sc-minor";
    case "error":
      return "sc-major";
    default:
      return "sc-style";
  }
}
