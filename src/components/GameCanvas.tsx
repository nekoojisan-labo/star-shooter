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

    // Use visualViewport on mobile to exclude browser chrome (address bar, etc.)
    const getViewportSize = () => {
      const vv = window.visualViewport;
      if (vv) {
        return { width: vv.width, height: vv.height };
      }
      return { width: window.innerWidth, height: window.innerHeight };
    };

    const resizeCanvas = () => {
      const { width, height } = getViewportSize();
      canvas.width = width;
      canvas.height = height;
      if (engineRef.current) {
        engineRef.current.resize(width, height);
      }
    };

    // Initial size
    const initialSize = getViewportSize();
    canvas.width = initialSize.width;
    canvas.height = initialSize.height;

    const engine = new GameEngine(ctx, initialSize.width, initialSize.height);
    engineRef.current = engine;

    window.addEventListener('resize', resizeCanvas);
    // visualViewport fires its own resize event when browser chrome toggles
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', resizeCanvas);
    }

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
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', resizeCanvas);
      }
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
        height: '100dvh',        // dvh = dynamic viewport height (excludes browser chrome on mobile)
        backgroundColor: '#000',
        touchAction: 'none',     // prevent default scroll/zoom on canvas
      }}
    />
  );
};

export default GameCanvas;
