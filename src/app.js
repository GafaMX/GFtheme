import GafaThemeSDK from "./components/GafaThemeSDK";
import GafaFitSDKWrapper from "./components/utils/GafaFitSDKWrapper";

var selection = document.querySelector('[data-gf-options]');

if (selection !== null) {
   window.GFThemeOptions = JSON.parse(document.querySelector('[data-gf-options]').innerHTML);
}



GafaFitSDKWrapper.initValues(
   () => {
      if(typeof gafa === 'undefined'){
         GafaThemeSDK.renderLogin('[data-gf-theme="login"]');
         GafaThemeSDK.renderRegister('[data-gf-theme="register"]');
         GafaThemeSDK.renderPasswordRecovery('[data-gf-theme="password-recovery"]');
         GafaThemeSDK.renderLoginRegister('[data-gf-theme="login-register"]');
         GafaThemeSDK.renderProfileUserInfo('[data-gf-theme="profile-info"]');
      } else {
         // Render créditos
         GafaThemeSDK.renderProfileWallet('[data-gf-theme="profile-wallet"]');
   
         // Render clases futuras
         GafaThemeSDK.renderFutureClasses('[data-gf-theme="future-classes"]');
         
         // Render clases pasadas
         GafaThemeSDK.renderPastClasses('[data-gf-theme="past-classes"]');
         
         // Render compras realizadas
         GafaThemeSDK.renderPurchaseList('[data-gf-theme="purchase-list"]');
      }

      // Render miembros de staff
      GafaThemeSDK.renderStaffList('[data-gf-theme="staff-list"]');
      
      // Render lista de servicios
      GafaThemeSDK.renderServiceList('[data-gf-theme="service-list"]');
      
      // Render lista de paquetes
      GafaThemeSDK.renderComboList('[data-gf-theme="combo-list"]');
      
      // Render lista de membresías
      GafaThemeSDK.renderMembershipList('[data-gf-theme="membership-list"]');
      
      // Render calendario
      GafaThemeSDK.renderMeetingsCalendar('[data-gf-theme="meetings-calendar"]');

      const fancy = document.querySelector('[data-gf-theme="fancy"]');
      fancy.innerHTML = '<div class="spinner"><div class="bounce1"></div><div class="bounce2"></div><div class="bounce3"></div></div>';
   }
);
