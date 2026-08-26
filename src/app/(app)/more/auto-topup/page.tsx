import { requireUser } from "@/lib/auth";
import { Card } from "@/components/ui/Card";
import { PlaceholderPage } from "../PlaceholderPage";

export default async function AutoTopUpPage() {
  await requireUser();
  return (
    <PlaceholderPage
      title="Auto Top-up"
      description="Automatically top up your balance when it runs low."
    >
      <Card className="flex flex-col gap-stack-md opacity-60">
        <label className="flex items-center justify-between">
          <span className="text-body-lg font-medium text-on-surface">Enable Auto Top-up</span>
          <input type="checkbox" disabled className="h-5 w-5 accent-primary" />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-body-md font-medium text-on-surface">Top up when balance falls below</span>
          <input
            disabled
            placeholder="$20.00"
            className="rounded-lg border border-border-light bg-surface-container-low px-3 py-2 text-body-lg text-on-surface"
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-body-md font-medium text-on-surface">Top-up amount</span>
          <input
            disabled
            placeholder="$50.00"
            className="rounded-lg border border-border-light bg-surface-container-low px-3 py-2 text-body-lg text-on-surface"
          />
        </label>
      </Card>
    </PlaceholderPage>
  );
}
