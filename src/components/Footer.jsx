import styled from 'styled-components';
import { media, theme } from '../styles';

const FooterOuter = styled.footer`
  width: 100%;
  padding: ${theme.spacing.xl} 20px calc(${theme.spacing.xl} + env(safe-area-inset-bottom, 0px));
  /* border-top: 1px solid ${theme.colors.border}; */
  margin-top: ${theme.spacing.xl};
`;

const FooterInner = styled.div`
  max-width: ${theme.grid.maxWidth};
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 10px;
  align-items: flex-start;

  ${media.tablet} {
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
    gap: 20px;
  }
`;

const Line = styled.div`
  font-family: ${theme.typography.fontFamilyMono};
  font-size: 12px;
  line-height: 1.4;
  color: ${theme.colors.textLight};
`;

const Link = styled.a`
  color: ${theme.colors.text};
  text-decoration: none;
  border-bottom: 1px solid transparent;

  &:hover {
    border-bottom-color: ${theme.colors.text};
  }
`;

const ArenaRow = styled(Line)`
  display: inline-flex;
  align-items: center;
  gap: 8px;
`;

  
export default function Footer() {
  return (
    <FooterOuter>
      <FooterInner>
        <Line>
          Designed and developed by{' '}
          <Link href="https://yigit.world" target="_blank" rel="noreferrer">
            Yiğit Toprak
          </Link>
        </Line>
        <ArenaRow>
          <span>
            Powered by{' '}
            <Link href="https://www.are.na" target="_blank" rel="noreferrer">
              <img
                src="https://d2w9rnfcy7mm78.cloudfront.net/9485135/original_10647a43631b7746e4a0821772aefa41.png?1605218631?bc=0" alt="are.na logo"

                style={{ height: '1em', verticalAlign: 'middle' }}
              />
            </Link>
          </span>
        </ArenaRow>
      </FooterInner>
    </FooterOuter>
  );
}

