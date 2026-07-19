const PROFILE_PREFIX = "rally:booth-profile:";

const frames = [
  {
    id: "court-club",
    name: "Court Club",
    src: "/frames/court-club.png",
    photo: { x: 112, y: 214, w: 780, h: 548 },
    captionY: 620,
    panel: "rgba(244, 236, 214, 0.94)",
    ink: "#173f31",
    accent: "#e74e2f",
  },
  {
    id: "kitchen-royalty",
    name: "Kitchen Royalty",
    src: "/frames/kitchen-royalty.png",
    photo: { x: 96, y: 254, w: 832, h: 488 },
    captionY: 610,
    panel: "rgba(35, 7, 54, 0.93)",
    ink: "#fff7df",
    accent: "#f7ee32",
  },
  {
    id: "golden-hour",
    name: "Golden Hour",
    src: "/frames/golden-hour.png",
    photo: { x: 104, y: 190, w: 816, h: 522 },
    captionY: 574,
    panel: "rgba(56, 35, 25, 0.9)",
    ink: "#fff3d4",
    accent: "#f6ae45",
  },
  {
    id: "team-tape",
    name: "Team Tape",
    src: "/frames/team-tape.png",
    photo: { x: 96, y: 170, w: 832, h: 542 },
    captionY: 578,
    panel: "rgba(16, 16, 15, 0.93)",
    ink: "#fffaf0",
    accent: "#ff731c",
  },
];

const superlatives = [
  "Most Likely to Poach",
  "Kitchen Royalty",
  "Third-Shot Therapist",
  "Lob Department Chair",
  "Best Dressed at Open Play",
  "Certified Erne Threat",
  "Team Nobody Asked For",
  "Two Dinks, One Dream",
  "Most Likely to Call It In",
];

const quotes = [
  "Mine was in.",
  "Meet us at the kitchen.",
  "Respect the third shot.",
  "We came. We dinked. We poached.",
  "Hydrated, coordinated, overrated.",
  "One more game means three more games.",
];

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

function fitText(ctx, text, maxWidth, start, min, family) {
  let size = start;
  while (size > min) {
    ctx.font = `700 ${size}px ${family}`;
    if (ctx.measureText(text).width <= maxWidth) break;
    size -= 2;
  }
  return size;
}

function downloadBlob(blob, filename) {
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}

