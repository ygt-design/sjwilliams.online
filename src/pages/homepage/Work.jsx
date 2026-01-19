import { useEffect, useMemo, useState } from 'react';
import styled from 'styled-components';
import { theme, GridContainer, GridColumn } from '../../styles';
import { fetchGroupChannelsPage1 } from '../../api/arenaProxy';
import { useRegisterLoading } from '../../loading/LoadingContext';

const WorkContainer = styled.div`
`;

const WorkNavColumn = styled.div`
  position: sticky;
  top: 150px;
  height: fit-content;
  z-index: 10;
  pointer-events: none;
  width: 100%;
`;

const WorkNav = styled.div`
  pointer-events: auto;
  position: relative;
  width: fit-content;
`;

const NavButton = styled.button`
  display: block;
  width: fit-content;
  padding: 0;
  margin-bottom: 5px;
  background: none;
  border: none;
  font-family: ${theme.typography.fontFamilyMono};
  font-size: 12px;
  text-decoration: ${props => props.$active ? 'underline' : 'none'};
  text-underline-offset: 4px;
  cursor: pointer;
  text-align: left;
  color: ${theme.colors.text};
  pointer-events: auto;
  
  &:hover {
    background: rgba(0, 0, 0, 0.1);
  }
`;

const TagFilter = styled.div`
  margin-top: 50px;
`;

const TagFilterHeader = styled.div`
  display: flex;
  align-items: baseline;
  gap: 20px;
  padding-bottom: 4px;
  margin-bottom: 8px;
  border-bottom: 1px solid ${theme.colors.text};
`;

const TagFilterTitle = styled.div`
  font-family: ${theme.typography.fontFamilyMono};
  font-size: 12px;
  opacity: 0.8;
`;

const TagClearButton = styled.button`
  width: fit-content;
  padding: 0;
  background: none;
  border: none;
  font-family: ${theme.typography.fontFamilyMono};
  font-size: 12px;
  cursor: pointer;
  color: ${theme.colors.text};
  opacity: ${props => (props.disabled ? 0.4 : 0.8)};

  &:hover {
    background: rgba(0, 0, 0, 0.1);
  }
`;

const TagList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-height: 50vh;
  overflow: auto;
  padding-right: 6px;
`;

const TagButton = styled.button`
  width: fit-content;
  padding: 0;
  background: none;
  border: none;
  font-family: ${theme.typography.fontFamilyMono};
  font-size: 12px;
  cursor: pointer;
  text-align: left;
  color: ${theme.colors.text};
  text-decoration: ${props => (props.$active ? 'underline' : 'none')};
  text-underline-offset: 3px;

  &:hover {
    background: rgba(0, 0, 0, 0.1);
  }
`;

const WorkContent = styled.div`
  position: relative;
  z-index: 1;
`;

const WorkGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 24px;
  
  @media (max-width: 768px) {
    grid-template-columns: 1fr;
  }
`;

const WorkList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0;
`;

const WorkListCell = styled.div`
  font-family: ${theme.typography.fontFamilyMono};
  font-size: 14px;
  line-height: 1.4;
`;

const WorkListChannelName = styled(WorkListCell)`
  font-family: 'JetBrains Mono', monospace;
`;

const WorkListNumber = styled(WorkListCell)`
  grid-area: num;
`;

const WorkListName = styled(WorkListChannelName)`
  grid-area: name;
`;

const WorkListClient = styled(WorkListCell)`
  grid-area: client;

  @media (max-width: 768px) {
    display: none;
  }
`;

const WorkListTags = styled(WorkListCell)`
  grid-area: tags;
