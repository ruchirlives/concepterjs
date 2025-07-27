import React, { createContext, useContext } from 'react';

const FlowMenuContext = createContext({
  handleNodeMenu: () => {},
  handleEdgeMenu: () => {},
});

export const FlowMenuProvider = ({ handleNodeMenu, handleEdgeMenu, children }) => (
  <FlowMenuContext.Provider value={{ handleNodeMenu, handleEdgeMenu }}>
    {children}
  </FlowMenuContext.Provider>
);

export const useFlowMenu = () => useContext(FlowMenuContext);

export default FlowMenuContext;
