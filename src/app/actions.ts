"use server";

import { admin } from "@/lib/supabase";

// Visitors are not signed in, so keep clip creation narrow: a real meeting,
// a sane range, and a short quote taken from the transcript.
export async function createClip(input: {
  meetingId: string;
  startMs: number;
  endMs: number;
  quote: string;
  title?: string;
}): Promise<{ id: string } | { error: string }> {
  const startMs = Math.max(0, Math.round(input.startMs));
  const endMs = Math.round(input.endMs);
  const quote = input.quote.trim().slice(0, 1200);
  const title = input.title?.trim().slice(0, 120) || null;

  if (!quote) return { error: "Select some of the transcript first." };
  if (endMs <= startMs) return { error: "The clip needs a start and an end." };
  if (endMs - startMs > 10 * 60 * 1000) return { error: "Clips can be at most 10 minutes long." };

  const { data: meeting } = await admin
    .from("meetings")
    .select("id, duration_ms")
    .eq("id", input.meetingId)
    .maybeSingle();
  if (!meeting) return { error: "That meeting no longer exists." };

  const { data, error } = await admin
    .from("highlights")
    .insert({
      meeting_id: meeting.id,
      start_ms: startMs,
      end_ms: Math.min(endMs, meeting.duration_ms || endMs),
      quote,
      title,
    })
    .select("id")
    .single();
  if (error) return { error: "Could not save the clip. Try again." };
  return { id: data.id };
}
