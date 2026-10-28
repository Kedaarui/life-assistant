export type Citation = {
  ref: string;
  entryId: string;
  title: string;
  date: string;
};

export type CitationSegment =
  | { type: "text"; value: string }
  | { type: "citation"; ref: string; value: string };

const CITATION_PATTERN = /\[\[?(E\d+)\]\]?/g;

/**
 * Split model output into plain text and citation markers such as [[E1]].
 * Both [[E1]] and [E1] are accepted.
 */
export function splitCitationSegments(content: string): CitationSegment[] {
  const segments: CitationSegment[] = [];
  const pattern = new RegExp(CITATION_PATTERN.source, "g");
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(content)) !== null) {
    const index = match.index;
    if (index > lastIndex) {
      segments.push({ type: "text", value: content.slice(lastIndex, index) });
    }
    segments.push({ type: "citation", ref: match[1], value: match[0] });
    lastIndex = index + match[0].length;
  }

  if (lastIndex < content.length) {
    segments.push({ type: "text", value: content.slice(lastIndex) });
  }

  return segments;
}

export function stripCitationMarkers(content: string) {
  return content
    .replace(new RegExp(CITATION_PATTERN.source, "g"), "")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

export function extractCitations(content: string, citations: Citation[]) {
  const byRef = new Map(citations.map((citation) => [citation.ref, citation]));
  const seen = new Set<string>();
  const result: Citation[] = [];

  for (const segment of splitCitationSegments(content)) {
    if (segment.type !== "citation") continue;
    const citation = byRef.get(segment.ref);
    if (citation && !seen.has(segment.ref)) {
      seen.add(segment.ref);
      result.push(citation);
    }
  }

  return result;
}
