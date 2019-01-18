'use strict';

import React from "react";
import ReactDOM from "react-dom";
import ServiceList from "./service/ServiceList";
import StaffList from "./staff/StaffList";
import Login from "./auth/Login";
import GafaFitSDKWrapper from "./utils/GafaFitSDKWrapper";
import ComboList from "./combo/ComboList";
import MembershipList from "./membership/MembershipList";
import Register from "./auth/Register";
import PasswordRecovery from "./auth/PasswordRecovery";
import ProfileUserInfo from "./profile/ProfileUserInfo";
import Calendar from "./calendar/Calendar";
import ProfileUserInfo from "./profile/info/ProfileUserInfo";
import LoginRegister from "./menu/LoginRegister";

class GafaThemeSDK extends React.Component {
    constructor(props) {
        super(props);
    }

    static propsForPagedListComponent(result) {
        return {
            list: result.data,
            currentPage: result.current_page,
            lastPage: result.last_page,
            perPage: result.per_page,
            total: result.total
        };
    }

    static renderElementIntoContainers(domContainers, elementToRender, props) {
        domContainers.forEach(function (domContainer) {
            ReactDOM.render(React.createElement(elementToRender, props), domContainer);
        });
    }

    static renderStaffList(selector) {
        let domContainers = document.querySelectorAll(selector);
        if (domContainers.length > 0) {
            GafaFitSDKWrapper.getStaffList(function (result) {
                let props = GafaThemeSDK.propsForPagedListComponent(result);
                GafaThemeSDK.renderElementIntoContainers(domContainers, StaffList, props);
            });
        }
    };

    static renderServiceList(selector) {
        let domContainers = document.querySelectorAll(selector);
        if (domContainers.length > 0) {
            GafaFitSDKWrapper.getServiceList(function (result) {
                let props = GafaThemeSDK.propsForPagedListComponent(result);
                GafaThemeSDK.renderElementIntoContainers(domContainers, ServiceList, props);
            });
        }
    };

    static renderComboList(selector) {
        let domContainers = document.querySelectorAll(selector);
        if (domContainers.length > 0) {
            GafaFitSDKWrapper.getComboList(function (result) {
                let props = GafaThemeSDK.propsForPagedListComponent(result);
                GafaThemeSDK.renderElementIntoContainers(domContainers, ComboList, props);
            });
        }
    };

    static renderMembershipList(selector) {
        let domContainers = document.querySelectorAll(selector);
        if (domContainers.length > 0) {
            GafaFitSDKWrapper.getMembershipList(function (result) {
                let props = GafaThemeSDK.propsForPagedListComponent(result);
                GafaThemeSDK.renderElementIntoContainers(domContainers, MembershipList, props);
            });
        }
    };

    static renderLogin(selector) {
        let domContainers = document.querySelectorAll(selector);
        if (domContainers.length > 0) {
            GafaThemeSDK.renderElementIntoContainers(domContainers, Login, {});
        }
    };

    static renderRegister(selector) {
        let domContainers = document.querySelectorAll(selector);
        if (domContainers.length > 0) {
            GafaThemeSDK.renderElementIntoContainers(domContainers, Register, {});
        }
    };

    static renderPasswordRecovery(selector) {
        let domContainers = document.querySelectorAll(selector);
        if (domContainers.length > 0) {
            GafaThemeSDK.renderElementIntoContainers(domContainers, PasswordRecovery, {});
        }
    };

    static renderProfileUserInfo(selector) {
        let domContainers = document.querySelectorAll(selector);
        if (domContainers.length > 0) {
            GafaThemeSDK.renderElementIntoContainers(domContainers, ProfileUserInfo, {});
        }
    };

    static renderMeetingsCalendar(selector) {
        let domContainers = document.querySelectorAll(selector);
        if (domContainers.length > 0) {
            GafaFitSDKWrapper.getBrandLocations({
                'page': 1,
                'per_page': 1000,
            }, function (result) {
                let locations = result.data;
                let props = {
                    'locations': locations
                };
                GafaThemeSDK.renderElementIntoContainers(domContainers, Calendar, props);
            })
        }
    }

    static renderLoginRegister(selector) {
        let domContainers = document.querySelectorAll(selector);
        if (domContainers.length > 0) {
            GafaThemeSDK.renderElementIntoContainers(domContainers, LoginRegister, {});
        }
    };
}

export default GafaThemeSDK;
