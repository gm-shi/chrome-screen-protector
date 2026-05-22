export type TimerStatus = "idle" | "running" | "protecting";

export interface PetProtectorSettings {
  petImageDataUrl: string | null;
  screenTimeMinutes: number;
  protectorDurationMinutes: number;
  timerStatus: TimerStatus;
  timerEndsAt: number | null;
}

export type RuntimeMessage =
  | { type: "GET_STATUS" }
  | { type: "START_TIMER"; payload: Pick<PetProtectorSettings, "screenTimeMinutes" | "protectorDurationMinutes"> }
  | { type: "STOP_TIMER" }
  | { type: "SHOW_PROTECTOR"; payload: Pick<PetProtectorSettings, "petImageDataUrl" | "protectorDurationMinutes"> }
  | { type: "HIDE_PROTECTOR" };

export interface RuntimeResponse {
  ok: boolean;
  error?: string;
  settings?: PetProtectorSettings;
}
