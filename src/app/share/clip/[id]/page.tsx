import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ClipView } from "@/components/clip/clip-view";
import { getHighlight, getMeeting } from "@/lib/data";
import { clock } from "@/lib/format";

export const revalidate = 300;

export async function generateMetadata({ params }: PageProps<"/share/clip/[id]">): Promise<Metadata> {
  const { id } = await params;
  const found = await getHighlight(id);
  if (!found) return { title: "Clip" };
  const { highlight, meeting } = found;
  return {
    title: `Clip from ${meeting.title}`,
    description: `“${highlight.quote.slice(0, 150)}” · ${clock(highlight.start_ms)}–${clock(highlight.end_ms)}`,
  };
}

export default async function SharedClipPage({ params }: PageProps<"/share/clip/[id]">) {
  const { id } = await params;
  const found = await getHighlight(id);
  if (!found) notFound();
  const data = await getMeeting(found.meeting.slug);
  if (!data) notFound();
  return <ClipView data={data} clip={found.highlight} />;
}
