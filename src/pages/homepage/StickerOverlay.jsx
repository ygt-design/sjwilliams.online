import { useEffect, useRef, useState } from "react";
import styled from "styled-components";
import { apiUrl } from "../../api/apiBase";

const Stage = styled.div`
  position: ${(p) => (p.$positioning === "fixed" ? "fixed" : "absolute")};
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  overflow: hidden;
  touch-action: none;
  pointer-events: none;
  z-index: ${(p) => p.$zIndex ?? 1};
`;

const StickerWrapper = styled.div`
  position: absolute;
  pointer-events: auto;
`;

const StickerImg = styled.img`
  width: 100%;
  height: 100%;
  user-select: none;
  -webkit-user-drag: none;
  will-change: transform, left, top;
  display: block;
`;

const PositionLabel = styled.div`
  position: absolute;
  top: -20px;
  right: -25px;
  background: #e6e6e6;
  color: #000;
  padding: 2px 4px;
  font-size: 10px;
  font-family: 'JetBrains Mono', monospace;
  pointer-events: none;
  z-index: 1000;
`;

function pickRandomUnique(arr, n) {
  const copy = [...arr];
  const out = [];
  while (copy.length && out.length < n) {
    const idx = Math.floor(Math.random() * copy.length);
    out.push(copy[idx]);
    copy.splice(idx, 1);
  }
  return out;
}

function clamp(num, min, max) {
  return Math.max(min, Math.min(max, num));
}

function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

function getImageUrl(block) {
  return (
    block?.image?.display?.url ||
    block?.image?.original?.url ||
    block?.image?.thumb?.url ||
    null
  );
}

// Prefer using the channel slug directly (no group lookup).
// Set `VITE_STICKERS_CHANNEL_SLUG` to the slug from the Are.na channel URL.
const STICKERS_CHANNEL_SLUG =
  import.meta.env.VITE_STICKERS_CHANNEL_SLUG || "stickers-aeb4empugza";

const HOME_SPAWN_POINTS = [
  { xPercent: 20, yPercent: 15 },
  { xPercent: 70, yPercent: 25 },
  { xPercent: 58, yPercent: 60 },
];

const MOBILE_HOME_SPAWN_POINTS_PX = [
  { x: 36, y: 167 },
  { x: 226, y: 235 },
  { x: 135, y: 583 },
];

function layoutStickers(imageBlocks, vw, vh, variant, { isMobile = false } = {}) {
  const base = Math.min(vw, vh);

  return imageBlocks.map((block, i) => {
    const url = getImageUrl(block);

    const scale = randomBetween(0.65, 0.95);
    const size = clamp(base * 0.18 * scale, 110, 260);

    const rotation = randomBetween(-30, 30);

    const maxLeft = Math.max(0, vw - size);
    const maxTop = Math.max(0, vh - size);

    let left = 0;
    let top = 0;

    if (variant === "case") {
      const pad = Math.min(60, Math.round(base * 0.06));
      left = clamp(randomBetween(pad, maxLeft - pad), 0, maxLeft);
      top = clamp(randomBetween(pad, maxTop - pad), 0, maxTop);
    } else {
      if (isMobile) {
        const spawn = MOBILE_HOME_SPAWN_POINTS_PX[i % MOBILE_HOME_SPAWN_POINTS_PX.length];
        left = clamp(spawn.x, 0, maxLeft);
        top = clamp(spawn.y, 0, maxTop);
      } else {
        const spawn = HOME_SPAWN_POINTS[i % HOME_SPAWN_POINTS.length];
        left = clamp((vw * spawn.xPercent) / 100, 0, maxLeft);
        top = clamp((vh * spawn.yPercent) / 100, 0, maxTop);
      }
    }

    return {
      id: block.id,
      title: block.title || "sticker",
      url,
      size,
      left,
      top,
      rotation,
      zIndex: 10 + i,
      spawnIndex: i + 1,
    };
  });
}

