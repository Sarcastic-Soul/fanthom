import "server-only";
import { db } from "./supabase";
import type {
  ActionItem,
  Chapter,
  Highlight,
  Meeting,
  MeetingDetail,
  MeetingListItem,
  SearchHit,
  Speaker,
  Summary,
  Utterance,
} from "./types";

export async function listMeetings(): Promise<MeetingListItem[]> {
  const { data, error } = await db
    .from("meetings")
    .select("*, speakers(id, name, color, talk_ms)")
    .order("started_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as MeetingListItem[];
}

// PostgREST caps a response at 1000 rows, and an hour-long call can have more lines.
async function allUtterances(meetingId: string): Promise<Utterance[]> {
  const pageSize = 1000;
  const rows: Utterance[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await db
      .from("utterances")
      .select("id, speaker_id, idx, start_ms, end_ms, text")
      .eq("meeting_id", meetingId)
      .order("idx")
      .range(from, from + pageSize - 1);
    if (error) throw error;
    rows.push(...(data as Utterance[]));
    if (!data || data.length < pageSize) return rows;
  }
}

export async function getMeeting(slug: string): Promise<MeetingDetail | null> {
  const { data: meeting, error } = await db
    .from("meetings")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw error;
  if (!meeting) return null;
  const id = (meeting as Meeting).id;

  const [speakers, utterances, chapters, actionItems, summaries, highlights] = await Promise.all([
    db.from("speakers").select("*").eq("meeting_id", id).order("color"),
    allUtterances(id),
    db.from("chapters").select("id, idx, title, start_ms, end_ms, gist").eq("meeting_id", id).order("idx"),
    db
      .from("action_items")
      .select("id, idx, text, owner_name, speaker_id, ts_ms, done")
      .eq("meeting_id", id)
      .order("idx"),
    db.from("summaries").select("template, content, model").eq("meeting_id", id),
    db.from("highlights").select("*").eq("meeting_id", id).order("start_ms"),
  ]);

  for (const r of [speakers, chapters, actionItems, summaries, highlights]) {
    if (r.error) throw r.error;
  }

  return {
    meeting: meeting as Meeting,
    speakers: speakers.data as Speaker[],
    utterances,
    chapters: chapters.data as Chapter[],
    actionItems: actionItems.data as ActionItem[],
    summaries: summaries.data as Summary[],
    highlights: highlights.data as Highlight[],
  };
}

export async function getHighlight(id: string) {
  const { data, error } = await db
    .from("highlights")
    .select("*, meetings(*)")
    .eq("id", id)
    .maybeSingle();
  if (error) return null;
  if (!data) return null;
  const { meetings, ...highlight } = data as Highlight & { meetings: Meeting };
  return { highlight: highlight as Highlight, meeting: meetings };
}

export async function getClipLines(meetingId: string, startMs: number, endMs: number) {
  const { data, error } = await db
    .from("utterances")
    .select("id, speaker_id, idx, start_ms, end_ms, text, speakers(name, color)")
    .eq("meeting_id", meetingId)
    .lt("start_ms", endMs)
    .gt("end_ms", startMs)
    .order("idx");
  if (error) throw error;
  return data as unknown as (Utterance & { speakers: { name: string; color: number } })[];
}

export async function searchAll(q: string): Promise<SearchHit[]> {
  if (!q.trim()) return [];
  const { data, error } = await db.rpc("search_utterances", { q, max_results: 60 });
  if (error) throw error;
  return (data ?? []) as SearchHit[];
}
