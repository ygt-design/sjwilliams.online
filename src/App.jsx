import { useState, useEffect } from 'react';
import { ThemeProvider } from 'styled-components';
import { GridContainer, GridColumn, theme } from './styles';
import GridVisualization from './components/GridVisualization';
// import ChannelList from './components/ChannelList';
import Navbar from './components/Navbar';
import LoadingOverlay from './components/LoadingOverlay';
import { LoadingProvider } from './loading/LoadingContext';
import Landing from './pages/homepage/Landing';
import Work from './pages/homepage/Work';
import CaseStudy from './components/CaseStudy';
import About from './pages/about/About';
import Gallery from './pages/gallery/Gallery';
import Footer from './components/Footer';

function App() {
  const [showGrid, setShowGrid] = useState(false);
  const [caseSlug, setCaseSlug] = useState(null);
  const [route, setRoute] = useState('home'); // home | about | gallery | case

  useEffect(() => {
    const handleKeyPress = (event) => {
      if (event.key === 'g' || event.key === 'G') {
        setShowGrid((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => {
      window.removeEventListener('keydown', handleKeyPress);
    };
  }, []);

  useEffect(() => {
    const parseHash = () => {
      const hash = window.location.hash || '';

      // Case study route: #case/<channel-slug>
      if (hash.startsWith('#case/')) {
        const slug = hash.slice('#case/'.length).trim();
        setCaseSlug(slug || null);
        setRoute(slug ? 'case' : 'home');
        return;
      }

      if (hash === '#about') {
        setCaseSlug(null);
        setRoute('about');
        return;
      }

      if (hash === '#gallery') {
        setCaseSlug(null);
        setRoute('gallery');
        return;
      }

      setCaseSlug(null);
      setRoute('home');

      // In-page anchor route: #home, #work, ...
      if (!hash) return;
      if (!/^#[A-Za-z0-9_-]+$/.test(hash)) return;

      const scrollToHash = () => {
        const element = document.querySelector(hash);
        if (element) {
          element.scrollIntoView({ behavior: 'instant', block: 'start' });
          return true;
        }
        return false;
      };

      if (!scrollToHash()) {
        setTimeout(() => {
          scrollToHash();
        }, 100);
      }
    };

    const initialTimeout = setTimeout(() => {
      parseHash();
    }, 300);

    window.addEventListener('hashchange', parseHash);
    
    return () => {
      clearTimeout(initialTimeout);
      window.removeEventListener('hashchange', parseHash);
    };
  }, []);

  return (
    <ThemeProvider theme={theme}>
      <LoadingProvider>
        {showGrid && <GridVisualization />}
        <Navbar />
        <LoadingOverlay />
        {route === 'case' && caseSlug ? (
          <CaseStudy channelSlug={caseSlug} />
        ) : route === 'about' ? (
          <About />
        ) : route === 'gallery' ? (
          <Gallery />
        ) : (
          <>
            <Landing />
            <Work />
          </>
        )}
        {route !== 'case' && <Footer />}
      </LoadingProvider>
    </ThemeProvider>
  );
}

export default App;
