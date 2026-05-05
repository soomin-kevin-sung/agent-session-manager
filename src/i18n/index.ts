import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import ko from "./locales/ko.json";
import en from "./locales/en.json";

const savedLanguage = localStorage.getItem("language");
const systemLanguage = navigator.language.startsWith("ko") ? "ko" : "en";
const initialLanguage =
  savedLanguage === "ko" || savedLanguage === "en" ? savedLanguage : systemLanguage;

i18n.use(initReactI18next).init({
  resources: {
    ko: { translation: ko },
    en: { translation: en },
  },
  lng: initialLanguage,
  fallbackLng: "en",
  interpolation: { escapeValue: false },
});

export default i18n;
