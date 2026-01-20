import { useEffect, useMemo, useRef, useState } from 'react';
import styled from 'styled-components';
import { GridContainer, GridColumn, theme } from '../styles';
import StickerOverlay from '../pages/homepage/StickerOverlay';
import { useRegisterLoading } from '../loading/LoadingContext';
import { apiUrl } from '../api/apiBase';

const Viewport = styled.div`
  box-sizing: border-box;
  position: relative;
  height: 100vh;
  overflow: hidden;

  @media (max-width: 768px) {
    height: auto;
    overflow: visible;
    min-height: auto;
    padding-top: 120px;
    padding-bottom: 80px;
  }
`;

const CaseGrid = styled(GridContainer)`
  height: 100%;
  min-height: 0;
  align-items: stretch;
  grid-template-rows: minmax(0, 1fr);

  @media (max-width: 768px) {
    height: auto;
    min-height: auto;
    grid-template-rows: initial;
  }
`;

const LeftPane = styled.div`
  box-sizing: border-box;
  align-self: start;
  position: sticky;
  top: 0;
  height: 100%;
  overflow: hidden;
  padding-top: 120px;
  padding-bottom: 24px;

  @media (max-width: 768px) {
    height: auto;
    overflow: visible;
    min-height: auto;
    margin-bottom: 24px;
    position: static;
    padding-top: 0;
    padding-bottom: 0;
  }
`;

const RightPane = styled.div`
  box-sizing: border-box;
  height: 100%;
  min-height: 0;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  padding-top: 120px;
  padding-bottom: 24px;

  @media (max-width: 768px) {
    height: auto;
    overflow: visible;
    min-height: auto;
    padding-top: 0;
    padding-bottom: 0;
  }
`;

const Meta = styled.div`
  font-family: ${theme.typography.fontFamilyMono};
  height: 100%;
  display: flex;
  flex-direction: column;
`;

const MetaSection = styled.div`
  margin-bottom: 16px;
`;

const WrittenSection = styled(MetaSection)`
  margin-top: auto;
  margin-bottom: 0;
`;

const MetaValue = styled.div`
  font-size: 14px;
  line-height: 1.5;
  white-space: pre-wrap;
`;

const MetaGridRow = styled.div`
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
  align-items: start;
  margin-bottom: 25px;
`;

const MediaStack = styled.div`
  display: flex;
  flex-direction: column;
  gap: 24px;
`;

const MediaCard = styled.div`
  font-family: ${theme.typography.fontFamilyMono};
`;

const TextBlock = styled.div`
  font-size: 14px;
  line-height: 1.5;
  white-space: pre-wrap;
`;

const BlockImage = styled.img`
  width: 100%;
  height: auto;
  display: block;
  object-fit: contain;
  object-position: top;
`;

const TitleImage = styled(BlockImage)`
  max-height: 250px;
`;

const VideoEmbed = styled.iframe`
  width: 100%;
  aspect-ratio: 16 / 9;
  border: 0;
  display: block;
`;

function getImageUrl(block) {
  return (
    block?.image?.display?.url ||
    block?.image?.original?.url ||
    block?.image?.thumb?.url ||
    null
  );
}

function normalizeContentsResponse(data) {
  const title = data?.title || data?.channel?.title || '';
  const contents = Array.isArray(data) ? data : (data?.contents || []);
  return { title, contents };
}

function normalizeTitle(str) {
  return String(str || '').trim().toLowerCase();
}

function firstByTitle(blocks, wanted) {
  const w = normalizeTitle(wanted);
  return (blocks || []).find((b) => normalizeTitle(b?.title) === w) || null;
}

function allByTitle(blocks, wanted) {
  const w = normalizeTitle(wanted);
  return (blocks || []).filter((b) => normalizeTitle(b?.title) === w);
}

function bestText(block) {
  if (!block) return '';
  const c = block?.content;
  if (typeof c === 'string' && c.trim()) return c.trim();
  if (c && typeof c === 'object') {
    const plain = typeof c.plain === 'string' ? c.plain : '';
    const markdown = typeof c.markdown === 'string' ? c.markdown : '';
    if (plain.trim()) return plain.trim();
    if (markdown.trim()) return markdown.trim();
  }
  if (typeof block.title === 'string' && block.title.trim()) return block.title.trim();
  return '';
}

function extractYouTubeUrl(block) {
  const fromSource = block?.source?.url || block?.source_url || '';
  if (fromSource) return fromSource;
  const content = typeof block?.content === 'string' ? block.content : '';
  const m = content.match(/https?:\/\/[^\s]+/);
  return m ? m[0] : '';
}

function toYouTubeEmbedUrl(url) {
  try {
    const u = new URL(url);
    let id = '';

    if (u.hostname === 'youtu.be') {
      id = u.pathname.replace('/', '');
    } else if (u.hostname.includes('youtube.com')) {
      if (u.pathname.startsWith('/embed/')) {
        id = u.pathname.replace('/embed/', '').split('/')[0];
      } else {
        id = u.searchParams.get('v') || '';
      }
    }

    if (!id) return '';

    // autoplay/mute/loop for youtube iframe:
    // loop requires playlist=<videoId>
    const qs = new URLSearchParams({
      autoplay: '1',
      mute: '1',
      loop: '1',
      playlist: id,
      playsinline: '1',
      rel: '0',
    });

    return `https://www.youtube.com/embed/${id}?${qs.toString()}`;
  } catch {
    return '';
  }
}

