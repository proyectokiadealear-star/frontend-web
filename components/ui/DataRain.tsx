"use client";

import { useEffect, useRef } from "react";

interface Wheel {
  cx: number;
  cy: number;
  radius: number;
  rotation: number;
  speed: number;
  opacity: number;
}

function drawWheel(ctx: CanvasRenderingContext2D, w: Wheel) {
  const { cx, cy, radius, rotation, opacity } = w;
  ctx.save();
  ctx.globalAlpha = opacity;
  ctx.translate(cx, cy);
  ctx.rotate(rotation);

  const tireThickness = radius * 0.16;
  const rimR = radius - tireThickness;
  const hubR = rimR * 0.18;

  // Tire body
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(18,18,18,0.95)";
  ctx.fill();

  // Tread blocks
  const treadCount = 36;
  for (let i = 0; i < treadCount; i++) {
    const a0 = (i / treadCount) * Math.PI * 2;
    const a1 = ((i + 0.55) / treadCount) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a0) * (radius - tireThickness * 0.05), Math.sin(a0) * (radius - tireThickness * 0.05));
    ctx.arc(0, 0, radius - tireThickness * 0.05, a0, a1);
    ctx.arc(0, 0, radius - tireThickness * 0.5, a1, a0, true);
    ctx.closePath();
    ctx.fillStyle = "rgba(255,255,255,0.04)";
    ctx.fill();
  }

  // Tire outer ring
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, Math.PI * 2);
  ctx.strokeStyle = "rgba(255,255,255,0.1)";
  ctx.lineWidth = 1;
  ctx.stroke();

  // Tire inner edge
  ctx.beginPath();
  ctx.arc(0, 0, rimR, 0, Math.PI * 2);
  ctx.strokeStyle = "rgba(255,255,255,0.07)";
  ctx.lineWidth = 0.8;
  ctx.stroke();

  // Rim face background
  ctx.beginPath();
  ctx.arc(0, 0, rimR, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(12,12,12,0.98)";
  ctx.fill();

  // 5 spokes
  const spokeCount = 5;
  for (let i = 0; i < spokeCount; i++) {
    const a  = (i / spokeCount) * Math.PI * 2;
    const aN = ((i + 0.42) / spokeCount) * Math.PI * 2;

    ctx.beginPath();
    ctx.moveTo(Math.cos(a)  * hubR * 1.6, Math.sin(a)  * hubR * 1.6);
    ctx.lineTo(Math.cos(a)  * rimR * 0.93, Math.sin(a)  * rimR * 0.93);
    ctx.lineTo(Math.cos(aN) * rimR * 0.93, Math.sin(aN) * rimR * 0.93);
    ctx.lineTo(Math.cos(aN) * hubR * 1.6, Math.sin(aN) * hubR * 1.6);
    ctx.closePath();

    const grad = ctx.createLinearGradient(
      Math.cos(a) * rimR * 0.5, Math.sin(a) * rimR * 0.5,
      Math.cos(a + Math.PI) * rimR * 0.2, Math.sin(a + Math.PI) * rimR * 0.2
    );
    grad.addColorStop(0,   "rgba(200,200,200,0.45)");
    grad.addColorStop(0.5, "rgba(110,110,110,0.25)");
    grad.addColorStop(1,   "rgba(50,50,50,0.15)");
    ctx.fillStyle = grad;
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * hubR * 1.6, Math.sin(a) * hubR * 1.6);
    ctx.lineTo(Math.cos(a) * rimR * 0.93, Math.sin(a) * rimR * 0.93);
    ctx.strokeStyle = "rgba(255,255,255,0.12)";
    ctx.lineWidth = 0.8;
    ctx.stroke();
  }

  // Cutout windows between spokes
  for (let i = 0; i < spokeCount; i++) {
    const a  = ((i + 0.5) / spokeCount) * Math.PI * 2;
    const aW = (0.45 / spokeCount) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a - aW / 2) * hubR * 2.2, Math.sin(a - aW / 2) * hubR * 2.2);
    ctx.arc(0, 0, rimR * 0.88, a - aW / 2, a + aW / 2);
    ctx.arc(0, 0, hubR * 2.2, a + aW / 2, a - aW / 2, true);
    ctx.closePath();
    ctx.fillStyle = "rgba(0,0,0,0.75)";
    ctx.fill();
  }

  // Rim barrel ring
  ctx.beginPath();
  ctx.arc(0, 0, rimR * 0.94, 0, Math.PI * 2);
  ctx.strokeStyle = "rgba(255,255,255,0.06)";
  ctx.lineWidth = rimR * 0.04;
  ctx.stroke();

  // Hub cap
  ctx.beginPath();
  ctx.arc(0, 0, hubR * 1.3, 0, Math.PI * 2);
  const hubGrad = ctx.createRadialGradient(-hubR * 0.3, -hubR * 0.3, 0, 0, 0, hubR * 1.3);
  hubGrad.addColorStop(0, "rgba(80,80,80,1)");
  hubGrad.addColorStop(1, "rgba(20,20,20,1)");
  ctx.fillStyle = hubGrad;
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.2)";
  ctx.lineWidth = 0.8;
  ctx.stroke();

  // Center dot
  ctx.beginPath();
  ctx.arc(0, 0, hubR * 0.35, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(255,255,255,0.15)";
  ctx.fill();

  ctx.restore();
}

export default function DataRain({ className }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let wheels: Wheel[] = [];
    let raf: number;

    const buildWheels = () => {
      const W = canvas.width;
      const H = canvas.height;
      const base = Math.min(W, H);
      wheels = [
        // Large hero wheel — centered
        { cx: W * 0.52, cy: H * 0.5,  radius: base * 0.42, rotation: 0,   speed: 0.0018, opacity: 0.55 },
        // Medium, top-left corner (partially cropped)
        { cx: W * 0.04, cy: H * 0.18, radius: base * 0.22, rotation: 0.6, speed: 0.0012, opacity: 0.22 },
        // Small, bottom-right corner
        { cx: W * 0.92, cy: H * 0.88, radius: base * 0.16, rotation: 1.2, speed: 0.0025, opacity: 0.18 },
      ];
    };

    const resize = () => {
      canvas.width  = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
      buildWheels();
    };

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (const w of wheels) {
        w.rotation += w.speed;
        drawWheel(ctx, w);
      }
      raf = requestAnimationFrame(draw);
    };

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    draw();

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{ display: "block", width: "100%", height: "100%" }}
    />
  );
}
