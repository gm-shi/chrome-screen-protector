import React, { ChangeEvent, useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { Clock, ImagePlus, PauseCircle, Play, ShieldCheck, X } from "lucide-react";
import { getActiveMedia, saveActiveMedia } from "../mediaStore";
import { clampMinutes, DEFAULT_SETTINGS, getSettings, patchSettings } from "../storage";
import type { PetProtectorSettings, RuntimeMessage, RuntimeResponse } from "../types";
import "./styles.css";

const PROTECTOR_MAX_MINUTES = 5;
const MIN_PROTECTOR_IMAGE_LONG_EDGE = 2560;
const MAX_PROTECTOR_IMAGE_LONG_EDGE = 4096;
const PROTECTOR_IMAGE_QUALITY = 0.95;
const MAX_VIDEO_BYTES = 15 * 1024 * 1024;

function App() {
  const [settings, setSettings] = useState<PetProtectorSettings>(DEFAULT_SETTINGS);
  const [mediaPreviewUrl, setMediaPreviewUrl] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    void refreshSettings();
  }, []);

  useEffect(() => {
    return () => {
      if (mediaPreviewUrl?.startsWith("blob:")) {
        URL.revokeObjectURL(mediaPreviewUrl);
      }
    };
  }, [mediaPreviewUrl]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const remainingText = useMemo(() => {
    if (settings.timerStatus !== "running" || !settings.timerEndsAt) {
      return null;
    }

    const remainingMs = Math.max(0, settings.timerEndsAt - now);
    const minutes = Math.floor(remainingMs / 60_000);
    const seconds = Math.floor((remainingMs % 60_000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  }, [now, settings.timerEndsAt, settings.timerStatus]);

  async function refreshSettings() {
    setIsBusy(true);
    setError(null);

    try {
      const response = await sendMessage({ type: "GET_STATUS" });
      if (response.settings) {
        setSettings(response.settings);
      }
      await refreshMediaPreview(response.settings ?? null);
    } catch (refreshError) {
      setError(getErrorMessage(refreshError));
      const fallbackSettings = await getSettings();
      setSettings(fallbackSettings);
      await refreshMediaPreview(fallbackSettings);
    } finally {
      setIsBusy(false);
    }
  }

  async function updateSettings(patch: Partial<PetProtectorSettings>) {
    const nextSettings = await patchSettings(patch);
    setSettings(nextSettings);
  }

  async function refreshMediaPreview(settings: PetProtectorSettings | null): Promise<void> {
    const activeMedia = await getActiveMedia();
    if (activeMedia) {
      setPreviewObjectUrl(URL.createObjectURL(activeMedia.blob));
      return;
    }

    setPreviewObjectUrl(settings?.petImageDataUrl ?? null);
  }

  function setPreviewObjectUrl(nextUrl: string | null): void {
    setMediaPreviewUrl((previousUrl) => replacePreviewUrl(previousUrl, nextUrl));
  }

  async function handleMediaUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    setError(null);

    try {
      if (file.type.startsWith("video/")) {
        if (file.size > MAX_VIDEO_BYTES) {
          throw new Error("Please upload a video under 15 MB.");
        }

        const videoDurationSeconds = await getVideoDurationSeconds(file);
        await saveActiveMedia(file, "video", file.name, videoDurationSeconds);
        setMediaPreviewUrl((previousUrl) => replacePreviewUrl(previousUrl, URL.createObjectURL(file)));
        await updateSettings({
          mediaType: "video",
          mediaName: file.name,
          mediaDurationSeconds: videoDurationSeconds,
          petImageDataUrl: null
        });
        return;
      }

      const imageBlob = await resizeImage(file, await getProtectorImageLongEdge());
      await saveActiveMedia(imageBlob, "image", file.name, null);
      setMediaPreviewUrl((previousUrl) => replacePreviewUrl(previousUrl, URL.createObjectURL(imageBlob)));
      await updateSettings({
        mediaType: "image",
        mediaName: file.name,
        mediaDurationSeconds: null,
        petImageDataUrl: null
      });
    } catch (uploadError) {
      setError(getErrorMessage(uploadError));
    } finally {
      event.target.value = "";
    }
  }

  async function startTimer() {
    setIsBusy(true);
    setError(null);

    try {
      const response = await sendMessage({
        type: "START_TIMER",
        payload: {
          screenTimeMinutes: settings.screenTimeMinutes,
          protectorDurationMinutes: settings.protectorDurationMinutes
        }
      });

      if (response.settings) {
        setSettings(response.settings);
      }
    } catch (startError) {
      setError(getErrorMessage(startError));
    } finally {
      setIsBusy(false);
    }
  }

  async function stopTimer() {
    setIsBusy(true);
    setError(null);

    try {
      const response = await sendMessage({ type: "STOP_TIMER" });
      if (response.settings) {
        setSettings(response.settings);
      }
    } catch (stopError) {
      setError(getErrorMessage(stopError));
    } finally {
      setIsBusy(false);
    }
  }

  const statusLabel =
    settings.timerStatus === "running"
      ? `Running${remainingText ? ` · ${remainingText}` : ""}`
      : settings.timerStatus === "protecting"
        ? "Protector active"
        : "Ready";

  return (
    <main className="app-shell">
      <header className="app-header">
        <div>
          <p className="eyebrow">Local Chrome extension</p>
          <h1>Pet Protector</h1>
        </div>
        <div className={`status-pill status-${settings.timerStatus}`}>
          <ShieldCheck size={15} aria-hidden="true" />
          {statusLabel}
        </div>
      </header>

      <section className="pet-preview" aria-label="Pet image">
        {mediaPreviewUrl && settings.mediaType === "video" ? (
          <video src={mediaPreviewUrl} aria-label="Uploaded pet video" muted loop playsInline controls />
        ) : mediaPreviewUrl ?? settings.petImageDataUrl ? (
          <img src={mediaPreviewUrl ?? settings.petImageDataUrl ?? ""} alt="Uploaded pet" />
        ) : (
          <div className="empty-pet">
            <ImagePlus size={36} aria-hidden="true" />
            <span>Add a pet image or video</span>
          </div>
        )}
      </section>

      <label className="upload-button">
        <ImagePlus size={18} aria-hidden="true" />
        Upload or replace pet media
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif,video/mp4,video/webm,video/quicktime"
          onChange={handleMediaUpload}
        />
      </label>

      <section className="controls" aria-label="Timer settings">
        <label className="field">
          <span>
            <Clock size={16} aria-hidden="true" />
            Screen time
          </span>
          <div className="number-row">
            <input
              min={1}
              max={720}
              type="number"
              value={settings.screenTimeMinutes}
              onChange={(event) =>
                void updateSettings({
                  screenTimeMinutes: clampMinutes(Number(event.target.value), 1, 720)
                })
              }
            />
            <span>min</span>
          </div>
        </label>

        {settings.mediaType === "image" ? (
          <label className="field">
            <span>
              <PauseCircle size={16} aria-hidden="true" />
              Protector duration
            </span>
            <div className="range-row">
              <input
                min={1}
                max={PROTECTOR_MAX_MINUTES}
                type="range"
                value={settings.protectorDurationMinutes}
                onChange={(event) =>
                  void updateSettings({
                    protectorDurationMinutes: clampMinutes(Number(event.target.value), 1, PROTECTOR_MAX_MINUTES)
                  })
                }
              />
              <strong>{settings.protectorDurationMinutes} min</strong>
            </div>
          </label>
        ) : (
          <div className="field">
            <span>
              <PauseCircle size={16} aria-hidden="true" />
              Protector duration
            </span>
            <p className="field-note">
              Video protector stays until dismissed. Timer starts at 00:00.
            </p>
          </div>
        )}
      </section>

      {error ? (
        <div className="error-banner" role="alert">
          {error}
        </div>
      ) : null}

      <footer className="actions">
        {settings.timerStatus === "idle" ? (
          <button className="primary-action" type="button" onClick={startTimer} disabled={isBusy}>
            <Play size={18} aria-hidden="true" />
            Start timer
          </button>
        ) : (
          <button className="secondary-action" type="button" onClick={stopTimer} disabled={isBusy}>
            <X size={18} aria-hidden="true" />
            Stop protector
          </button>
        )}
      </footer>
    </main>
  );
}

async function sendMessage(message: RuntimeMessage): Promise<RuntimeResponse> {
  const response = (await chrome.runtime.sendMessage(message)) as RuntimeResponse | undefined;

  if (!response?.ok) {
    throw new Error(response?.error ?? "The extension background service did not respond.");
  }

  return response;
}

async function resizeImage(file: File, maxSize: number): Promise<Blob> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Please upload an image file.");
  }

  const dataUrl = await readFileAsDataUrl(file);
  const image = await loadImage(dataUrl);
  const scale = Math.min(1, maxSize / Math.max(image.width, image.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(image.width * scale));
  canvas.height = Math.max(1, Math.round(image.height * scale));

  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Could not process this image.");
  }

  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  const blob = await canvasToBlob(canvas);
  if (!blob) {
    throw new Error("Could not compress this image.");
  }

  return blob;
}

