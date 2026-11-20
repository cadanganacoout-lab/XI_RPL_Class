import React, { useEffect, useRef } from "react";
import "../../css/starfield-background.css";

function createStars(width, height) {
  const count = Math.min(900, Math.max(140, Math.round((width * height) / 1800)));
  const maxRadius = Math.hypot(width, height) * 0.68;
  const minRadius = Math.min(100, maxRadius * 0.16);

  return Array.from({ length: count }, () => ({
    angle: Math.random() * Math.PI * 2,
    radius: minRadius + Math.sqrt(Math.random()) * (maxRadius - minRadius),
    speed: (0.004 + Math.random() * 0.012) * (Math.random() < 0.5 ? -1 : 1),
    size: 0.5 + Math.random() * 1.1,
    opacity: 0.2 + Math.random() * 0.5,
    phase: Math.random() * Math.PI * 2,
    twinkleSpeed: 0.6 + Math.random() * 1.4,
  }));
}

export default function StarfieldBackground() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return undefined;

    let width = 0;
    let height = 0;
    let pixelRatio = 1;
    let stars = [];
    let frameId = 0;
    let previousTime = 0;
    let elapsed = 0;
    let starColor = "";

    const updateColor = () => {
      starColor = getComputedStyle(document.documentElement)
        .getPropertyValue("--color-accent-strong")
        .trim();
    };

    const resize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      pixelRatio = Math.min(window.devicePixelRatio || 1, 1.5);
      canvas.width = Math.round(width * pixelRatio);
      canvas.height = Math.round(height * pixelRatio);
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      stars = createStars(width, height);
    };

    const render = time => {
      const delta = previousTime ? Math.min((time - previousTime) / 1000, 0.05) : 0;
      previousTime = time;
      elapsed += delta;
      context.clearRect(0, 0, width, height);

      const centerX = width / 2;
      const centerY = height / 2;

      for (const star of stars) {
        star.angle += star.speed * delta;
        const x = centerX + Math.cos(star.angle) * star.radius;
        const y = centerY + Math.sin(star.angle) * star.radius * 0.58
          + Math.sin(elapsed * star.twinkleSpeed + star.phase) * 1.5;
        const twinkle = 0.35 + Math.abs(Math.sin(elapsed * star.twinkleSpeed + star.phase)) * 0.65;

        context.globalAlpha = star.opacity * twinkle;
        context.fillStyle = starColor;
        context.fillRect(x, y, star.size, star.size);
      }

      context.globalAlpha = 1;
      frameId = window.requestAnimationFrame(render);
    };

    const start = () => {
      if (!frameId && !document.hidden) {
        previousTime = 0;
        frameId = window.requestAnimationFrame(render);
      }
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        window.cancelAnimationFrame(frameId);
        frameId = 0;
      } else {
        start();
      }
    };

    const themeObserver = new MutationObserver(updateColor);
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });

    updateColor();
    resize();
    start();
    window.addEventListener("resize", resize);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.cancelAnimationFrame(frameId);
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      themeObserver.disconnect();
    };
  }, []);

  return (
    <>
      <canvas className="site-starfield-background" ref={canvasRef} aria-hidden="true" />
      <div className="site-aurora-background" aria-hidden="true" />
    </>
  );
}
