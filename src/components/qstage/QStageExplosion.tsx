'use client';

import { memo, useState, useEffect, useCallback } from 'react';

interface QStageExplosionProps {
  trigger: boolean;
  onComplete?: () => void;
  successColor?: string;
}

// Particle configuration
const PARTICLE_COUNT = 50;
const COLORS = ['#00ff88', '#00d4ff', '#ffd700', '#ff00aa', '#ffffff'];

interface Particle {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  rotation: number;
  rotationSpeed: number;
  type: 'circle' | 'star' | 'square';
}

/**
 * QStageExplosion - Celebration particle effect
 * Triggered when success threshold is crossed
 */
export const QStageExplosion = memo(function QStageExplosion({
  trigger,
  onComplete,
  successColor = '#00ff88',
}: QStageExplosionProps) {
  const [particles, setParticles] = useState<Particle[]>([]);
  const [visible, setVisible] = useState(false);
  const [flashOpacity, setFlashOpacity] = useState(0);

  // Generate particles when triggered
  useEffect(() => {
    if (!trigger) return;

    setVisible(true);
    setFlashOpacity(0.6);

    // Generate particles bursting from center
    const newParticles: Particle[] = [];
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const angle = (Math.PI * 2 * i) / PARTICLE_COUNT + Math.random() * 0.5;
      const speed = 5 + Math.random() * 15;

      newParticles.push({
        id: i,
        x: 50, // Start from center (%)
        y: 50,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: 4 + Math.random() * 12,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        rotation: Math.random() * 360,
        rotationSpeed: (Math.random() - 0.5) * 20,
        type: ['circle', 'star', 'square'][Math.floor(Math.random() * 3)] as Particle['type'],
      });
    }

    setParticles(newParticles);

    // Fade out flash
    setTimeout(() => setFlashOpacity(0), 100);

    // Clean up after animation
    const timeout = setTimeout(() => {
      setVisible(false);
      setParticles([]);
      onComplete?.();
    }, 3000);

    return () => clearTimeout(timeout);
  }, [trigger, onComplete]);

  // Animate particles
  useEffect(() => {
    if (particles.length === 0) return;

    let animationFrame: number;
    let lastTime = performance.now();

    const animate = (currentTime: number) => {
      const deltaTime = Math.min((currentTime - lastTime) / 16, 2); // Cap at 2x speed
      lastTime = currentTime;

      setParticles(prev =>
        prev.map(p => ({
          ...p,
          x: p.x + p.vx * deltaTime * 0.3,
          y: p.y + p.vy * deltaTime * 0.3 + deltaTime * 0.5, // Add gravity
          vy: p.vy + deltaTime * 0.3, // Gravity acceleration
          vx: p.vx * 0.99, // Air resistance
          rotation: p.rotation + p.rotationSpeed * deltaTime,
        })).filter(p =>
          // Remove particles that are off-screen
          p.x > -10 && p.x < 110 && p.y < 120
        )
      );

      if (visible) {
        animationFrame = requestAnimationFrame(animate);
      }
    };

    animationFrame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationFrame);
  }, [visible, particles.length]);

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-50 pointer-events-none overflow-hidden">
      {/* Flash overlay */}
      <div
        className="absolute inset-0 transition-opacity duration-200"
        style={{
          backgroundColor: successColor,
          opacity: flashOpacity,
        }}
      />

      {/* Center burst glow */}
      <div
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[100vmax] h-[100vmax] rounded-full"
        style={{
          background: `radial-gradient(circle, ${successColor}40 0%, transparent 50%)`,
          animation: 'qstage-burst-expand 1s ease-out forwards',
        }}
      />

      {/* Success text */}
      <div
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
        style={{
          animation: 'qstage-success-text 1.5s ease-out forwards',
        }}
      >
        <span
          className="block font-black text-center"
          style={{
            fontSize: '15vmin',
            color: successColor,
            textShadow: `
              0 0 30px ${successColor},
              0 0 60px ${successColor}80,
              0 0 90px ${successColor}60
            `,
            fontFamily: "'Bebas Neue', 'Impact', sans-serif",
            letterSpacing: '0.1em',
          }}
        >
          SUCCESS!
        </span>
      </div>

      {/* Particles */}
      {particles.map(particle => (
        <div
          key={particle.id}
          className="absolute"
          style={{
            left: `${particle.x}%`,
            top: `${particle.y}%`,
            width: particle.size,
            height: particle.size,
            transform: `translate(-50%, -50%) rotate(${particle.rotation}deg)`,
            opacity: Math.max(0, 1 - particle.y / 120),
          }}
        >
          {particle.type === 'circle' && (
            <div
              className="w-full h-full rounded-full"
              style={{
                backgroundColor: particle.color,
                boxShadow: `0 0 ${particle.size}px ${particle.color}`,
              }}
            />
          )}
          {particle.type === 'star' && (
            <div
              className="w-full h-full"
              style={{
                backgroundColor: particle.color,
                clipPath: 'polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)',
                boxShadow: `0 0 ${particle.size}px ${particle.color}`,
              }}
            />
          )}
          {particle.type === 'square' && (
            <div
              className="w-full h-full"
              style={{
                backgroundColor: particle.color,
                boxShadow: `0 0 ${particle.size}px ${particle.color}`,
              }}
            />
          )}
        </div>
      ))}

      {/* Confetti streamers */}
      {[...Array(20)].map((_, i) => (
        <div
          key={`streamer-${i}`}
          className="absolute w-2 h-8 rounded-full"
          style={{
            left: `${5 + (i * 90) / 20}%`,
            top: '-20%',
            backgroundColor: COLORS[i % COLORS.length],
            animation: `qstage-confetti-fall ${2 + Math.random()}s ease-in forwards`,
            animationDelay: `${Math.random() * 0.5}s`,
            transform: `rotate(${Math.random() * 30 - 15}deg)`,
          }}
        />
      ))}
    </div>
  );
});

export default QStageExplosion;
