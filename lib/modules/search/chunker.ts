const MAX_CHARS = 420;
const HARD_SPLIT_OVERLAP = 40;

/**
 * Split long entries into paragraph/sentence-sized chunks. Chinese text has no
 * spaces, so sentence punctuation and paragraph breaks are the primary signals.
 */
export function chunkText(text: string): string[] {
  const normalized = text.trim();
  if (!normalized) return [];
  if (normalized.length <= MAX_CHARS) return [normalized];

  const chunks: string[] = [];
  const paragraphs = normalized.split(/\n{2,}/);

  for (const paragraph of paragraphs) {
    if (paragraph.length <= MAX_CHARS) {
      chunks.push(paragraph);
      continue;
    }

    const sentences = paragraph.split(/(?<=[。！？!?；;])/);
    let buffer = "";

    for (const sentence of sentences) {
      if (sentence.length > MAX_CHARS) {
        if (buffer) {
          chunks.push(buffer);
          buffer = "";
        }

        for (
          let index = 0;
          index < sentence.length;
          index += MAX_CHARS - HARD_SPLIT_OVERLAP
        ) {
          chunks.push(sentence.slice(index, index + MAX_CHARS));
        }
        continue;
      }

      if (buffer.length + sentence.length <= MAX_CHARS) {
        buffer += sentence;
      } else {
        if (buffer) chunks.push(buffer);
        buffer = sentence;
      }
    }

    if (buffer) chunks.push(buffer);
  }

  return chunks.filter((chunk) => chunk.trim().length > 0);
}
