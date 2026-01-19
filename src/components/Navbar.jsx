import { useRef, useEffect } from 'react';
import styled from 'styled-components';
import { theme, media } from '../styles';
import spinningHeadVideo from '../assets/videos/spinning-head.mp4';

const NavWrapper = styled.div`
  position: fixed;
  top: 0;
  z-index: 10000;
  max-width: ${theme.grid.maxWidth};
  margin: 0 auto;
  left: 20px;
  right: 20px;
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding-top: ${theme.spacing.md};
  pointer-events: none;

  ${media.tablet} {
    left: 20px;
    right: 20px;
  }

  ${media.desktop} {
    left: 20px;
    right: 20px;
  }
`;

const NavContainer = styled.nav`
  font-family: ${theme.typography.fontFamilyMono};
  font-size: 14px;
  display: flex;
  flex-direction: column;
  width: fit-content;
  pointer-events: auto;
`;

const NavLink = styled.a`
  font-family: ${theme.typography.fontFamilyMono};
  font-size: 16px;
  text-decoration: none;
  color: ${theme.colors.text};
  pointer-events: auto;
  display: inline-block;
  width: fit-content;
  padding: 0;

  &:hover {
    background: rgba(0, 0, 0, 0.1);
  }
`;

const VideoElement = styled.video`
  position: absolute;
  left: -9999px;
  top: -9999px;
  width: 1px;
  height: 1px;
  opacity: 0;
  display: block; /* keep it loadable/decodable */
  pointer-events: none;
  background: transparent;
`;

const VideoCanvas = styled.canvas`
  height: 50px;
  width: auto;
  display: block;
  pointer-events: auto;
`;

function Navbar() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const rafRef = useRef(null);
  const scrollTimeoutRef = useRef(null);
  const lastScrollYRef = useRef(window.scrollY);

  useEffect(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    // Ensure it starts fetching/decoding as soon as possible.
    video.preload = 'auto';
    video.load?.();

    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    function ensureCanvasSize() {
      const dpr = window.devicePixelRatio || 1;
      const targetH = 50;
      const vw = video.videoWidth || 0;
      const vh = video.videoHeight || 0;
      const aspect = vw && vh ? vw / vh : 1;

      const cssH = targetH;
      const cssW = Math.max(1, Math.round(cssH * aspect));

      canvas.style.height = `${cssH}px`;
      canvas.style.width = `${cssW}px`;

      const pxW = Math.max(1, Math.round(cssW * dpr));
      const pxH = Math.max(1, Math.round(cssH * dpr));
      if (canvas.width !== pxW) canvas.width = pxW;
      if (canvas.height !== pxH) canvas.height = pxH;
    }

    function drawFrame() {
      if (!video.videoWidth || !video.videoHeight) return;
      ensureCanvasSize();

      const w = canvas.width;
      const h = canvas.height;

      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, w, h);
      ctx.drawImage(video, 0, 0, w, h);

      const imageData = ctx.getImageData(0, 0, w, h);
      const data = imageData.data;

      // Simple near-white key: make white-ish pixels transparent
      // Tune threshold if needed.
      const threshold = 245;
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];

        if (r >= threshold && g >= threshold && b >= threshold) {
          data[i + 3] = 0;
        }
      }

      ctx.putImageData(imageData, 0, 0);
    }

    function tick() {
      drawFrame();
      rafRef.current = requestAnimationFrame(tick);
    }

    function start() {
      if (rafRef.current) return;
      rafRef.current = requestAnimationFrame(tick);
    }

    function stop() {
      if (!rafRef.current) return;
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }

    const onLoaded = () => {
      drawFrame();
    };
    const onSeeked = () => {
      drawFrame();
    };
    const onPlay = () => start();
    const onPause = () => {
      stop();
      drawFrame();
    };

    video.addEventListener('loadeddata', onLoaded);
    video.addEventListener('seeked', onSeeked);
    video.addEventListener('play', onPlay);
    video.addEventListener('pause', onPause);

    return () => {
      stop();
      video.removeEventListener('loadeddata', onLoaded);
      video.removeEventListener('seeked', onSeeked);
      video.removeEventListener('play', onPlay);
      video.removeEventListener('pause', onPause);
    };
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      if (!videoRef.current) return;

      const video = videoRef.current;
      
      if (!video.readyState || !video.duration) return;

      const currentScrollY = window.scrollY;
      const scrollDelta = currentScrollY - lastScrollYRef.current;
      lastScrollYRef.current = currentScrollY;

      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }

      if (Math.abs(scrollDelta) > 0.5) {
        const duration = video.duration;
        const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
        const scrollProgress = maxScroll > 0 ? currentScrollY / maxScroll : 0;

        // Increase "spin" by moving further through the timeline, and wrap.
        const spinMultiplier = 2.5;
        video.playbackRate = 2.0;
        video.currentTime = (scrollProgress * duration * spinMultiplier) % duration;
        video.play().catch(() => {});

        scrollTimeoutRef.current = setTimeout(() => {
          if (videoRef.current) {
            videoRef.current.pause();
          }
        }, 250);
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll);
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const handleWheel = (e) => {
      const video = videoRef.current;
      if (!video || !video.duration) return;

      if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);

      // Wheel-driven spin (works even when the page isn't scrollable, e.g. CaseStudy right pane)
      const factor = 0.0025; // seconds per wheel pixel
      const duration = video.duration;
      const next = (video.currentTime + e.deltaY * factor) % duration;
      video.playbackRate = 2.0;
      video.currentTime = next < 0 ? next + duration : next;
      video.play().catch(() => {});

      scrollTimeoutRef.current = setTimeout(() => {
        video.pause?.();
      }, 250);
    };

    window.addEventListener('wheel', handleWheel, { passive: true });
    return () => {
      window.removeEventListener('wheel', handleWheel);
    };
  }, []);

  return (
    <NavWrapper>
      <NavContainer>
        <NavLink href="#home">Home</NavLink>
        <NavLink href="#work">Work</NavLink>
        <NavLink href="#about">About</NavLink>
        <NavLink href="#gallery">Gallery</NavLink>
      </NavContainer>
      <VideoCanvas ref={canvasRef} />
      <VideoElement
        ref={videoRef}
        src={spinningHeadVideo}
        loop
        muted
        playsInline
        preload="auto"
        controls={false}
      />
    </NavWrapper>
  );
}

export default Navbar;
