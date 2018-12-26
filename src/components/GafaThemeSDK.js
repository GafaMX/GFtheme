'use strict';

import React from "react";
import ReactDOM from "react-dom";
import ServiceList from "./service/ServiceList";
import StaffList from "./staff/StaffList";
import Login from "./auth/Login";
import GafaFitSDKWrapper from "./utils/GafaFitSDKWrapper";

class GafaThemeSDK extends React.Component {
    constructor(props) {
        super(props);
    }

    static propsForPagedListComponent(result) {
        return {
            list: result.data,
            currentPage: result.current_page,
            lastPage: result.last_page,
            perPage: result.per_page
        };
    }

    static renderElementIntoContainer(containerSelector, elementToRender, props) {
        const domContainers = document.querySelectorAll(containerSelector);
        domContainers.forEach(function (domContainer) {
            ReactDOM.render(React.createElement(elementToRender, props), domContainer);
        });
    }

    static renderStaffList(selector) {
        GafaFitSDKWrapper.getStaffList(function(result){
            let props = GafaThemeSDK.propsForPagedListComponent(result);
            GafaThemeSDK.renderElementIntoContainer(selector, StaffList, props);
        });
    };

    static renderServiceList(selector) {
        GafaFitSDKWrapper.getServiceList(function(result){
            let props = GafaThemeSDK.propsForPagedListComponent(result);
            GafaThemeSDK.renderElementIntoContainer(selector, ServiceList, props);
        });
    };

    static renderLogin(selector) {
        GafaThemeSDK.renderElementIntoContainer(selector, Login, {});
    };
}

export default GafaThemeSDK;
