import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MeetingView } from "@/components/meeting/meeting-view";
import { getMeeting } from "@/lib/data";

export const revalidate = 60;

export async function generateMetadata({ params }: PageProps<"/meetings/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const data = await getMeeting(slug);
  return { title: data?.meeting.title ?? "Meeting" };
}

export default async function MeetingPage({ params }: PageProps<"/meetings/[slug]">) {
  const { slug } = await params;
  const data = await getMeeting(slug);
  if (!data) notFound();
  return <MeetingView data={data} />;
}