function CaseStudy({ channelSlug }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [channelTitle, setChannelTitle] = useState('');
  const [blocks, setBlocks] = useState([]);
  const viewportRef = useRef(null);
  const rightPaneRef = useRef(null);

  const safeTitle = useMemo(() => {
    if (channelTitle) return channelTitle;
    return channelSlug ? channelSlug.replace(/-/g, ' ') : 'Case study';
  }, [channelTitle, channelSlug]);

  useRegisterLoading(`case:${channelSlug || 'none'}`, loading);

  useEffect(() => {
    if (!channelSlug) return;

    async function fetchAllContents() {
      try {
        setLoading(true);
        setError(null);
        setBlocks([]);

        const per = 100;
        let page = 1;
        const all = [];

        const sessionKey = `caseStudyLoaded:${channelSlug}`;
        const isInitialLoad = !sessionStorage.getItem(sessionKey);
        const headers = isInitialLoad ? { 'Cache-Control': 'no-cache' } : {};

        while (true) {
          const res = await fetch(
            apiUrl(`/api/arena/channels/${channelSlug}/contents?per=${per}&page=${page}`),
            { headers }
          );
          if (!res.ok) {
            throw new Error(`Failed to fetch case study: ${res.status}`);
          }

          const data = await res.json();
          const normalized = normalizeContentsResponse(data);
          if (page === 1) setChannelTitle(normalized.title || '');

          const pageBlocks = normalized.contents || [];
          if (!Array.isArray(pageBlocks) || pageBlocks.length === 0) break;

          all.push(...pageBlocks);
          if (pageBlocks.length < per) break;
          page += 1;
        }

        setBlocks(all);
        sessionStorage.setItem(sessionKey, 'true');

        // Make sure the right pane is at the top when navigating in.
        if (rightPaneRef.current) rightPaneRef.current.scrollTop = 0;
      } catch (err) {
        setError(err.message || 'Failed to load case study');
      } finally {
        setLoading(false);
      }
    }

    fetchAllContents();
  }, [channelSlug]);

  // Forward wheel/trackpad scrolling to the right pane,
  // so users don't need to hover the media column to scroll.
  useEffect(() => {
    const viewport = viewportRef.current;
    const right = rightPaneRef.current;
    if (!viewport || !right) return;

    const isMobile = window.matchMedia('(max-width: 768px)').matches;
    if (isMobile) return;

    const onWheel = (e) => {
      // If the wheel event started inside the right pane, let it behave normally.
      if (right.contains(e.target)) return;

      e.preventDefault();
      right.scrollTop += e.deltaY;
    };

    viewport.addEventListener('wheel', onWheel, { passive: false });
    return () => viewport.removeEventListener('wheel', onWheel);
  }, [channelSlug]);

  if (!channelSlug) return null;
  if (loading) return null;
  if (error) return null;

  const titleBlock = firstByTitle(blocks, 'Title');
  const nameBlock = firstByTitle(blocks, 'Name');
  const clientBlock = firstByTitle(blocks, 'Client');
  const writtenBlock = firstByTitle(blocks, 'Written');
  const tagBlocks = allByTitle(blocks, 'Tag');

  const titleImageUrl = getImageUrl(titleBlock);
  const tagsValue = tagBlocks
    .map((b) => bestText(b))
    .filter(Boolean)
    .join(', ');

  const coverBlock = firstByTitle(blocks, 'cover');
  const coverUrl = getImageUrl(coverBlock);
  const pictureBlocks = allByTitle(blocks, 'Picture');
  const vidBlocks = allByTitle(blocks, 'vid');

  return (
    <Viewport ref={viewportRef}>
      <StickerOverlay variant="case" />
      <CaseGrid>
        <GridColumn span={4} tabletSpan={6} style={{ minHeight: 0 }}>
          <LeftPane>
            <Meta>
              <MetaSection style={{ marginBottom: 25 }}>
                {titleImageUrl ? (
                  <TitleImage src={titleImageUrl} alt="title" />
                ) : (
                  <MetaValue>{safeTitle}</MetaValue>
                )}
              </MetaSection>

              <MetaGridRow>
                <div>
                  <MetaValue>{bestText(nameBlock)}</MetaValue>
                </div>
                <div>
                  <MetaValue>{bestText(clientBlock)}</MetaValue>
                </div>
                <div>
                  <MetaValue>{tagsValue}</MetaValue>
                </div>
              </MetaGridRow>

              <WrittenSection>
                <MetaValue>{bestText(writtenBlock)}</MetaValue>
              </WrittenSection>
            </Meta>
          </LeftPane>
        </GridColumn>

        <GridColumn span={4} tabletStart={7} tabletSpan={6} style={{ minHeight: 0 }}>
          <RightPane ref={rightPaneRef}>
            <MediaStack>
              {coverUrl ? (
                <MediaCard>
                  <BlockImage src={coverUrl} alt="cover" />
                </MediaCard>
              ) : null}

              {pictureBlocks.map((b) => {
                const url = getImageUrl(b);
                if (!url) return null;
                return (
                  <MediaCard key={b.id}>
                    <BlockImage src={url} alt="picture" />
                  </MediaCard>
                );
              })}

              {vidBlocks.map((b) => {
                const url = extractYouTubeUrl(b);
                const embed = toYouTubeEmbedUrl(url);
                if (!embed) return null;
                return (
                  <MediaCard key={b.id}>
                    <VideoEmbed
                      src={embed}
                      title="YouTube video"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                      allowFullScreen
                    />
                  </MediaCard>
                );
              })}
            </MediaStack>
          </RightPane>
        </GridColumn>
      </CaseGrid>
    </Viewport>
  );
}

export default CaseStudy;
