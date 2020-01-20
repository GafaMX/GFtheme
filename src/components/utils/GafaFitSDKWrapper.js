'use strict';

import React from "react";
import GlobalStorage from "../store/GlobalStorage";

class GafaFitSDKWrapper extends React.Component {
    constructor(props) {
        super(props);
    }

    static initValues(callback) {
        window.GFtheme = {};
        if (window.GFThemeOptions != null) {
            GafaFitSDK.setUrl(window.GFThemeOptions.GAFA_FIT_URL);
            GafaFitSDK.setCompany(window.GFThemeOptions.COMPANY_ID);
            window.GFtheme.APIClientID = window.GFThemeOptions.API_CLIENT;
            window.GFtheme.APIClientSecret = window.GFThemeOptions.API_SECRET;
            window.GFtheme.TokenMovil = window.GFThemeOptions.TOKENMOVIL;
            window.GFtheme.CaptchaSecretKey = window.GFThemeOptions.CAPTCHA_SECRET_KEY;
            window.GFtheme.CaptchaPublicKey = window.GFThemeOptions.CAPTCHA_PUBLIC_KEY;
            window.GFtheme.RemoteAddr = window.GFThemeOptions.REMOTE_ADDR;
        }

        GafaFitSDKWrapper.getCurrentBrandAndLocation(callback);
    }

    static getCurrentBrandAndLocation(locationCallback) {
        GafaFitSDKWrapper.getCurrentBrand(function () {
            GafaFitSDKWrapper.getCurrentLocation(locationCallback);
        });
    }

    static getCurrentBrand(callback) {
        if (window.GFtheme.brand == null) {
            GafaFitSDKWrapper.getBrandList({}, function (result) {
                window.GFtheme.brand = result.data[0].slug;
                callback();
            });
        } else {
            callback();
        }
    }

    static getCurrentLocation(callback) {
        if (window.GFtheme.location == null) {
            GafaFitSDKWrapper.getBrandLocations({}, function (result) {
                window.GFtheme.location = result.data[0].slug;
                callback();
            });
        } else {
            callback();
        }
    }

    static setBrand(brand) {
        window.GFtheme.brand = brand;
    }

    static getStaffList(options, callback) {
        GafaFitSDK.GetBrandStaffList(
            window.GFtheme.brand, options, function (error, result) {
                if (error === null) {
                    callback(result);
                }
            }
        );
    };

    static getServiceList(options, callback) {
        GafaFitSDK.GetBrandServiceList(
            window.GFtheme.brand, options, function (error, result) {
                if (error === null) {
                    callback(result);
                }
            }
        );
    };

    static isAuthenticated(callback) {
        GafaFitSDKWrapper.getMe(function (result) {
            callback(result != null);
        });
    };


    static getComboList(options, callback) {
        let functionToRetrieveCombos = GafaFitSDK.GetBrandCombolist;

        GafaFitSDKWrapper.isAuthenticated(function (auth) {
            if (auth) {
                functionToRetrieveCombos = GafaFitSDK.GetBrandComboListforUser;
            }

            functionToRetrieveCombos(
                window.GFtheme.brand, options, function (error, result) {
                    if (error === null) {
                        callback(result);
                    }
                }
            );
        });
    };

    static getMembershipList(options, callback) {
        let functionToRetrieveMemberships = GafaFitSDK.GetBrandMembershipList;

        GafaFitSDKWrapper.isAuthenticated(function (auth) {
            if (auth) {
                functionToRetrieveMemberships = GafaFitSDK.GetBrandMembershipListForUser;
            }

            functionToRetrieveMemberships(
                window.GFtheme.brand, options, function (error, result) {
                    if (error === null) {
                        callback(result);
                    }
                }
            );
        });
    };