`;

const WorkListRow = styled.div`
  display: grid;
  grid-template-columns: 1fr 3fr 2fr 2fr;
  grid-template-areas: "num name client tags";
  column-gap: 16px;
  border-bottom: 1px solid ${theme.colors.text};
  padding: 15px 0;
  transition: background-color all 500ms ease;
  transition-delay: 500ms;
  cursor: pointer;

  &:first-child {
    border-top: 1px solid ${theme.colors.text};
  }

  &:last-child {
    border-bottom: 1px solid ${theme.colors.text};
  }

  &:hover {
    background-color: ${theme.colors.text};
    color: white;
    transition-delay: 0s;

    ${WorkListCell} {
      color: white;
    }
  }

  @media (max-width: 768px) {
    grid-template-columns: 1fr;
    grid-template-areas:
      "num"
      "name"
      "tags";
    row-gap: 10px;
    padding: 22px 0;
  }
`;

const WorkItem = styled.div`
  position: relative;
  width: 100%;
  height: fit-content;
  overflow: hidden; 
  cursor: pointer;
`;

const WorkImage = styled.img`
  width: 100%;
  height: auto;
  object-fit: contain;
  object-position: top;
  display: block;
`;

const WorkTitle = styled.div`
  margin-top: 12px;
  font-size: 14px;
  line-height: 1.4;
  font-family: ${theme.typography.fontFamilyMono};
`;

const WorkMetaName = styled.div`
  margin-top: 12px;
  font-size: 16px;
  line-height: 1.4;
  font-family: ${theme.typography.fontFamilyMono};
  width: fit-content;
  padding: 2px 4px;
  background: rgba(0, 0, 0, 0.1);
`;

const WorkMetaTags = styled.div`
  margin-top: 4px;
  font-size: 12px;
  line-height: 1.2;
  font-family: ${theme.typography.fontFamilyMono};
  opacity: 0.9;
