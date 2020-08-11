import GafaThemeSDK from "./components/GafaThemeSDK";
import GafaFitSDKWrapper from "./components/utils/GafaFitSDKWrapper";


// if(!jQuery){
//     import jQuery from 'jquery';
//     window.jQuery = window.$ = jQuery;
// }

window.GFThemeOptions = JSON.parse(document.querySelector('[data-gf-options]').innerHTML);

GafaFitSDKWrapper.initValues(
   () => {
      GafaThemeSDK.renderLogin('[data-gf-theme="login"]');
      GafaThemeSDK.renderRegister('[data-gf-theme="register"]');
      GafaThemeSDK.renderPasswordRecovery('[data-gf-theme="password-recovery"]');
      GafaThemeSDK.renderProfileUserInfo('[data-gf-theme="profile-info"]');
      GafaThemeSDK.renderLoginRegister('[data-gf-theme="login-register"]');

      GafaThemeSDK.renderStaffList('[data-gf-theme="staff-list"][data-gf-perpage]');
      GafaThemeSDK.renderStaffListWithoutPagination('[data-gf-theme="staff-list"]:not([data-gf-perpage])');

      GafaThemeSDK.renderServiceList('[data-gf-theme="service-list"][data-gf-perpage]');
      GafaThemeSDK.renderServiceListWithoutPagination('[data-gf-theme="service-list"]:not([data-gf-perpage])');

      GafaThemeSDK.renderComboList('[data-gf-theme="combo-list"][data-gf-perpage]');
      GafaThemeSDK.renderComboListWithFilter('[data-gf-theme="combo-list"][data-gf-filterbyname]');
      GafaThemeSDK.renderComboListWithoutPagination('[data-gf-theme="combo-list"]:not([data-gf-perpage]):not([data-gf-filterbyname])');

      GafaThemeSDK.renderMembershipList('[data-gf-theme="membership-list"][data-gf-perpage]');
      GafaThemeSDK.renderMembershipListWithoutPagination('[data-gf-theme="membership-list"]:not([data-gf-perpage]');

      GafaThemeSDK.renderMeetingsCalendar('[data-gf-theme="meetings-calendar"]');
   //   GafaThemeSDK.renderMeetingsCalendarWithoutLimit('[data-gf-theme="meetings-calendar"]:not([data-gf-limit]');

      GafaThemeSDK.renderLocationsFilter('[data-gf-theme="locations-filter"]');
   }
);

function handler(target, event){
   while(document.querySelector('[data-gf-theme="fancy"]').firstChild)
      document.querySelector('[data-gf-theme="fancy"]').removeChild(document.querySelector('[data-gf-theme="fancy"]').firstChild);

   event.preventDefault();
};

document.addEventListener('click', function(e) {
   for (var target = e.target; target && target != this; target = target.parentNode) {
      if (target.matches("#CreateReservationFancyTemplate--Close")) {
         handler(target, e);
         break;
      }
   }
}, false);
