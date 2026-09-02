"use client";

// Standard on/off switch — accent fill when on, neutral track when off,
// sliding white knob. Purely presentational: the caller owns the checked
// state entirely (no internal state, no persistence of its own).
export function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={
        "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors " +
        (checked ? "bg-accent" : "bg-neutral-300")
      }
    >
      <span
        className={
          "inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform " +
          (checked ? "translate-x-6" : "translate-x-1")
        }
      />
    </button>
  );
}
