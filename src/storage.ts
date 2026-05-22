import type { PetProtectorSettings } from "./types";

export const SETTINGS_KEY = "petProtectorSettings";

export const DEFAULT_SETTINGS: PetProtectorSettings = {
  petImageDataUrl: null,
  mediaType: "image",
  mediaName: null,
  mediaDurationSeconds: null,
  screenTimeMinutes: 25,
  protectorDurationMinutes: 1,
  timerStatus: "idle",
  timerEndsAt: null
};

export async function getSettings(): Promise<PetProtectorSettings> {
  const result = await chrome.storage.local.get(SETTINGS_KEY);
  const savedSettings = result[SETTINGS_KEY] as Partial<PetProtectorSettings> | undefined;
  const legacyImageDataUrl = savedSettings?.petImageDataUrl ?? null;

  return {
    ...DEFAULT_SETTINGS,
    ...savedSettings,
    mediaType: savedSettings?.mediaType ?? "image"
  };
}

export async function saveSettings(settings: PetProtectorSettings): Promise<void> {
  await chrome.storage.local.set({ [SETTINGS_KEY]: settings });
}

export async function patchSettings(patch: Partial<PetProtectorSettings>): Promise<PetProtectorSettings> {
  const settings = await getSettings();
  const nextSettings = { ...settings, ...patch };
  await saveSettings(nextSettings);
  return nextSettings;
}

export function clampMinutes(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) {
    return min;
  }

  return Math.min(Math.max(value, min), max);
}
