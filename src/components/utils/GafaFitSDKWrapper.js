'use strict';

import React from "react";
import GlobalStorage from "../store/GlobalStorage";
import CalendarStorage from '../calendar/CalendarStorage';

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
            window.GFtheme.BrandID = window.GFThemeOptions.BRAND_ID;
            window.GFtheme.TokenMovil = window.GFThemeOptions.TOKENMOVIL;
            window.GFtheme.CaptchaSecretKey = window.GFThemeOptions.CAPTCHA_SECRET_KEY;
            window.GFtheme.StaffName = window.GFThemeOptions.STAFF_NAME ? window.GFThemeOptions.STAFF_NAME : 'Staff';
            window.GFtheme.ClassName = window.GFThemeOptions.CLASS_NAME ? window.GFThemeOptions.CLASS_NAME : 'Clases';
            window.GFtheme.CaptchaPublicKey = window.GFThemeOptions.CAPTCHA_PUBLIC_KEY;
            window.GFtheme.RemoteAddr = window.GFThemeOptions.REMOTE_ADDR;
            // window.GFtheme.ConektaPublicKey = window.GFThemeOptions.CONEKTA_PUBLIC_KEY;
        }

        // GafaFitSDKWrapper.setLocalStorage();

        GafaFitSDKWrapper.getInitialValues(callback);
    }

    // static setConektaPayment(){
    //     let {ConektaPublicKey} = window.GFtheme;
    //     Conekta.setPublicKey(ConektaPublicKey)

    //     GafaFitSDKWrapper.getUserPaymentInfo('', function (result) {
    //         GlobalStorage.set('ConektaPaymentInfo',  result.conekta)
    //     });
    // }

    static getInitialValues(cb) {
        let component = this;
        GafaFitSDKWrapper.getBrandList({}, function (result) {
            GlobalStorage.initialValues(result.data, function () {
                cb();
            });
        });

    }

    // static setMeetings(cb){
    //    let locations = GlobalStorage.get('locations');
    //    let meetings = [];

    //    if ( locations ){
    //       let start_date = moment().toDate();
    //       let end_date = moment().toDate();

    //       CalendarStorage.set('start_date', start_date);

    //       locations.forEach(function (location) {
    //          start_date = !location.date_start ? start_date : moment(location.date_start).toDate();
    //          end_date.setDate(start_date.getDate() + (location.calendar_days - 1));

    //          let start_string = `${start_date.getFullYear()}-${start_date.getMonth() + 1}-${start_date.getDate()}`;
    //          let end_string = `${end_date.getFullYear()}-${end_date.getMonth() + 1}-${end_date.getDate()}`;

    //          GafaFitSDKWrapper.getMeetingsInLocation(location.id, start_string, end_string, function(result){
    //             meetings = meetings.concat(result);

    //             CalendarStorage.set('meetings', meetings);
    //             CalendarStorage.set('start_date', start_date);
    //             if(cb){
    //                cb();
    //             }
    //          });
    //       });
    //    }
    // }

    static getCurrentLocation(callback) {
        let location = localStorage.getItem('__GFthemeLocation');

        if (location) {
            window.GFtheme.location = location;
            GafaFitSDKWrapper.getBrandLocations({}, function (result) {
                let locations = result.data;
                let currentLocation = locations.find(element => element.slug === location);
                GlobalStorage.set('currentLocation', currentLocation);
                CalendarStorage.set('locations', locations);
                callback();
            });
        } else {
            if (window.GFtheme.location == null) {
                GafaFitSDKWrapper.getBrandLocations({}, function (result) {
                    localStorage.setItem('__GFthemeLocation', result.data[0].slug);
                    window.GFtheme.location = result.data[0].slug;
                    callback();
                });
            } else {
                callback();
            }
        }
    }

    static getStaffList(brand, options, callback) {
        GafaFitSDK.GetBrandStaffList(
            brand, options, function (error, result) {
                if (error === null) {
                    callback(result);
                }
            }
        );
    };

    static getServiceList(brand, options, callback) {
        GafaFitSDK.GetBrandServiceList(
            brand, options, function (error, result) {
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


    static getComboList(brand, options, callback) {
        let functionToRetrieveCombos = GafaFitSDK.GetBrandCombolist;

        GafaFitSDKWrapper.isAuthenticated(function (auth) {
            if (auth) {
                functionToRetrieveCombos = GafaFitSDK.GetBrandComboListforUser;
            }

            functionToRetrieveCombos(
                brand, options, function (error, result) {
                    if (error === null) {
                        callback(result);
                    }
                }
            );
        });
    };

    static getMembershipList(brand, options, callback) {
        let functionToRetrieveMemberships = GafaFitSDK.GetBrandMembershipList;

        GafaFitSDKWrapper.isAuthenticated(function (auth) {
            if (auth) {
                functionToRetrieveMemberships = GafaFitSDK.GetBrandMembershipListForUser;
            }

            functionToRetrieveMemberships(
                brand, options, function (error, result) {
                    if (error === null) {
                        callback(result);
                    }
                }
            );
        });
    };

    static getFancyForBuyCombo(brand, location, combos_id, callback) {
        GafaFitSDKWrapper.getMe(function (me) {
            GafaFitSDK.GetCreateReservationForm(
                brand,
                location,
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

    static getFancyForBuyMembership(brand, location, memberships_id, callback) {
        GafaFitSDKWrapper.getMe(function (me) {
            GafaFitSDK.GetCreateReservationForm(
                brand,
                location,
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

    static getUserCredits(brand, callback) {
        GafaFitSDK.GetUserCredits(
            brand, {}, function (error, result) {
                if (error === null) {
                    callback(result);
                }
            }
        );
    };

    static getUserMemberships(brand, callback) {
        GafaFitSDK.GetUserMembership(
            brand, {}, function (error, result) {

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
        options['custom_fields'] = params.special_texts_values;

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
                    // Automatic login
                    GafaFitSDKWrapper.getToken(
                        params.email,
                        params.password,
                        function () {
                            me.successLoginCallback.bind(me);
                            successCallback(result);
                        },
                        me.errorLoginCallback.bind(me)
                    );
                }
            }
        );
    };

    static successLoginCallback(result) {

        if (window.GFtheme.combo_id != null) {
            GafaFitSDKWrapper.getFancyForBuyCombo(window.GFtheme.combo_id, function (result) {
                window.GFtheme.combo_id = null;
            });
        } else if (window.GFtheme.membership_id != null) {
            GafaFitSDKWrapper.getFancyForBuyMembership(window.GFtheme.membership_id, function (result) {
                window.GFtheme.membership_id = null;
            });
        } else if (window.GFtheme.meetings_id != null && window.GFtheme.location_slug != null) {
            GafaFitSDKWrapper.getFancyForMeetingReservation(window.GFtheme.location_slug, window.GFtheme.meetings_id, function (result) {
                window.GFtheme.meetings_id = null;
                window.GFtheme.location_slug = null;
            });
        } else {
            location.reload();
        }
    }

    static errorLoginCallback(error) {
        this.setState({serverError: error, logged: false});
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

    static getMeWithPurchase(callback) {
        GafaFitSDKWrapper.getMe(function (result) {
            let user = result;
            let brands = GlobalStorage.get('brands');
            let credits = [];
            let memberships = [];

            brands.forEach(function (brand) {

                GafaFitSDKWrapper.getUserCredits(brand.slug, function (result) {
                    credits = result;
                    user.credits = credits;

                    GafaFitSDKWrapper.getUserMemberships(brand.slug, function (result) {
                        memberships = memberships.concat(result);
                        user.memberships = memberships;
                        callback(user);
                    });
                });
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
                    GafaFitSDKWrapper.getMeWithPurchase(
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
                    successCallback(result);
                }
            }
        );
    }

    static getMeetingsInLocation(location, start_date, end_date, callback) {
        let brand = GlobalStorage.get('currentBrand').slug;
        //   let location = GlobalStorage.get('currentLocation').id;
        GafaFitSDK.GetlocationMeetingList(
            brand,
            location, {
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
        let brand = GlobalStorage.get('currentBrand').slug;
        options.only_actives = true;
        GafaFitSDK.GetBrandLocationList(brand, options, function (error, result) {
            if (error === null) {
                callback(result);
            }
        })
    }

    static getBrandLocationsWithoutBrand(brand, options, callback) {
        options.only_actives = true;
        GafaFitSDK.GetBrandLocationList(brand, options, function (error, result) {
            if (error === null) {
                callback(result);
            }
        })
    }

    static getBrandRooms(brand, options, callback) {
        GafaFitSDK.GetRoomsInBrand(brand, options, function (error, result) {
            if (error === null) {
                callback(result);
            }
        });
    }

    static getFancyForMeetingReservation(brand, location, meetings_id, callback) {
        GafaFitSDKWrapper.getMe(function (me) {
            GafaFitSDK.GetCreateReservationForm(
                brand,
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

    static getUserFutureReservationsInBrand(brand, options, callback) {
        GafaFitSDK.GetUserFutureReservationsInBrand(
            brand, options,
            function (error, result) {
                if (error === null) {
                    callback(result);
                }
            }
        )
    };

    static postUserCancelReservation(brand, reservation, options, callbackSuccess, callbackError) {
        GafaFitSDK.PostUserCancelReservation(
            brand, reservation, options,
            function (error, result) {
                if (error === null) {
                    callbackSuccess(result);
                } else {
                    callbackError(error);
                }
            }
        )
    };

    static getUserPastReservationsInBrand(brand, options, callback) {
        GafaFitSDK.GetUserPastReservationsInBrand(
            brand, options,
            function (error, result) {
                if (error === null) {
                    callback(result);
                }
            }
        )
    };

    static getUserPurchasesInBrand(brand, options, callback) {
        GafaFitSDK.GetUserPurchasesInBrand(
            brand, options,
            function (error, result) {
                if (error === null) {
                    callback(result);
                }
            }
        )
    }

    // Funciones de metodos de pago | Inicio

    static getUserPaymentInfo(options, callback) {
        let brand = GlobalStorage.get('currentBrand').slug;

        GafaFitSDK.GetUserPaymentInfo(
            brand, options,
            function (error, result) {
                if (error === null) {
                    callback(result);
                }
            }
        )
    }

    static postUserRemovePaymentOption(paymentMethod, idCard, callback) {
        let brand = GlobalStorage.get('currentBrand').slug;

        GafaFitSDK.PostUserRemovePaymentOption(
            brand,
            paymentMethod,
            idCard,
            function (error, result) {
                if (error === null) {
                    callback(result);
                }
            }
        )
    }

    static postUserAddPaymentOption(paymentMethod, optionToken, optionPhone, callback) {
        let brand = GlobalStorage.get('currentBrand').slug;

        GafaFitSDK.PostUserAddPaymentOption(
            brand,
            paymentMethod,
            optionToken,
            optionPhone,
            function (error, result) {
                if (error === null) {
                    callback(result);
                }
            }
        )
    }

    // Funciones de metodos de pago | Fin

    //Textos Especiales
    static getCatalogSpecialTextsGroupsWithFields(special_text, options, callback) {
        let brand = GlobalStorage.get('currentBrand').slug;
        GafaFitSDK.GetCatalogSpecialTextsGroupsWithFields(
            special_text,
            brand,
            options,
            function (error, result) {
                if (error === null) {
                    callback(result);
                }
            }
        );
    }
}

export default GafaFitSDKWrapper;

