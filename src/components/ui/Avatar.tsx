// Initials-in-circle avatar. Locked tokens only — cycles blue/neutral fills,
// no new hues. Used where a person needs a visual anchor (Split participants).
const TONES = ["bg-primary", "bg-nets-blue-dark", "bg-outline"] as const;

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

export function Avatar({
  name,
  index = 0,
  size = 32,
  className = "",
}: {
  name: string;
  index?: number;
  size?: number;
  className?: string;
}) {
  return (
    <div
      className={`flex shrink-0 items-center justify-center rounded-full font-semibold text-white ${TONES[index % TONES.length]} ${className}`}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.4) }}
    >
      {initialsOf(name)}
    </div>
  );
}
