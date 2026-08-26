// Mirrors src/app/(app)/more/page.tsx. Real destinations for "My NETS Card"/
// "Tools"/"Support & Info" are all real authenticated routes or the real
// logout server action (which imports supabase) — none belong in an
// isolated, unauthenticated preview, so every row here is visually present
// but inert rather than linking out of /preview/* into the real app.
import { Card } from "@/components/ui/Card";
import { Avatar } from "@/components/ui/Avatar";
import { Icon, type IconName } from "@/components/Icon";
import { displayNameFromEmail } from "@/lib/user";

const CARD_ROWS: Array<{ label: string; icon: IconName }> = [
  { label: "Card Settings", icon: "settings" },
  { label: "Auto Top-up", icon: "wallet" },
  { label: "Transaction Limits", icon: "sliders" },
  { label: "Security & Privacy", icon: "shield" },
];
const TOOLS: Array<{ label: string; description: string; icon: IconName }> = [
  { label: "Smart Split", description: "Scan receipt & divide bills", icon: "split" },
  { label: "Spending Insights", description: "Understand your NETS spending", icon: "budget" },
  { label: "Bill Tracker", description: "Track upcoming bills", icon: "bills" },
  { label: "Overseas", description: "Explore supported NETS destinations", icon: "overseas" },
];
const SUPPORT_ROWS = ["Help Centre", "Contact Us", "Terms of Service"];
const mockEmail = "sean.wu+demo@example.com";

export default function PreviewMorePage() {
  const name = displayNameFromEmail(mockEmail);
  return (
    <div className="flex flex-col gap-stack-lg">
      <Card className="flex items-center gap-4">
        <Avatar name={name} size={56} />
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-title-lg text-on-surface">{name}</h2>
          <p className="truncate text-body-md text-on-surface-variant">{mockEmail}</p>
        </div>
      </Card>

      <section>
        <h3 className="mb-2 px-1 text-label-md font-semibold uppercase tracking-wide text-on-surface-variant">My NETS Card</h3>
        <Card padded={false}>
          <div className="divide-y divide-border-light px-stack-md">
            {CARD_ROWS.map((row) => (
              <div key={row.label} className="flex items-center justify-between py-4 opacity-70">
                <div className="flex items-center gap-4">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <Icon name={row.icon} size={20} />
                  </span>
                  <span className="text-body-lg font-medium text-on-surface">{row.label}</span>
                </div>
                <Icon name="chevron-right" size={20} className="text-outline-variant" />
              </div>
            ))}
          </div>
        </Card>
      </section>

      <section>
        <h3 className="mb-2 px-1 text-label-md font-semibold uppercase tracking-wide text-on-surface-variant">Tools</h3>
        <div className="grid grid-cols-2 gap-3">
          {TOOLS.map((tool) => (
            <div key={tool.label} className="flex flex-col gap-3 rounded-lg border border-border-light bg-surface-container-lowest p-stack-md opacity-70 shadow-card">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Icon name={tool.icon} size={22} />
              </span>
              <div>
                <p className="text-body-lg font-semibold text-on-surface">{tool.label}</p>
                <p className="mt-0.5 text-body-md text-on-surface-variant">{tool.description}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h3 className="mb-2 px-1 text-label-md font-semibold uppercase tracking-wide text-on-surface-variant">Support &amp; Info</h3>
        <Card padded={false}>
          <div className="divide-y divide-border-light px-stack-md">
            {SUPPORT_ROWS.map((label) => (
              <div key={label} className="flex items-center justify-between py-4 opacity-70">
                <span className="text-body-lg font-medium text-on-surface">{label}</span>
                <Icon name="chevron-right" size={20} className="text-outline-variant" />
              </div>
            ))}
            <button type="button" disabled className="flex w-full items-center justify-center py-4 text-title-lg font-semibold text-error opacity-70">
              Log Out
            </button>
          </div>
        </Card>
      </section>

      <p className="text-center text-label-md text-on-surface-variant">
        Card/Tools/Support rows are inert in this preview — their real destinations need a signed-in account.
      </p>
    </div>
  );
}
