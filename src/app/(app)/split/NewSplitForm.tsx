"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useActionState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Icon, type IconName } from "@/components/Icon";
import { formatMoney } from "@/lib/format";
import { DEMO_RECEIPT, type ParsedReceipt } from "@/lib/receipt";
import { createSplit, type CreateSplitState, type UserLookupResult } from "../actions";
import { useEmailLookup } from "./useEmailLookup";

const CATEGORIES: Array<{ value: string; label: string; icon: IconName }> = [
  { value: "General", label: "General", icon: "split" },
  { value: "food", label: "Food", icon: "fast-food" },
  { value: "cafe", label: "Cafe", icon: "coffee" },
  { value: "ride", label: "Ride", icon: "ride" },
  { value: "grocery", label: "Groceries", icon: "grocery" },
];

const DEFAULT_NAME = "You";

type EntryMode = "manual" | "scan";
type ScanStep = "options" | "loading" | "review" | "confirmed" | "error";
type DraftItem = { id: number; name: string; price: string };
type SplitMethod = "equal" | "custom" | "items";

function distributeEqually(totalCents: number, count: number): number[] {
  if (count <= 0) return [];
  const base = Math.floor(totalCents / count);
  const remainder = totalCents - base * count;
  // First `remainder` people carry the extra cent so the split always sums exactly.
  return Array.from({ length: count }, (_, i) => base + (i < remainder ? 1 : 0));
}

// Distributes `deltaCents` (the gap between the scanned items' sum and the
// confirmed total — usually tax/service charge, occasionally a discount)
// across people proportional to each person's item subtotal, via largest-
// remainder rounding — floor everyone's exact share, then hand out the
// leftover cents to whoever's fractional share was biggest, so the parts
// always sum to EXACTLY deltaCents regardless of rounding. Splitting tax
// evenly regardless of what each person ordered would be the simpler
// implementation, but proportional-to-spend is what a real per-item split
// is expected to do.
function distributeProportionally(deltaCents: number, weights: number[]): number[] {
  const totalWeight = weights.reduce((s, w) => s + w, 0);
  if (totalWeight <= 0 || deltaCents === 0) return weights.map(() => 0);
  const raw = weights.map((w) => (deltaCents * w) / totalWeight);
  const floors = raw.map((r) => Math.trunc(r));
  let leftover = deltaCents - floors.reduce((s, f) => s + f, 0);
  const byRemainder = raw
    .map((r, i) => ({ i, frac: r - Math.trunc(r) }))
    .sort((a, b) => b.frac - a.frac);
  const result = [...floors];
  for (let k = 0; k < byRemainder.length && leftover !== 0; k++) {
    const step = leftover > 0 ? 1 : -1;
    result[byRemainder[k].i] += step;
    leftover -= step;
  }
  return result;
}

function draftItemsFrom(receipt: ParsedReceipt): DraftItem[] {
  return receipt.items.map((item, i) => ({
    id: i,
    name: item.name,
    price: (item.priceCents / 100).toFixed(2),
  }));
}

