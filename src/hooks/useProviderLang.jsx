// useProviderLang.jsx
//
// Minimal i18n primitive, scoped ONLY to Service Provider-facing pages.
// Deliberately not a general-purpose app-wide i18n system — student and
// faculty pages must never read from this. Mirrors useTheme.jsx's shape
// (same store-backed persistence, same Context + hook pattern) so it
// feels familiar next to the existing Theme switch in Settings.
//
// Persistence: per-device via `store` (same mechanism as Theme), key
// 'providerLang', default 'bn' (Bangla). See PROVIDER_SIDE_CLEANUP_PLAN.md
// "Open question" — localStorage/store chosen over a per-account Firestore
// field to match the existing Theme pattern; revisit if owners report
// needing it to follow them across devices.

import { createContext, useContext, useEffect, useState } from 'react';
import { store } from '../store/store';
import { providerStrings } from '../lib/providerStrings';

const ProviderLangCtx = createContext({
  lang: 'bn',
  setLang: () => {},
  t: (key) => key,
});

export function ProviderLangProvider({ children }) {
  const [lang, setLangState] = useState(() => {
    const saved = store.get('providerLang');
    return saved === 'en' || saved === 'bn' ? saved : 'bn';
  });

  useEffect(() => {
    store.set('providerLang', lang);
  }, [lang]);

  const setLang = (id) => {
    if (id === 'en' || id === 'bn') setLangState(id);
  };

  const t = (key) => {
    const dict = providerStrings[lang] || providerStrings.bn;
    const fallbackDict = providerStrings.bn;
    if (dict[key] !== undefined) return dict[key];
    if (fallbackDict[key] !== undefined) return fallbackDict[key];
    return key;
  };

  return (
    <ProviderLangCtx.Provider value={{ lang, setLang, t }}>
      {children}
    </ProviderLangCtx.Provider>
  );
}

export const useProviderLang = () => useContext(ProviderLangCtx);
