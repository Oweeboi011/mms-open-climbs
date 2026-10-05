import { createContext, use, useState } from "react";

const GuideContext = createContext(null);

export function GuideProvider({ children }) {
  const [guideOpen, setGuideOpen] = useState(false);
  return (
    <GuideContext value={{ guideOpen, setGuideOpen }}>
      {children}
    </GuideContext>
  );
}

export function useGuide() {
  return use(GuideContext);
}
