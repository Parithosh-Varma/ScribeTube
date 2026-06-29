import React, { createContext, useContext, useRef, useEffect } from "react";

interface MouseContextType {
  mouseX: React.RefObject<number | null>;
  mouseY: React.RefObject<number | null>;
}

const MouseContext = createContext<MouseContextType>({
  mouseX: { current: 0 },
  mouseY: { current: 0 },
});

export const useMouse = () => useContext(MouseContext);

export function MouseProvider({ children }: { children: React.ReactNode }) {
  const mouseX = useRef<number | null>(0);
  const mouseY = useRef<number | null>(0);

  useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      mouseX.current = event.pageX;
      mouseY.current = event.pageY;
    };
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  return (
    <MouseContext.Provider value={{ mouseX, mouseY }}>
      {children}
    </MouseContext.Provider>
  );
}