    static getFancyForBuyCombo(combos_id, callback) {
        GafaFitSDKWrapper.getMe(function (me) {
            GafaFitSDK.GetCreateReservationForm(
                window.GFtheme.brand,
                window.GFtheme.location,
                me.id,
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
        GafaFitSDKWrapper.getMe(function (me) {
            GafaFitSDK.GetCreateReservationForm(
                window.GFtheme.brand,
                window.GFtheme.location,
                me.id,
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
            window.GFtheme.APIClientID,
            window.GFtheme.APIClientSecret,
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

    static getUserCredits(callback) {
        GafaFitSDK.GetUserCredits(
            window.GFtheme.brand, {}, function (error, result) {
                if (error === null) {
                    callback(result);
                }
            }
        );
    };

    static getUserMemberships(callback) {
        GafaFitSDK.GetUserMembership(
            window.GFtheme.brand, {}, function (error, result) {
                if (error === null) {
                    callback(result);
                }
            }
        );
    };

    static postRegister(params, successCallback, errorCallback) {
        let options = {};
        options.last_name = params.last_name;
        options.grant_type = 'password';
        options.scope = '*';
        options.tokenmovil = null;
        options.captcha_secret_key = window.GFtheme.CaptchaSecretKey;
        options.remote_addr = window.GFtheme.RemoteAddr;
        options['g_recaptcha_response'] = params.g_recaptcha_response;
        options['g-recaptcha-response'] = params.g_recaptcha_response;

        let me = this;

        GafaFitSDK.PostRegister(
            window.GFtheme.APIClientID,
            window.GFtheme.APIClientSecret,
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
                    successCallback(result);

                    // Automatic login
                    GafaFitSDKWrapper.getToken(params.email, params.password,
                        me.successLoginCallback.bind(me),
                        me.errorLoginCallback.bind(me));
                }
            }
        );
    };

    static successLoginCallback(result) {
        /*
        this.setState({logged: true});
        if (this.props.successCallback) {
            this.props.successCallback(result);
        }
        */

        if (window.GFtheme.combo_id != null) {
            GafaFitSDKWrapper.getFancyForBuyCombo(window.GFtheme.combo_id, function (result) {
                window.GFtheme.combo_id = null;
            });
        }
        if (window.GFtheme.membership_id != null) {
            GafaFitSDKWrapper.getFancyForBuyMembership(window.GFtheme.membership_id, function (result) {
                window.GFtheme.membership_id = null;
            });
        }
        if (window.GFtheme.meetings_id != null && window.GFtheme.location_slug != null) {
            GafaFitSDKWrapper.getFancyForMeetingReservation(window.GFtheme.location_slug, window.GFtheme.meetings_id, function (result) {
                window.GFtheme.meetings_id = null;
                window.GFtheme.location_slug = null;
            });
        }
    }

    static errorLoginCallback(error) {
        /*
        this.setState({serverError: error, logged: false});
         */
    }

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

    static postPasswordChange(params, successCallback, errorCallback) {
        GafaFitSDK.NewPassword(
            params.email,
            params.password,
            params.passwordConfirmation,
            params.token,
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
        if (GlobalStorage.get('me') == null) {
            GafaFitSDK.GetMe(
                function (error, result) {
                    if (error == null) {
                        GlobalStorage.set("me", result);
                        callback(result);
                    } else {
                        callback(null);
                    }
                }
            );
        } else {
            callback(GlobalStorage.get("me"));
        }
    };

    static getMeWithCredits(callback) {
        GafaFitSDKWrapper.getMe(function (result) {
            let user = result;
            GafaFitSDKWrapper.getUserCredits(function (result) {
                user.credits = result;
                user.creditsTotal = 0;
                user.credits.forEach(function (elem) {
                    user.creditsTotal += elem.total;
                });
                GlobalStorage.set("me", user);
                callback(user);
            });
        });
    }

    static putMe(params, successCallback, errorCallback) {
        GafaFitSDK.PutMe(
            params,
            function (error, result) {
                if (error != null) {
                    let errorToPrint = Object.keys(error).map(function (key) {
                        return error[key];
                    }).join(". ");
                    errorCallback(errorToPrint);
                } else {
                    GlobalStorage.set("me", result);
                    GafaFitSDKWrapper.getMeWithCredits(
                        successCallback
                    );
                }
            }
        );
    };

    static getCountries(callback) {
        GafaFitSDK.GetCountryList({},
            function (error, result) {
                if (error === null) {
                    callback(result);
                } else {
                    callback([]);
                }
            }
        );
    };

    static getCountryStates(country, callback) {
        GafaFitSDK.GetCountryStateList(country, {},
            function (error, result) {
                if (error === null) {
                    callback(result);
                } else {
                    callback([]);
                }
            }
        );
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
                    GlobalStorage.set("me", null);
                    successCallback(result);
                }
            }
        );
    }

    static getMeetingsInLocation(location, start_date, end_date, callback) {
        GafaFitSDK.GetlocationMeetingList(window.GFtheme.brand, location, {
            'only_actives': true,
            'start': start_date,
            'end': end_date
        }, function (error, result) {
            if (error === null) {
                callback(result);
            }
        })
    }

    static getBrandList(options, callback) {
        options.only_actives = true;
        GafaFitSDK.GetBrandList(options, function (error, result) {
            if (error === null) {
                callback(result);
            }
        })
    }

    static getBrandLocations(options, callback) {
        options.only_actives = true;
        GafaFitSDK.GetBrandLocationList(window.GFtheme.brand, options, function (error, result) {
            if (error === null) {
                callback(result);
            }
        })
    }

    static getBrandRooms(options, callback) {
        GafaFitSDK.GetRoomsInBrand(window.GFtheme.brand, options, function (error, result) {
            if (error === null) {
                callback(result);
            }
        });
    }

    static getFancyForMeetingReservation(location, meetings_id, callback) {
        GafaFitSDKWrapper.getMe(function (me) {
            GafaFitSDK.GetCreateReservationForm(
                window.GFtheme.brand,
                location,
                me.id,
                '[data-gf-theme="fancy"]',
                {
                    'meetings_id': meetings_id,
                }, function (error, result) {
                    if (error === null) {
                        callback(result);
                    }
                }
            );
        });
    };

    static getUserFutureReservationsInBrand(options, callback) {
        GafaFitSDK.GetUserFutureReservationsInBrand(
            window.GFtheme.brand, options,
            function (error, result) {
                if (error === null) {
                    callback(result);
                }
            }
        )
    };

    static postUserCancelReservation(reservation, options, callback) {
        GafaFitSDK.PostUserCancelReservation(
            window.GFtheme.brand, reservation, options,
            function (error, result) {
                if (error === null) {
                    callback(result);
                }
            }
        )
    };

    static getUserPastReservationsInBrand(options, callback) {
        GafaFitSDK.GetUserPastReservationsInBrand(
            window.GFtheme.brand, options,
            function (error, result) {
                if (error === null) {
                    callback(result);
                }
            }
        )
    };

    static getUserPurchasesInBrand(options, callback) {
        GafaFitSDK.GetUserPurchasesInBrand(
            window.GFtheme.brand, options,
            function (error, result) {
                if (error === null) {
                    callback(result);
                }
            }
        )
    }

}

export default GafaFitSDKWrapper;

