import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';

/**
 * Visual skin, independent of the light/dark `data-theme` in ThemeContext.
 *   paper -- the original editorial paper look (default)
 *   board -- the BoardUI look (neutral surfaces, Inter, accent gradient)
 * Purely presentational: it sets `data-skin` on <html>, and src/styles/board-skin.css
 * redefines the colour tokens under `[data-skin="board"]`. index.html applies the saved
 * value before React mounts so a Board user never sees a paper frame on refresh.
 */
export type Skin = 'paper' | 'board';

const SKIN_STORAGE_KEY = 'alphaboard-skin';

interface SkinContextType {
  skin: Skin;
  setSkin: (skin: Skin) => void;
}

const SkinContext = createContext<SkinContextType | undefined>(undefined);

function readSavedSkin(): Skin {
  try {
    return localStorage.getItem(SKIN_STORAGE_KEY) === 'board' ? 'board' : 'paper';
  } catch {
    return 'paper';
  }
}

export function SkinProvider({ children }: { children: ReactNode }) {
  const [skin, setSkinState] = useState<Skin>(readSavedSkin);

  useEffect(() => {
    document.documentElement.setAttribute('data-skin', skin);
    try {
      localStorage.setItem(SKIN_STORAGE_KEY, skin);
    } catch {
      // Private mode / blocked storage: the skin still applies for this visit.
    }
  }, [skin]);

  const setSkin = useCallback((next: Skin) => setSkinState(next), []);

  return <SkinContext.Provider value={{ skin, setSkin }}>{children}</SkinContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components -- the hook belongs beside its provider (same shape as ThemeContext)
export function useSkin() {
  const context = useContext(SkinContext);
  if (context === undefined) {
    throw new Error('useSkin must be used within a SkinProvider');
  }
  return context;
}
