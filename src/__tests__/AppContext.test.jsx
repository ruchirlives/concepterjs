jest.mock("axios");

import React, { useEffect } from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import { AppProvider, useAppContext } from '../AppContext';

describe('AppContext applyStateVariables', () => {
  it('updates layered state slices when given normalized data', async () => {
    let applyRef = null;

    const TestComponent = () => {
      const { layerOptions, activeLayers, applyStateVariables } = useAppContext();
      useEffect(() => {
        applyRef = applyStateVariables;
      }, [applyStateVariables]);
      return (
        <div data-testid="layers">
          {layerOptions.join(',')}|{activeLayers.join(',')}
        </div>
      );
    };

    await act(async () => {
      render(
        <AppProvider>
          <TestComponent />
        </AppProvider>
      );
    });

    await waitFor(() => expect(typeof applyRef).toBe('function'));

    act(() => {
      applyRef({ layerOptions: ['alpha'], activeLayers: ['alpha'] });
    });

    await waitFor(() => expect(screen.getByTestId('layers').textContent).toBe('alpha|alpha'));
  });
});
