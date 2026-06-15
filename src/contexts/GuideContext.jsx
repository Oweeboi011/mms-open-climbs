import { createContext, useContext, useState } from "react";

const GuideContext = createContext(null);

export function GuideProvider({ children }) {
  const [guideOpen, setGuideOpen] = useState(false);
  return (
    <GuideContext.Provider value={{ guideOpen, setGuideOpen }}>
      {children}
    </GuideContext.Provider>
  );
}

export function useGuide() {
  return useContext(GuideContext);
}
