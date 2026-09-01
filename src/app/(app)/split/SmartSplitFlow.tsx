"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Avatar } from "@/components/ui/Avatar";
import { EmptyState } from "@/components/ui/EmptyState";
import { Icon } from "@/components/Icon";
import { ActivityList } from "../transactions/ActivityList";
import { NewSplitForm } from "./NewSplitForm";
import { useEmailLookup } from "./useEmailLookup";
import { formatMoney } from "@/lib/format";
import { transactionCategoryToIconCategory } from "@/lib/categoryIcon";

type Txn = {
  id: string;
  description: string;
  category: string;
  amountCents: number;
  type: string;
  country: string | null;
  createdAt: Date;
};

type RecentPartner = { userId: string; name: string };

type Step = "select" | "name" | "people" | "form";

const STEP_LABELS: Record<Exclude<Step, "form">, string> = {
  select: "1 of 3 · Select transactions",
  name: "2 of 3 · Name your split",
  people: "3 of 3 · Choose who to split with",
};

// Same category vocabulary check as split/page.tsx's "Split this" prefill
// (transactionCategoryToIconCategory maps into a wider vocabulary than
// NewSplitForm's own 5-value dropdown covers) — applied to the first
// selected transaction when multiple span different categories.
const SPLIT_CATEGORY_VALUES = new Set(["General", "food", "cafe", "ride", "grocery"]);

function mappedCategoryFor(txn: Txn | undefined): string {
  if (!txn) return "General";
  const mapped = transactionCategoryToIconCategory(txn.category);
  return mapped && SPLIT_CATEGORY_VALUES.has(mapped) ? mapped : "General";
}

const DEFAULT_NAME = "You";

