const canvas = document.getElementById("peony-scene");
const ctx = canvas.getContext("2d");

let width = 0;
let height = 0;
let dpr = 1;
let particles = [];
let pointerX = 0;
let pointerY = 0;
let targetPointerX = 0;
let targetPointerY = 0;
let ready = false;

const IMAGE_SOURCE = "image copy 2.png";
const IMAGE_PARTICLE_COUNT = 12000;
const CAMERA_DISTANCE = 900;

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

function loadPeonyFromImage() {
  const image = new Image();
  image.onload = () => createParticlesFromImage(image);
  image.onerror = createFallbackPeony;
  image.src = IMAGE_SOURCE;
}

function createParticlesFromImage(image) {
  const sampleSize = 460;
  const source = document.createElement("canvas");
  const sourceCtx = source.getContext("2d", { willReadFrequently: true });
  const ratio = image.width / image.height;

  source.width = ratio >= 1 ? sampleSize : Math.round(sampleSize * ratio);
  source.height = ratio >= 1 ? Math.round(sampleSize / ratio) : sampleSize;
  sourceCtx.drawImage(image, 0, 0, source.width, source.height);

  const pixels = sourceCtx.getImageData(0, 0, source.width, source.height).data;
  const weightedPixels = [];
  let totalWeight = 0;
  let minX = source.width;
  let minY = source.height;
  let maxX = 0;
  let maxY = 0;

  for (let y = 0; y < source.height; y += 1) {
    for (let x = 0; x < source.width; x += 1) {
      const index = (y * source.width + x) * 4;
      const r = pixels[index];
      const g = pixels[index + 1];
      const b = pixels[index + 2];
      const a = pixels[index + 3];
      if (a < 40) continue;

      const lum = luminance(r, g, b);
      const sat = saturation(r, g, b);
      const ink = Math.max(0, 1 - lum);
      const redBias = Math.max(0, (r - Math.max(g, b)) / 255);
      const hasVisibleDots = ink > 0.32 || sat > 0.34 || redBias > 0.18;
      if (!hasVisibleDots) continue;

      // Darker/densely marked pixels receive particles; faint areas are skipped.
      const weight = ink ** 2.15 * 8.5 + sat ** 1.9 * 1.6 + redBias * 1.5;
      if (weight < 0.62) continue;

      totalWeight += weight;
      weightedPixels.push({ x, y, weight, cumulative: totalWeight, lum, sat });
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }

  if (weightedPixels.length < 900) {
    createFallbackPeony();
    return;
  }

  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;
  const span = Math.max(maxX - minX, maxY - minY);
  particles = [];

  for (let i = 0; i < IMAGE_PARTICLE_COUNT; i += 1) {
    const pixel = pickWeightedPixel(weightedPixels, totalWeight);
    const density = Math.min(1, pixel.weight / 8.8);
    const x = ((pixel.x + Math.random() - 0.5 - centerX) / span) * 34;
    const y = ((pixel.y + Math.random() - 0.5 - centerY) / span) * 34;
    const distance = Math.min(1, Math.hypot(x / 17, y / 17));
    const bulge = Math.sqrt(Math.max(0, 1 - distance * distance));
    const detailLift = density * 4.2 + pixel.sat * 2;

    particles.push({
      x,
      y,
      z: (Math.random() - 0.5) * (3.2 + bulge * 17) + detailLift,
      size: 0.28 + density * 0.62 + Math.random() * 0.26,
      pulse: Math.random() * Math.PI * 2,
      hue: 352 + Math.random() * 7,
      lightness: 35 + density * 27 + Math.random() * 7,
      brightness: 0.48 + density * 0.52,
      delay: distance * 0.9 + Math.random() * 0.28,
    });
  }

  ready = true;
}

function pickWeightedPixel(weightedPixels, totalWeight) {
  const target = Math.random() * totalWeight;
  let low = 0;
  let high = weightedPixels.length - 1;

  while (low < high) {
    const mid = (low + high) >> 1;
    if (weightedPixels[mid].cumulative < target) low = mid + 1;
    else high = mid;
  }

  return weightedPixels[low];
}

function createFallbackPeony() {
  particles = [];

  for (let i = 0; i < IMAGE_PARTICLE_COUNT; i += 1) {
    const angle = Math.random() * Math.PI * 2;
    const radius = Math.sqrt(Math.random()) * 16;
    const petal = 0.72 + Math.sin(angle * 10) * 0.18 + Math.sin(angle * 17) * 0.1;
    const r = radius * petal;
    const density = 1 - radius / 16;

    particles.push({
      x: Math.cos(angle) * r,
      y: Math.sin(angle) * r,
      z: (Math.random() - 0.5) * (4 + density * 16),
      size: 0.28 + density * 0.62 + Math.random() * 0.26,
      pulse: Math.random() * Math.PI * 2,
      hue: 352 + Math.random() * 7,
      lightness: 35 + density * 27 + Math.random() * 7,
      brightness: 0.48 + density * 0.52,
      delay: radius / 16 * 0.9 + Math.random() * 0.28,
    });
  }

  ready = true;
}

function rotate(point, angleX, angleY, angleZ) {
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
  x = x1;
  z = z2;

  const cosZ = Math.cos(angleZ);
  const sinZ = Math.sin(angleZ);
  const x2 = x * cosZ - y * sinZ;
  const y2 = x * sinZ + y * cosZ;

  return { x: x2, y: y2, z };
}

function drawGlow(cx, cy, beat) {
  const radius = Math.min(width, height) * (0.27 + beat * 0.02);
  const glow = ctx.createRadialGradient(cx, cy, radius * 0.035, cx, cy, radius);
  glow.addColorStop(0, "rgba(255, 26, 58, 0.19)");
  glow.addColorStop(0.44, "rgba(180, 0, 30, 0.08)");
  glow.addColorStop(1, "rgba(0, 0, 0, 0)");

  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function smoothstep(value) {
  const t = Math.max(0, Math.min(1, value));

  return t * t * (3 - 2 * t);
}

function render(time) {
  const seconds = time * 0.001;
  const cx = width / 2;
  const cy = height / 2;
  const scale = Math.min(width, height) * 0.018;
  const beat = (Math.sin(seconds * 2.35) + 1) * 0.5;
  const bloomBreath = 1 + beat * 0.014;

  pointerX += (targetPointerX - pointerX) * 0.035;
  pointerY += (targetPointerY - pointerY) * 0.035;

  ctx.clearRect(0, 0, width, height);
  drawGlow(cx, cy, beat);

  if (!ready) {
    requestAnimationFrame(render);
    return;
  }

  const angleX = 0.14 + pointerY * 0.16 + Math.sin(seconds * 0.45) * 0.035;
  const angleY = pointerX * 0.22 + Math.sin(seconds * 0.55) * 0.075;
  const angleZ = Math.sin(seconds * 0.42) * 0.08;

  const projected = particles.map((particle) => {
    const rotated = rotate(
      {
        x: particle.x * (0.22 + smoothstep(seconds * 0.42 - particle.delay) * 0.78) * bloomBreath,
        y: particle.y * (0.22 + smoothstep(seconds * 0.42 - particle.delay) * 0.78) * bloomBreath,
        z: particle.z * (0.35 + smoothstep(seconds * 0.42 - particle.delay) * 0.65),
      },
      angleX,
      angleY,
      angleZ,
    );
    const perspective = CAMERA_DISTANCE / (CAMERA_DISTANCE - rotated.z * scale);

    return {
      x: cx + rotated.x * scale * perspective,
      y: cy + rotated.y * scale * perspective,
      z: rotated.z,
      size: particle.size * perspective,
      pulse: particle.pulse,
      hue: particle.hue,
      lightness: particle.lightness,
      brightness: particle.brightness,
    };
  });

  projected.sort((a, b) => a.z - b.z);

  ctx.save();
  ctx.globalCompositeOperation = "lighter";

  for (const particle of projected) {
    const depthLight = 0.45 + ((particle.z + 16) / 34) * 0.55;
    const shimmer = 0.78 + Math.sin(seconds * 3.1 + particle.pulse) * 0.12;
    const alpha = Math.max(0.14, particle.brightness * depthLight * shimmer);
    const radius = Math.max(0.38, particle.size * scale * 0.078);
    const dot = ctx.createRadialGradient(
      particle.x,
      particle.y,
      0,
      particle.x,
      particle.y,
      radius * 3.05,
    );

    dot.addColorStop(0, `hsla(${particle.hue}, 100%, 88%, ${alpha})`);
    dot.addColorStop(0.22, `hsla(${particle.hue}, 98%, ${particle.lightness}%, ${alpha * 0.92})`);
    dot.addColorStop(1, `hsla(${particle.hue}, 96%, 25%, 0)`);

    ctx.fillStyle = dot;
    ctx.beginPath();
    ctx.arc(particle.x, particle.y, radius * 3.05, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
  requestAnimationFrame(render);
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
loadPeonyFromImage();
requestAnimationFrame(render);
