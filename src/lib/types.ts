export type MediaType = "youtube" | "audio" | "video";

export type Meeting = {
  id: string;
  slug: string;
  title: string;
  started_at: string;
  duration_ms: number;
  media_type: MediaType;
  media_url: string | null;
  youtube_id: string | null;
  source_name: string | null;
  source_url: string | null;
  credit: string | null;
  kind: "demo" | "upload";
  status: "processing" | "ready" | "failed";
  meeting_type: string | null;
};

export type Speaker = {
  id: string;
  meeting_id: string;
  label: string;
  name: string;
  role: string | null;
  color: number;
  talk_ms: number;
  turns: number;
};

export type Utterance = {
  id: number;
  speaker_id: string;
  idx: number;
  start_ms: number;
  end_ms: number;
  text: string;
};

export type Chapter = {
  id: string;
  idx: number;
  title: string;
  start_ms: number;
  end_ms: number;
  gist: string | null;
};

export type ActionItem = {
  id: string;
  idx: number;
  text: string;
  owner_name: string | null;
  speaker_id: string | null;
  ts_ms: number | null;
  done: boolean;
};

export type SummaryBullet = { text: string; ts_ms?: number | null; line?: number };
export type SummaryContent = {
  tldr?: string;
  sections: { heading: string; bullets: SummaryBullet[] }[];
};
export type Summary = { template: string; content: SummaryContent; model: string | null };

export type Highlight = {
  id: string;
  meeting_id: string;
  start_ms: number;
  end_ms: number;
  title: string | null;
  quote: string;
  created_at: string;
};

export type MeetingListItem = Meeting & {
  speakers: Pick<Speaker, "id" | "name" | "color" | "talk_ms">[];
};

export type MeetingDetail = {
  meeting: Meeting;
  speakers: Speaker[];
  utterances: Utterance[];
  chapters: Chapter[];
  actionItems: ActionItem[];
  summaries: Summary[];
  highlights: Highlight[];
};

export type SearchHit = {
  utterance_id: number;
  meeting_id: string;
  meeting_slug: string;
  meeting_title: string;
  started_at: string;
  speaker_name: string;
  speaker_color: number;
  start_ms: number;
  snippet: string;
  rank: number;
};

export const TEMPLATES = [
  { id: "general", label: "General" },
  { id: "project_update", label: "Project update" },
  { id: "standup", label: "Standup" },
  { id: "retro", label: "Retro" },
  { id: "sales", label: "Sales" },
  { id: "one_on_one", label: "1:1" },
] as const;