export function NewSplitForm({
  initialTitle,
  initialTotalAmount,
  initialCategory,
  initialItems,
  initialNames,
  initialParticipantUserIds,
  onCreated,
}: {
  // Prefill from a real Transaction (Split's "Split this" entry point — see
  // split/page.tsx, which resolves these from the transaction server-side
  // rather than trusting raw query-string values as authoritative). Only
  // ever set together in practice; the form still works with none of them
  // (the original manual-entry-first behavior) since every field is
  // optional. Auto-expands when a prefill is present — the whole point is
  // skipping the extra "+ New split" tap.
  initialTitle?: string;
  initialTotalAmount?: string;
  initialCategory?: string;
  // Smart Split's "Select Transaction(s)" step (see SmartSplitFlow) hands
  // each selected transaction in as one line item here — the exact same
  // itemized structure a scanned receipt's items already take (see
  // draftItemsFrom below), rather than a parallel representation. Seeds
  // scanItems and jumps straight to the "confirmed" scan step so "By items"
  // is immediately available, same as after a real scan.
  initialItems?: Array<{ name: string; price: string }>;
  // Smart Split's "Choose who to split with" step (quick-pick + the same
  // exact-email search below) hands its selections in as these — the
  // "who's splitting it" input further down still works exactly as before
  // for adding/removing anyone else.
  initialNames?: string[];
  initialParticipantUserIds?: Record<string, string>;
  // Smart Split lives on its own page (src/app/(app)/split/new), not inline
  // in the splits list like "Split this" — it needs to navigate away after
  // a successful create instead of just resetting in place.
  onCreated?: () => void;
}) {
  const hasInitialItems = Boolean(initialItems && initialItems.length > 0);
  const [expanded, setExpanded] = useState(Boolean(initialTitle));
  const [title, setTitle] = useState(initialTitle ?? "");
  const [totalAmount, setTotalAmount] = useState(initialTotalAmount ?? "");
  const [category, setCategory] = useState(initialCategory ?? "General");
  const [names, setNames] = useState<string[]>(
    initialNames && initialNames.length > 0 ? initialNames : [DEFAULT_NAME],
  );
  const [nameInput, setNameInput] = useState("");
  // name -> the real userId it references, only present for linked
  // participants — free-text names (the default/fallback path) never have
  // an entry here. Keyed by the same display-name string `names` already
  // uses everywhere else, so none of the existing name-keyed bookkeeping
  // (customAmounts, itemAssignments, equal-share indexing) needs to change.
  const [participantUserIds, setParticipantUserIds] = useState<Record<string, string>>(
    initialParticipantUserIds ?? {},
  );
  const [method, setMethod] = useState<SplitMethod>("equal");
  const [customAmounts, setCustomAmounts] = useState<Record<string, string>>({});
  // Item id -> names assigned to it. Only meaningful in "items" method, and
  // only ever populated from a scan (there's no per-item data in manual
  // entry) — see the method-picker's conditional render below.
  const [itemAssignments, setItemAssignments] = useState<Record<number, string[]>>({});

  const [mode, setMode] = useState<EntryMode>(hasInitialItems ? "scan" : "manual");
  const [scanStep, setScanStep] = useState<ScanStep>(hasInitialItems ? "confirmed" : "options");
  const [scanItems, setScanItems] = useState<DraftItem[]>(
    initialItems ? initialItems.map((it, i) => ({ id: i, name: it.name, price: it.price })) : [],
  );
  // Seeded from initialTotalAmount too (not just totalAmount) so that if the
  // user hits "Edit" on an already-confirmed Smart Split summary, the total
  // field they land on shows the real figure instead of a blank one they'd
  // have to retype before "Looks good, continue" re-enables.
  const [scanReviewTotal, setScanReviewTotal] = useState(initialTotalAmount ?? "");
  const [scanError, setScanError] = useState("");
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const uploadInputRef = useRef<HTMLInputElement>(null);

  const [state, formAction, pending] = useActionState<CreateSplitState, FormData>(
    createSplit,
    null,
  );

  useEffect(() => {
    if (state?.ok) {
      reset();
      onCreated?.();
    }
    // onCreated must stay a stable reference (memoized by the caller —
    // see handleCreated in SmartSplitFlow) so this doesn't re-fire on every
    // unrelated re-render once state.ok is already true.
  }, [state, onCreated]);

  const displayedMatch = useEmailLookup(nameInput);

  function reset() {
    setTitle("");
    setTotalAmount("");
    setCategory("General");
    setNames([DEFAULT_NAME]);
    setNameInput("");
    setParticipantUserIds({});
    setMethod("equal");
    setCustomAmounts({});
    setItemAssignments({});
    setExpanded(false);
    setMode("manual");
    setScanStep("options");
    setScanItems([]);
    setScanReviewTotal("");
    setScanError("");
  }

  const totalCents = Math.round((Number(totalAmount) || 0) * 100);
  const equalShares = useMemo(
    () => distributeEqually(totalCents, names.length),
    [totalCents, names.length],
  );

  const customCentsFor = (name: string) => Math.round((Number(customAmounts[name]) || 0) * 100);
  const customSum = names.reduce((s, n) => s + customCentsFor(n), 0);
  const customValid = totalCents > 0 && customSum === totalCents;

  function toggleItemAssignee(itemId: number, name: string) {
    setItemAssignments((prev) => {
      const current = prev[itemId] ?? [];
      const next = current.includes(name) ? current.filter((n) => n !== name) : [...current, name];
      return { ...prev, [itemId]: next };
    });
  }

  // Each item's price splits equally among whoever it's assigned to, summed
  // per person; the gap between the items' sum and the confirmed total
  // (usually tax/service charge) is then split proportional to each
  // person's item subtotal — see distributeProportionally.
  const itemBaseShares = useMemo(() => {
    const base: Record<string, number> = Object.fromEntries(names.map((n) => [n, 0]));
    for (const item of scanItems) {
      const assignees = (itemAssignments[item.id] ?? []).filter((n) => names.includes(n));
      if (assignees.length === 0) continue;
      const priceCents = Math.round((Number(item.price) || 0) * 100);
      const shares = distributeEqually(priceCents, assignees.length);
      assignees.forEach((name, i) => {
        base[name] = (base[name] ?? 0) + (shares[i] ?? 0);
      });
    }
    return base;
  }, [scanItems, itemAssignments, names]);

  const itemSharesByPerson = useMemo(() => {
    const itemsAssignedSum = Object.values(itemBaseShares).reduce((s, v) => s + v, 0);
    const deltaShares = distributeProportionally(
      totalCents - itemsAssignedSum,
      names.map((n) => itemBaseShares[n] ?? 0),
    );
    const result: Record<string, number> = {};
    names.forEach((n, i) => {
      result[n] = (itemBaseShares[n] ?? 0) + (deltaShares[i] ?? 0);
    });
    return result;
  }, [itemBaseShares, names, totalCents]);

  const allItemsAssigned =
    scanItems.length > 0 && scanItems.every((it) => (itemAssignments[it.id] ?? []).length > 0);
  const itemsValid = totalCents > 0 && allItemsAssigned;

  const participants = names.map((name, i) => ({
    name,
    shareAmountCents:
      method === "equal"
        ? equalShares[i]
        : method === "items"
          ? (itemSharesByPerson[name] ?? 0)
          : customCentsFor(name),
    userId: participantUserIds[name] ?? null,
  }));

  const canSubmit =
    title.trim().length > 0 &&
    totalCents > 0 &&
    names.length > 0 &&
    (method === "equal" ||
      (method === "custom" && customValid) ||
      (method === "items" && itemsValid));

  function addName() {
    const n = nameInput.trim();
    if (!n || names.includes(n)) {
      setNameInput("");
      return;
    }
    setNames((prev) => [...prev, n]);
    setNameInput("");
  }

  // Adds a real registered user found via the strict email match above —
  // a separate, explicit action from the Enter-to-add free-text path, so
  // typing a full email and pressing Enter still just adds it as plain text
  // unless this suggestion is specifically clicked. Most participants won't
  // be registered users, so free-text stays the default, unforced path.
  function addLinkedUser(result: NonNullable<UserLookupResult>) {
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
    // Purge from item assignments too, so a removed person doesn't stay
    // invisibly "assigned" to items and silently absorb a share of them.
    setItemAssignments((prev) =>
      Object.fromEntries(Object.entries(prev).map(([id, assignees]) => [id, assignees.filter((x) => x !== n)])),
    );
  }

  async function handleReceiptFile(file: File | undefined) {
    if (!file) return;
    setScanStep("loading");
    setScanError("");
    try {
      const body = new FormData();
      body.append("image", file);
      const res = await fetch("/api/parse-receipt", { method: "POST", body });
      const json = await res.json();
      if (!res.ok) {
        setScanError(json?.error || "Couldn't read that receipt. Try again or enter it manually.");
        setScanStep("error");
        return;
      }
      const parsed = json as ParsedReceipt;
      setScanItems(draftItemsFrom(parsed));
      setScanReviewTotal((parsed.totalCents / 100).toFixed(2));
      setScanStep("review");
    } catch {
      setScanError("Couldn't reach the scanner. Check your connection and try again, or enter it manually.");
      setScanStep("error");
    }
  }

  function loadDemoReceipt() {
    setScanError("");
    setScanItems(draftItemsFrom(DEMO_RECEIPT));
    setScanReviewTotal((DEMO_RECEIPT.totalCents / 100).toFixed(2));
    setScanStep("review");
  }

  function updateScanItemName(id: number, name: string) {
    setScanItems((prev) => prev.map((it) => (it.id === id ? { ...it, name } : it)));
  }

  function updateScanItemPrice(id: number, price: string) {
    setScanItems((prev) => prev.map((it) => (it.id === id ? { ...it, price } : it)));
  }

  function removeScanItem(id: number) {
    setScanItems((prev) => prev.filter((it) => it.id !== id));
  }

  function backToManual() {
    setMode("manual");
    // "By items" only makes sense with scanned line items — falling back to
    // manual entry without also falling back the method would strand the
    // form on a method with nothing to assign.
    setMethod((m) => (m === "items" ? "equal" : m));
  }

  function confirmScan() {
    const cents = Math.round((Number(scanReviewTotal) || 0) * 100);
    if (cents <= 0) return;
    setTotalAmount((cents / 100).toFixed(2));
    setScanStep("confirmed");
  }

  const scanItemsSumCents = scanItems.reduce(
    (s, it) => s + Math.round((Number(it.price) || 0) * 100),
    0,
  );
  const scanReviewTotalCents = Math.round((Number(scanReviewTotal) || 0) * 100);

  if (!expanded) {
    return (
      <Button type="button" onClick={() => setExpanded(true)} className="w-full justify-center sm:w-auto">
        <Icon name="plus" size={18} />
        New split
      </Button>
    );
  }

  const showSharedBottom = mode === "manual" || scanStep === "confirmed";

  return (
    <Card padded={false} className="overflow-hidden">
      <div className="h-1.5 bg-primary" />
      <div className="p-8">
        <div className="flex items-center justify-between">
          <h2 className="text-title-lg text-on-surface">New split</h2>
          <button type="button" onClick={reset} className="text-body-md text-on-surface-variant hover:text-on-surface">
            Cancel
          </button>
        </div>

        <div className="mt-4 flex gap-2">
          <Button
            type="button"
            variant={mode === "manual" ? "primary" : "secondary"}
            onClick={() => {
              setMode("manual");
              setMethod((m) => (m === "items" ? "equal" : m));
            }}
            className="flex-1 justify-center"
          >
            Manual entry
          </Button>
          <Button
            type="button"
            variant={mode === "scan" ? "primary" : "secondary"}
            onClick={() => setMode("scan")}
            className="flex-1 justify-center"
          >
            <Icon name="camera" size={16} />
            Scan receipt
          </Button>
        </div>

        <form action={formAction} className="mt-4 flex flex-col gap-4">
          <input type="hidden" name="participants" value={JSON.stringify(participants)} />
          <input type="hidden" name="category" value={category} />

          <label className="flex flex-col gap-1.5">
            <span className="text-body-md font-medium text-on-surface">What&apos;s it for?</span>
            <input
              name="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Dinner at Din Tai Fung"
              className="rounded-lg border border-border-light bg-surface-container-lowest px-3 py-2 text-body-md text-on-surface outline-none focus:border-primary"
              required
            />
          </label>

          {mode === "manual" ? (
            <div className="flex gap-3">
              <label className="flex flex-1 flex-col gap-1.5">
                <span className="text-body-md font-medium text-on-surface">Total amount</span>
                <div className="relative">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-body-md text-on-surface-variant">
                    $
                  </span>
                  <input
                    name="totalAmount"
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={totalAmount}
                    onChange={(e) => setTotalAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full rounded-lg border border-border-light bg-surface-container-lowest py-2 pl-7 pr-3 text-body-md text-on-surface outline-none focus:border-primary"
                    required
                  />
                </div>
              </label>
              <label className="flex w-36 flex-col gap-1.5">
                <span className="text-body-md font-medium text-on-surface">Category</span>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="rounded-lg border border-border-light bg-surface-container-lowest px-3 py-2 text-body-md text-on-surface outline-none focus:border-primary"
                >
                  {CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {/* Hidden totalAmount input so the shared form still submits a value once scanning is confirmed. */}
              <input type="hidden" name="totalAmount" value={totalAmount} />

              <label className="flex w-36 flex-col gap-1.5">
                <span className="text-body-md font-medium text-on-surface">Category</span>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="rounded-lg border border-border-light bg-surface-container-lowest px-3 py-2 text-body-md text-on-surface outline-none focus:border-primary"
                >
                  {CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </label>

              {scanStep === "options" ? (
                <div className="flex flex-col gap-3">
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                    <button
                      type="button"
                      onClick={() => cameraInputRef.current?.click()}
                      className="flex flex-col items-center gap-2 rounded-lg border border-border-light bg-surface-container-lowest px-4 py-5 text-body-md font-medium text-on-surface hover:bg-surface-container-low"
                    >
                      <Icon name="camera" size={22} className="text-primary" />
                      Take photo
                    </button>
                    <button
                      type="button"
                      onClick={() => uploadInputRef.current?.click()}
                      className="flex flex-col items-center gap-2 rounded-lg border border-border-light bg-surface-container-lowest px-4 py-5 text-body-md font-medium text-on-surface hover:bg-surface-container-low"
                    >
                      <Icon name="upload" size={22} className="text-primary" />
                      Upload receipt
                    </button>
                    <button
                      type="button"
                      onClick={loadDemoReceipt}
                      className="flex flex-col items-center gap-2 rounded-lg border border-border-light bg-surface-container-lowest px-4 py-5 text-body-md font-medium text-on-surface hover:bg-surface-container-low"
                    >
                      <Icon name="bills" size={22} className="text-primary" />
                      Try demo receipt
                    </button>
                  </div>
                  <input
                    ref={cameraInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      e.target.value = "";
                      handleReceiptFile(file);
                    }}
                  />
                  <input
                    ref={uploadInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      e.target.value = "";
                      handleReceiptFile(file);
                    }}
                  />
                  <button
                    type="button"
                    onClick={backToManual}
                    className="self-start text-body-md text-on-surface-variant hover:text-on-surface"
                  >
                    Enter manually instead
                  </button>
                </div>
              ) : null}

              {scanStep === "loading" ? (
                <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-border-light bg-surface-container-low px-4 py-8 text-center">
                  <div className="h-6 w-6 animate-spin rounded-full border-2 border-border-light border-t-primary" />
                  <p className="text-body-md text-on-surface-variant">Reading your receipt…</p>
                </div>
              ) : null}

              {scanStep === "error" ? (
                <div className="flex flex-col gap-3 rounded-lg border border-border-light bg-surface-container-low px-4 py-5">
                  <p className="text-body-md text-error">{scanError}</p>
                  <div className="flex gap-2">
                    <Button type="button" variant="secondary" onClick={() => setScanStep("options")}>
                      Try again
                    </Button>
                    <Button type="button" variant="secondary" onClick={backToManual}>
                      Enter manually instead
                    </Button>
                  </div>
                </div>
              ) : null}

              {scanStep === "review" ? (
                <div className="flex flex-col gap-3">
                  <div className="divide-y divide-border-light rounded-lg border border-border-light">
                    {scanItems.map((item) => (
                      <div key={item.id} className="flex items-center gap-2 px-3 py-2">
                        <input
                          value={item.name}
                          onChange={(e) => updateScanItemName(item.id, e.target.value)}
                          placeholder="Item name"
                          className="min-w-0 flex-1 border-none bg-transparent text-body-md text-on-surface outline-none placeholder:text-on-surface-variant"
                        />
                        <div className="relative w-24 shrink-0">
                          <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-label-md text-on-surface-variant">
                            $
                          </span>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={item.price}
                            onChange={(e) => updateScanItemPrice(item.id, e.target.value)}
                            className="w-full rounded-lg border border-border-light bg-surface-container-lowest py-1 pl-5 pr-2 text-right text-body-md text-on-surface outline-none focus:border-primary"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => removeScanItem(item.id)}
                          aria-label={`Remove ${item.name || "item"}`}
                          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface"
                        >
                          <Icon name="plus" size={12} className="rotate-45" />
                        </button>
                      </div>
                    ))}
                    {scanItems.length === 0 ? (
                      <p className="px-3 py-4 text-body-md text-on-surface-variant">
                        No items left — the total below still carries over.
                      </p>
                    ) : null}
                  </div>

                  <label className="flex flex-col gap-1.5">
                    <span className="text-body-md font-medium text-on-surface">Total amount</span>
                    <div className="relative">
                      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-body-md text-on-surface-variant">
                        $
                      </span>
                      <input
                        type="number"
                        min="0.01"
                        step="0.01"
                        value={scanReviewTotal}
                        onChange={(e) => setScanReviewTotal(e.target.value)}
                        placeholder="0.00"
                        className="w-full rounded-lg border border-border-light bg-surface-container-lowest py-2 pl-7 pr-3 text-body-md text-on-surface outline-none focus:border-primary"
                      />
                    </div>
                    <span className="text-label-md text-on-surface-variant">
                      Items add up to {formatMoney(scanItemsSumCents)}
                      {scanItemsSumCents !== scanReviewTotalCents
                        ? " — adjust the total above if it includes tax or service charge"
                        : ""}
                    </span>
                  </label>

                  <div className="flex gap-2">
                    <Button
                      type="button"
                      onClick={confirmScan}
                      disabled={scanReviewTotalCents <= 0}
                      className="flex-1 justify-center"
                    >
                      Looks good, continue
                    </Button>
                    <Button type="button" variant="secondary" onClick={backToManual}>
                      Enter manually instead
                    </Button>
                  </div>
                </div>
              ) : null}

              {scanStep === "confirmed" ? (
                <div className="flex items-center justify-between rounded-lg border border-border-light bg-surface-container-low px-3 py-2.5">
                  <div className="flex items-center gap-2 text-body-md text-on-surface">
                    <Icon name="bills" size={16} className="text-primary" />
                    <span>
                      {scanItems.length} item{scanItems.length === 1 ? "" : "s"} scanned ·{" "}
                      {formatMoney(totalCents)}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setScanStep("review")}
                    className="text-body-md font-medium text-primary hover:underline"
                  >
                    Edit
                  </button>
                </div>
              ) : null}
            </div>
          )}

          {showSharedBottom ? (
            <>
              <div className="flex flex-col gap-1.5">
                <span className="text-body-md font-medium text-on-surface">Who&apos;s splitting it?</span>
                <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border-light bg-surface-container-lowest p-2">
                  {names.map((n) => (
                    <span
                      key={n}
                      className="inline-flex items-center gap-1 rounded-full bg-primary/10 py-1 pl-3 pr-1.5 text-body-md font-medium text-primary"
                    >
                      {participantUserIds[n] ? (
                        <Icon
                          name="check-circle"
                          size={12}
                          className="text-primary"
                          aria-hidden={false}
                          aria-label="Registered user"
                        />
                      ) : null}
                      {n}
                      <button
                        type="button"
                        onClick={() => removeName(n)}
                        aria-label={`Remove ${n}`}
                        className="flex h-4 w-4 items-center justify-center rounded-full text-primary hover:bg-primary/20"
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
                {/* Explicit, separate action from Enter-to-add — matching a
                    real account never forces linking, it's just offered. */}
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

              <div className="flex flex-col gap-1.5">
                <span className="text-body-md font-medium text-on-surface">Split method</span>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant={method === "equal" ? "primary" : "secondary"}
                    onClick={() => setMethod("equal")}
                    className="flex-1 justify-center"
                  >
                    Equal split
                  </Button>
                  {/* Only available after a scan produced itemized data —
                      manual entry has no per-item prices to assign. */}
                  {scanItems.length > 0 ? (
                    <Button
                      type="button"
                      variant={method === "items" ? "primary" : "secondary"}
                      onClick={() => setMethod("items")}
                      className="flex-1 justify-center"
                    >
                      By items
                    </Button>
                  ) : null}
                  <Button
                    type="button"
                    variant={method === "custom" ? "primary" : "secondary"}
                    onClick={() => setMethod("custom")}
                    className="flex-1 justify-center"
                  >
                    Custom amounts
                  </Button>
                </div>
              </div>

              {method === "items" ? (
                <div className="flex flex-col gap-1.5">
                  <span className="text-body-md font-medium text-on-surface">Who had what?</span>
                  <div className="divide-y divide-border-light rounded-lg border border-border-light">
                    {scanItems.map((item) => {
                      const assignees = itemAssignments[item.id] ?? [];
                      return (
                        <div key={item.id} className="flex flex-col gap-2 px-3 py-2.5">
                          <div className="flex items-center justify-between">
                            <span className="text-body-md text-on-surface">{item.name || "Unnamed item"}</span>
                            <span className="text-body-md font-medium text-on-surface">
                              {formatMoney(Math.round((Number(item.price) || 0) * 100))}
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {names.map((n) => (
                              <button
                                key={n}
                                type="button"
                                onClick={() => toggleItemAssignee(item.id, n)}
                                className={
                                  "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-label-md font-medium " +
                                  (assignees.includes(n)
                                    ? "bg-primary text-on-primary"
                                    : "border border-border-light text-on-surface-variant hover:bg-surface-container-low")
                                }
                              >
                                {participantUserIds[n] ? (
                                  <Icon
                                    name="check-circle"
                                    size={11}
                                    aria-hidden={false}
                                    aria-label="Registered user"
                                  />
                                ) : null}
                                {n}
                              </button>
                            ))}
                          </div>
                          {assignees.length === 0 ? (
                            <p className="text-label-md text-error">Nobody&apos;s assigned to this yet</p>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                  {!allItemsAssigned ? (
                    <p className="text-label-md text-error">Assign every item to at least one person</p>
                  ) : null}
                </div>
              ) : null}

              <div className="divide-y divide-border-light rounded-lg border border-border-light">
                {names.map((n, i) => (
                  <div key={n} className="flex items-center justify-between px-3 py-2">
                    <span className="inline-flex items-center gap-1.5 text-body-md text-on-surface">
                      {n}
                      {participantUserIds[n] ? (
                        <Icon
                          name="check-circle"
                          size={12}
                          className="text-primary"
                          aria-hidden={false}
                          aria-label="Registered user"
                        />
                      ) : null}
                    </span>
                    {method === "equal" ? (
                      <span className="text-body-md font-semibold text-on-surface">
                        {formatMoney(equalShares[i] ?? 0)}
                      </span>
                    ) : method === "items" ? (
                      <span className="text-body-md font-semibold text-on-surface">
                        {formatMoney(itemSharesByPerson[n] ?? 0)}
                      </span>
                    ) : (
                      <div className="relative w-28">
                        <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-label-md text-on-surface-variant">
                          $
                        </span>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={customAmounts[n] ?? ""}
                          onChange={(e) =>
                            setCustomAmounts((prev) => ({ ...prev, [n]: e.target.value }))
                          }
                          placeholder="0.00"
                          className="w-full rounded-lg border border-border-light bg-surface-container-lowest py-1 pl-5 pr-2 text-right text-body-md text-on-surface outline-none focus:border-primary"
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {method === "custom" ? (
                <p className={`text-label-md ${customValid ? "text-on-surface-variant" : "text-error"}`}>
                  {formatMoney(customSum)} of {formatMoney(totalCents)} allocated
                </p>
              ) : null}

              <Button type="submit" disabled={!canSubmit || pending} className="justify-center">
                {pending ? "Creating…" : "Create split"}
              </Button>
            </>
          ) : null}
        </form>
      </div>
    </Card>
  );
}
