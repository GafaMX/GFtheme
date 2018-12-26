'use strict';

import React from "react";

class GafaFitSDKWrapper extends React.Component {
    constructor(props) {
        super(props);
    }

    static initValues(){
        GafaFitSDK.setUrl('https://devgafa.fit/');
        GafaFitSDK.setCompany(3);
        window.brand = 'zuda';
    }

    static setBrand(brand) {
        window.brand = brand;
    }

    static getStaffList(callback) {
        GafaFitSDK.GetBrandStaffList(
            window.brand, {}, function (error, result) {
                if (error === null) {
                    callback(result);
                }
            }
        );
    };

    static getServiceList(callback) {
        GafaFitSDK.GetBrandServiceList(
            window.brand, {}, function (error, result) {
                if (error === null) {
                    callback(result);
                }
            }
        );
    };

    static getToken(email, password, successCallback, errorCallback) {
        GafaFitSDK.GetToken(
            3,
            "rh9}UJA<7,H7d!T27&a9.9ZXQsCf&CS/[jik==c&",
            email,
            password,
            {
                "grant_type": "password",
                "scope": "*"
            },
            function (error, result) {
                if (error != null) {
                    let errorToPrint = Object.keys(error).map(function (key) {
                        return error[key];
                    }).join(" ");
                    errorCallback(errorToPrint);
                } else {
                    successCallback(result);
                }
            }
        );
    };
}

export default GafaFitSDKWrapper;

