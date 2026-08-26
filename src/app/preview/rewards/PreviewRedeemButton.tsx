"use client";

// Mirrors src/app/(app)/rewards/RedeemButton.tsx's look, but never calls the
// real redeemReward server action — just a local "redeemed" toggle so
// clicking it shows *some* feedback without implying a real points
// deduction happened anywhere.
import { useState } from "react";
import { Button } from "@/components/ui/Button";

export function PreviewRedeemButton({ affordable }: { affordable: boolean }) {
  const [redeemed, setRedeemed] = useState(false);

  return (
    <div className="w-full">
      <Button
        type="button"
        disabled={!affordable || redeemed}
        onClick={() => setRedeemed(true)}
        className="w-full"
      >
        {redeemed ? "Redeemed (preview)" : "Redeem"}
      </Button>
    </div>
  );
}
