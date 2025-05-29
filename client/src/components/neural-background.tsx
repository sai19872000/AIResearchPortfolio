import { useEffect, useRef } from "react";

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

export function NeuralBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationId: number;
    let particles: Particle[] = [];

    const resizeCanvas = () => {
      canvas.width = canvas.offsetWidth || 1920;
      canvas.height = canvas.offsetHeight || 1080;
      
      // Reinitialize particles when canvas resizes
      const particleCount = Math.min(30, Math.floor((canvas.width * canvas.height) / 15000));
      particles = Array.from({ length: particleCount }, () => ({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.3,
      }));
    };

    const animate = () => {
      if (!canvas || !canvas.width || !canvas.height || !ctx) return;
      
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // Update particle positions
      particles.forEach((particle) => {
        particle.x += particle.vx;
        particle.y += particle.vy;

        // Wrap around edges
        if (particle.x < 0) particle.x = canvas.width;
        if (particle.x > canvas.width) particle.x = 0;
        if (particle.y < 0) particle.y = canvas.height;
        if (particle.y > canvas.height) particle.y = 0;
      });

      // Draw connections
      ctx.strokeStyle = "rgba(49, 130, 206, 0.2)";
      ctx.lineWidth = 1;
      
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const distance = Math.sqrt(dx * dx + dy * dy);

          if (distance < 100) {
            const opacity = (100 - distance) / 100 * 0.4;
            ctx.strokeStyle = `rgba(49, 130, 206, ${opacity})`;
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.stroke();
          }
        }
      }

      // Draw particles
      particles.forEach((particle) => {
        ctx.fillStyle = "rgba(49, 130, 206, 0.6)";
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, 2, 0, Math.PI * 2);
        ctx.fill();
      });

      animationId = requestAnimationFrame(animate);
    };

    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);
    animate();

    return () => {
      window.removeEventListener("resize", resizeCanvas);
      if (animationId) {
        cancelAnimationFrame(animationId);
      }
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full opacity-80"
      style={{ zIndex: 1 }}
    />
  );
}
