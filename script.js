const canvas = document.getElementById("heart-scene");
const ctx = canvas.getContext("2d");

let width = 0;
let height = 0;
let dpr = 1;
let particles = [];
let pointerX = 0;
let pointerY = 0;
let targetPointerX = 0;
let targetPointerY = 0;

const HEART_POINT_COUNT = 15000;
const CAMERA_DISTANCE = 900;

function heartPoint(t) {
  const x = 16 * Math.sin(t) ** 3;
  const y =
    13 * Math.cos(t) -
    5 * Math.cos(2 * t) -
    2 * Math.cos(3 * t) -
    Math.cos(4 * t);

  return { x, y };
}

function createParticles() {
  particles = [];

  for (let i = 0; i < HEART_POINT_COUNT; i += 1) {
    const edgePoint = heartPoint(Math.random() * Math.PI * 2);
    const fill = Math.random() > 0.16 ? Math.sqrt(Math.random()) : 0.96 + Math.random() * 0.06;
    const bulge = Math.sqrt(Math.max(0, 1 - fill * fill));
    const depth = (Math.random() - 0.5) * (3.2 + bulge * 19);

    particles.push({
      x: edgePoint.x * fill,
      y: -edgePoint.y * fill,
      z: depth,
      size: 0.46 + Math.random() * 1.02,
      pulse: Math.random() * Math.PI * 2,
      brightness: 0.66 + Math.random() * 0.34,
    });
  }
}

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

function drawGlow(cx, cy, scale, beat) {
  const radius = Math.min(width, height) * (0.22 + beat * 0.02);
  const glow = ctx.createRadialGradient(cx, cy, radius * 0.04, cx, cy, radius);
  glow.addColorStop(0, "rgba(255, 20, 45, 0.18)");
  glow.addColorStop(0.42, "rgba(190, 0, 28, 0.08)");
  glow.addColorStop(1, "rgba(0, 0, 0, 0)");

  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function render(time) {
  const seconds = time * 0.001;
  const cx = width / 2;
  const cy = height / 2;
  const scale = Math.min(width, height) * 0.018;
  const beat = (Math.sin(seconds * 3.2) + 1) * 0.5;
  const heartbeat = 1 + beat * 0.045;

  pointerX += (targetPointerX - pointerX) * 0.035;
  pointerY += (targetPointerY - pointerY) * 0.035;

  ctx.clearRect(0, 0, width, height);
  drawGlow(cx, cy, scale, beat);

  const angleX = -0.16 + pointerY * 0.18 + Math.sin(seconds * 0.7) * 0.05;
  const angleY = seconds * 0.48 + pointerX * 0.3;
  const angleZ = Math.sin(seconds * 0.4) * 0.04;

  const projected = particles.map((particle) => {
    const rotated = rotate(
      {
        x: particle.x * heartbeat,
        y: particle.y * heartbeat,
        z: particle.z * heartbeat,
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
      size: particle.size * perspective * (1 + beat * 0.18),
      pulse: particle.pulse,
      brightness: particle.brightness,
    };
  });

  projected.sort((a, b) => a.z - b.z);

  ctx.save();
  ctx.globalCompositeOperation = "lighter";

  for (const particle of projected) {
    const depthLight = 0.44 + ((particle.z + 12) / 24) * 0.56;
    const shimmer = 0.74 + Math.sin(seconds * 4 + particle.pulse) * 0.18;
    const alpha = Math.max(0.18, particle.brightness * depthLight * shimmer);
    const radius = Math.max(0.45, particle.size * scale * 0.075);

    const dot = ctx.createRadialGradient(
      particle.x,
      particle.y,
      0,
      particle.x,
      particle.y,
      radius * 3.3,
    );
    dot.addColorStop(0, `rgba(255, 235, 235, ${alpha})`);
    dot.addColorStop(0.22, `rgba(255, 55, 76, ${alpha * 0.88})`);
    dot.addColorStop(1, "rgba(145, 0, 18, 0)");

    ctx.fillStyle = dot;
    ctx.beginPath();
    ctx.arc(particle.x, particle.y, radius * 3.3, 0, Math.PI * 2);
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

createParticles();
resize();
requestAnimationFrame(render);
