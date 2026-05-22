import type { RuntimeMessage } from "./types";

const ROOT_ID = "pet-screen-protector-root";
const LISTENER_FLAG = "__petScreenProtectorListenerReady";

declare global {
  interface Window {
    [LISTENER_FLAG]?: boolean;
  }
}

if (!window[LISTENER_FLAG]) {
  window[LISTENER_FLAG] = true;
  chrome.runtime.onMessage.addListener((message: RuntimeMessage) => {
    if (message.type === "SHOW_PROTECTOR") {
      showProtector(
        message.payload.mediaDataUrl,
        message.payload.mediaType,
        message.payload.mediaDurationSeconds,
        message.payload.protectorDurationMinutes
      );
    }

    if (message.type === "HIDE_PROTECTOR") {
      hideProtector();
    }
  });
}

function showProtector(
  mediaDataUrl: string | null,
  mediaType: "image" | "video",
  mediaDurationSeconds: number | null,
  durationMinutes: number
): void {
  hideProtector();

  const protectorStartedAt = Date.now();
  const root = document.createElement("div");
  root.id = ROOT_ID;
  root.setAttribute("role", "dialog");
  root.setAttribute("aria-label", "Pet screen protector");

  const styles = document.createElement("style");
  styles.textContent = `
    #${ROOT_ID} {
      position: fixed;
      inset: 0;
      z-index: 2147483647;
      display: grid;
      place-items: center;
      overflow: hidden;
      color: #f8fafc;
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      background:
        radial-gradient(circle at 20% 20%, rgba(56, 189, 248, 0.32), transparent 28%),
        radial-gradient(circle at 78% 22%, rgba(251, 191, 36, 0.28), transparent 24%),
        radial-gradient(circle at 55% 82%, rgba(244, 114, 182, 0.24), transparent 30%),
        linear-gradient(135deg, #10212f 0%, #1d2f26 52%, #3a2735 100%);
    }

    #${ROOT_ID} * {
      box-sizing: border-box;
    }

    #${ROOT_ID} .pet-protector-close {
      position: absolute;
      top: 20px;
      right: 20px;
      z-index: 2;
      min-width: 112px;
      height: 42px;
      padding: 0 16px;
      border: 1px solid rgba(255, 255, 255, 0.3);
      border-radius: 999px;
      color: #ffffff;
      background: rgba(15, 23, 42, 0.45);
      cursor: pointer;
      font-size: 14px;
      font-weight: 800;
      line-height: 1;
      backdrop-filter: blur(14px);
      box-shadow: 0 14px 38px rgba(0, 0, 0, 0.26);
    }

    #${ROOT_ID} .pet-protector-scene {
      position: absolute;
      inset: -3%;
      display: grid;
      place-items: center;
    }

    #${ROOT_ID} .pet-protector-scene.is-image {
      animation: petSceneDrift 18s ease-in-out infinite alternate;
    }

    #${ROOT_ID} .pet-protector-scene.is-image::after {
      content: "";
      position: absolute;
      inset: 0;
      background:
        radial-gradient(circle at 50% 45%, transparent 0%, rgba(0, 0, 0, 0.08) 52%, rgba(0, 0, 0, 0.34) 100%),
        linear-gradient(180deg, rgba(15, 23, 42, 0.12), rgba(15, 23, 42, 0.28));
      pointer-events: none;
    }

    #${ROOT_ID} .pet-protector-media-wrap {
      width: 100%;
      height: 100%;
    }

    #${ROOT_ID} .pet-protector-media-wrap.is-image {
      animation: petBreathing 8s ease-in-out infinite;
    }

    #${ROOT_ID} .pet-protector-media {
      width: 100%;
      height: 100%;
      object-fit: cover;
      border-radius: 0;
    }

    #${ROOT_ID} .pet-protector-placeholder {
      width: min(72vw, 520px);
      height: min(72vw, 520px);
      display: grid;
      place-items: center;
      border-radius: 999px;
      color: #172033;
      background: linear-gradient(135deg, #fef3c7, #bae6fd);
      font-size: clamp(48px, 11vw, 112px);
      font-weight: 800;
    }

    #${ROOT_ID} .pet-protector-caption {
      position: absolute;
      left: 50%;
      bottom: max(34px, 6vh);
      z-index: 1;
      transform: translateX(-50%);
      width: min(88vw, 520px);
      padding: 12px 18px;
      border: 1px solid rgba(255, 255, 255, 0.22);
      border-radius: 999px;
      text-align: center;
      font-size: 14px;
      line-height: 1.35;
      background: rgba(15, 23, 42, 0.36);
      backdrop-filter: blur(14px);
    }

    #${ROOT_ID} .pet-protector-timer {
      position: absolute;
      right: 20px;
      bottom: 20px;
      z-index: 2;
      min-width: 112px;
      padding: 10px 14px;
      border: 1px solid rgba(255, 255, 255, 0.26);
      border-radius: 999px;
      color: #ffffff;
      background: rgba(15, 23, 42, 0.42);
      text-align: center;
      font-size: 14px;
      font-weight: 800;
      line-height: 1;
      backdrop-filter: blur(14px);
      box-shadow: 0 14px 38px rgba(0, 0, 0, 0.22);
    }

    @keyframes petSceneDrift {
      from { transform: translate3d(-1.5vw, -1vh, 0) scale(1.01); }
      to { transform: translate3d(1.5vw, 1vh, 0) scale(1.04); }
    }

    @keyframes petBreathing {
      0%, 100% { transform: scale(1); }
      50% { transform: scale(1.025); }
    }
  `;

  const closeButton = document.createElement("button");
  closeButton.type = "button";
  closeButton.className = "pet-protector-close";
  closeButton.setAttribute("aria-label", "Dismiss pet screen protector");
  closeButton.textContent = "Dismiss";
  closeButton.addEventListener("click", requestHideProtector);

  const scene = document.createElement("div");
  scene.className = `pet-protector-scene is-${mediaType}`;

  const mediaWrap = document.createElement("div");
  mediaWrap.className = `pet-protector-media-wrap is-${mediaType}`;

  if (mediaDataUrl && mediaType === "video") {
    const video = document.createElement("video");
    video.className = "pet-protector-media";
    video.src = mediaDataUrl;
    video.autoplay = true;
    video.loop = false;
    video.muted = true;
    video.playsInline = true;
    video.setAttribute("aria-label", "Uploaded pet video");
    mediaWrap.append(video);
    void video.play().catch(() => undefined);
  } else if (mediaDataUrl) {
    const image = document.createElement("img");
    image.className = "pet-protector-media";
    image.src = mediaDataUrl;
    image.alt = "Uploaded pet";
    mediaWrap.append(image);
  } else {
    const placeholder = document.createElement("div");
    placeholder.className = "pet-protector-placeholder";
    placeholder.textContent = "PET";
    mediaWrap.append(placeholder);
  }

  const caption = document.createElement("div");
  caption.className = "pet-protector-caption";
  caption.textContent =
    mediaType === "video"
      ? `Video screen protector${mediaDurationSeconds ? ` (${formatDuration(mediaDurationSeconds)})` : ""}.`
      : `Screen protector active for up to ${durationMinutes} minute${durationMinutes === 1 ? "" : "s"}.`;

  const timer = document.createElement("div");
  timer.className = "pet-protector-timer";
  timer.textContent = "00:00";
  const intervalId = window.setInterval(() => {
    timer.textContent = formatElapsedMs(Date.now() - protectorStartedAt);
  }, 1000);
  root.dataset.timerId = String(intervalId);

  scene.append(mediaWrap);
  root.append(styles, closeButton, scene, caption, timer);
  document.documentElement.append(root);
}

function hideProtector(): void {
  const root = document.getElementById(ROOT_ID);
  const timerId = root?.dataset.timerId;
  if (timerId) {
    window.clearInterval(Number(timerId));
  }

  root?.remove();
}

function requestHideProtector(): void {
  hideProtector();
  void chrome.runtime.sendMessage({ type: "HIDE_PROTECTOR" } satisfies RuntimeMessage);
}

function formatDuration(seconds: number): string {
  const roundedSeconds = Math.max(1, Math.round(seconds));
  const minutes = Math.floor(roundedSeconds / 60);
  const remainingSeconds = roundedSeconds % 60;
  return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
}

function formatElapsedMs(milliseconds: number): string {
  const remainingSeconds = Math.max(0, Math.floor(milliseconds / 1000));
  return formatDuration(remainingSeconds);
}
