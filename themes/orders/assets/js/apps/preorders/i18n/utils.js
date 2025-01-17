import en from "./en.json";
import it from "./it.json";
import es from "./es.json";
import de from "./de.json";
import fr from "./fr.json";

const languages = {
  it: it,
  en: en,
  es: es,
  de: de,
  fr: fr,
};

function getPreferredLanguage() {
  return navigator.language.substring(0, 2);
}

function translate(preferredLanguage) {
  preferredLanguage = getPreferredLanguage();
  return function translate(str) {
    if (languages[preferredLanguage]) {
      return languages[preferredLanguage][str];
    } else {
      return en[str];
    }
  };
}

let t = translate();
export { t as translate };
