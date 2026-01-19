import { useEffect, useMemo, useRef, useState } from 'react';
import styled from 'styled-components';
import { theme } from '../../styles';
import { fetchGroupChannelsPage1 } from '../../api/arenaProxy';
import { apiUrl } from '../../api/apiBase';
import { useRegisterLoading } from '../../loading/LoadingContext';

const Wrapper = styled.div`
  position: fixed;
  inset: 0;
  width: 100vw;
  height: 100vh;
  margin: 0;
  padding: 0;
  overflow: hidden;
`;

const CanvasStage = styled.div`
  width: 100%;
  height: 100%;
  overflow: hidden;
  touch-action: none;
  position: relative;
`;

const CanvasEl = styled.canvas`
  width: 100%;
  height: 100%;
  display: block;
`;

function getImageUrls(block) {
  return {
    thumb: block?.image?.thumb?.url || '',
    display: block?.image?.display?.url || '',
    original: block?.image?.original?.url || '',
  };
}

function getBestDims(block) {
  const d =
    block?.image?.display ||
    block?.image?.thumb ||
    block?.image?.original ||
    null;
  const w = Number(d?.width || 0);
  const h = Number(d?.height || 0);
  if (!w || !h) return null;
  return { w, h };
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function GalleryCanvas({ images }) {
  const stageRef = useRef(null);
  const canvasRef = useRef(null);

  // World transform
  const panRef = useRef({ x: 0, y: 0 });
  const zoomRef = useRef(1);
  const INITIAL_ZOOM = 0.85;

  // Render scheduling
  const rafRef = useRef(null);
  const needsDrawRef = useRef(true);

  // Interaction
  const dragRef = useRef({
    dragging: false,
    startX: 0,
    startY: 0,
    startPanX: 0,
    startPanY: 0,
  });

  // Image cache / queue
  const cacheRef = useRef(new Map()); // url -> { status, img }
  const inflightRef = useRef(new Set()); // url
  const queueRef = useRef([]);
  const runningRef = useRef(0);
  const MAX_CONCURRENCY = 6;
  const OVERSCROLL = 200;

  const getPanBounds = (stageW, stageH, zoom) => {
    const worldW = layout.width * zoom;
    const worldH = layout.height * zoom;

    // If the world is smaller than the viewport, pin it centered (no inverted bounds).
    const xRange = stageW - worldW;
    const yRange = stageH - worldH;

    const maxX = OVERSCROLL;
    const maxY = OVERSCROLL;

    const minX = xRange >= 0 ? xRange / 2 : xRange - OVERSCROLL;
    const minY = yRange >= 0 ? yRange / 2 : yRange - OVERSCROLL;

    return {
      minX,
      maxX: xRange >= 0 ? xRange / 2 : maxX,
      minY,
      maxY: yRange >= 0 ? yRange / 2 : maxY,
    };
  };

  const layout = useMemo(() => {
    // Slight-grid layout: mostly aligned, but with jitter + mild size variance.
    // Also keeps spacing tighter (closer together).
    const gap = 30;
    const base = 220;
    const jitter = 50;
    const margin = 60;

    const hashStringToSeed = (str) => {
      let h = 2166136261;
      const s = String(str || '');
      for (let i = 0; i < s.length; i += 1) {
        h ^= s.charCodeAt(i);
        h = Math.imul(h, 16777619);
      }
      return h >>> 0;
    };

    const mulberry32 = (seed) => {
      let t = seed >>> 0;
      return () => {
        t += 0x6D2B79F5;
        let r = Math.imul(t ^ (t >>> 15), 1 | t);
        r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
        return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
      };
    };

    const n = images.length || 1;
    const cols = Math.max(5, Math.ceil(Math.sqrt(n)));
    const stride = base + gap;

    const nodes = (images || []).map((img, idx) => {
      const key = String(img.id || img.display || img.thumb || img.original || idx);
      const rand = mulberry32(hashStringToSeed(key));

      const aspect =
        img.width && img.height
          ? img.width / img.height
          : 0.85 + rand() * 0.6;

      const scale = 0.88 + rand() * 0.24; // mild variance
      let w = base * scale * clamp(aspect, 0.75, 1.35);
      let h = (base * scale) / clamp(aspect, 0.75, 1.35);

      w = clamp(w, 150, 300);
      h = clamp(h, 150, 300);

      const row = Math.floor(idx / cols);
      const col = idx % cols;

      const jx = (rand() - 0.5) * jitter * 2;
      const jy = (rand() - 0.5) * jitter * 2;

      return {
        ...img,
        key,
        x: col * stride + jx,
        y: row * stride + jy,
        w,
        h,
      };
    });

    // Bounds + shift into positive space
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const it of nodes) {
      minX = Math.min(minX, it.x);
      minY = Math.min(minY, it.y);
      maxX = Math.max(maxX, it.x + it.w);
      maxY = Math.max(maxY, it.y + it.h);
    }
    if (!Number.isFinite(minX)) minX = 0;
    if (!Number.isFinite(minY)) minY = 0;
    if (!Number.isFinite(maxX)) maxX = 1;
    if (!Number.isFinite(maxY)) maxY = 1;

    const shiftX = -minX + margin;
    const shiftY = -minY + margin;
    for (const it of nodes) {
      it.x += shiftX;
      it.y += shiftY;
    }

    const width = (maxX - minX) + margin * 2;
    const height = (maxY - minY) + margin * 2;

    return { nodes, width, height };
  }, [images]);

  const requestDraw = () => {
    needsDrawRef.current = true;
    if (rafRef.current) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      draw();
    });
  };

  const maybeStartLoads = () => {
    while (runningRef.current < MAX_CONCURRENCY && queueRef.current.length) {
      const url = queueRef.current.shift();
      if (!url) continue;
      if (inflightRef.current.has(url)) continue;
      const cached = cacheRef.current.get(url);
      if (cached?.status === 'loaded') continue;

      inflightRef.current.add(url);
      runningRef.current += 1;

      const img = new Image();
      img.decoding = 'async';
      img.loading = 'eager';
      img.src = url;

      img.onload = () => {
        cacheRef.current.set(url, { status: 'loaded', img });
        inflightRef.current.delete(url);
        runningRef.current -= 1;
        requestDraw();
        maybeStartLoads();
      };
      img.onerror = () => {
        cacheRef.current.set(url, { status: 'error', img: null });
        inflightRef.current.delete(url);
        runningRef.current -= 1;
        maybeStartLoads();
      };
    }
  };

  const enqueue = (url) => {
    if (!url) return;
    const cached = cacheRef.current.get(url);
    if (cached?.status === 'loaded') return;
    if (inflightRef.current.has(url)) return;
    if (queueRef.current.includes(url)) return;
    queueRef.current.push(url);
    maybeStartLoads();
  };

  const draw = () => {
    if (!needsDrawRef.current) return;
    needsDrawRef.current = false;

    const canvas = canvasRef.current;
    const stage = stageRef.current;
    if (!canvas || !stage) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const w = Math.max(1, stage.clientWidth);
    const h = Math.max(1, stage.clientHeight);

    if (canvas.width !== Math.round(w * dpr)) canvas.width = Math.round(w * dpr);
    if (canvas.height !== Math.round(h * dpr)) canvas.height = Math.round(h * dpr);

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = theme.colors.background;
    ctx.fillRect(0, 0, w, h);

    const { x: panX, y: panY } = panRef.current;
    const zoom = zoomRef.current;

    // Compute visible world rect (with margin for prefetch).
    const marginPx = 1400;
    const left = (-panX - marginPx) / zoom;
    const top = (-panY - marginPx) / zoom;
    const right = (w - panX + marginPx) / zoom;
    const bottom = (h - panY + marginPx) / zoom;

    // Apply transform for drawing tiles.
    ctx.setTransform(dpr, 0, 0, dpr, panX, panY);
    ctx.scale(zoom, zoom);

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'low';

    // Determine visible tiles.
    // We intentionally do a simple full scan here because any miss in spatial-hash
    // culling feels like "images disappearing" while panning.
    const { nodes } = layout;

    const isVisible = (n) =>
      !(n.x > right || n.x + n.w < left || n.y > bottom || n.y + n.h < top);

    const visible = nodes
      .filter((n) => n && isVisible(n))
      .sort((a, b) => (a.y - b.y) || (a.x - b.x));

    for (const item of visible) {
      const x = item.x;
      const y = item.y;
      const tw = item.w;
      const th = item.h;

      // Load policy: thumb-first; upgrade to display when zoomed in.
      const wantHigh = zoom >= 1.2 && !!item.display;
      const lowUrl = item.thumb || item.display || item.original;
      const highUrl = wantHigh ? item.display : '';

      enqueue(lowUrl);
      if (highUrl) enqueue(highUrl);

      const drawUrl =
        highUrl && cacheRef.current.get(highUrl)?.status === 'loaded' ? highUrl : lowUrl;

      const cached = cacheRef.current.get(drawUrl);
      if (cached?.status === 'loaded' && cached.img) {
        const imgEl = cached.img;
        const iw = imgEl.naturalWidth || tw;
        const ih = imgEl.naturalHeight || th;

        // Preserve the image's aspect ratio (no cropping/stretching).
        // "height/width auto" equivalent: contain-fit inside (tw x th).
        const scale = Math.min(tw / iw, th / ih);
        const dw = iw * scale;
        const dh = ih * scale;
        const dx = x + (tw - dw) / 2;
        const dy = y + (th - dh) / 2;

        ctx.drawImage(imgEl, dx, dy, dw, dh);
      } else {
        // placeholder: outline only (no background block)
        ctx.strokeStyle = 'rgba(0,0,0,0.12)';
        ctx.lineWidth = 1;
        ctx.strokeRect(x + 0.5, y + 0.5, tw - 1, th - 1);
      }
    }
  };

  // Initial center + resize
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;

    const center = () => {
      const w = Math.max(1, stage.clientWidth);
      const h = Math.max(1, stage.clientHeight);

      const zoom = INITIAL_ZOOM;
      zoomRef.current = zoom;
      panRef.current = {
        x: (w - layout.width * zoom) / 2,
        y: (h - layout.height * zoom) / 2,
      };

      // Ensure we start within valid bounds (prevents blank canvas at edges).
      const b = getPanBounds(w, h, zoom);
      panRef.current.x = clamp(panRef.current.x, b.minX, b.maxX);
      panRef.current.y = clamp(panRef.current.y, b.minY, b.maxY);

      requestDraw();
    };

    center();
    const onResize = () => {
      // Keep current world center stable on resize.
      const w = Math.max(1, stage.clientWidth);
      const h = Math.max(1, stage.clientHeight);
      const zoom = zoomRef.current;
      const cxWorld = (w / 2 - panRef.current.x) / zoom;
      const cyWorld = (h / 2 - panRef.current.y) / zoom;
      panRef.current.x = w / 2 - cxWorld * zoom;
      panRef.current.y = h / 2 - cyWorld * zoom;
      requestDraw();
    };

    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layout.width, layout.height]);

  // Drag pan + wheel pan (no zoom)
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;

    const onPointerDown = (e) => {
      dragRef.current.dragging = true;
      dragRef.current.startX = e.clientX;
      dragRef.current.startY = e.clientY;
      dragRef.current.startPanX = panRef.current.x;
      dragRef.current.startPanY = panRef.current.y;
      stage.setPointerCapture?.(e.pointerId);
    };

    const onPointerMove = (e) => {
      if (!dragRef.current.dragging) return;
      const dx = e.clientX - dragRef.current.startX;
      const dy = e.clientY - dragRef.current.startY;
      if (Math.hypot(dx, dy) > 4) dragRef.current.moved = true;
      panRef.current.x = dragRef.current.startPanX + dx;
      panRef.current.y = dragRef.current.startPanY + dy;

      // Clamp panning so we don't drift into blank space (feels like disappearing images).
      const w = Math.max(1, stage.clientWidth);
      const h = Math.max(1, stage.clientHeight);
      const zoom = zoomRef.current;
      const b = getPanBounds(w, h, zoom);
      panRef.current.x = clamp(panRef.current.x, b.minX, b.maxX);
      panRef.current.y = clamp(panRef.current.y, b.minY, b.maxY);

      requestDraw();
    };

    const onPointerUp = () => {
      dragRef.current.dragging = false;
    };

    const onWheel = (e) => {
      e.preventDefault();

      const w = Math.max(1, stage.clientWidth);
      const h = Math.max(1, stage.clientHeight);
      const zoom = zoomRef.current;

      // Trackpad pinch typically comes through as ctrlKey + wheel on most browsers.
      // ctrlKey => zoom, otherwise => pan.
      if (e.ctrlKey) {
        const rect = stage.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;

        // world point under cursor
        const wx = (mx - panRef.current.x) / zoom;
        const wy = (my - panRef.current.y) / zoom;

        const factor = Math.exp(-e.deltaY * 0.0015);
        const nextZoom = clamp(zoom * factor, 0.55, 2.2);
        zoomRef.current = nextZoom;

        // Keep cursor world point stable
        panRef.current.x = mx - wx * nextZoom;
        panRef.current.y = my - wy * nextZoom;

        const b = getPanBounds(w, h, nextZoom);
        panRef.current.x = clamp(panRef.current.x, b.minX, b.maxX);
        panRef.current.y = clamp(panRef.current.y, b.minY, b.maxY);
      } else {
        // Pan
        panRef.current.x -= e.deltaX;
        panRef.current.y -= e.deltaY;

        const b = getPanBounds(w, h, zoom);
        panRef.current.x = clamp(panRef.current.x, b.minX, b.maxX);
        panRef.current.y = clamp(panRef.current.y, b.minY, b.maxY);
      }

      requestDraw();
    };

    stage.addEventListener('pointerdown', onPointerDown);
    stage.addEventListener('pointermove', onPointerMove);
    stage.addEventListener('pointerup', onPointerUp);
    stage.addEventListener('pointercancel', onPointerUp);
    stage.addEventListener('wheel', onWheel, { passive: false });

    return () => {
      stage.removeEventListener('pointerdown', onPointerDown);
      stage.removeEventListener('pointermove', onPointerMove);
      stage.removeEventListener('pointerup', onPointerUp);
      stage.removeEventListener('pointercancel', onPointerUp);
      stage.removeEventListener('wheel', onWheel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layout.width, layout.height]);

  return (
    <CanvasStage ref={stageRef}>
      <CanvasEl ref={canvasRef} />
    </CanvasStage>
  );
}

