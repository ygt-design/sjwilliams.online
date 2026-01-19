import { useEffect, useRef } from 'react';
import styled from 'styled-components';
import { GridColumn, media, theme } from '../../styles';

const steveHeadUrl = new URL('../../assets/modal/steveHead.glb', import.meta.url).href;

const ModelCard = styled.div`
  width: 100%;
  height: 70vh;
  min-height: 520px;
  max-height: 820px;
  background: ${theme.colors.background};
  overflow: hidden;
`;

const ModelViewer = styled('model-viewer')`
  width: 100%;
  height: 100%;
  display: block;
  background: transparent;
  pointer-events: none;
`;

const ModelColumn = styled(GridColumn)`
  align-self: start;

  ${media.tablet} {
    position: sticky;
    top: 120px;
    grid-row: 1 / span 2;
  }

  ${media.desktop} {
    position: sticky;
    top: 120px;
  }
`;

function SteveHeadModel() {
  const viewerRef = useRef(null);
  const rafRef = useRef(null);

  useEffect(() => {
    const mv = viewerRef.current;
    if (!mv) return;

    const MAX_DEG = 50;
    const PERIOD_MS = 6000; // full -90 -> +90 -> -90 loop
    const start = performance.now();

    const tick = () => {
      const t = (performance.now() - start) / PERIOD_MS; // cycles
      const angle = Math.sin(t * Math.PI * 2) * MAX_DEG;
      // orientation: x y z
      mv.setAttribute('orientation', `0deg 0deg ${angle.toFixed(2)}deg`);
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, []);

  return (
    <ModelColumn span={4} tabletStart={1} tabletSpan={6}>
      <ModelCard>
        <ModelViewer
          ref={viewerRef}
          src={steveHeadUrl}
          alt="Steve head 3D model"
          disable-zoom
          interaction-prompt="none"
          exposure="1"
        />
      </ModelCard>
    </ModelColumn>
  );
}

export default SteveHeadModel;

