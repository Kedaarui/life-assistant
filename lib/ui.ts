const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/35 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas";

export const btnPrimary =
  `inline-flex items-center justify-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-[13px] font-medium text-white transition hover:bg-accent-deep disabled:cursor-not-allowed disabled:opacity-50 ${focusRing}`;

export const btnSecondary =
  `inline-flex items-center justify-center gap-1.5 rounded-lg border border-line bg-surface px-4 py-2 text-[13px] font-medium text-ink-soft transition hover:border-line-strong hover:bg-surface-soft hover:text-ink disabled:opacity-50 ${focusRing}`;

export const btnGhost =
  `inline-flex items-center justify-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[13px] text-ink-soft transition hover:bg-surface-soft hover:text-ink ${focusRing}`;

export const btnDanger =
  `inline-flex items-center justify-center gap-1.5 rounded-lg border border-danger/25 bg-surface px-4 py-2 text-[13px] font-medium text-danger transition hover:bg-danger/5 ${focusRing}`;

export const inputClass =
  `h-10 w-full rounded-lg border border-line bg-surface px-3.5 text-[14px] text-ink placeholder:text-ink-faint transition focus:border-accent/60 focus:outline-none focus:ring-2 focus:ring-accent/10`;

export const textareaClass =
  `w-full resize-y rounded-lg border border-line bg-surface px-3.5 py-2.5 text-[14px] leading-6 text-ink placeholder:text-ink-faint transition focus:border-accent/60 focus:outline-none focus:ring-2 focus:ring-accent/10`;

export const selectClass =
  `h-10 w-full rounded-lg border border-line bg-surface px-3.5 text-[14px] text-ink transition focus:border-accent/60 focus:outline-none focus:ring-2 focus:ring-accent/10`;

export const labelClass = "text-[12px] font-medium text-ink-soft";

export const cardClass =
  "rounded-xl border border-line bg-surface shadow-card";

export const cardHeaderClass =
  "flex items-center justify-between gap-3 border-b border-line px-5 py-3.5";

export const cardTitleClass = "text-[15px] font-semibold text-ink";

export const sectionLabelClass =
  "text-[12px] font-medium text-ink-faint";
