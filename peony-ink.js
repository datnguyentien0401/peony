const canvas = document.getElementById("ink-scene");
const ctx = canvas.getContext("2d");

const IMAGE_SOURCE = "image copy 2.png";
const DOT_COUNT = 38000;
const SAMPLE_SIZE = 620;
const CAMERA_DISTANCE = 900;
const DOT_SPRITE_SIZE = 64;

let width = 0;
let height = 0;
let dpr = 1;
let dots = [];
let sourceBounds = null;
let pointerX = 0;
let pointerY = 0;
let targetPointerX = 0;
let targetPointerY = 0;
let animationStarted = false;
let textDots = [];
const dotSprites = new Map();

function resize() {
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  width = window.innerWidth;
  height = window.innerHeight;
  canvas.width = Math.floor(width * dpr);
  canvas.height = Math.floor(height * dpr);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function luminance(r, g, b) {
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

function saturation(r, g, b) {
  const max = Math.max(r, g, b) / 255;
  const min = Math.min(r, g, b) / 255;

  return max === 0 ? 0 : (max - min) / max;
}

function loadImage() {
  const image = new Image();
  image.onload = () => buildDots(image);
  image.src = IMAGE_SOURCE;
}

function buildDots(image) {
  const source = document.createElement("canvas");
  const sourceCtx = source.getContext("2d", { willReadFrequently: true });
  const ratio = image.width / image.height;

  source.width = ratio >= 1 ? SAMPLE_SIZE : Math.round(SAMPLE_SIZE * ratio);
  source.height = ratio >= 1 ? Math.round(SAMPLE_SIZE / ratio) : SAMPLE_SIZE;
  sourceCtx.drawImage(image, 0, 0, source.width, source.height);

  const pixels = sourceCtx.getImageData(0, 0, source.width, source.height).data;
  const candidates = [];
  let totalWeight = 0;
  let minX = source.width;
  let minY = source.height;
  let maxX = 0;
  let maxY = 0;

  const bottomCutoff = source.height * 0.78;

  for (let y = 0; y < source.height; y += 1) {
    if (y > bottomCutoff) continue;

    for (let x = 0; x < source.width; x += 1) {
      const index = (y * source.width + x) * 4;
      const r = pixels[index];
      const g = pixels[index + 1];
      const b = pixels[index + 2];
      const a = pixels[index + 3];
      if (a < 50) continue;

      const lum = luminance(r, g, b);
      const sat = saturation(r, g, b);
      const ink = Math.max(0, 1 - lum);
      const redBias = Math.max(0, (r - Math.max(g, b)) / 255);
      const mark = ink * 0.82 + sat * 0.24 + redBias * 0.28;

      if (mark < 0.33) continue;

      const roughCenterX = source.width * 0.5;
      const roughCenterY = bottomCutoff * 0.52;
      const edgeDistance = Math.min(
        1,
        Math.hypot((x - roughCenterX) / (source.width * 0.5), (y - roughCenterY) / (bottomCutoff * 0.5)),
      );
      const edgeBoost = 0.78 + smoothstep((edgeDistance - 0.42) / 0.5) * 1.55;
      const weight = mark ** 2.35 * edgeBoost;
      totalWeight += weight;
      candidates.push({ x, y, mark, edgeDistance, cumulative: totalWeight });
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }

  sourceBounds = { centerX: (minX + maxX) / 2, centerY: (minY + maxY) / 2, spanX: maxX - minX, spanY: maxY - minY };
  dots = [];

  for (let i = 0; i < DOT_COUNT; i += 1) {
    const pixel = pickWeighted(candidates, totalWeight);
    const edgeJitter = smoothstep((pixel.edgeDistance - 0.48) / 0.42);
    const x = pixel.x + (Math.random() - 0.5) * (1 + edgeJitter * 0.35);
    const y = pixel.y + (Math.random() - 0.5) * (1 + edgeJitter * 0.35);
    const nx = (x - sourceBounds.centerX) / Math.max(1, sourceBounds.spanX * 0.5);
    const ny = (y - sourceBounds.centerY) / Math.max(1, sourceBounds.spanY * 0.5);
    const distance = Math.min(1, Math.hypot(nx, ny));
    const bulge = Math.sqrt(Math.max(0, 1 - distance * distance));
    const backLayer = Math.random() ** 0.72;
    const side = Math.random() < 0.5 ? -1 : 1;
    const tangent = Math.atan2(ny, nx) + Math.PI / 2;
    const layerScale = 1 - backLayer * 0.11;
    const sideOffset = side * backLayer * bulge * 6.2;
    const layeredX = sourceBounds.centerX + (x - sourceBounds.centerX) * layerScale + Math.cos(tangent) * sideOffset;
    const layeredY = sourceBounds.centerY + (y - sourceBounds.centerY) * layerScale + Math.sin(tangent) * sideOffset * 0.55;
    const petalMotion = smoothstep((distance - 0.16) / 0.84);
    const budAngle = Math.atan2(ny, nx);
    const budRadius = 0.18 + distance * 0.82;
    const budWidth = sourceBounds.spanX * (0.035 + backLayer * 0.018);
    const budHeight = sourceBounds.spanY * (0.18 + backLayer * 0.04);
    const budCurl = Math.sin(budAngle * 3 + side * 0.7) * sourceBounds.spanX * 0.018;
    const budX =
      sourceBounds.centerX +
      Math.cos(budAngle) * budWidth * budRadius * (0.45 + petalMotion * 0.55) +
      budCurl * petalMotion;
    const budY =
      sourceBounds.centerY -
      sourceBounds.spanY * 0.045 +
      Math.sin(budAngle) * budHeight * budRadius * (0.75 + petalMotion * 0.25) -
      petalMotion * sourceBounds.spanY * 0.06;
    const openZ = pixel.mark * 24 + bulge * 34 - backLayer * (68 + bulge * 86) + (Math.random() - 0.5) * 16;

    dots.push({
      x: layeredX,
      y: layeredY,
      z: openZ * 0.82,
      budX,
      budY,
      budZ: openZ * (0.22 + petalMotion * 0.16) + (1 - backLayer) * 18,
      petalMotion,
      bloomDelay: petalMotion * 0.48 + backLayer * 0.16 + Math.random() * 0.12,
      flutterPhase: Math.random() * Math.PI * 2,
      flutterAmount: 4.2 + petalMotion * 15.5,
      flutterX: Math.cos(tangent),
      flutterY: Math.sin(tangent) * 0.72,
      mark: pixel.mark * (1 - backLayer * 0.36),
      radius: 0.5 + pixel.mark * 1.24 + pixel.edgeDistance * 0.24 + Math.random() * 0.34,
      alpha: (0.24 + pixel.mark * 0.6 + pixel.edgeDistance * 0.12) * (1 - backLayer * 0.48),
    });
  }

  buildTextDots();
  startAnimation();
}

function pickWeighted(candidates, totalWeight) {
  const target = Math.random() * totalWeight;
  let low = 0;
  let high = candidates.length - 1;

  while (low < high) {
    const mid = (low + high) >> 1;
    if (candidates[mid].cumulative < target) low = mid + 1;
    else high = mid;
  }

  return candidates[low];
}

function buildTextDots() {
  const textCanvas = document.createElement("canvas");
  const textCtx = textCanvas.getContext("2d", { willReadFrequently: true });
  const fontSize = 72;
  const message = "Happy Birthday Lan Phuong";

  textCanvas.width = 1180;
  textCanvas.height = 150;
  textCtx.clearRect(0, 0, textCanvas.width, textCanvas.height);
  textCtx.fillStyle = "#fff";
  textCtx.textAlign = "center";
  textCtx.textBaseline = "middle";
  textCtx.font = `300 italic ${fontSize}px "Snell Roundhand", "Great Vibes", "Palatino Linotype", "Brush Script MT", cursive`;
  textCtx.fillText(message, textCanvas.width / 2, textCanvas.height / 2 + 6);

  const pixels = textCtx.getImageData(0, 0, textCanvas.width, textCanvas.height).data;
  const candidates = [];

  for (let y = 0; y < textCanvas.height; y += 3) {
    for (let x = 0; x < textCanvas.width; x += 3) {
      const alpha = pixels[(y * textCanvas.width + x) * 4 + 3];
      if (alpha > 70) candidates.push({ x, y, alpha: alpha / 255 });
    }
  }

  textDots = candidates.map((dot) => ({
    x: (dot.x - textCanvas.width / 2) / textCanvas.width,
    y: (dot.y - textCanvas.height / 2) / textCanvas.height,
    alpha: dot.alpha,
    phase: Math.random() * Math.PI * 2,
    size: 0.58 + Math.random() * 0.52,
  }));
}

function drawTextDots(seconds) {
  if (!textDots.length) return;

  const reveal = smoothstep(seconds / 4.2);

  const textWidth = Math.min(width * 0.66, 620);
  const textHeight = textWidth * 0.13;
  const centerX = width / 2;
  const centerY = height - Math.max(42, height * 0.075);
  const sprite = getDotSprite(4);

  ctx.save();
  ctx.globalCompositeOperation = "lighter";

  for (const dot of textDots) {
    const revealEdge = (dot.x + 0.5) / 1;
    const revealAlpha = smoothstep((reveal - revealEdge) / 0.08 + 0.5);
    if (revealAlpha <= 0) continue;

    const shimmer = 0.8 + Math.sin(seconds * 1.9 + dot.phase) * 0.18;
    const size = dot.size * Math.max(1.05, textWidth * 0.0042) * (0.82 + revealAlpha * 0.18);
    const slide = (1 - revealAlpha) * 26;
    const x = centerX + dot.x * textWidth - slide;
    const y = centerY + dot.y * textHeight;

    ctx.globalAlpha = Math.min(1, dot.alpha * shimmer * 0.92 * revealAlpha);
    ctx.drawImage(sprite, x - size, y - size, size * 2, size * 2);
  }

  ctx.globalAlpha = 1;
  ctx.restore();
}

function rotate(point, angleX, angleY) {
  let { x, y, z } = point;

  const cosX = Math.cos(angleX);
  const sinX = Math.sin(angleX);
  const y1 = y * cosX - z * sinX;
  const z1 = y * sinX + z * cosX;
  y = y1;
  z = z1;

  const cosY = Math.cos(angleY);
  const sinY = Math.sin(angleY);
  const x1 = x * cosY + z * sinY;
  const z2 = -x * sinY + z * cosY;

  return { x: x1, y, z: z2 };
}

function smoothstep(value) {
  const t = Math.max(0, Math.min(1, value));

  return t * t * (3 - 2 * t);
}

function getDotSprite(depthBucket) {
  if (dotSprites.has(depthBucket)) return dotSprites.get(depthBucket);

  const sprite = document.createElement("canvas");
  sprite.width = DOT_SPRITE_SIZE;
  sprite.height = DOT_SPRITE_SIZE;

  const spriteCtx = sprite.getContext("2d");
  const center = DOT_SPRITE_SIZE / 2;
  const depth = depthBucket / 5;
  const gradient = spriteCtx.createRadialGradient(center, center, 0, center, center, center);
  gradient.addColorStop(0, "rgba(255, 238, 250, 1)");
  gradient.addColorStop(0.22, `rgba(255, ${Math.round(72 + depth * 58)}, ${Math.round(168 + depth * 52)}, 0.9)`);
  gradient.addColorStop(1, "rgba(165, 0, 96, 0)");
  spriteCtx.fillStyle = gradient;
  spriteCtx.beginPath();
  spriteCtx.arc(center, center, center, 0, Math.PI * 2);
  spriteCtx.fill();
  dotSprites.set(depthBucket, sprite);

  return sprite;
}

function startAnimation() {
  if (animationStarted) return;

  animationStarted = true;
  requestAnimationFrame(draw);
}


function draw(time = 0) {
  pointerX += (targetPointerX - pointerX) * 0.045;
  pointerY += (targetPointerY - pointerY) * 0.045;

  ctx.clearRect(0, 0, width, height);

  const bg = ctx.createRadialGradient(width / 2, height / 2, 0, width / 2, height / 2, Math.min(width, height) * 0.55);
  bg.addColorStop(0, "#170012");
  bg.addColorStop(0.48, "#050004");
  bg.addColorStop(1, "#000");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, height);

  if (!dots.length || !sourceBounds) {
    requestAnimationFrame(draw);
    return;
  }

  const fit = Math.min(width * 0.78 / sourceBounds.spanX, height * 0.78 / sourceBounds.spanY);
  const offsetX = width / 2;
  const offsetY = height / 2;
  const seconds = time * 0.001;
  const openBase = smoothstep(seconds / 4.2);
  const flutterBase = smoothstep((seconds - 3.6) / 1.0);
  const breath = Math.sin(seconds * 0.82) * 0.028 * flutterBase;
  const angleX = -0.08 + pointerY * 0.16 + breath;
  const angleY = pointerX * 0.18 + breath * 0.7;
  const projected = dots.map((dot) => {
    const delayedOpen = smoothstep(openBase * 1.35 - dot.bloomDelay);
    const easedOpen = smoothstep(delayedOpen);
    const flutterStrength = dot.petalMotion * flutterBase * easedOpen;
    const flutter = Math.sin(seconds * 3.15 + dot.flutterPhase) * dot.flutterAmount * flutterStrength;
    const flutterZ = flutter * 1.65;
    const edgeDrift = flutter * 0.09;
    const currentX = dot.budX + (dot.x - dot.budX) * easedOpen + dot.flutterX * edgeDrift;
    const currentY = dot.budY + (dot.y - dot.budY) * easedOpen + dot.flutterY * edgeDrift;
    const currentZ = dot.budZ + (dot.z - dot.budZ) * easedOpen + flutterZ;
    const local = rotate(
      {
        x: (currentX - sourceBounds.centerX) * fit,
        y: (currentY - sourceBounds.centerY) * fit,
        z: currentZ * fit * 0.08,
      },
      angleX,
      angleY,
    );
    const perspective = CAMERA_DISTANCE / (CAMERA_DISTANCE - local.z);

    return {
      x: offsetX + local.x * perspective,
      y: offsetY + local.y * perspective,
      z: local.z,
      mark: dot.mark,
      radius: Math.max(0.45, dot.radius * fit * 0.09 * perspective),
      alpha: dot.alpha,
      openAmount: delayedOpen,
    };
  });

  projected.sort((a, b) => a.z - b.z);

  ctx.save();
  ctx.globalCompositeOperation = "lighter";

  for (const dot of projected) {
    const depth = Math.max(0, Math.min(1, (dot.z + 95) / 190));
    const diameter = dot.radius * (5.2 + dot.openAmount * 0.48);
    const alpha = Math.min(1, dot.alpha * (0.66 + depth * 0.5) * (0.78 + dot.openAmount * 0.32));
    const sprite = getDotSprite(Math.round(depth * 5));

    ctx.globalAlpha = alpha;
    ctx.drawImage(sprite, dot.x - diameter / 2, dot.y - diameter / 2, diameter, diameter);
  }

  ctx.globalAlpha = 1;
  ctx.restore();
  drawTextDots(seconds);
  requestAnimationFrame(draw);
}

window.addEventListener("resize", resize);
window.addEventListener("pointermove", (event) => {
  targetPointerX = (event.clientX / window.innerWidth - 0.5) * 2;
  targetPointerY = (event.clientY / window.innerHeight - 0.5) * 2;
});
window.addEventListener("pointerleave", () => {
  targetPointerX = 0;
  targetPointerY = 0;
});

resize();
loadImage();