export function initBooth({ authorizeSave, statusEl }) {
  const canvas = document.getElementById("booth-canvas");
  const ctx = canvas.getContext("2d");
  const upload = document.getElementById("booth-upload");
  const zoom = document.getElementById("booth-zoom");
  const nameInput = document.getElementById("booth-name");
  const superlative = document.getElementById("booth-superlative");
  const custom = document.getElementById("booth-custom");
  const customField = document.getElementById("booth-custom-field");
  const quote = document.getElementById("booth-quote");
  const frameButtons = [...document.querySelectorAll("[data-booth-frame]")];

  const state = {
    frame: 0,
    photo: null,
    zoom: 1,
    panX: 0,
    panY: 0,
    drag: null,
  };

  const frameImages = frames.map((frame) => {
    const image = new Image();
    image.src = frame.src;
    image.onload = draw;
    return image;
  });

  for (const label of superlatives) {
    const option = document.createElement("option");
    option.value = label;
    option.textContent = label;
    superlative.appendChild(option);
  }
  const customOption = document.createElement("option");
  customOption.value = "custom";
  customOption.textContent = "Write my own…";
  superlative.appendChild(customOption);

  function activeSuperlative() {
    return superlative.value === "custom"
      ? (custom.value.trim() || "Most Likely to Dink")
      : superlative.value;
  }

  function drawPhoto(frame) {
    const box = frame.photo;
    ctx.save();
    ctx.beginPath();
    ctx.rect(box.x, box.y, box.w, box.h);
    ctx.clip();

    if (!state.photo) {
      const gradient = ctx.createLinearGradient(box.x, box.y, box.x + box.w, box.y + box.h);
      gradient.addColorStop(0, "#e7e1d6");
      gradient.addColorStop(1, "#cfdcd4");
      ctx.fillStyle = gradient;
      ctx.fillRect(box.x, box.y, box.w, box.h);
      ctx.strokeStyle = "rgba(36, 31, 28, 0.12)";
      ctx.lineWidth = 2;
      for (let x = box.x - box.h; x < box.x + box.w; x += 42) {
        ctx.beginPath();
        ctx.moveTo(x, box.y + box.h);
        ctx.lineTo(x + box.h, box.y);
        ctx.stroke();
      }
      ctx.fillStyle = "rgba(36, 31, 28, 0.72)";
      ctx.textAlign = "center";
      ctx.font = '700 27px ui-monospace, Menlo, monospace';
      ctx.fillText("UPLOAD A PLAYER OR TEAM PHOTO", box.x + box.w / 2, box.y + box.h / 2);
      ctx.font = '20px Georgia, serif';
      ctx.fillText("then drag to line up the shot", box.x + box.w / 2, box.y + box.h / 2 + 38);
      ctx.restore();
      return;
    }

    const base = Math.max(box.w / state.photo.naturalWidth, box.h / state.photo.naturalHeight);
    const scale = base * state.zoom;
    const w = state.photo.naturalWidth * scale;
    const h = state.photo.naturalHeight * scale;
    const maxX = Math.max(0, (w - box.w) / 2);
    const maxY = Math.max(0, (h - box.h) / 2);
    state.panX = clamp(state.panX, -maxX, maxX);
    state.panY = clamp(state.panY, -maxY, maxY);
    const x = box.x + (box.w - w) / 2 + state.panX;
    const y = box.y + (box.h - h) / 2 + state.panY;
    ctx.drawImage(state.photo, x, y, w, h);
    ctx.restore();
  }

  function drawCaption(frame) {
    const x = frame.photo.x + 20;
    const y = frame.captionY;
    const w = frame.photo.w - 40;
    const h = 118;
    ctx.fillStyle = frame.panel;
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = frame.accent;
    ctx.fillRect(x, y, 10, h);

    const name = (nameInput.value.trim() || "RALLY OPEN PLAY").toUpperCase();
    const title = activeSuperlative().toUpperCase();
    const line = quote.value.trim() || "Mine was in.";
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = frame.accent;
    ctx.font = '700 17px ui-monospace, Menlo, monospace';
    ctx.fillText(name, x + 28, y + 28);

    ctx.fillStyle = frame.ink;
    const titleSize = fitText(ctx, title, w - 56, 43, 25, '"Cormorant Garamond", Georgia, serif');
    ctx.font = `700 ${titleSize}px "Cormorant Garamond", Georgia, serif`;
    ctx.fillText(title, x + 28, y + 70);

    ctx.font = 'italic 18px Georgia, serif';
    const quoteText = `“${line.slice(0, 72)}”`;
    ctx.fillText(quoteText, x + 28, y + 100);
  }

  function draw() {
    const frame = frames[state.frame];
    const frameImage = frameImages[state.frame];
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#f3eee3";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    if (frameImage.complete && frameImage.naturalWidth) {
      ctx.drawImage(frameImage, 0, 0, canvas.width, canvas.height);
    }
    drawPhoto(frame);
    drawCaption(frame);
  }

  async function canvasBlob(type = "image/png", quality) {
    return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
  }

  function profileRecord(address, image, proof) {
    return {
      version: 1,
      address,
      image,
      frame: frames[state.frame].id,
      name: nameInput.value.trim() || "Rally Open Play",
      superlative: activeSuperlative(),
      quote: quote.value.trim() || "Mine was in.",
      savedAt: proof.signedAt,
      signature: proof.signature,
      publicKey: proof.publicKey,
      imageHash: proof.imageHash,
    };
  }

  async function saveProfile() {
    const button = document.getElementById("booth-save");
    button.disabled = true;
    try {
      const blob = await canvasBlob("image/jpeg", 0.84);
      const bytes = await blob.arrayBuffer();
      const digest = await crypto.subtle.digest("SHA-256", bytes);
      const imageHash = [...new Uint8Array(digest)]
        .map((b) => b.toString(16).padStart(2, "0")).join("");
      const proof = await authorizeSave(imageHash);
      if (!proof?.address) return;
      const image = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.readAsDataURL(blob);
      });
      localStorage.setItem(
        `${PROFILE_PREFIX}${proof.address}`,
        JSON.stringify(profileRecord(proof.address, image, { ...proof, imageHash })),
      );
      renderSavedProfile(proof.address);
      statusEl.textContent = "Portrait signed and saved to this Tezos profile on this device.";
    } catch (error) {
      if (String(error?.name).includes("Quota")) {
        statusEl.textContent = "This browser is out of profile space — download the portrait instead.";
      } else {
        statusEl.textContent = error?.message || "Profile save was cancelled.";
      }
    } finally {
      button.disabled = false;
    }
  }

  function renderSavedProfile(address) {
    const card = document.getElementById("booth-profile-card");
    if (!address) {
      card.hidden = true;
      return;
    }
    let record = null;
    try {
      record = JSON.parse(localStorage.getItem(`${PROFILE_PREFIX}${address}`));
    } catch {}
    card.hidden = !record?.image;
    if (!record?.image) return;
    document.getElementById("booth-profile-image").src = record.image;
    document.getElementById("booth-profile-title").textContent = record.superlative;
    document.getElementById("booth-profile-meta").textContent =
      `${record.name} · wallet-signed ${new Date(record.savedAt).toLocaleDateString()}`;
  }

  upload.addEventListener("change", () => {
    const file = upload.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      statusEl.textContent = "Choose a JPG, PNG, HEIC, or other image file.";
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      statusEl.textContent = "That photo is over 20 MB — choose a smaller copy.";
      return;
    }
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      state.photo = image;
      state.zoom = 1;
      state.panX = 0;
      state.panY = 0;
      zoom.value = "1";
      draw();
      statusEl.textContent = "Photo loaded — drag it in the frame to adjust the crop.";
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      statusEl.textContent = "That image format could not be opened in this browser.";
    };
    image.src = url;
  });

  zoom.addEventListener("input", () => {
    state.zoom = Number(zoom.value);
    draw();
  });

  for (const input of [nameInput, custom, quote]) input.addEventListener("input", draw);
  superlative.addEventListener("change", () => {
    customField.hidden = superlative.value !== "custom";
    draw();
  });

  frameButtons.forEach((button, index) => button.addEventListener("click", () => {
    state.frame = index;
    frameButtons.forEach((item, i) => item.setAttribute("aria-pressed", String(i === index)));
    draw();
  }));

  canvas.addEventListener("pointerdown", (event) => {
    if (!state.photo) return;
    canvas.setPointerCapture(event.pointerId);
    state.drag = { x: event.clientX, y: event.clientY };
    canvas.classList.add("dragging");
  });
  canvas.addEventListener("pointermove", (event) => {
    if (!state.drag) return;
    const ratio = canvas.width / canvas.getBoundingClientRect().width;
    state.panX += (event.clientX - state.drag.x) * ratio;
    state.panY += (event.clientY - state.drag.y) * ratio;
    state.drag = { x: event.clientX, y: event.clientY };
    draw();
  });
  const endDrag = () => {
    state.drag = null;
    canvas.classList.remove("dragging");
  };
  canvas.addEventListener("pointerup", endDrag);
  canvas.addEventListener("pointercancel", endDrag);

  document.getElementById("booth-surprise").addEventListener("click", () => {
    state.frame = Math.floor(Math.random() * frames.length);
    superlative.value = superlatives[Math.floor(Math.random() * superlatives.length)];
    quote.value = quotes[Math.floor(Math.random() * quotes.length)];
    customField.hidden = true;
    frameButtons.forEach((item, i) => item.setAttribute("aria-pressed", String(i === state.frame)));
    draw();
  });

  document.getElementById("booth-download").addEventListener("click", async () => {
    const blob = await canvasBlob();
    downloadBlob(blob, `rally-${activeSuperlative().toLowerCase().replace(/[^a-z0-9]+/g, "-")}.png`);
  });

  document.getElementById("booth-share").addEventListener("click", async () => {
    const blob = await canvasBlob();
    const file = new File([blob], "rally-photo.png", { type: "image/png" });
    if (navigator.share && navigator.canShare?.({ files: [file] })) {
      await navigator.share({ title: activeSuperlative(), text: "Made in Rally", files: [file] });
    } else {
      downloadBlob(blob, "rally-photo.png");
      statusEl.textContent = "Downloaded — this browser shares from the saved file.";
    }
  });

  document.getElementById("booth-save").addEventListener("click", saveProfile);
  document.getElementById("booth-profile-edit").addEventListener("click", () => {
    document.getElementById("booth").scrollIntoView({ behavior: "smooth", block: "start" });
  });

  document.fonts?.ready.then(draw);
  draw();
  return { renderSavedProfile };
}
