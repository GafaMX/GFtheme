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
import PasswordForgot from "./auth/PasswordForgot";

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

    static renderElementIntoContainer(domContainers, elementToRender, props) {
        domContainers.forEach(function (domContainer) {
            ReactDOM.render(React.createElement(elementToRender, props), domContainer);
        });
    }

    static renderStaffList(selector) {
        let domContainers = document.querySelectorAll(selector);
        if (domContainers.length > 0) {
            GafaFitSDKWrapper.getStaffList(function (result) {
                let props = GafaThemeSDK.propsForPagedListComponent(result);
                GafaThemeSDK.renderElementIntoContainer(domContainers, StaffList, props);
            });
        }
    };

    static renderServiceList(selector) {
        let domContainers = document.querySelectorAll(selector);
        if (domContainers.length > 0) {
            GafaFitSDKWrapper.getServiceList(function (result) {
                let props = GafaThemeSDK.propsForPagedListComponent(result);
                GafaThemeSDK.renderElementIntoContainer(domContainers, ServiceList, props);
            });
        }
    };

    static renderComboList(selector) {
        let domContainers = document.querySelectorAll(selector);
        if (domContainers.length > 0) {
            GafaFitSDKWrapper.getComboList(function (result) {
                let props = GafaThemeSDK.propsForPagedListComponent(result);
                GafaThemeSDK.renderElementIntoContainer(domContainers, ComboList, props);
            });
        }
    };

    static renderMembershipList(selector) {
        let domContainers = document.querySelectorAll(selector);
        if (domContainers.length > 0) {
            GafaFitSDKWrapper.getMembershipList(function (result) {
                let props = GafaThemeSDK.propsForPagedListComponent(result);
                GafaThemeSDK.renderElementIntoContainer(domContainers, MembershipList, props);
            });
        }
    };

    static renderLogin(selector) {
        let domContainers = document.querySelectorAll(selector);
        if (domContainers.length > 0) {
            GafaThemeSDK.renderElementIntoContainer(domContainers, Login, {});
        }
    };

    static renderRegister(selector) {
        let domContainers = document.querySelectorAll(selector);
        if (domContainers.length > 0) {
            GafaThemeSDK.renderElementIntoContainer(domContainers, Register, {});
        }
    };

    static renderPasswordForgot(selector) {
        let domContainers = document.querySelectorAll(selector);
        if (domContainers.length > 0) {
            GafaThemeSDK.renderElementIntoContainer(domContainers, PasswordForgot, {});
        }
    };
}

export default GafaThemeSDK;
