import React, { useRef, useEffect } from 'react';
import { GameEngine } from '../game/GameEngine';

const GameCanvas: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<GameEngine | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      if (engineRef.current) {
        engineRef.current.resize(window.innerWidth, window.innerHeight);
      }
    };

    // Initial size
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const engine = new GameEngine(ctx, window.innerWidth, window.innerHeight);
    engineRef.current = engine;

    window.addEventListener('resize', resizeCanvas);

    let animationFrameId: number;
    let lastTime = performance.now();

    const render = (time: number) => {
      let deltaTime = (time - lastTime) / 1000;
      lastTime = time;

      deltaTime = Math.min(deltaTime, 0.1);

      engine.update(deltaTime);
      engine.draw();

      animationFrameId = requestAnimationFrame(render);
    };

    animationFrameId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', resizeCanvas);
      engine.cleanup();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        display: 'block',
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        backgroundColor: '#000'
      }}
    />
  );
};

export default GameCanvas;
