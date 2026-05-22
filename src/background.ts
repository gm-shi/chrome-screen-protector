import { clampMinutes, getSettings, patchSettings } from "./storage";
import type { RuntimeMessage, RuntimeResponse } from "./types";

const SCREEN_TIME_ALARM = "pet-protector-screen-time";
const HIDE_PROTECTOR_ALARM = "pet-protector-hide";
const PROTECTOR_MAX_MINUTES = 5;

chrome.runtime.onInstalled.addListener(async () => {
  await chrome.alarms.clear(SCREEN_TIME_ALARM);
  await chrome.alarms.clear(HIDE_PROTECTOR_ALARM);
  const settings = await getSettings();
  await patchSettings({ ...settings, timerStatus: "idle", timerEndsAt: null });
});

chrome.runtime.onMessage.addListener((message: RuntimeMessage, _sender, sendResponse) => {
  handleMessage(message)
    .then(sendResponse)
    .catch((error: unknown) => {
      sendResponse({ ok: false, error: getErrorMessage(error) });
    });

  return true;
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === SCREEN_TIME_ALARM) {
    void showProtectorOnAllTabs();
  }

  if (alarm.name === HIDE_PROTECTOR_ALARM) {
    void hideProtectorOnAllTabs();
  }
});

async function handleMessage(message: RuntimeMessage): Promise<RuntimeResponse> {
  if (message.type === "GET_STATUS") {
    const settings = await getSettings();
    return { ok: true, settings };
  }

  if (message.type === "START_TIMER") {
    const screenTimeMinutes = clampMinutes(message.payload.screenTimeMinutes, 1, 720);
    const protectorDurationMinutes = clampMinutes(message.payload.protectorDurationMinutes, 1, PROTECTOR_MAX_MINUTES);
    const timerEndsAt = Date.now() + screenTimeMinutes * 60_000;

    await chrome.alarms.clear(SCREEN_TIME_ALARM);
    await chrome.alarms.clear(HIDE_PROTECTOR_ALARM);
    await chrome.alarms.create(SCREEN_TIME_ALARM, { when: timerEndsAt });

    const settings = await patchSettings({
      screenTimeMinutes,
      protectorDurationMinutes,
      timerStatus: "running",
      timerEndsAt
    });

    return { ok: true, settings };
  }

  if (message.type === "STOP_TIMER") {
    await chrome.alarms.clear(SCREEN_TIME_ALARM);
    await chrome.alarms.clear(HIDE_PROTECTOR_ALARM);
    await hideProtectorOnAllTabs();
    const settings = await patchSettings({ timerStatus: "idle", timerEndsAt: null });
    return { ok: true, settings };
  }

  if (message.type === "HIDE_PROTECTOR") {
    await chrome.alarms.clear(HIDE_PROTECTOR_ALARM);
    await hideProtectorOnAllTabs();
    const settings = await getSettings();
    return { ok: true, settings };
  }

  return { ok: false, error: `Unsupported message type: ${message.type}` };
}

async function showProtectorOnAllTabs(): Promise<void> {
  const settings = await getSettings();
  const protectorDurationMinutes = clampMinutes(settings.protectorDurationMinutes, 1, PROTECTOR_MAX_MINUTES);

  await patchSettings({
    timerStatus: "protecting",
    timerEndsAt: null,
    protectorDurationMinutes
  });

  await chrome.alarms.clear(HIDE_PROTECTOR_ALARM);
  await chrome.alarms.create(HIDE_PROTECTOR_ALARM, { delayInMinutes: protectorDurationMinutes });

  const tabs = await chrome.tabs.query({ windowType: "normal" });
  await Promise.allSettled(
    tabs.map((tab) =>
      sendOverlayMessage(tab.id, {
        type: "SHOW_PROTECTOR",
        payload: {
          petImageDataUrl: settings.petImageDataUrl,
          protectorDurationMinutes
        }
      })
    )
  );
}

async function hideProtectorOnAllTabs(): Promise<void> {
  const tabs = await chrome.tabs.query({ windowType: "normal" });
  await Promise.allSettled(tabs.map((tab) => sendOverlayMessage(tab.id, { type: "HIDE_PROTECTOR" })));
  await patchSettings({ timerStatus: "idle", timerEndsAt: null });
}

async function sendOverlayMessage(tabId: number | undefined, message: RuntimeMessage): Promise<void> {
  if (!tabId) {
    return;
  }

  try {
    await chrome.tabs.sendMessage(tabId, message);
  } catch {
    await tryInjectContentScript(tabId);
    await chrome.tabs.sendMessage(tabId, message);
  }
}

async function tryInjectContentScript(tabId: number): Promise<void> {
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ["assets/contentScript.js"]
    });
  } catch (error) {
    console.info("Pet protector could not inject into this tab.", error);
  }
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
