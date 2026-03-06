import styled from 'styled-components';
import { GridColumn, media, theme } from '../../styles';
import selfiesVideo from '../../assets/videos/selfies.mov';

const VideoCard = styled.div`
  width: 100%;
  height: 70vh;
  min-height: 520px;
  max-height: 820px;
  background: ${theme.colors.background};
  overflow: hidden;
`;

const StyledVideo = styled.video`
  width: 100%;
  height: 100%;
  display: block;
  object-fit: cover;
`;

const VideoColumn = styled(GridColumn)`
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
  return (
    <VideoColumn span={4} tabletStart={1} tabletSpan={6}>
      <VideoCard>
        <StyledVideo
          src={selfiesVideo}
          autoPlay
          loop
          muted
          playsInline
        />
      </VideoCard>
    </VideoColumn>
  );
}

export default SteveHeadModel;

