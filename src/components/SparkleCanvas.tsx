import { useEffect, useRef } from 'react';

interface SparkleCanvasProps {
  fireCount: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  shape: 'star' | 'circle' | 'heart';
  alpha: number;
  decay: number;
  rotation: number;
  rv: number;
}

export default function SparkleCanvas({ fireCount }: SparkleCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const particlesRef = useRef<Particle[]>([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;

    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    const colors = [
      '#FFB6C1', // Dreamy Pink
      '#FFD700', // Sparkle Gold
      '#BA55D3', // Magic Purple
      '#FFF0F5', // Lavender Blush
      '#FF69B4', // Hot Pink
      '#E6E6FA'  // Lavender
    ];

    const shapes: ('star' | 'circle' | 'heart')[] = ['star', 'circle', 'heart'];

    const drawHeart = (ctx: CanvasRenderingContext2D, x: number, y: number, size: number) => {
      ctx.beginPath();
      ctx.moveTo(x, y + size / 4);
      ctx.quadraticCurveTo(x, y, x + size / 2, y);
      ctx.quadraticCurveTo(x + size, y, x + size, y + size / 3);
      ctx.quadraticCurveTo(x + size, y + (size * 2) / 3, x + size / 2, y + size);
      ctx.quadraticCurveTo(x, y + (size * 2) / 3, x, y + size / 3);
      ctx.quadraticCurveTo(x, y, x, y + size / 4);
      ctx.closePath();
    };

    const drawStar = (ctx: CanvasRenderingContext2D, x: number, y: number, r: number, p = 5, m = 0.5) => {
      ctx.beginPath();
      ctx.moveTo(x, y + r);
      for (let i = 0; i < p * 2; i++) {
        const angle = (Math.PI * i) / p;
        const currentR = i % 2 === 0 ? r : r * m;
        ctx.lineTo(x + Math.sin(angle) * currentR, y + Math.cos(angle) * currentR);
      }
      ctx.closePath();
    };

    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const particles = particlesRef.current;
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.08; // Gravity slightly pulls them
        p.alpha -= p.decay;
        p.rotation += p.rv;

        if (p.alpha <= 0) {
          particles.splice(i, 1);
          continue;
        }

        ctx.save();
        ctx.globalAlpha = p.alpha;
        ctx.fillStyle = p.color;
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 1;

        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);

        if (p.shape === 'heart') {
          drawHeart(ctx, -p.size / 2, -p.size / 2, p.size);
          ctx.fill();
          ctx.stroke();
        } else if (p.shape === 'star') {
          drawStar(ctx, 0, 0, p.size);
          ctx.fill();
          ctx.stroke();
        } else {
          ctx.beginPath();
          ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        }

        ctx.restore();
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  // Spawn sparkly particles when fireCount changes
  useEffect(() => {
    if (fireCount === 0) return;

    const width = window.innerWidth;
    const height = window.innerHeight;

    // Standard splash: 45 particles radiating from the center/bottom
    const newParticles: Particle[] = [];
    const count = 55;

    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 8 + 4;
      const decay = Math.random() * 0.015 + 0.008;

      newParticles.push({
        x: width / 2 + (Math.random() * 100 - 50),
        y: height / 2 + (Math.random() * 100 - 50),
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 2, // burst slightly upwards
        size: Math.random() * 12 + 6,
        color: [
          '#FFB6C1', // Dreamy Pink
          '#FFD700', // Sparkle Gold
          '#BA55D3', // Magic Purple
          '#FFFFFF', // White Sparkle
          '#FF69B4', // Hot Pink
        ][Math.floor(Math.random() * 5)],
        shape: ['star', 'circle', 'heart'][Math.floor(Math.random() * 3)] as 'star' | 'circle' | 'heart',
        alpha: 1,
        decay,
        rotation: Math.random() * Math.PI * 2,
        rv: Math.random() * 0.1 - 0.05
      });
    }

    particlesRef.current = [...particlesRef.current, ...newParticles];
  }, [fireCount]);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-50"
      style={{ mixBlendMode: 'screen' }}
    />
  );
}