async function getProtectorImageLongEdge(): Promise<number> {
  const display = await getPrimaryDisplay();
  const displayLongEdge = display ? Math.max(display.bounds.width, display.bounds.height) : 0;
  const screenLongEdge = Math.max(window.screen.width, window.screen.height) * window.devicePixelRatio;
  const detectedLongEdge = Math.max(displayLongEdge, screenLongEdge);
  const targetLongEdge = Math.max(MIN_PROTECTOR_IMAGE_LONG_EDGE, Math.ceil(detectedLongEdge));
  return Math.min(MAX_PROTECTOR_IMAGE_LONG_EDGE, targetLongEdge);
}

async function getPrimaryDisplay(): Promise<chrome.system.display.DisplayUnitInfo | null> {
  if (!chrome.system?.display?.getInfo) {
    return null;
  }

  try {
    const displays = await chrome.system.display.getInfo();
    return displays.find((display) => display.isPrimary) ?? displays[0] ?? null;
  } catch {
    return null;
  }
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => resolve(String(reader.result)));
    reader.addEventListener("error", () => reject(new Error("Could not read this image.")));
    reader.readAsDataURL(file);
  });
}

function getVideoDurationSeconds(file: File): Promise<number | null> {
  return new Promise((resolve) => {
    const video = document.createElement("video");
    const objectUrl = URL.createObjectURL(file);

    video.preload = "metadata";
    video.addEventListener(
      "loadedmetadata",
      () => {
        URL.revokeObjectURL(objectUrl);
        resolve(Number.isFinite(video.duration) ? video.duration : null);
      },
      { once: true }
    );
    video.addEventListener(
      "error",
      () => {
        URL.revokeObjectURL(objectUrl);
        resolve(null);
      },
      { once: true }
    );
    video.src = objectUrl;
  });
}

function formatDuration(seconds: number): string {
  const roundedSeconds = Math.max(1, Math.round(seconds));
  const minutes = Math.floor(roundedSeconds / 60);
  const remainingSeconds = roundedSeconds % 60;
  return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
}

function replacePreviewUrl(previousUrl: string | null, nextUrl: string | null): string | null {
  if (previousUrl?.startsWith("blob:")) {
    URL.revokeObjectURL(previousUrl);
  }

  return nextUrl;
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob(resolve, "image/webp", PROTECTOR_IMAGE_QUALITY);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener("load", () => resolve(image));
    image.addEventListener("error", () => reject(new Error("Could not load this image.")));
    image.src = src;
  });
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
