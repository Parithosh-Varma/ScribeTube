export interface VideoPreset {
  id: string;
  title: string;
  channel: string;
  url: string;
  thumbnail: string;
  rawTranscript: string;
  formattedBook: string;
}

export const videoPresets: Record<string, VideoPreset> = {};
