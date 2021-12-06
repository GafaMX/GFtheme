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

    get(key) {
        if (key) {
            let strings = this.getLanguageObject();
            return strings[key] ? strings[key] : '';
        }

        return '';
    },

    getLanguageObject() {
        let lang = this.language;

        let languages = {
            'ES': Strings_ES,
            'EN': Strings_EN,
        };

        return languages[lang];
    }
};

export default StringStore;