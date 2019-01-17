import GafaThemeSDK from "./components/GafaThemeSDK";
import style from "./css/basic-theme.css";
import 'bootstrap/dist/css/bootstrap.min.css';
import 'jquery/dist/jquery.min';
import GafaFitSDKWrapper from "./components/utils/GafaFitSDKWrapper";

GafaFitSDKWrapper.initValues();

GafaThemeSDK.renderLogin('[data-gf-theme="login"]');
GafaThemeSDK.renderRegister('[data-gf-theme="register"]');
GafaThemeSDK.renderPasswordRecovery('[data-gf-theme="password-recovery"]');
GafaThemeSDK.renderProfileUserInfo('[data-gf-theme="profile-info"]');

GafaThemeSDK.renderStaffList('[data-gf-theme="staff-list"]');
GafaThemeSDK.renderServiceList('[data-gf-theme="service-list"]');
GafaThemeSDK.renderComboList('[data-gf-theme="combo-list"]');
GafaThemeSDK.renderMembershipList('[data-gf-theme="membership-list"]');
GafaThemeSDK.renderMeetingsCalendar('[data-gf-theme="meetings-calendar"]');