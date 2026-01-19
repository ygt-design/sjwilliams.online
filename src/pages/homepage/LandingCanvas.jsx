import { useEffect, useRef } from 'react';
import p5 from 'p5';
import seagramFont from '../../assets/fonts/Seagram.ttf';
import { useLoadingContext } from '../../loading/LoadingContext';

function LandingCanvas() {
  const sketchRef = useRef(null);
  const p5InstanceRef = useRef(null);
  const { landingP5Ready } = useLoadingContext();

  useEffect(() => {
    // Start the p5 sketch shortly before loader fade completes.
    if (!landingP5Ready) return;
    if (!sketchRef.current || p5InstanceRef.current) return;

    const sketch = (p) => {
      let font = null;
      let fontLoaded = false;

      let crispMask = null;
      let crispReady = false;

      let softMask = null;
      let softReady = false;

      // reveal
      let revealProgress = 0;
      const revealSpeed = 0.016;
      const revealBand = 0.12;

      // pointer field (smooth decay)
      let mx = 0,
        my = 0,
        pmx = 0,
        pmy = 0;
      let fx = 0,
        fy = 0;
      let vx = 0,
        vy = 0;
      let pointerStrength = 0;
      let lastDirX = 1,
        lastDirY = 0;

      const getCanvasSize = () => {
        const el = sketchRef.current;
        if (el) {
          const rect = el.getBoundingClientRect();
          const w = Math.max(1, Math.round(rect.width));
          const h = Math.max(1, Math.round(rect.height));
          if (w > 1 && h > 1) return { w, h };
        }
        return { w: window.innerWidth, h: window.innerHeight };
      };

      const resetPointer = (w, h) => {
        mx = w / 2;
        my = h / 2;
        pmx = mx;
        pmy = my;
        fx = mx;
        fy = my;
        vx = 0;
        vy = 0;
        pointerStrength = 0;
        lastDirX = 1;
        lastDirY = 0;
      };

      // cheap stable noise
      const hash2D = (ix, iy) => {
        const s = Math.sin(ix * 127.1 + iy * 311.7) * 43758.5453123;
        return s - Math.floor(s); // [0..1)
      };
      const jitter01 = (ix, iy) => hash2D(ix, iy) * 2 - 1; // [-1..1]

      const sampleBrightness = (g, x, y) => {
        if (!g || !g.pixels) return 0;
        const px = x < 0 ? 0 : x >= g.width ? g.width - 1 : x | 0;
        const py = y < 0 ? 0 : y >= g.height ? g.height - 1 : y | 0;
        const idx = (py * g.width + px) * 4;
        if (idx < 0 || idx + 2 >= g.pixels.length) return 0;
        return (g.pixels[idx] + g.pixels[idx + 1] + g.pixels[idx + 2]) / 3;
      };

      const smoothBrightness = (g, x, y, r) => {
        const b0 = sampleBrightness(g, x, y);
        const b1 = sampleBrightness(g, x + r, y);
        const b2 = sampleBrightness(g, x, y + r);
        return b0 * 0.5 + b1 * 0.25 + b2 * 0.25;
      };

      const smoothstep = (a, b, x) => {
        const t = p.constrain((x - a) / (b - a), 0, 1);
        return t * t * (3 - 2 * t);
      };

      const setPointer = (x, y) => {
        mx = p.constrain(x, 0, p.width);
        my = p.constrain(y, 0, p.height);
        pointerStrength = 1;
      };

      const updatePointerPhysics = () => {
        const dxm = mx - pmx;
        const dym = my - pmy;
        pmx = mx;
        pmy = my;

        vx = p.lerp(vx, dxm, 0.35);
        vy = p.lerp(vy, dym, 0.35);
        vx *= 0.92;
        vy *= 0.92;

        fx = p.lerp(fx, mx, 0.14);
        fy = p.lerp(fy, my, 0.14);

        const speed = Math.sqrt(vx * vx + vy * vy);

        if (speed > 0.2) {
          lastDirX = vx / speed;
          lastDirY = vy / speed;
        }

        const target = speed > 0.05 ? 1 : 0;
        pointerStrength = p.lerp(pointerStrength, target, speed > 0.05 ? 0.12 : 0.04);
      };

      const fieldAt = (x, y, dotSpacing) => {
        if (pointerStrength < 0.001) return { dx: 0, dy: 0, sizeMult: 1 };

        const rx = x - fx;
        const ry = y - fy;
        const r = p.min(p.width, p.height) * 0.32;
        const r2 = r * r;

        const d2 = rx * rx + ry * ry;
        if (d2 >= r2) return { dx: 0, dy: 0, sizeMult: 1 };

        const d = Math.sqrt(d2);
        const falloff = 1 - smoothstep(0, r, d);

        const speed = Math.sqrt(vx * vx + vy * vy);
        const move = p.constrain(speed / 18, 0, 1);

        const maxDisp = dotSpacing * 3.0;
        const dispAmp = maxDisp * (0.35 + 1.35 * move) * falloff * pointerStrength;

        const ndx = lastDirX;
        const ndy = lastDirY;

        const tt = p.millis() / 1000;
        const wobble = Math.sin(tt * 6.2 + d * 0.06);

        const dx = ndx * dispAmp + -ndy * wobble * dispAmp * 0.34;
        const dy = ndy * dispAmp + ndx * wobble * dispAmp * 0.34;

        const sizeMult = 1 + wobble * 0.28 * falloff * pointerStrength * (0.35 + 0.95 * move);

        return { dx, dy, sizeMult: p.constrain(sizeMult, 0.78, 1.42) };
      };

      const buildMasks = () => {
        if (!fontLoaded || !font) return;

        const w = p.width;
        const h = p.height;
        const mobile = w < 520;

        const word = 'sjwilliams';
        const cx = w / 2;
        const cy = h / 2;

        const maxTextWidth = mobile ? w * 0.8 : w * 0.92;
        const maxTextHeight = mobile ? h * 0.28 : h * 0.34;

        let size = p.min(w * 0.25, h * 0.34);
        const minSize = 18;

        const measure = (s) => {
          try {
            return font.textBounds(word, 0, 0, s);
          } catch {
            return { w: s * word.length * 0.6, h: s * 1.05 };
          }
        };

        for (let i = 0; i < 14; i++) {
          const b = measure(size);
          if (b.w <= maxTextWidth && b.h <= maxTextHeight) break;
          size *= 0.88;
          if (size < minSize) {
            size = minSize;
            break;
          }
        }

        if (mobile) {
          const narrowFactor = p.map(w, 520, 320, 1.0, 0.82, true);
          size *= narrowFactor;
        }

        if (crispMask) crispMask.remove();
        crispMask = p.createGraphics(w, h);
        crispMask.pixelDensity(1);
        crispMask.background(0);
        crispMask.fill(255);
        crispMask.noStroke();
        crispMask.textFont(font);
        crispMask.textAlign(p.CENTER, p.CENTER);
        crispMask.textSize(size);
        crispMask.text(word, cx, cy);
        crispMask.loadPixels();
        crispReady = !!(crispMask.pixels && crispMask.pixels.length > 0);

        if (softMask) softMask.remove();
        softMask = p.createGraphics(w, h);
        softMask.pixelDensity(1);
        softMask.background(0);
        softMask.noStroke();
        softMask.textFont(font);
        softMask.textAlign(p.CENTER, p.CENTER);
        softMask.textSize(size);

        const blurRadius = Math.round(p.min(w, h) * 0.045);
        const step = Math.max(2, Math.round(blurRadius / 7));

        softMask.fill(255, 26);
        softMask.text(word, cx, cy);

        for (let ox = -blurRadius; ox <= blurRadius; ox += step) {
          for (let oy = -blurRadius; oy <= blurRadius; oy += step) {
            if (ox === 0 && oy === 0) continue;
            const dd = Math.sqrt(ox * ox + oy * oy);
            if (dd > blurRadius) continue;
            const a = p.map(dd, 0, blurRadius, 24, 1);
            softMask.fill(255, a);
            softMask.text(word, cx + ox, cy + oy);
          }
        }

        softMask.loadPixels();
        softReady = !!(softMask.pixels && softMask.pixels.length > 0);
      };

      p.setup = () => {
        const { w, h } = getCanvasSize();
        p.createCanvas(w, h);
        p.pixelDensity(1);
        resetPointer(w, h);

        p.frameRate(w < 520 ? 30 : 60);

        p.loadFont(
          seagramFont,
          (loadedFont) => {
            font = loadedFont;
            fontLoaded = true;
            crispReady = false;
            softReady = false;
          },
          (err) => console.error('Font failed to load:', err)
        );
      };

      p.mouseMoved = () => setPointer(p.mouseX, p.mouseY);
      p.mouseDragged = () => setPointer(p.mouseX, p.mouseY);

      p.touchStarted = () => {
        if (p.touches && p.touches.length > 0) setPointer(p.touches[0].x, p.touches[0].y);
        return false;
      };
      p.touchMoved = () => {
        if (p.touches && p.touches.length > 0) setPointer(p.touches[0].x, p.touches[0].y);
        return false;
      };
      p.touchEnded = () => false;

      p.draw = () => {
        p.background(255);
        if (!fontLoaded || !font) return;

        if (
          !crispReady ||
          !softReady ||
          !crispMask ||
          !softMask ||
          p.width !== crispMask.width ||
          p.height !== crispMask.height
        ) {
          buildMasks();
          return;
        }

        if (revealProgress < 1) revealProgress = p.min(1, revealProgress + revealSpeed);

        updatePointerPhysics();

        // grid density
        const densityFactor = p.width < 520 ? 0.022 : 0.017;
        const dotSpacing = p.min(p.width, p.height) * densityFactor;

        const maxDotSize = dotSpacing * 1.45;
        const textMaxDot = maxDotSize * 0.92;

        const textThreshold = 45;

        // ✅ smaller background dots
        const bgMinDot = dotSpacing * 0.02;
        const bgMaxDot = dotSpacing * 0.42;

        const centerX = p.width / 2;
        const centerY = p.height / 2;
        const radiusX = p.width / 2;
        const radiusY = p.height / 2;

        const sampleR = dotSpacing * 0.5;
        const t = p.millis() * 0.001;

        p.noStroke();
        p.fill(0);

        for (let x = 0; x < p.width; x += dotSpacing) {
          for (let y = 0; y < p.height; y += dotSpacing) {
            const gridX = (x / dotSpacing) | 0;
            const gridY = (y / dotSpacing) | 0;

            const crispB = smoothBrightness(crispMask, x, y, sampleR);
            const isText = crispB > textThreshold;

            let softB = smoothBrightness(softMask, x, y, sampleR) / 255;
            softB = p.constrain(softB * 2.0, 0, 1);
            softB = Math.pow(softB, 0.65);

            const distFromWord = 1 - softB;
            const distWide = p.constrain(distFromWord / 1.25, 0, 1);
            let wordFalloff = 1 - smoothstep(0.05, 1.0, distWide);
            wordFalloff = p.lerp(0.22, 1.0, wordFalloff);

            // mild edge vignette only
            const dxn = (x - centerX) / radiusX;
            const dyn = (y - centerY) / radiusY;
            const e = p.constrain(Math.sqrt(dxn * dxn + dyn * dyn), 0, 1);
            const edgeVign = 1 - smoothstep(0.55, 1.0, e);

            // thin out background dots (stable)
            if (!isText) {
              const keepProb = p.lerp(0.28, 0.92, wordFalloff);
              const rnd = hash2D(gridX * 19.7, gridY * 23.3);
              if (rnd > keepProb) continue;
            }

            const jitter = jitter01(gridX, gridY);
            const jitterAmp = 0.18 * wordFalloff;

            const phase = hash2D(gridX * 3.1, gridY * 3.1) * p.TWO_PI;
            const idle = Math.sin(t * 0.7 + phase);
            const idleAmp = 0.028 * wordFalloff;
            const idleMult = 1 + idle * idleAmp;

            let dotSize;

            if (isText) {
              const baseDot = p.map(e, 0, 1, dotSpacing * 0.52, dotSpacing * 0.25);
              dotSize = p.map(crispB, 0, 255, baseDot * 0.85, textMaxDot);

              const revealScale = smoothstep(0, revealBand, revealProgress - e);
              dotSize *= revealScale;

              dotSize *= 1 + jitter * (jitterAmp * 0.45);
              dotSize *= idleMult;
            } else {
              dotSize = p.map(wordFalloff, 0, 1, bgMinDot, bgMaxDot);

              // ✅ smaller overall background emphasis
              dotSize *= p.map(softB, 0, 1, 0.30, 0.75);

              dotSize *= p.map(edgeVign, 0, 1, 0.85, 1.0);

              dotSize *= 1 + jitter * jitterAmp;
              dotSize *= idleMult;
            }

            const f = fieldAt(x, y, dotSpacing);
            const xx = x + f.dx * (isText ? 0.65 : 1.0);
            const yy = y + f.dy * (isText ? 0.65 : 1.0);

            dotSize *= isText
              ? p.map(f.sizeMult, 0.78, 1.42, 0.95, 1.10, true)
              : f.sizeMult;

            if (dotSize < 0.12) continue;
            p.circle(xx, yy, dotSize);
          }
        }
      };

      p.windowResized = () => {
        const { w, h } = getCanvasSize();
        p.resizeCanvas(w, h);
        crispReady = false;
        softReady = false;
        resetPointer(w, h);
        p.frameRate(w < 520 ? 30 : 60);
      };
    };

    p5InstanceRef.current = new p5(sketch, sketchRef.current);

    return () => {
      if (p5InstanceRef.current) {
        p5InstanceRef.current.remove();
        p5InstanceRef.current = null;
      }
    };
  }, [landingP5Ready]);

  return (
    <div
      ref={sketchRef}
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        display: 'block',
        touchAction: 'none',
      }}
    />
  );
}

export default LandingCanvas;