import { ReactNode } from "react";

// Swap the logo mark + name per client.
const LogoMark = (
  <span className="grid h-9 w-9 place-items-center rounded-[10px] bg-brand shadow-brand">
    <svg viewBox="0 0 32 32" fill="none" className="h-5 w-5" aria-hidden="true">
      <path d="M8 21h16M11 21V11m5 10V14m5 7v-4" stroke="white" strokeWidth="2.6" strokeLinecap="round" />
    </svg>
  </span>
);

export function Brand({ name = "Acme", sub }: { name?: string; sub?: string }) {
  return (
    <span className="flex items-center gap-3 font-display text-lg font-bold tracking-tight text-ink">
      {LogoMark}
      {name}{sub ? <>&nbsp;<span className="font-medium text-muted">{sub}</span></> : null}
    </span>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-xl border border-line bg-white shadow-card ${className}`}>{children}</div>;
}

export function Stat({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  return (
    <Card className="p-5">
      <div className="text-sm text-muted">{label}</div>
      <div className="mt-1 font-display text-2xl font-bold text-ink">{value}</div>
      {hint ? <div className="mt-1 text-xs text-muted">{hint}</div> : null}
    </Card>
  );
}

const TONES: Record<string, string> = {
  brand: "bg-brand-soft text-brand-600",
  gold: "bg-[#FBF1D9] text-[#8A6A12]",
  gray: "bg-surface-soft text-muted",
  green: "bg-[#E7F8ED] text-success",
  red: "bg-[#FDECEC] text-[#B42318]",
  done: "bg-[#15803D] text-white",
  progress: "bg-brand text-white",
  waiting: "bg-[#B57506] text-white",
  overdue: "bg-[#B42318] text-white",
  upcoming: "bg-[#6B7385] text-white",
};

export function Badge({ children, tone = "brand" }: { children: ReactNode; tone?: keyof typeof TONES }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${TONES[tone]}`}>
      {children}
    </span>
  );
}

export const inputClass =
  "w-full rounded-[11px] border border-line-strong bg-surface-soft px-3.5 py-3 text-ink outline-none transition focus:border-brand focus:bg-white focus:ring-2 focus:ring-brand-soft";
export const btnPrimary =
  "inline-flex items-center justify-center gap-2 rounded-full bg-brand px-5 py-3 font-display text-sm font-semibold text-white shadow-brand transition hover:-translate-y-0.5";
export const btnGhost =
  "inline-flex items-center justify-center gap-2 rounded-full border border-line-strong bg-transparent px-5 py-3 font-display text-sm font-semibold text-ink transition hover:-translate-y-0.5 hover:bg-surface-soft";
