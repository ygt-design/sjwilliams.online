import { useState, useEffect } from 'react';
import styled from 'styled-components';
import { GridContainer, GridColumn } from '../styles';

const GridVisualizationWrapper = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  pointer-events: none;
  z-index: -1;
`;

const GridColumnVisual = styled.div`
  background: rgba(211, 211, 211, 0.1);
  border: 1px solid rgba(211, 211, 211, 0.2);
  min-height: 100vh;
`;

function GridVisualization() {
  const [columnCount, setColumnCount] = useState(12);

  useEffect(() => {
    const updateColumnCount = () => {
      const isMobile = window.innerWidth < 768;
      setColumnCount(isMobile ? 4 : 12);
    };

    updateColumnCount();
    window.addEventListener('resize', updateColumnCount);
    return () => {
      window.removeEventListener('resize', updateColumnCount);
    };
  }, []);

  return (
    <GridVisualizationWrapper>
      <GridContainer>
        {Array.from({ length: columnCount }, (_, i) => (
          <GridColumnVisual key={i} as={GridColumn} span={1} />
        ))}
      </GridContainer>
    </GridVisualizationWrapper>
  );
}

export default GridVisualization;
