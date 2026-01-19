import { createRoot } from 'react-dom/client';
import { GlobalStyle } from './styles';
import App from './App.jsx';

createRoot(document.getElementById('root')).render(
  <>
    <GlobalStyle />
    <App />
  </>,
);