function StickerOverlay({ variant = "home" } = {}) {
  const [stickers, setStickers] = useState([]);
  const [imageBlocks, setImageBlocks] = useState([]);
  const [error, setError] = useState(null);
  const [draggingId, setDraggingId] = useState(null);
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia?.("(max-width: 768px)")?.matches ?? window.innerWidth <= 768;
  });

  const stageRef = useRef(null);
  const zCounterRef = useRef(100);
  const dragRef = useRef({
    activeId: null,
    offsetX: 0,
    offsetY: 0,
  });

  const didFetchRef = useRef(false);

  useEffect(() => {
    const mq = window.matchMedia?.("(max-width: 768px)");
    const update = () => setIsMobile(mq?.matches ?? window.innerWidth <= 768);
    update();
    if (!mq) {
      window.addEventListener("resize", update);
      return () => window.removeEventListener("resize", update);
    }
    mq.addEventListener?.("change", update);
    return () => mq.removeEventListener?.("change", update);
  }, []);

  useEffect(() => {
    if (didFetchRef.current) return;
    didFetchRef.current = true;

    // No stickers on mobile case study.
    if (variant === "case" && isMobile) return;

    async function fetchStickers() {
      try {
        setError(null);

        const isInitialLoad = !sessionStorage.getItem('stickersLoaded');
        const headers = isInitialLoad ? { 'Cache-Control': 'no-cache' } : {};
        
        const contentsRes = await fetch(
          apiUrl(
            `/api/arena/channels/${encodeURIComponent(
              STICKERS_CHANNEL_SLUG
            )}/contents?per=100&page=1`
          ),
          { headers }
        );
        if (!contentsRes.ok) {
          throw new Error(`Failed to fetch contents: ${contentsRes.status}`);
        }
        const contentsData = await contentsRes.json();
        const blocksArray = Array.isArray(contentsData) ? contentsData : (contentsData.contents || []);
        const imagesOnly = blocksArray.filter((b) => !!getImageUrl(b));

        if (imagesOnly.length < 3) {
          throw new Error("Not enough image stickers in the channel (need at least 3).");
        }

        setImageBlocks(imagesOnly);
        sessionStorage.setItem('stickersLoaded', 'true');
      } catch (err) {
        console.error(err);
        setError(err.message || "Failed to load stickers");
      }
    }

    fetchStickers();
  }, [variant, isMobile]);

  useEffect(() => {
    if (variant === "case" && isMobile) return;
    if (imageBlocks.length === 0) return;

    const rect = stageRef.current?.getBoundingClientRect?.();
    const vw = rect?.width ? Math.round(rect.width) : window.innerWidth;
    const vh = rect?.height ? Math.round(rect.height) : window.innerHeight;

    const chosen = pickRandomUnique(imageBlocks, 3);
    const laidOut = layoutStickers(chosen, vw, vh, variant, {
      isMobile: variant === "home" && isMobile,
    });

    setStickers(laidOut.filter((s) => !!s.url));
  }, [imageBlocks, variant, isMobile]);

  useEffect(() => {
    function onResize() {
      if (variant === "case" && isMobile) return;
      const rect = stageRef.current?.getBoundingClientRect?.();
      const vw = rect?.width ? Math.round(rect.width) : window.innerWidth;
      const vh = rect?.height ? Math.round(rect.height) : window.innerHeight;

      setStickers((prev) =>
        prev.map((s) => {
          const maxLeft = Math.max(0, vw - s.size);
          const maxTop = Math.max(0, vh - s.size);
          return {
            ...s,
            left: clamp(s.left, 0, maxLeft),
            top: clamp(s.top, 0, maxTop),
          };
        })
      );
    }

    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [variant, isMobile]);

  useEffect(() => {
    function onPointerMove(e) {
      if (variant === "case" && isMobile) return;
      const activeId = dragRef.current.activeId;
      if (!activeId) return;

      const stage = stageRef.current;
      if (!stage) return;

      const rect = stage.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      setStickers((prev) =>
        prev.map((s) => {
          if (s.id !== activeId) return s;

          const newLeft = x - dragRef.current.offsetX;
          const newTop = y - dragRef.current.offsetY;

          const maxLeft = Math.max(0, rect.width - s.size);
          const maxTop = Math.max(0, rect.height - s.size);

          return {
            ...s,
            left: clamp(newLeft, 0, maxLeft),
            top: clamp(newTop, 0, maxTop),
          };
        })
      );
    }

    function onPointerUp() {
      dragRef.current.activeId = null;
      setDraggingId(null);
    }

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerUp);

    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);
    };
  }, [variant, isMobile]);

  function startDrag(e, stickerId) {
    if (variant === "case" && isMobile) return;
    const stage = stageRef.current;
    if (!stage) return;

    const nextZ = ++zCounterRef.current;
    setStickers((prev) =>
      prev.map((s) => (s.id === stickerId ? { ...s, zIndex: nextZ } : s))
    );

    const rect = stage.getBoundingClientRect();
    const pointerX = e.clientX - rect.left;
    const pointerY = e.clientY - rect.top;

    const s = stickers.find((st) => st.id === stickerId);
    if (!s) return;

    dragRef.current.activeId = stickerId;
    dragRef.current.offsetX = pointerX - s.left;
    dragRef.current.offsetY = pointerY - s.top;
    setDraggingId(stickerId);

    e.currentTarget.setPointerCapture?.(e.pointerId);
  }

  if (error) return null;
  if (variant === "case" && isMobile) return null;

  return (
    <Stage
      ref={stageRef}
      $positioning={variant === "case" ? "fixed" : "absolute"}
      $zIndex={variant === "case" ? 50 : 1}
    >
      {stickers.map((s) => (
        <StickerWrapper
          key={s.id}
          onPointerDown={(e) => startDrag(e, s.id)}
          style={{
            width: `${s.size}px`,
            height: `${s.size}px`,
            left: `${s.left}px`,
            top: `${s.top}px`,
            zIndex: s.zIndex,
            transform: `rotate(${s.rotation}deg)`,
          }}
        >
          <StickerImg 
            src={s.url} 
            alt={s.title} 
            draggable={false}
            style={{
              cursor: draggingId === s.id ? 'grabbing' : 'grab'
            }}
          />
          {variant === "home" ? (
            <PositionLabel>
              x: {Math.round(s.left)}<br />
              y: {Math.round(s.top)}
            </PositionLabel>
          ) : null}
        </StickerWrapper>
      ))}
    </Stage>
  );
}

export default StickerOverlay;