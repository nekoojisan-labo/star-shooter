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
    const getViewport = () => {
      const vv = window.visualViewport;
      if (vv) {
        return { width: vv.width, height: vv.height, offsetTop: vv.offsetTop, offsetLeft: vv.offsetLeft };
      }
      return { width: window.innerWidth, height: window.innerHeight, offsetTop: 0, offsetLeft: 0 };
    };

    const applySize = () => {
      const { width, height, offsetTop, offsetLeft } = getViewport();
      // Keep the drawing buffer and the CSS box the same size so the canvas
      // is never stretched. Stretching would push the bottom UI back under
      // the mobile address bar even though the buffer excludes it.
      canvas.width = width;
      canvas.height = height;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      canvas.style.top = `${offsetTop}px`;
      canvas.style.left = `${offsetLeft}px`;
      if (engineRef.current) {
        engineRef.current.resize(width, height);
      }
    };

    const initial = getViewport();
    canvas.width = initial.width;
    canvas.height = initial.height;

    const engine = new GameEngine(ctx, initial.width, initial.height);
    engineRef.current = engine;
    applySize();

    window.addEventListener('resize', applySize);
    window.addEventListener('orientationchange', applySize);
    // visualViewport fires its own resize/scroll events when the browser
    // chrome (address bar) toggles on mobile.
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', applySize);
      window.visualViewport.addEventListener('scroll', applySize);
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
      window.removeEventListener('resize', applySize);
      window.removeEventListener('orientationchange', applySize);
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', applySize);
        window.visualViewport.removeEventListener('scroll', applySize);
      }
      engine.cleanup();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        display: 'block',
        position: 'fixed',
        top: 0,
        left: 0,
        backgroundColor: '#000'
      }}
    />
  );
};

export default GameCanvas;
