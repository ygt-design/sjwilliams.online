/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useMemo, useRef, useState } from 'react';
import styled from 'styled-components';
import { useLoadingContext } from '../loading/LoadingContext';
import { apiUrl } from '../api/apiBase';

const FADE_MS = 450;
const STICKER_SWAP_MS = 260;
const STICKER_FADE_MS = 160;

const STICKERS_CHANNEL_SLUG =
  import.meta.env.VITE_STICKERS_CHANNEL_SLUG || 'stickers-aeb4empugza';
const CACHE_KEY = 'loadingOverlayStickers:v1';

const Overlay = styled.div`
  position: fixed;
  inset: 0;
  width: 100vw;
  /* full viewport so centering is visually correct */
  height: 100vh;
  background: #fff;
  z-index: 999999;
  opacity: ${(p) => (p.$visible ? 1 : 0)};
  transition: opacity ${FADE_MS}ms ease;
  pointer-events: ${(p) => (p.$visible ? 'auto' : 'none')};
`;

const StickerStage = styled.div`
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
`;

const StickerWrap = styled.div`
  position: relative;
  /* small centered sticker "badge" */
  width: 30%;
  height: 30%;
`;

const StickerImg = styled.img`
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: contain;
  opacity: ${(p) => (p.$show ? 1 : 0)};
  transition: opacity ${STICKER_FADE_MS}ms ease;
  will-change: opacity;
  user-select: none;
  -webkit-user-drag: none;
  pointer-events: none;
`;

function getImageUrl(block) {
  return (
    block?.image?.display?.url ||
    block?.image?.original?.url ||
    block?.image?.thumb?.url ||
    null
  );
}

function LoadingOverlay() {
  const { overlayMounted, overlayVisible } = useLoadingContext();
  const [stickerUrls, setStickerUrls] = useState([]);
  const [layerA, setLayerA] = useState('');
  const [layerB, setLayerB] = useState('');
  const [showA, setShowA] = useState(true);

  const didFetchRef = useRef(false);
  const intervalRef = useRef(null);

  const hasStickers = stickerUrls.length > 0;

  const pickRandom = useMemo(() => {
    return () => {
      if (!stickerUrls.length) return '';
      const idx = Math.floor(Math.random() * stickerUrls.length);
      return stickerUrls[idx] || '';
    };
  }, [stickerUrls]);

  // Fetch sticker images once (only while overlay is used).
  useEffect(() => {
    if (!overlayMounted) return undefined;
    if (didFetchRef.current) return undefined;
    didFetchRef.current = true;

    let cancelled = false;

    async function fetchStickers() {
      try {
        const cached = sessionStorage.getItem(CACHE_KEY);
        if (cached) {
          const arr = JSON.parse(cached);
          if (!cancelled && Array.isArray(arr) && arr.length) {
            setStickerUrls(arr);
            return;
          }
        }
      } catch {
        // ignore cache parse errors
      }

      try {
        const res = await fetch(
          apiUrl(
            `/api/arena/channels/${encodeURIComponent(
              STICKERS_CHANNEL_SLUG
            )}/contents?per=100&page=1`
          )
        );
        if (!res.ok) return;
        const data = await res.json();
        const blocksArray = Array.isArray(data) ? data : (data.contents || []);
        const urls = (blocksArray || [])
          .map((b) => getImageUrl(b))
          .filter(Boolean);

        // de-dupe
        const unique = Array.from(new Set(urls));
        if (cancelled || unique.length === 0) return;

        setStickerUrls(unique);
        try {
          sessionStorage.setItem(CACHE_KEY, JSON.stringify(unique));
        } catch {
          // ignore storage quota issues
        }
      } catch {
        // ignore fetch errors; overlay can stay blank
      }
    }

    fetchStickers();
    return () => {
      cancelled = true;
    };
  }, [overlayMounted]);

  // Start rapid cross-fade loop while overlay is mounted.
  useEffect(() => {
    if (!overlayMounted) return undefined;
    if (!hasStickers) return undefined;

    // seed
    if (!layerA) setLayerA(pickRandom());
    if (!layerB) setLayerB(pickRandom());

    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => {
      const next = pickRandom();
      if (!next) return;
      if (showA) {
        setLayerB(next);
        setShowA(false);
      } else {
        setLayerA(next);
        setShowA(true);
      }
    }, STICKER_SWAP_MS);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = null;
    };
  }, [overlayMounted, hasStickers, layerA, layerB, pickRandom, showA]);

  if (!overlayMounted) return null;
  return (
    <Overlay aria-hidden="true" $visible={overlayVisible}>
      <StickerStage>
        <StickerWrap>
          <StickerImg src={layerA || ''} alt="" $show={overlayVisible && showA} />
          <StickerImg src={layerB || ''} alt="" $show={overlayVisible && !showA} />
        </StickerWrap>
      </StickerStage>
    </Overlay>
  );
}

export default LoadingOverlay;