// Smart Split: Select Transaction(s) -> Name -> Choose People, then hands
// off into the exact same NewSplitForm/createSplit path "Split this" already
// uses (see NewSplitForm's initialItems/initialNames/initialParticipantUserIds
// props) — two starting points feeding one underlying split-creation flow,
// not a parallel reimplementation of it.
export function SmartSplitFlow({
  txns,
  currency,
  recentPartners,
}: {
  txns: Txn[];
  currency: string;
  recentPartners: RecentPartner[];
}) {
  const router = useRouter();
  // Stable reference (router itself is stable across renders) so
  // NewSplitForm's own success effect can safely list this in its
  // dependency array without re-firing on every unrelated re-render.
  const handleCreated = useCallback(() => router.push("/split"), [router]);
  const [step, setStep] = useState<Step>("select");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [title, setTitle] = useState("");
  const [titleTouched, setTitleTouched] = useState(false);
  const [names, setNames] = useState<string[]>([DEFAULT_NAME]);
  const [participantUserIds, setParticipantUserIds] = useState<Record<string, string>>({});
  const [nameInput, setNameInput] = useState("");
  const displayedMatch = useEmailLookup(nameInput);

  const selectedTxns = useMemo(() => txns.filter((t) => selectedIds.has(t.id)), [txns, selectedIds]);
  const totalCents = selectedTxns.reduce((s, t) => s + Math.abs(t.amountCents), 0);

  // Sensible default: the transaction's own description when only one was
  // picked, otherwise the first plus a count. Derived at render time (not
  // synced via an effect) so it stays live as the selection changes on step
  // 1, right up until the user actually types their own title on step 2.
  const defaultTitle = useMemo(() => {
    if (selectedTxns.length === 0) return "";
    if (selectedTxns.length === 1) return selectedTxns[0].description;
    return `${selectedTxns[0].description} +${selectedTxns.length - 1} more`;
  }, [selectedTxns]);
  const displayTitle = titleTouched ? title : defaultTitle;

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function addQuickPartner(p: RecentPartner) {
    if (names.includes(p.name)) return;
    setNames((prev) => [...prev, p.name]);
    setParticipantUserIds((prev) => ({ ...prev, [p.name]: p.userId }));
  }

  function addName() {
    const n = nameInput.trim();
    if (!n || names.includes(n)) {
      setNameInput("");
      return;
    }
    setNames((prev) => [...prev, n]);
    setNameInput("");
  }

  function addLinkedUser(result: NonNullable<typeof displayedMatch>) {
    if (!names.includes(result.displayName)) {
      setNames((prev) => [...prev, result.displayName]);
      setParticipantUserIds((prev) => ({ ...prev, [result.displayName]: result.userId }));
    }
    setNameInput("");
  }

  function removeName(n: string) {
    setNames((prev) => prev.filter((x) => x !== n));
    setParticipantUserIds((prev) => {
      if (!(n in prev)) return prev;
      const next = { ...prev };
      delete next[n];
      return next;
    });
  }

  function goBack() {
    if (step === "name") setStep("select");
    else if (step === "people") setStep("name");
  }

  if (step === "form") {
    return (
      <NewSplitForm
        initialTitle={displayTitle}
        initialTotalAmount={(totalCents / 100).toFixed(2)}
        initialCategory={mappedCategoryFor(selectedTxns[0])}
        initialItems={selectedTxns.map((t) => ({
          name: t.description,
          price: (Math.abs(t.amountCents) / 100).toFixed(2),
        }))}
        initialNames={names}
        initialParticipantUserIds={participantUserIds}
        onCreated={handleCreated}
      />
    );
  }

  return (
    <div className="flex flex-col gap-stack-md">
      <div className="flex items-center gap-2">
        {step === "select" ? (
          <Link
            href="/split"
            aria-label="Back to Split"
            className="flex h-9 w-9 items-center justify-center rounded-full text-on-surface hover:bg-surface-container-low"
          >
            <Icon name="chevron-left" size={20} />
          </Link>
        ) : (
          <button
            type="button"
            onClick={goBack}
            aria-label="Back"
            className="flex h-9 w-9 items-center justify-center rounded-full text-on-surface hover:bg-surface-container-low"
          >
            <Icon name="chevron-left" size={20} />
          </button>
        )}
        <span className="text-label-md font-semibold uppercase tracking-widest text-on-surface-variant">
          {STEP_LABELS[step]}
        </span>
      </div>

      {step === "select" ? (
        <div className="flex flex-col gap-stack-md">
          <p className="text-body-md text-on-surface-variant">
            Pick one or more payments to split. Only real NETS payments show up here.
          </p>
          {txns.length === 0 ? (
            <EmptyState
              icon={<Icon name="split" size={22} />}
              title="Nothing to split yet"
              description="Make a NETS payment first, then come back to split it with friends."
            />
          ) : (
            <ActivityList
              txns={txns}
              currency={currency}
              selectable
              selectedIds={selectedIds}
              onToggleSelect={toggleSelect}
            />
          )}
          <div className="flex items-center justify-between gap-4 rounded-lg border border-border-light bg-surface-container-lowest p-4">
            <div>
              <p className="text-label-md text-on-surface-variant">
                {selectedTxns.length} selected
              </p>
              <p className="text-title-lg text-on-surface">{formatMoney(totalCents, currency)}</p>
            </div>
            <Button
              type="button"
              onClick={() => setStep("name")}
              disabled={selectedTxns.length === 0}
            >
              Continue
            </Button>
          </div>
        </div>
      ) : null}

      {step === "name" ? (
        <Card className="flex flex-col gap-stack-md">
          <div className="divide-y divide-border-light rounded-lg border border-border-light">
            {selectedTxns.map((t) => (
              <div key={t.id} className="flex items-center justify-between px-3 py-2.5">
                <span className="text-body-md text-on-surface">{t.description}</span>
                <span className="text-body-md font-medium text-on-surface">
                  {formatMoney(Math.abs(t.amountCents), currency)}
                </span>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between">
            <span className="text-body-lg font-semibold text-on-surface">Total</span>
            <span className="text-title-lg text-on-surface">{formatMoney(totalCents, currency)}</span>
          </div>
          <label className="flex flex-col gap-1.5">
            <span className="text-body-md font-medium text-on-surface">What&apos;s it for?</span>
            <input
              value={displayTitle}
              onChange={(e) => {
                setTitle(e.target.value);
                setTitleTouched(true);
              }}
              placeholder="e.g. Dinner at Din Tai Fung"
              className="rounded-lg border border-border-light bg-surface-container-lowest px-3 py-2.5 text-body-lg text-on-surface outline-none focus:border-primary"
            />
          </label>
          <div className="flex gap-2">
            <Button type="button" variant="secondary" onClick={() => setStep("select")}>
              Back
            </Button>
            <Button
              type="button"
              onClick={() => setStep("people")}
              disabled={displayTitle.trim().length === 0}
              className="flex-1 justify-center"
            >
              Continue
            </Button>
          </div>
        </Card>
      ) : null}

      {step === "people" ? (
        <Card className="flex flex-col gap-stack-lg">
          {recentPartners.length > 0 ? (
            <div className="flex flex-col gap-2">
              <span className="text-body-md font-medium text-on-surface">Split with again</span>
              <div className="flex flex-wrap gap-2">
                {recentPartners.map((p) => {
                  const added = names.includes(p.name);
                  return (
                    <button
                      key={p.userId}
                      type="button"
                      onClick={() => addQuickPartner(p)}
                      disabled={added}
                      className={
                        "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-label-md font-medium transition-colors " +
                        (added
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border-light bg-surface-container-lowest text-on-surface hover:bg-surface-container-low")
                      }
                    >
                      <Avatar name={p.name} size={20} />
                      {p.name}
                      {added ? <Icon name="check" size={12} /> : null}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}

          <div className="flex flex-col gap-1.5">
            <span className="text-body-md font-medium text-on-surface">Who&apos;s splitting it?</span>
            <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border-light bg-surface-container-lowest p-2">
              {names.map((n) => (
                <span
                  key={n}
                  className="inline-flex items-center gap-1 rounded-full bg-primary/10 py-1 pl-3 pr-1.5 text-label-md font-medium text-primary"
                >
                  {participantUserIds[n] ? (
                    <Icon name="check-circle" size={12} aria-hidden={false} aria-label="Registered user" />
                  ) : null}
                  {n}
                  <button
                    type="button"
                    onClick={() => removeName(n)}
                    aria-label={`Remove ${n}`}
                    className="flex h-4 w-4 items-center justify-center rounded-full hover:bg-primary/20"
                  >
                    <Icon name="plus" size={11} className="rotate-45" />
                  </button>
                </span>
              ))}
              <input
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addName();
                  }
                }}
                placeholder="Type a name or email, press Enter"
                className="min-w-[140px] flex-1 border-none bg-transparent px-2 py-1 text-body-md text-on-surface outline-none placeholder:text-on-surface-variant"
              />
            </div>
            {/* Explicit, separate action from Enter-to-add — same as
                NewSplitForm's own input: matching a real account never forces
                linking, it's just offered. Strict exact-match only, never a
                browsable list — see findRegisteredUserByEmail. */}
            {displayedMatch ? (
              <button
                type="button"
                onClick={() => addLinkedUser(displayedMatch)}
                className="inline-flex w-fit items-center gap-1.5 rounded-full border border-primary bg-primary/5 px-3 py-1.5 text-label-md font-medium text-primary hover:bg-primary/10"
              >
                <Icon name="check-circle" size={13} />
                Add {displayedMatch.displayName} as registered user
              </button>
            ) : null}
          </div>

          <div className="flex gap-2">
            <Button type="button" variant="secondary" onClick={() => setStep("name")}>
              Back
            </Button>
            <Button type="button" onClick={() => setStep("form")} className="flex-1 justify-center">
              Continue
            </Button>
          </div>
        </Card>
      ) : null}
    </div>
  );
}
