import { useEffect, useMemo, useState } from 'react';
import styled from 'styled-components';
import { GridContainer, GridColumn, theme } from '../../styles';
import SteveHeadModel from './SteveHeadModel';
import { fetchGroupChannelsPage1 } from '../../api/arenaProxy';
import { useRegisterLoading } from '../../loading/LoadingContext';
import { apiUrl } from '../../api/apiBase';

const Wrapper = styled.div`
  padding-top: 120px;
  padding-bottom: 80px;
`;

const RightColumn = styled.div`
  display: flex;
  flex-direction: column;
  gap: 32px;
`;

const BlockText = styled.div`
  font-family: ${theme.typography.fontFamilyMono};
  font-size: 14px;
  line-height: 1.5;
  white-space: pre-wrap;
`;

const Section = styled.section`
  display: flex;
  flex-direction: column;
  gap: 14px;
`;

const SectionTitle = styled.h3`
  font-family: ${theme.typography.fontFamilyMono};
  font-size: 12px;
  font-weight: 400;
  margin: 0;
  width: fit-content;
  background: rgba(0, 0, 0, 0.1);
  padding: 2px 6px;
`;

const SkillGroupTitle = styled.h4`
  font-family: ${theme.typography.fontFamilyMono};
  font-size: 12px;
  font-weight: 400;
  margin: 0;
  opacity: 0.9;
  width: fit-content;
  background: rgba(0, 0, 0, 0.1);
  padding: 2px 6px;
`;

const BulletList = styled.ul`
  list-style: disc;
  margin: 0;
  padding-left: 30px;
  display: flex;
  flex-direction: column;
  gap: 6px;
`;

const Bullet = styled.li`
  font-family: ${theme.typography.fontFamilyMono};
  font-size: 14px;
  line-height: 1.5;
  white-space: pre-wrap;
  margin-left: 30px;
  &::marker {
    color: ${theme.colors.text};
  }
`;

const BlockLink = styled.a`
  font-family: ${theme.typography.fontFamilyMono};
  font-size: 14px;
  color: ${theme.colors.text};
  text-decoration: underline;
  text-underline-offset: 3px;
`;

