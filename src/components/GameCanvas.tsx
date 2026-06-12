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

    const engine = new GameEngine(canvas, ctx, initialSize.width, initialSize.height);
    engineRef.current = engine;

    window.addEventListener('resize', resizeCanvas);
    // visualViewport fires its own resize event when browser chrome toggles
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', resizeCanvas);
    }

    let animationFrameId: number;
    let cancelled = false;

    /** Draw a simple loading screen while assets are loading */
    const drawLoading = (progress: string) => {
      ctx.fillStyle = '#050510';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Starfield dots
      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      for (let i = 0; i < 60; i++) {
        // Deterministic positions so they don't flicker between frames
        const x = ((i * 137.5) % 1) * canvas.width || (i * 23.7) % canvas.width;
        const y = ((i * 79.3) % 1) * canvas.height || (i * 41.1) % canvas.height;
        ctx.beginPath();
        ctx.arc(x, y, 1, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.fillStyle = '#00AAFF';
      ctx.font = `bold 28px "Courier New"`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('STAR SHOOTER', canvas.width / 2, canvas.height / 2 - 40);

      ctx.fillStyle = '#AAAAAA';
      ctx.font = `16px "Courier New"`;
      ctx.fillText(progress, canvas.width / 2, canvas.height / 2 + 10);

      // Simple animated bar
      const barW = Math.min(300, canvas.width * 0.6);
      const barX = canvas.width / 2 - barW / 2;
      const barY = canvas.height / 2 + 40;
      ctx.strokeStyle = '#336699';
      ctx.lineWidth = 2;
      ctx.strokeRect(barX, barY, barW, 12);
      const fill = ((Date.now() / 30) % barW);
      ctx.fillStyle = '#00AAFF';
      ctx.fillRect(barX, barY, fill, 12);

      ctx.textBaseline = 'alphabetic';
    };

    // Animate loading screen while loadAssets runs
    let loadingRafId: number;
    const animateLoading = () => {
      drawLoading('NOW LOADING...');
      loadingRafId = requestAnimationFrame(animateLoading);
    };
    loadingRafId = requestAnimationFrame(animateLoading);

    // Await asset loading BEFORE starting the game loop
    engine.loadAssets().then(() => {
      cancelAnimationFrame(loadingRafId);
      if (cancelled) return;

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
    });

    return () => {
      cancelled = true;
      cancelAnimationFrame(loadingRafId);
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
