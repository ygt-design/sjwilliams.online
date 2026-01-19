import styled, { createGlobalStyle } from 'styled-components';

// Breakpoints
export const breakpoints = {
  mobile: '375px',
  tablet: '768px',
  desktop: '1200px',
  wide: '1920px',
};

// Theme tokens
export const theme = {
  colors: {
    primary: '#000000',
    secondary: '#666666',
    background: '#ffffff',
    text: '#000000',
    textLight: '#666666',
    border: '#e0e0e0',
    error: '#ff0000',
  },
  spacing: {
    xs: '4px',
    sm: '8px',
    md: '16px',
    lg: '24px',
    xl: '32px',
    xxl: '48px',
  },
  typography: {
    fontFamily: '"Inter", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    fontFamilyMono: '"JetBrains Mono", monospace',
    fontSize: {
      base: '16px',
      sm: '14px',
      lg: '18px',
      xl: '24px',
      h1: '32px',
      h2: '28px',
      h3: '24px',
      h4: '20px',
    },
    lineHeight: 1.5,
  },
  grid: {
    columns: 12,
    gap: '20px',
    maxWidth: '1470px',
  },
};

// Media query helpers
export const media = {
  mobile: `@media (min-width: ${breakpoints.mobile})`,
  tablet: `@media (min-width: ${breakpoints.tablet})`,
  desktop: `@media (min-width: ${breakpoints.desktop})`,
  wide: `@media (min-width: ${breakpoints.wide})`,
};

// Global styles
export const GlobalStyle = createGlobalStyle`
  @font-face {
    font-family: 'JetBrains Mono';
    src: url('/src/assets/fonts/JetBrainsMono-Regular.ttf') format('truetype');
    font-weight: normal;
    font-style: normal;
    font-display: swap;
  }

  @font-face {
    font-family: 'JetBrains Mono';
    src: url('/src/assets/fonts/JetBrainsMono-Bold.ttf') format('truetype');
    font-weight: bold;
    font-style: normal;
    font-display: swap;
  }

  @font-face {
    font-family: 'JetBrains Mono';
    src: url('/src/assets/fonts/JetBrainsMono-ExtraBold.ttf') format('truetype');
    font-weight: 800;
    font-style: normal;
    font-display: swap;
  }

  *,
  *::before,
  *::after {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
  }

  html {
    font-size: 16px;
    scroll-behavior: smooth;
  }

  body {
    font-family: ${theme.typography.fontFamily};
    font-size: ${theme.typography.fontSize.base};
    line-height: ${theme.typography.lineHeight};
    color: ${theme.colors.text};
    background-color: ${theme.colors.background};
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }

`;

export const GridContainer = styled.div`
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
  max-width: ${theme.grid.maxWidth};
  margin: 0 auto;
  padding: 0 20px;
  width: 100%;

  ${media.tablet} {
    grid-template-columns: repeat(12, 1fr);
    gap: 16px;
    padding: 0 20px;
  }

  ${media.desktop} {
    gap: 20px;
    padding: 0 20px;
  }

  ${media.wide} {
    padding: 0 20px;
  }
`;

export const GridColumn = styled.div`
  grid-column: ${props => {
    if (props.start && props.end) {
      return `${props.start} / ${props.end + 1}`;
    }
    if (props.start) {
      return `${props.start} / span ${props.span || 1}`;
    }
    if (props.span) {
      return `span ${props.span}`;
    }
    return 'span 12';
  }};

  ${media.tablet} {
    grid-column: ${props => {
      if (props.start && props.end) {
        return `${props.start} / ${props.end + 1}`;
      }
      if (props.tabletStart) {
        return `${props.tabletStart} / span ${props.tabletSpan || props.span || 1}`;
      }
      if (props.tabletSpan) {
        return `span ${props.tabletSpan}`;
      }
      if (props.start) {
        return `${props.start} / span ${props.span || 1}`;
      }
      if (props.span) {
        return `span ${props.span}`;
      }
      return 'span 12';
    }};
  }

  ${media.desktop} {
    grid-column: ${props => {
      if (props.start && props.end) {
        return `${props.start} / ${props.end + 1}`;
      }
      if (props.desktopStart) {
        return `${props.desktopStart} / span ${props.desktopSpan || props.span || 1}`;
      }
      if (props.desktopSpan) {
        return `span ${props.desktopSpan}`;
      }
      if (props.tabletStart) {
        return `${props.tabletStart} / span ${props.tabletSpan || props.span || 1}`;
      }
      if (props.tabletSpan) {
        return `span ${props.tabletSpan}`;
      }
      if (props.start) {
        return `${props.start} / span ${props.span || 1}`;
      }
      if (props.span) {
        return `span ${props.span}`;
      }
      return 'span 12';
    }};
  }
`;

export const Description = styled.p`
  font-family: ${theme.typography.fontFamily};
  font-size: ${theme.typography.fontSize.base};
  line-height: ${theme.typography.lineHeight};
  color: ${theme.colors.textLight};
  margin: 0;
`;

