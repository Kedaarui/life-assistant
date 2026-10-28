function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function HighlightText({
  text,
  query,
}: {
  text: string;
  query: string;
}) {
  const terms = [
    ...new Set(
      query
        .split(/[\s,，。！!？?、；;：:]+/)
        .map((term) => term.trim())
        .filter((term) => term.length >= 2),
    ),
  ]
    .sort((a, b) => b.length - a.length)
    .slice(0, 12);

  if (terms.length === 0) return <>{text}</>;

  const pattern = new RegExp(
    `(${terms.map(escapeRegExp).join("|")})`,
    "gi",
  );
  const parts = text.split(pattern);
  const lowerTerms = new Set(terms.map((term) => term.toLowerCase()));

  return (
    <>
      {parts.map((part, index) =>
        lowerTerms.has(part.toLowerCase()) ? (
          <mark
            key={index}
            className="rounded bg-accent-soft px-0.5 text-inherit"
          >
            {part}
          </mark>
        ) : (
          <span key={index}>{part}</span>
        ),
      )}
    </>
  );
}