function Gallery() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [blocks, setBlocks] = useState([]);

  useRegisterLoading('gallery', loading);

  useEffect(() => {
    async function fetchGallery() {
      try {
        setLoading(true);
        setError(null);
        setBlocks([]);

        const groupSlug = 'sjwilliams-world';
        const sessionKey = 'galleryLoaded';
        const isInitialLoad = !sessionStorage.getItem(sessionKey);
        const headers = isInitialLoad ? { 'Cache-Control': 'no-cache' } : {};

        const channels = await fetchGroupChannelsPage1(groupSlug, { headers });
        const galleryChannel = (channels || []).find(
          (ch) => String(ch?.title || '').trim().toLowerCase() === 'gallery'
        );

        if (!galleryChannel?.slug) {
          throw new Error('Gallery channel not found in group.');
        }

        const per = 100;
        let page = 1;
        const all = [];
        while (true) {
          const res = await fetch(
            apiUrl(`/api/arena/channels/${galleryChannel.slug}/contents?per=${per}&page=${page}`),
            { headers }
          );
          if (!res.ok) throw new Error(`Failed to fetch gallery contents: ${res.status}`);

          const data = await res.json();
          const contents = Array.isArray(data) ? data : (data.contents || []);
          if (!Array.isArray(contents) || contents.length === 0) break;

          all.push(...contents);
          if (contents.length < per) break;
          page += 1;
        }

        setBlocks(all);
        sessionStorage.setItem(sessionKey, 'true');
      } catch (err) {
        setError(err.message || 'Failed to load Gallery');
      } finally {
        setLoading(false);
      }
    }

    fetchGallery();
  }, []);

  const images = useMemo(() => {
    return (blocks || [])
      .map((b) => ({
        id: b?.id,
        title: b?.title || 'gallery image',
        ...getImageUrls(b),
        ...(getBestDims(b) ? { width: getBestDims(b).w, height: getBestDims(b).h } : {}),
      }))
      .filter((x) => !!(x.thumb || x.display || x.original));
  }, [blocks]);

  if (loading) return null;
  if (error) return null;

  return (
    <Wrapper id="gallery">
      <GalleryCanvas images={images} />
    </Wrapper>
  );
}

export default Gallery;

