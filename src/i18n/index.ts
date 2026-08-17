import { createContext, createElement, ReactNode, useContext, useMemo } from 'react';
import { enUS } from './locales/en-US';
import { zhCN } from './locales/zh-CN';

export type Language = 'zh-CN' | 'en-US';
export type TranslateParams = Record<string, string | number>;
export type Translator = (key: string, params?: TranslateParams) => string;

const dictionaries = {
  'zh-CN': zhCN,
  'en-US': enUS
};

export function createTranslator(language: Language) {
  const dictionary = dictionaries[language] ?? dictionaries['zh-CN'];

  return function t(key: string, params?: TranslateParams) {
    const result = key.split('.').reduce<unknown>((value, part) => {
      if (value && typeof value === 'object' && part in value) {
        return (value as Record<string, unknown>)[part];
      }
      return undefined;
    }, dictionary);

    const template = typeof result === 'string' ? result : key;
    return params ? interpolate(template, params) : template;
  };
}

const fallbackTranslator = createTranslator('zh-CN');

const I18nContext = createContext<Translator>(fallbackTranslator);

export function I18nProvider({ children, language }: { children: ReactNode; language: Language }) {
  const translator = useMemo(() => createTranslator(language), [language]);
  return createElement(I18nContext.Provider, { value: translator }, children);
}

export function useI18n() {
  return useContext(I18nContext);
}

function interpolate(template: string, params: TranslateParams) {
  return Object.entries(params).reduce(
    (text, [key, value]) => text.split(`{{${key}}}`).join(String(value)),
    template
  );
}
