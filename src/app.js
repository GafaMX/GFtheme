import GafaThemeSDK from "./components/GafaThemeSDK";

// Buq SDK
// if(!jQuery){
//     import jQuery from 'jquery';
//     window.jQuery = window.$ = jQuery;
// }
var selection = document.querySelector('[data-gf-options]');

if (selection !== null) {
    window.GFThemeOptions = JSON.parse(document.querySelector('[data-gf-options]').innerHTML);
}
// window.GFThemeOptions = JSON.parse(document.querySelector('[data-gf-options]').innerHTML);

window.GafaThemeSDK = GafaThemeSDK;
window.GFThemeSDK = GafaThemeSDK;

GafaThemeSDK.init(window.GFThemeOptions);
