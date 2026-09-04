"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/Icon";
import { formatMoney } from "@/lib/format";
import { requiredMonthlySavings, actualMonthlyPace } from "@/lib/savingsGoals";

// Fill-in duration for both the progress bar and the count-up figure, so
// they read as one motion rather than two out-of-sync animations.
const ANIMATION_MS = 600;

export type ActiveSavingsGoal = {
  id: string;
  name: string;
  targetAmountCents: number;
  currentSavedCents: number;
  targetDate: Date;
  createdAt: Date;
};

// Home's replacement for the old "Top Spending Categories" donut — a single
// tappable card summarizing the user's nearest unfinished savings goal
// (see home/page.tsx for how "active" is chosen), or a CTA to create one.
// The whole card is one <Link>, not a card containing a separate button —
// avoids nesting an interactive element inside another.
export function SavingsReportCard({
  goal,
  currency,
}: {
  goal: ActiveSavingsGoal | null;
  currency: string;
}) {
  const targetPct =
    goal && goal.targetAmountCents > 0
      ? Math.min(1, goal.currentSavedCents / goal.targetAmountCents) * 100
      : 0;

  const [barPct, setBarPct] = useState(0);
  const [displayedSavedCents, setDisplayedSavedCents] = useState(0);

  useEffect(() => {
    if (!goal) return;

    // Set on the frame AFTER mount (not the same render) so the CSS width
    // transition below actually has a 0% -> target% change to animate,
    // rather than painting at the target width immediately.
    const kickoff = requestAnimationFrame(() => setBarPct(targetPct));

    const target = goal.currentSavedCents;
    const start = performance.now();
    let frame: number;
    function tick(now: number) {
      const t = Math.min(1, (now - start) / ANIMATION_MS);
      const eased = 1 - (1 - t) ** 3; // ease-out cubic, matching the bar's feel
      setDisplayedSavedCents(Math.round(target * eased));
      if (t < 1) frame = requestAnimationFrame(tick);
    }
    frame = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(kickoff);
      cancelAnimationFrame(frame);
    };
  }, [goal, targetPct]);

  if (!goal) {
    return (
      <Link href="/savings-goals" className="block">
        <div className="flex flex-col items-center justify-center rounded-card border border-line bg-surface px-6 py-12 text-center transition-colors hover:bg-surface-muted">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-surface-muted text-ink-muted">
            <Icon name="target" size={22} />
          </div>
          <p className="text-base font-medium text-ink">No savings goal yet</p>
          <p className="mt-1 max-w-sm text-sm text-ink-muted">
            Set a target and see what it&apos;ll take each month to get there.
          </p>
          {/* Styled like ButtonLink's primary variant, but a span — the
              whole card above is already the link, so this can't be a
              second nested anchor. */}
          <span className="mt-4 inline-flex items-center justify-center gap-2 rounded-button bg-accent px-4 py-2 text-sm font-medium text-white">
            Create a savings goal
          </span>
        </div>
      </Link>
    );
  }

  const { monthlyCents: requiredCents } = requiredMonthlySavings(goal);
  const actualCents = actualMonthlyPace(goal);
  const onTrack = actualCents >= requiredCents;

  return (
    <Link href="/savings-goals" className="block">
      <Card padded={false} className="overflow-hidden transition-colors hover:bg-surface-muted">
        <div className="h-1.5 bg-accent" />
        <div className="p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent text-white">
              <Icon name="target" size={18} />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="truncate text-base font-bold text-ink">{goal.name}</h2>
              <p className="text-sm text-ink-muted">
                {formatMoney(displayedSavedCents, currency)} of{" "}
                {formatMoney(goal.targetAmountCents, currency)} saved
              </p>
            </div>
          </div>

          <div className="mt-4 h-3 w-full overflow-hidden rounded-full bg-neutral-200">
            <div
              className="h-full rounded-full bg-accent transition-[width] duration-[600ms] ease-out"
              style={{ width: `${barPct}%` }}
            />
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-button bg-surface-muted px-3 py-2.5">
              <p className="text-xs text-ink-muted">Needed pace</p>
              <p className="mt-0.5 text-sm font-semibold text-ink">
                {formatMoney(requiredCents, currency)}/mo
              </p>
            </div>
            <div className="rounded-button bg-surface-muted px-3 py-2.5">
              <p className="text-xs text-ink-muted">Your pace</p>
              <p
                className={`mt-0.5 text-sm font-semibold ${onTrack ? "text-accent" : "text-danger-strong"}`}
              >
                {formatMoney(actualCents, currency)}/mo
              </p>
            </div>
          </div>
        </div>
      </Card>
    </Link>
  );
}
