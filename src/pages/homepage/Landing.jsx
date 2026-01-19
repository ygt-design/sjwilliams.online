import styled from 'styled-components';
import LandingCanvas from './LandingCanvas';
import StickerOverlay from './StickerOverlay';
import { theme } from '../../styles';

const LandingContainer = styled.div`
  width: 100vw;
  height: 100vh;
  min-height: 100vh;
  /* iOS Safari URL/search bar safe viewport (avoid dvh) */
  @supports (height: 100svh) {
    height: 100svh;
    min-height: 100svh;
  }
  /* Older iOS Safari fallback */
  @supports (-webkit-touch-callout: none) {
    height: -webkit-fill-available;
    min-height: -webkit-fill-available;
  }
  /* outline: 0.25px solid black; */
  position: relative;
`;

const BottomText = styled.p`
  position: absolute;
  bottom: calc(50px + env(safe-area-inset-bottom, 0px));
  left: 50%;
  transform: translateX(-50%);
  text-align: center;
  font-family: ${theme.typography.fontFamilyMono};
  font-size: 16px;
  color: ${theme.colors.text};
  margin: 0;
  padding: 0 20px;
  max-width: 800px;
  width: calc(100% - 40px);

  @media (max-width: 768px) {
    font-size: 14px;
    bottom: calc(30px + env(safe-area-inset-bottom, 0px));
    padding: 0 16px;
    width: calc(100% - 32px);
  }

  @media (max-width: 480px) {
    font-size: 12px;
    bottom: calc(20px + env(safe-area-inset-bottom, 0px));
    padding: 0 12px;
    width: calc(100% - 24px);
  }
`;

function Landing() {
  return (
    <LandingContainer id="home">
      <LandingCanvas />
      <StickerOverlay />
      <BottomText>
        Hi, my name is Steve, some refer to me as Sj and I'm a Ghanaian Toronto-based creative professional. I've been doing this for almost 10 years now hehe :)
      </BottomText>
    </LandingContainer>
  );
}

export default Landing;
