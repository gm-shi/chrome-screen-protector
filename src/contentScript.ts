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
      showProtector(message.payload.petImageDataUrl, message.payload.protectorDurationMinutes);
    }

    if (message.type === "HIDE_PROTECTOR") {
      hideProtector();
    }
  });
}

function showProtector(petImageDataUrl: string | null, durationMinutes: number): void {
  hideProtector();

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
      width: 42px;
      height: 42px;
      border: 1px solid rgba(255, 255, 255, 0.3);
      border-radius: 999px;
      color: #ffffff;
      background: rgba(15, 23, 42, 0.45);
      cursor: pointer;
      font-size: 28px;
      line-height: 1;
      backdrop-filter: blur(14px);
    }

    #${ROOT_ID} .pet-protector-scene {
      position: absolute;
      inset: -3%;
      display: grid;
      place-items: center;
      animation: petSceneDrift 18s ease-in-out infinite alternate;
    }

    #${ROOT_ID} .pet-protector-scene::after {
      content: "";
      position: absolute;
      inset: 0;
      background:
        radial-gradient(circle at 50% 45%, transparent 0%, rgba(0, 0, 0, 0.08) 52%, rgba(0, 0, 0, 0.34) 100%),
        linear-gradient(180deg, rgba(15, 23, 42, 0.12), rgba(15, 23, 42, 0.28));
      pointer-events: none;
    }

    #${ROOT_ID} .pet-protector-image-wrap {
      width: 100%;
      height: 100%;
      animation: petBreathing 8s ease-in-out infinite;
    }

    #${ROOT_ID} .pet-protector-image {
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
  closeButton.textContent = "×";
  closeButton.addEventListener("click", requestHideProtector);

  const scene = document.createElement("div");
  scene.className = "pet-protector-scene";

  const imageWrap = document.createElement("div");
  imageWrap.className = "pet-protector-image-wrap";

  if (petImageDataUrl) {
    const image = document.createElement("img");
    image.className = "pet-protector-image";
    image.src = petImageDataUrl;
    image.alt = "Uploaded pet";
    imageWrap.append(image);
  } else {
    const placeholder = document.createElement("div");
    placeholder.className = "pet-protector-placeholder";
    placeholder.textContent = "PET";
    imageWrap.append(placeholder);
  }

  const caption = document.createElement("div");
  caption.className = "pet-protector-caption";
  caption.textContent = `Screen protector active for up to ${durationMinutes} minute${durationMinutes === 1 ? "" : "s"}.`;

  scene.append(imageWrap);
  root.append(styles, closeButton, scene, caption);
  document.documentElement.append(root);
}

function hideProtector(): void {
  document.getElementById(ROOT_ID)?.remove();
}

function requestHideProtector(): void {
  hideProtector();
  void chrome.runtime.sendMessage({ type: "HIDE_PROTECTOR" } satisfies RuntimeMessage);
}
