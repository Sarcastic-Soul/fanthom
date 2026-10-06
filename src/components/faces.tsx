import type { CSSProperties } from "react";
import { initials, speakerColor } from "@/lib/format";

export function Faces({ people, max = 8 }: { people: { name: string; color: number }[]; max?: number }) {
  const shown = people.slice(0, max);
  const extra = people.length - shown.length;
  return (
    <span className="faces">
      {shown.map((p) => (
        <span
          key={p.name + p.color}
          className="face"
          title={p.name}
          style={{ "--c": speakerColor(p.color) } as CSSProperties}
        >
          {initials(p.name)}
        </span>
      ))}
      {extra > 0 && <span className="face more">+{extra}</span>}
    </span>
  );
}
