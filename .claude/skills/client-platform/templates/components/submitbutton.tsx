"use client";

import { useFormStatus } from "react-dom";

// Submit button with a pending spinner + label; disables itself while the
// form's server action runs so people don't double-submit. Drop-in for <button>.
export function SubmitButton({
  children,
  pendingText,
  className = "",
}: {
  children: React.ReactNode;
  pendingText?: string;
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} aria-busy={pending} className={`${className} ${pending ? "cursor-wait opacity-80" : ""}`}>
      <span className="inline-flex items-center justify-center gap-2">
        {pending ? (
          <>
            <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4 animate-spin" aria-hidden="true">
              <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" className="opacity-25" />
              <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
            </svg>
            {pendingText || "Please wait…"}
          </>
        ) : (
          children
        )}
      </span>
    </button>
  );
}