const LinksList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
`;

function normalizeTitle(value) {
  return String(value || '').trim().toLowerCase();
}

function getBlockText(block) {
  if (!block) return '';
  if (typeof block?.content === 'string' && block.content.trim()) return block.content;
  if (typeof block?.description === 'string' && block.description.trim()) return block.description;
  return '';
}

function parseMarkdownLinks(text) {
  const out = [];
  const lines = String(text || '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  for (const line of lines) {
    const m = line.match(/^\[([^\]]+)\]\((https?:\/\/[^)]+)\)$/);
    if (m) out.push({ label: m[1], url: m[2] });
  }

  return out;
}

function About() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [blocks, setBlocks] = useState([]);

  useRegisterLoading('about', loading);

  useEffect(() => {
    async function fetchAbout() {
      try {
        setLoading(true);
        setError(null);

        const groupSlug = 'sjwilliams-world';
        const isInitialLoad = !sessionStorage.getItem('aboutLoaded');
        const headers = isInitialLoad ? { 'Cache-Control': 'no-cache' } : {};

        // Find the "About" channel in the group (standardized: per=100&page=1)
        const channels = await fetchGroupChannelsPage1(groupSlug, { headers });
        const aboutChannel = (channels || []).find(
          (ch) => String(ch?.title || '').trim().toLowerCase() === 'about'
        );

        if (!aboutChannel?.slug) {
          throw new Error('About channel not found in group.');
        }

        // Fetch all contents for the About channel (paginated)
        const per = 100;
        const all = [];
        let page = 1;
        while (true) {
          const res = await fetch(
            apiUrl(`/api/arena/channels/${aboutChannel.slug}/contents?per=${per}&page=${page}`),
            { headers }
          );
          if (!res.ok) throw new Error(`Failed to fetch about contents: ${res.status}`);

          const data = await res.json();
          const contents = Array.isArray(data) ? data : (data.contents || []);
          if (!Array.isArray(contents) || contents.length === 0) break;

          all.push(...contents);
          if (contents.length < per) break;
          page += 1;
        }

        setBlocks(all);
        sessionStorage.setItem('aboutLoaded', 'true');
      } catch (err) {
        setError(err.message || 'Failed to load About');
      } finally {
        setLoading(false);
      }
    }

    fetchAbout();
  }, []);

  const aboutText = useMemo(() => {
    const aboutTextBlock = (blocks || []).find(
      (b) => normalizeTitle(b?.title) === 'about text'
    );
    return getBlockText(aboutTextBlock);
  }, [blocks]);

  const clientsLinks = useMemo(() => {
    const clientsBlock = (blocks || []).find((b) => normalizeTitle(b?.title) === 'clients');
    const content = getBlockText(clientsBlock);
    return parseMarkdownLinks(content);
  }, [blocks]);

  if (loading) return null;
  if (error) return null;

  return (
    <Wrapper id="about">
      <GridContainer>
        <SteveHeadModel />

        <GridColumn span={4} tabletStart={7} tabletSpan={6}>
          <RightColumn>
            {!!aboutText && <BlockText>{aboutText}</BlockText>}

            <Section aria-label="Contact">
              <SectionTitle>Contact</SectionTitle>
              <BlockText>
                I am always open to new opportunities and collaborations. Feel free to reach out
                to me via email at{' '}
                <BlockLink href="mailto:sjwilliamsbusiness@yahoo.com">
                  sjwilliamsbusiness@yahoo.com
                </BlockLink>
                .
              </BlockText>
            </Section>

            <Section aria-label="Follow me">
              <SectionTitle>Follow me</SectionTitle>
              <LinksList>
                <BlockLink
                  href="https://www.linkedin.com/authwall?trk=bf&trkInfo=AQF9qJM0niOxfwAAAZvWppUA-JJWSaf_djDqwlJaN__Z2gdQjvYPD_QPgniFV9sDEhfh7t5sELbEXZ6LeHeFS7RMUhK5LjyjXLaL3xf_Kpe10fAsvjGQE95sgHFTInswUkOKx0E=&original_referer=&sessionRedirect=https%3A%2F%2Fwww.linkedin.com%2Fin%2Fsteve-williams-jnr-233b521b4%2F"
                  target="_blank"
                  rel="noreferrer"
                >
                  LinkedIn
                </BlockLink>
                <BlockLink
                  href="https://substack.com/@d3spacitospider"
                  target="_blank"
                  rel="noreferrer"
                >
                  Substack
                </BlockLink>
                <BlockLink
                  href="https://www.instagram.com/sjwilliams_/"
                  target="_blank"
                  rel="noreferrer"
                >
                  Instagram
                </BlockLink>
              </LinksList>
            </Section>

            <Section aria-label="I'm Good at">
              <SectionTitle>I&apos;m Good at:</SectionTitle>

              <div>
                <SkillGroupTitle>Creative + Production Skills</SkillGroupTitle>
                <BulletList>
                  <Bullet>Creative Direction &amp; Consultation</Bullet>
                  <Bullet>Photography (Film &amp; Digital)</Bullet>
                  <Bullet>Video Production &amp; Producing</Bullet>
                  <Bullet>Basic Video Editing (iMovie, Adobe Premiere Pro)</Bullet>
                  <Bullet>Art Direction &amp; Set Styling</Bullet>
                  <Bullet>Deck Creation &amp; Visual Storytelling</Bullet>
                </BulletList>
              </div>

              <div>
                <SkillGroupTitle>Strategy + Marketing</SkillGroupTitle>
                <BulletList>
                  <Bullet>Brand Strategy &amp; Marketing</Bullet>
                  <Bullet>Content Strategy</Bullet>
                  <Bullet>Public Relations &amp; Communications</Bullet>
                  <Bullet>Social Media Campaign Execution</Bullet>
                </BulletList>
              </div>

              <div>
                <SkillGroupTitle>Project + Client Management</SkillGroupTitle>
                <BulletList>
                  <Bullet>Project Management</Bullet>
                  <Bullet>Client &amp; Relationship Management</Bullet>
                  <Bullet>Budgeting &amp; Vendor Coordination</Bullet>
                  <Bullet>Event Planning &amp; Curation</Bullet>
                </BulletList>
              </div>

              <div>
                <SkillGroupTitle>Tech proficiency</SkillGroupTitle>
                <BulletList>
                  <Bullet>Adobe Creative Cloud (Photoshop, InDesign, Illustrator)</Bullet>
                  <Bullet>Figma</Bullet>
                  <Bullet>Canva</Bullet>
                  <Bullet>Microsoft Office Suite</Bullet>
                  <Bullet>iMovie</Bullet>
                  <Bullet>CaptureOne</Bullet>
                  <Bullet>Google Suite</Bullet>
                </BulletList>
              </div>
            </Section>

            {clientsLinks.length > 0 && (
              <Section aria-label="Clients">
                <SectionTitle>Clients</SectionTitle>
                <LinksList>
                  {clientsLinks.map((l) => (
                    <BlockLink key={l.url} href={l.url} target="_blank" rel="noreferrer">
                      {l.label}
                    </BlockLink>
                  ))}
                </LinksList>
              </Section>
            )}
          </RightColumn>
        </GridColumn>
      </GridContainer>
    </Wrapper>
  );
}

export default About;

