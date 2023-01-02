import Strings_ES from "./Strings_ES";
import Strings_EN from "./Strings_EN";


const StringStore = {
    language: 'ES',
    available_languages: [
        'ES',
        'EN'
    ],
    setLanguage(lang) {
        lang = lang.toUpperCase();
        if (this.available_languages.indexOf(lang) !== -1) {
            this.language = lang;
        }
    },
    getLanguage() {
        return this.language;
    },

    get(key, string_replace = []) {
        let return_string = '';
        if (key) {
            let strings = this.getLanguageObject();
            let keys = key.split('.');
            key = keys[0];
            if (strings[key]) {
                if (keys.length > 1) {
                    let strobject = strings[key];
                    if (typeof strobject === "object") {
                        return_string = strobject[keys[1]] ? strobject[keys[1]] : '';
                    }
                }
                return_string = strings[key] ? strings[key] : '';

                if (string_replace.length) {
                    string_replace.forEach(function (replace) {
                        return_string = return_string.replace('_|_', replace);
                    });
                }
            }
        }

        return typeof return_string==="string" ? return_string : '';
    },

    getLanguageObject() {
        let lang = this.language;

        let languages = {
            'ES': Strings_ES,
            'EN': Strings_EN,
        };

        return languages[lang];
    },

    initLang() {
        let language_element = document.querySelector('[data-gf-language]');
        if (language_element) {
            let lang = language_element.getAttribute('data-gf-language');
            this.setLanguage(lang);
        }
    }
};

export default StringStore;