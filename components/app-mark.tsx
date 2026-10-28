export function AppMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <rect width="32" height="32" rx="9" fill="currentColor" />
      <circle
        cx="16"
        cy="16"
        r="6.5"
        stroke="#fffcf8"
        strokeWidth="1.8"
      />
      <circle cx="16" cy="16" r="1.9" fill="#fffcf8" />
    </svg>
  );
}
