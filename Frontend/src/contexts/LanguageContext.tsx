import React, { createContext, useContext, useState, ReactNode } from 'react';

interface LanguageContextType {
  isArabic: boolean;
  setIsArabic: (value: boolean) => void;
  t: (arabicText: string, englishText: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [isArabic, setIsArabic] = useState(true);

  const t = (arabicText: string, englishText: string) => {
    return isArabic ? arabicText : englishText;
  };

  return (
    <LanguageContext.Provider value={{ isArabic, setIsArabic, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}