export type TimerStatus = "idle" | "running" | "protecting";
export type ProtectorMediaType = "image" | "video";

export interface PetProtectorSettings {
  petImageDataUrl: string | null;
  mediaType: ProtectorMediaType;
  mediaName: string | null;
  mediaDurationSeconds: number | null;
  screenTimeMinutes: number;
  protectorDurationMinutes: number;
  timerStatus: TimerStatus;
  timerEndsAt: number | null;
}

export type RuntimeMessage =
  | { type: "GET_STATUS" }
  | { type: "START_TIMER"; payload: Pick<PetProtectorSettings, "screenTimeMinutes" | "protectorDurationMinutes"> }
  | { type: "STOP_TIMER" }
  | {
      type: "SHOW_PROTECTOR";
      payload: Pick<PetProtectorSettings, "mediaDurationSeconds" | "mediaType" | "protectorDurationMinutes"> & {
        mediaDataUrl: string | null;
      };
    }
  | { type: "HIDE_PROTECTOR" };

export interface RuntimeResponse {
  ok: boolean;
  error?: string;
  settings?: PetProtectorSettings;
}
