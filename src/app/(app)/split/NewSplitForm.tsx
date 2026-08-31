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
}) {
  const [expanded, setExpanded] = useState(Boolean(initialTitle));
  const [title, setTitle] = useState(initialTitle ?? "");
  const [totalAmount, setTotalAmount] = useState(initialTotalAmount ?? "");
  const [category, setCategory] = useState(initialCategory ?? "General");
  const [names, setNames] = useState<string[]>([DEFAULT_NAME]);
  const [nameInput, setNameInput] = useState("");
  // name -> the real userId it references, only present for linked
  // participants — free-text names (the default/fallback path) never have
  // an entry here. Keyed by the same display-name string `names` already
  // uses everywhere else, so none of the existing name-keyed bookkeeping
  // (customAmounts, itemAssignments, equal-share indexing) needs to change.
  const [participantUserIds, setParticipantUserIds] = useState<Record<string, string>>({});
  const [matchedUser, setMatchedUser] = useState<UserLookupResult>(null);
  const [method, setMethod] = useState<SplitMethod>("equal");
  const [customAmounts, setCustomAmounts] = useState<Record<string, string>>({});
  // Item id -> names assigned to it. Only meaningful in "items" method, and
  // only ever populated from a scan (there's no per-item data in manual
  // entry) — see the method-picker's conditional render below.
  const [itemAssignments, setItemAssignments] = useState<Record<number, string[]>>({});

  const [mode, setMode] = useState<EntryMode>("manual");
  const [scanStep, setScanStep] = useState<ScanStep>("options");
  const [scanItems, setScanItems] = useState<DraftItem[]>([]);
  const [scanReviewTotal, setScanReviewTotal] = useState("");
  const [scanError, setScanError] = useState("");
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const uploadInputRef = useRef<HTMLInputElement>(null);

  const [state, formAction, pending] = useActionState<CreateSplitState, FormData>(
    createSplit,
    null,
  );

  useEffect(() => {
    if (state?.ok) reset();
  }, [state]);

  // Debounced strict lookup as the user types — findRegisteredUserByEmail
  // itself refuses to match anything until the input looks like a complete
  // email, so this only ever fires a real query once there's something
  // worth checking, not on every keystroke of a short partial string.
  useEffect(() => {
    const trimmed = nameInput.trim();
    // Empty input needs no state reset here — displayedMatch (derived below,
    // during render) already treats blank input as "no match" without
    // needing an effect-driven setState for that branch.
    if (!trimmed) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      const result = await findRegisteredUserByEmail(trimmed);
      if (!cancelled) setMatchedUser(result);
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [nameInput]);
  // Guards against showing a stale match left over from a previous, since-
  // cleared input (e.g. right after addLinkedUser resets nameInput but the
  // debounce timer for the old value hasn't been superseded by a render yet).
  const displayedMatch = nameInput.trim() ? matchedUser : null;

  function reset() {
    setTitle("");
    setTotalAmount("");
    setCategory("General");
    setNames([DEFAULT_NAME]);
    setNameInput("");
    setParticipantUserIds({});
    setMatchedUser(null);
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
    setMatchedUser(null);
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
    setMatchedUser(null);
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
      <div className="h-1.5 bg-accent" />
      <div className="p-8">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-ink">New split</h2>
          <button type="button" onClick={reset} className="text-sm text-ink-muted hover:text-ink">
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
            <span className="text-sm font-medium text-ink">What&apos;s it for?</span>
            <input
              name="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Dinner at Din Tai Fung"
              className="rounded-button border border-line bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-accent"
              required
            />
          </label>

          {mode === "manual" ? (
            <div className="flex gap-3">
              <label className="flex flex-1 flex-col gap-1.5">
                <span className="text-sm font-medium text-ink">Total amount</span>
                <div className="relative">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-ink-muted">
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
                    className="w-full rounded-button border border-line bg-surface py-2 pl-7 pr-3 text-sm text-ink outline-none focus:border-accent"
                    required
                  />
                </div>
              </label>
              <label className="flex w-36 flex-col gap-1.5">
                <span className="text-sm font-medium text-ink">Category</span>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="rounded-button border border-line bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-accent"
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
                <span className="text-sm font-medium text-ink">Category</span>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="rounded-button border border-line bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-accent"
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
                      className="flex flex-col items-center gap-2 rounded-button border border-line bg-surface px-4 py-5 text-sm font-medium text-ink hover:bg-surface-muted"
                    >
                      <Icon name="camera" size={22} className="text-accent" />
                      Take photo
                    </button>
                    <button
                      type="button"
                      onClick={() => uploadInputRef.current?.click()}
                      className="flex flex-col items-center gap-2 rounded-button border border-line bg-surface px-4 py-5 text-sm font-medium text-ink hover:bg-surface-muted"
                    >
                      <Icon name="upload" size={22} className="text-accent" />
                      Upload receipt
                    </button>
                    <button
                      type="button"
                      onClick={loadDemoReceipt}
                      className="flex flex-col items-center gap-2 rounded-button border border-line bg-surface px-4 py-5 text-sm font-medium text-ink hover:bg-surface-muted"
                    >
                      <Icon name="bills" size={22} className="text-accent" />
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
                    className="self-start text-sm text-ink-muted hover:text-ink"
                  >
                    Enter manually instead
                  </button>
                </div>
              ) : null}

              {scanStep === "loading" ? (
                <div className="flex flex-col items-center justify-center gap-3 rounded-button border border-line bg-surface-muted px-4 py-8 text-center">
                  <div className="h-6 w-6 animate-spin rounded-full border-2 border-line border-t-accent" />
                  <p className="text-sm text-ink-muted">Reading your receipt…</p>
                </div>
              ) : null}

              {scanStep === "error" ? (
                <div className="flex flex-col gap-3 rounded-button border border-line bg-surface-muted px-4 py-5">
                  <p className="text-sm text-danger-strong">{scanError}</p>
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
                  <div className="divide-y divide-line rounded-button border border-line">
                    {scanItems.map((item) => (
                      <div key={item.id} className="flex items-center gap-2 px-3 py-2">
                        <input
                          value={item.name}
                          onChange={(e) => updateScanItemName(item.id, e.target.value)}
                          placeholder="Item name"
                          className="min-w-0 flex-1 border-none bg-transparent text-sm text-ink outline-none placeholder:text-ink-muted"
                        />
                        <div className="relative w-24 shrink-0">
                          <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-ink-muted">
                            $
                          </span>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={item.price}
                            onChange={(e) => updateScanItemPrice(item.id, e.target.value)}
                            className="w-full rounded-button border border-line bg-surface py-1 pl-5 pr-2 text-right text-sm text-ink outline-none focus:border-accent"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => removeScanItem(item.id)}
                          aria-label={`Remove ${item.name || "item"}`}
                          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-ink-muted hover:bg-surface-muted hover:text-ink"
                        >
                          <Icon name="plus" size={12} className="rotate-45" />
                        </button>
                      </div>
                    ))}
                    {scanItems.length === 0 ? (
                      <p className="px-3 py-4 text-sm text-ink-muted">
                        No items left — the total below still carries over.
                      </p>
                    ) : null}
                  </div>

                  <label className="flex flex-col gap-1.5">
                    <span className="text-sm font-medium text-ink">Total amount</span>
                    <div className="relative">
                      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-ink-muted">
                        $
                      </span>
                      <input
                        type="number"
                        min="0.01"
                        step="0.01"
                        value={scanReviewTotal}
                        onChange={(e) => setScanReviewTotal(e.target.value)}
                        placeholder="0.00"
                        className="w-full rounded-button border border-line bg-surface py-2 pl-7 pr-3 text-sm text-ink outline-none focus:border-accent"
                      />
                    </div>
                    <span className="text-xs text-ink-muted">
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
                <div className="flex items-center justify-between rounded-button border border-line bg-surface-muted px-3 py-2.5">
                  <div className="flex items-center gap-2 text-sm text-ink">
                    <Icon name="bills" size={16} className="text-accent" />
                    <span>
                      {scanItems.length} item{scanItems.length === 1 ? "" : "s"} scanned ·{" "}
                      {formatMoney(totalCents)}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setScanStep("review")}
                    className="text-sm font-medium text-accent hover:text-accent-strong"
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
                <span className="text-sm font-medium text-ink">Who&apos;s splitting it?</span>
                <div className="flex flex-wrap items-center gap-2 rounded-button border border-line bg-surface p-2">
                  {names.map((n) => (
                    <span
                      key={n}
                      className="inline-flex items-center gap-1 rounded-full bg-nets-blue-100 py-1 pl-3 pr-1.5 text-sm font-medium text-accent"
                    >
                      {participantUserIds[n] ? (
                        <Icon
                          name="check-circle"
                          size={12}
                          className="text-accent"
                          aria-hidden={false}
                          aria-label="Registered user"
                        />
                      ) : null}
                      {n}
                      <button
                        type="button"
                        onClick={() => removeName(n)}
                        aria-label={`Remove ${n}`}
                        className="flex h-4 w-4 items-center justify-center rounded-full text-accent hover:bg-white/60"
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
                    className="min-w-[140px] flex-1 border-none bg-transparent px-2 py-1 text-sm text-ink outline-none placeholder:text-ink-muted"
                  />
                </div>
                {/* Explicit, separate action from Enter-to-add — matching a
                    real account never forces linking, it's just offered. */}
                {displayedMatch ? (
                  <button
                    type="button"
                    onClick={() => addLinkedUser(displayedMatch)}
                    className="inline-flex w-fit items-center gap-1.5 rounded-full border border-accent bg-nets-blue-100/60 px-3 py-1.5 text-xs font-medium text-accent hover:bg-nets-blue-100"
                  >
                    <Icon name="check-circle" size={13} />
                    Add {displayedMatch.displayName} as registered user
                  </button>
                ) : null}
              </div>

              <div className="flex flex-col gap-1.5">
                <span className="text-sm font-medium text-ink">Split method</span>
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
                  <span className="text-sm font-medium text-ink">Who had what?</span>
                  <div className="divide-y divide-line rounded-button border border-line">
                    {scanItems.map((item) => {
                      const assignees = itemAssignments[item.id] ?? [];
                      return (
                        <div key={item.id} className="flex flex-col gap-2 px-3 py-2.5">
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-ink">{item.name || "Unnamed item"}</span>
                            <span className="text-sm font-medium text-ink">
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
                                  "inline-flex items-center gap-1 " +
                                  (assignees.includes(n)
                                    ? "rounded-full bg-accent px-2.5 py-1 text-xs font-medium text-white"
                                    : "rounded-full border border-line px-2.5 py-1 text-xs font-medium text-ink-muted hover:bg-surface-muted")
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
                            <p className="text-xs text-danger-strong">Nobody&apos;s assigned to this yet</p>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                  {!allItemsAssigned ? (
                    <p className="text-xs text-danger-strong">Assign every item to at least one person</p>
                  ) : null}
                </div>
              ) : null}

              <div className="divide-y divide-line rounded-button border border-line">
                {names.map((n, i) => (
                  <div key={n} className="flex items-center justify-between px-3 py-2">
                    <span className="inline-flex items-center gap-1.5 text-sm text-ink">
                      {n}
                      {participantUserIds[n] ? (
                        <Icon
                          name="check-circle"
                          size={12}
                          className="text-accent"
                          aria-hidden={false}
                          aria-label="Registered user"
                        />
                      ) : null}
                    </span>
                    {method === "equal" ? (
                      <span className="text-sm font-semibold text-ink">
                        {formatMoney(equalShares[i] ?? 0)}
                      </span>
                    ) : method === "items" ? (
                      <span className="text-sm font-semibold text-ink">
                        {formatMoney(itemSharesByPerson[n] ?? 0)}
                      </span>
                    ) : (
                      <div className="relative w-28">
                        <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-ink-muted">
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
                          className="w-full rounded-button border border-line bg-surface py-1 pl-5 pr-2 text-right text-sm text-ink outline-none focus:border-accent"
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {method === "custom" ? (
                <p className={`text-xs ${customValid ? "text-ink-muted" : "text-danger-strong"}`}>
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
