import React, { createContext, useContext, useState } from 'react';

const TiptapContext = createContext();

export const TiptapProvider = ({ children }) => {
  const [tiptapContent, setTiptapContent] = useState({
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        content: [{ type: 'text', text: 'Edit here...' }],
      },
    ],
  });

  return (
    <TiptapContext.Provider value={{ tiptapContent, setTiptapContent }}>
      {children}
    </TiptapContext.Provider>
  );
};

export const useTiptapContext = () => useContext(TiptapContext);

export default TiptapContext;