`;


function getImageUrl(block) {
  return (
    block?.image?.display?.url ||
    block?.image?.original?.url ||
    block?.image?.thumb?.url ||
    null
  );
}

function isWorkChannelTitle(title) {
  const t = (title || "").trimStart();
  return t.startsWith("-") || t.startsWith("—");
}

function stripWorkPrefix(title) {
  const t = (title || "").trimStart();
  return t.replace(/^[-—]\s*/, "").trim();
}

function extractTagsFromBlocks(blocksArray) {
  const out = [];
  const seen = new Set();

  for (const block of blocksArray || []) {
    if (block?.title?.toLowerCase() !== 'tag') continue;
    const content = typeof block?.content === 'string' ? block.content : '';
    const parts = content
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    for (const p of parts) {
      const key = p.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(p);
    }
  }

  return out;
}

function Work() {
  const [workItems, setWorkItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [viewMode, setViewMode] = useState(() => {
    const saved = localStorage.getItem('workViewMode');
    return saved || 'grid';
  });
  const [selectedTags, setSelectedTags] = useState([]);

  useRegisterLoading('work', loading);

  const availableTags = useMemo(() => {
    const byKey = new Map(); // lower -> original
    for (const item of workItems) {
      const tags = Array.isArray(item?.tags) ? item.tags : [];
      for (const t of tags) {
        const normalized = String(t || '').trim();
        if (!normalized) continue;
        const key = normalized.toLowerCase();
        if (!byKey.has(key)) byKey.set(key, normalized);
      }
    }
    return Array.from(byKey.values()).sort((a, b) =>
      a.localeCompare(b, undefined, { sensitivity: 'base' })
    );
  }, [workItems]);

  const filteredWorkItems = useMemo(() => {
    if (!selectedTags.length) return workItems;

    const selected = selectedTags
      .map((t) => String(t || '').trim().toLowerCase())
      .filter(Boolean);

    if (!selected.length) return workItems;

    return workItems.filter((item) => {
      const itemTags = Array.isArray(item?.tags)
        ? item.tags.map((t) => String(t || '').trim().toLowerCase()).filter(Boolean)
        : [];
      return selected.every((t) => itemTags.includes(t));
    });
  }, [selectedTags, workItems]);

  useEffect(() => {
    const CACHE_KEY = 'workItemsCache:v1';

    // Hydrate instantly from cache when returning from CaseStudy
    try {
      const cachedRaw = sessionStorage.getItem(CACHE_KEY);
      if (cachedRaw) {
        const cached = JSON.parse(cachedRaw);
        if (Array.isArray(cached) && cached.length) {
          setWorkItems(cached);
          setLoading(false);
        }
      }
    } catch {
      // ignore cache parse errors
    }

    async function fetchWork({ background = false } = {}) {
      try {
        if (!background) setLoading(true);
        setError(null);

        const groupSlug = 'sjwilliams-world';
        const isInitialLoad = !sessionStorage.getItem('workLoaded');
        const headers = isInitialLoad ? { 'Cache-Control': 'no-cache' } : {};

        async function fetchChannelBlocks(channelSlug) {
          const per = 100;
          let page = 1;
          let coverBlock = null;
          let clientBlock = null;
          const tags = [];
          const tagsSeen = new Set();

          while (true) {
            const contentsRes = await fetch(
              `http://localhost:3001/api/arena/channels/${channelSlug}/contents?per=${per}&page=${page}`,
              { headers }
            );
            if (!contentsRes.ok) {
              console.warn(`Failed to fetch contents for channel ${channelSlug}`);
              return null;
            }

            const contentsData = await contentsRes.json();
            const blocksArray = Array.isArray(contentsData)
              ? contentsData
              : (contentsData.contents || []);

            if (!coverBlock) {
              coverBlock = blocksArray.find(
                (block) => block.title?.toLowerCase() === 'cover' && !!getImageUrl(block)
              ) || null;
            }
            if (!clientBlock) {
              clientBlock = blocksArray.find(
                (block) => block.title?.toLowerCase() === 'client'
              ) || null;
            }
            const pageTags = extractTagsFromBlocks(blocksArray);
            for (const t of pageTags) {
              const key = t.toLowerCase();
              if (tagsSeen.has(key)) continue;
              tagsSeen.add(key);
              tags.push(t);
            }

            // we can stop early if we've found a cover and at least one Tag block
            if (coverBlock && tags.length > 0 && clientBlock) break;
            if (!Array.isArray(blocksArray) || blocksArray.length < per) break;
            page += 1;
          }

          if (!coverBlock) return null;

          return {
            coverBlock,
            clientBlock,
            tags,
          };
        }

        const channelsArray = await fetchGroupChannelsPage1(groupSlug, { headers });
        const workChannels = channelsArray.filter((channel) => isWorkChannelTitle(channel.title));

        // Fetch contents in small batches (concurrency = 3) to avoid bursts.
        async function mapWithConcurrency(items, concurrency, mapper) {
          const out = new Array(items.length);
          let idx = 0;

          async function worker() {
            while (idx < items.length) {
              const i = idx++;
              try {
                out[i] = await mapper(items[i], i);
              } catch {
                out[i] = null;
              }
            }
          }

          const workers = Array.from({ length: Math.max(1, concurrency) }, () => worker());
          await Promise.all(workers);
          return out;
        }

        const items = (await mapWithConcurrency(workChannels, 3, async (channel) => {
          try {
            const blocks = await fetchChannelBlocks(channel.slug);
            if (!blocks) return null;

            return {
              id: channel.id,
              channelSlug: channel.slug,
              channelTitle: channel.title,
              imageUrl: getImageUrl(blocks.coverBlock),
              coverBlockId: blocks.coverBlock.id,
              client: blocks.clientBlock?.content || '',
              tags: Array.isArray(blocks.tags) ? blocks.tags : [],
              tagsLabel: Array.isArray(blocks.tags) ? blocks.tags.join(', ') : '',
            };
          } catch (err) {
            console.warn(`Error fetching contents for channel ${channel.slug}:`, err);
            return null;
          }
        })).filter((item) => item !== null);

        setWorkItems(items);
        sessionStorage.setItem('workLoaded', 'true');
        try {
          sessionStorage.setItem(CACHE_KEY, JSON.stringify(items));
        } catch {
          // ignore storage quota issues
        }
      } catch (err) {
        console.error('Error fetching work:', err);
        setError(err.message || 'Failed to load work');
      } finally {
        if (!background) setLoading(false);
      }
    }

    const hadCache = (() => {
      try {
        const cachedRaw = sessionStorage.getItem(CACHE_KEY);
        const cached = cachedRaw ? JSON.parse(cachedRaw) : null;
        return Array.isArray(cached) && cached.length > 0;
      } catch {
        return false;
      }
    })();

    // Always revalidate on mount, but don't block UI if we already had cached items.
    fetchWork({ background: hadCache });
  }, []);

  if (loading) {
    return null;
  }

  if (error) {
    return <WorkContainer>Error: {error}</WorkContainer>;
  }

  if (workItems.length === 0) {
    return <WorkContainer>No work items found.</WorkContainer>;
  }

  return (
    <GridContainer id="work">
      <GridColumn span={2}>
        <WorkNavColumn>
          <WorkNav>
                  <NavButton
                    $active={viewMode === 'grid'}
                    onClick={() => {
                      setViewMode('grid');
                      localStorage.setItem('workViewMode', 'grid');
                    }}
                  >
                    Grid
                  </NavButton>
                  <NavButton
                    $active={viewMode === 'list'}
                    onClick={() => {
                      setViewMode('list');
                      localStorage.setItem('workViewMode', 'list');
                    }}
                  >
                    List
                  </NavButton>
                  <TagFilter>
                    <TagFilterHeader>
                      <TagFilterTitle>Tags</TagFilterTitle>
                      <TagClearButton
                        type="button"
                        disabled={selectedTags.length === 0}
                        onClick={() => setSelectedTags([])}
                      >
                        Clear
                      </TagClearButton>
                    </TagFilterHeader>

                    <TagList>
                      {availableTags.map((tag) => (
                        <TagButton
                          key={tag}
                          type="button"
                          $active={selectedTags.includes(tag)}
                          onClick={() => {
                            setSelectedTags((prev) =>
                              prev.includes(tag)
                                ? prev.filter((t) => t !== tag)
                                : [...prev, tag]
                            );
                          }}
                        >
                          {tag}
                        </TagButton>
                      ))}
                    </TagList>
                  </TagFilter>
          </WorkNav>
        </WorkNavColumn>
      </GridColumn>
      <GridColumn start={3} span={10}>
        <WorkContent>
          {viewMode === 'grid' ? (
            <WorkGrid>
              {filteredWorkItems.map((item) => {
                const displayTitle = stripWorkPrefix(item.channelTitle) || 'Work item';
                
                return (
                  <WorkItem
                    key={item.id}
                    role="link"
                    tabIndex={0}
                    onClick={() => {
                      window.location.hash = `#case/${item.channelSlug}`;
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        window.location.hash = `#case/${item.channelSlug}`;
                      }
                    }}
                  >
                    <WorkImage src={item.imageUrl} alt={displayTitle} />
                    <WorkMetaName>{displayTitle}</WorkMetaName>
                    <WorkMetaTags>{item.tagsLabel || ''}</WorkMetaTags>
                  </WorkItem>
                );
              })}
            </WorkGrid>
          ) : (
              <WorkList>
                {filteredWorkItems.map((item, index) => {
                  const displayTitle = stripWorkPrefix(item.channelTitle) || 'Work item';
                  const number = String(index + 1).padStart(2, '0');
                  
                  return (
                    <WorkListRow
                      key={item.id}
                      role="link"
                      tabIndex={0}
                      onClick={() => {
                        window.location.hash = `#case/${item.channelSlug}`;
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          window.location.hash = `#case/${item.channelSlug}`;
                        }
                      }}
                    >
                      <WorkListNumber>{number}</WorkListNumber>
                      <WorkListName>{displayTitle}</WorkListName>
                      <WorkListClient>{item.client || ''}</WorkListClient>
                      <WorkListTags>{item.tagsLabel || ''}</WorkListTags>
                    </WorkListRow>
                  );
                })}
              </WorkList>
          )}
        </WorkContent>
      </GridColumn>
      <GridColumn span={1} />
    </GridContainer>
  );
}

export default Work;
