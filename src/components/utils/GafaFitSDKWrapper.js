'use strict';

import React from "react";

class GafaFitSDKWrapper extends React.Component {
    constructor(props) {
        super(props);
    }

    static initValues() {
        GafaFitSDK.setUrl('https://devgafa.fit/');
        GafaFitSDK.setCompany(3);
        window.GFtheme = {};
        window.GFtheme.brand = 'zuda';
        window.GFtheme.location = 'zuda-plaza-lilas';
    }

    static setBrand(brand) {
        window.GFtheme.brand = brand;
    }

    static getStaffList(callback) {
        GafaFitSDK.GetBrandStaffList(
            window.GFtheme.brand, {}, function (error, result) {
                if (error === null) {
                    callback(result);
                }
            }
        );
    };

    static getServiceList(callback) {
        GafaFitSDK.GetBrandServiceList(
            window.GFtheme.brand, {}, function (error, result) {
                if (error === null) {
                    callback(result);
                }
            }
        );
    };

    static getComboList(callback) {
        let functionToRetrieveCombos = GafaFitSDK.GetBrandCombolist;
        GafaFitSDKWrapper.getMe(function () {
            if (window.GFtheme.me != null) {
                functionToRetrieveCombos = GafaFitSDK.GetBrandComboListforUser;
            }
            functionToRetrieveCombos(
                window.GFtheme.brand, {
                    'only_actives': true,
                    'propagate': true
                }, function (error, result) {
                    if (error === null) {
                        callback(result);
                    }
                }
            );
        });
    };

    static getMembershipList(callback) {
        let functionToRetrieveMemberships = GafaFitSDK.GetBrandMembershipList;
        GafaFitSDKWrapper.getMe(function () {
            if (window.GFtheme.me != null) {
                functionToRetrieveMemberships = GafaFitSDK.GetBrandMembershipListForUser;
            }
            functionToRetrieveMemberships(
                window.GFtheme.brand, {
                    'only_actives': true,
                    'propagate': true
                }, function (error, result) {
                    if (error === null) {
                        callback(result);
                    }
                }
            );
        });
    };

    static getFancyForBuyCombo(combos_id, callback) {
        GafaFitSDKWrapper.getMe(function () {
            GafaFitSDK.GetCreateReservationForm(
                window.GFtheme.brand,
                window.GFtheme.location,
                window.GFtheme.me.id,
                '[data-gf-theme="fancy"]',
                {
                    'combos_id': combos_id,
                }, function (error, result) {
                    if (error === null) {
                        callback(result);
                    }
                }
            );
        });
    };

    static getFancyForBuyMembership(memberships_id, callback) {
        GafaFitSDKWrapper.getMe(function () {
            GafaFitSDK.GetCreateReservationForm(
                window.GFtheme.brand,
                window.GFtheme.location,
                window.GFtheme.me.id,
                '[data-gf-theme="fancy"]',
                {
                    'memberships_id': memberships_id,
                }, function (error, result) {
                    if (error === null) {
                        callback(result);
                    }
                }
            );
        });
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
                    }).join(". ");
                    errorCallback(errorToPrint);
                } else {
                    GafaFitSDKWrapper.getMe(function () {
                        successCallback(result)
                    });
                }
            }
        );
    };

    static postRegister(params, successCallback, errorCallback) {
        let options = {};
        options.last_name = params.last_name;
        options.password = 'password';
        options.scope = '*';
        GafaFitSDK.PostRegister(
            3,
            "rh9}UJA<7,H7d!T27&a9.9ZXQsCf&CS/[jik==c&",
            params.email,
            params.password,
            params.passwordConfirmation,
            params.first_name,
            options,
            function (error, result) {
                if (error != null) {
                    let errorToPrint = Object.keys(error).map(function (key) {
                        return error[key];
                    }).join(". ");
                    errorCallback(errorToPrint);
                } else {
                    successCallback(result)
                }
            }
        );
    };

    static postPasswordForgot(params, successCallback, errorCallback) {
        GafaFitSDK.RequestNewPassword(
            params.email,
            params.returnUrl,
            function (error, result) {
                if (error != null) {
                    let errorToPrint = Object.keys(error).map(function (key) {
                        return error[key];
                    }).join(". ");
                    errorCallback(errorToPrint);
                } else {
                    successCallback(result)
                }
            }
        );
    };

    static getMe(callback) {
        if (window.GFtheme.me == null) {
            GafaFitSDK.GetMe(
                function (error, result) {
                    window.GFtheme.me = result;
                    callback();
                }
            );
        } else {
            callback();
        }
    };

    static logout(successCallback, errorCallback) {
        GafaFitSDK.PostLogout(
            {},
            function (error, result) {
                if (error != null) {
                    let errorToPrint = Object.keys(error).map(function (key) {
                        return error[key];
                    }).join(". ");
                    errorCallback(errorToPrint);
                } else {
                    window.GFtheme.me = null;
                    successCallback(result);
                }
            }
        );
    }
}

export default GafaFitSDKWrapper;

