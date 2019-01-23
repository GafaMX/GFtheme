import GafaThemeSDK from "./components/GafaThemeSDK";
import "./css/basic-theme.css";
import 'bootstrap/dist/css/bootstrap.min.css';
import 'jquery/dist/jquery.min';
import GafaFitSDKWrapper from "./components/utils/GafaFitSDKWrapper";

GafaFitSDKWrapper.initValues();

GafaThemeSDK.renderLogin('[data-gf-theme="login"]');
GafaThemeSDK.renderRegister('[data-gf-theme="register"]');
GafaThemeSDK.renderPasswordRecovery('[data-gf-theme="password-recovery"]');
GafaThemeSDK.renderProfileUserInfo('[data-gf-theme="profile-info"]');
GafaThemeSDK.renderLoginRegister('[data-gf-theme="login-register"]');

GafaThemeSDK.renderStaffList('[data-gf-theme="staff-list"][data-gf-perpage]');
GafaThemeSDK.renderStaffListWithoutPagination('[data-gf-theme="staff-list"]:not([data-gf-perpage]');

GafaThemeSDK.renderServiceList('[data-gf-theme="service-list"][data-gf-perpage]');
GafaThemeSDK.renderServiceListWithoutPagination('[data-gf-theme="service-list"]:not([data-gf-perpage]');

GafaThemeSDK.renderComboList('[data-gf-theme="combo-list"][data-gf-perpage]');
GafaThemeSDK.renderComboListWithoutPagination('[data-gf-theme="combo-list"]:not([data-gf-perpage]');

GafaThemeSDK.renderMembershipList('[data-gf-theme="membership-list"][data-gf-perpage]');
GafaThemeSDK.renderMembershipListWithoutPagination('[data-gf-theme="membership-list"]:not([data-gf-perpage]');

GafaThemeSDK.renderMeetingsCalendar('[data-gf-theme="meetings-calendar"]');