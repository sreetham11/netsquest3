"use client";

import { Icon } from "@/components/Icon";

// Two-beat animated intro shown when tapping the "Scan & Pay" nav action,
// before the existing scan/split UI at SCAN_ACTION.href appears. Pure
// CSS-keyframe decoration (nfc-ping / face-scan, see globals.css) layered in
// front of navigation — it does not call, wrap, or delay any Server Action;
// AppShell owns the timers and navigates once this is done or skipped.
export type ScanPayStage = "nfc" | "faceid";

export function ScanPayIntro({
  stage,
  onSkip,
}: {
  stage: ScanPayStage;
  onSkip: () => void;
}) {
  return (
    <div
      role="button"
      aria-label="Skip"
      tabIndex={0}
      onClick={onSkip}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onSkip();
      }}
      className="absolute inset-0 z-40 flex flex-col items-center justify-center gap-6 bg-hero text-white"
    >
      {stage === "nfc" ? (
        <>
          <div className="relative flex h-28 w-28 items-center justify-center">
            {/* Three staggered expanding rings — a CSS-only "radar ping",
                looping until this stage ends. */}
            <span className="absolute inset-0 animate-nfc-ping rounded-full border-2 border-white" />
            <span
              className="absolute inset-0 animate-nfc-ping rounded-full border-2 border-white"
              style={{ animationDelay: "0.4s" }}
            />
            <span
              className="absolute inset-0 animate-nfc-ping rounded-full border-2 border-white"
              style={{ animationDelay: "0.8s" }}
            />
            <span className="relative flex h-14 w-14 items-center justify-center rounded-full bg-white/15">
              <Icon name="contactless" size={28} />
            </span>
          </div>
          <p className="text-base font-medium">Hold Near Reader</p>
        </>
      ) : (
        <>
          <div className="relative flex h-28 w-28 items-center justify-center">
            {/* Viewfinder corners + a scanning line sweeping through the
                frame — decorative Face ID convention, not a real scan. */}
            <span className="absolute inset-0 overflow-hidden rounded-3xl border-2 border-white/40">
              <span className="absolute inset-x-0 top-1/2 h-0.5 animate-face-scan bg-white" />
            </span>
            <span className="absolute -left-1 -top-1 h-5 w-5 rounded-tl-lg border-l-2 border-t-2 border-white" />
            <span className="absolute -right-1 -top-1 h-5 w-5 rounded-tr-lg border-r-2 border-t-2 border-white" />
            <span className="absolute -bottom-1 -left-1 h-5 w-5 rounded-bl-lg border-b-2 border-l-2 border-white" />
            <span className="absolute -bottom-1 -right-1 h-5 w-5 rounded-br-lg border-b-2 border-r-2 border-white" />
            <Icon name="face" size={40} className="text-white" />
          </div>
          <p className="text-base font-medium">Scanning Face ID…</p>
        </>
      )}
      <p className="text-xs text-white/60">Tap to skip</p>
    </div>
  );
}
