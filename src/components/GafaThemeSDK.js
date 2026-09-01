'use strict';

import React from "react";
import ReactDOM from "react-dom";
import GlobalStorage from "./store/GlobalStorage";
import CalendarStorage from "./calendar/CalendarStorage";

import ServiceList from "./service/ServiceList";
import StaffList from "./staff/StaffList";
import Login from "./auth/Login";
import GafaFitSDKWrapper from "./utils/GafaFitSDKWrapper";
import ComboList from "./combo/ComboList";
import MembershipList from "./membership/MembershipList";
import Register from "./auth/Register";
import PasswordRecovery from "./auth/PasswordRecovery";
import Calendar from "./calendar/Calendar";
import CalendarReact from "./calendar/CalendarReact";
import ProfileUserInfo from "./profile/info/ProfileUserInfo";
import LoginRegister from "./menu/LoginRegister";
import LoginRegisterPages from "./menu/LoginRegisterPages";

import moment from "moment";
import StringStore from "./utils/Strings/StringStore";
import CheckoutController from "./checkout/CheckoutController";

import "../styles/newlook/reset.scss";
import "../styles/newlook/fancy.scss";
import PurchaseButton from "./purchase_button/PurchaseButton";

class GafaThemeSDK extends React.Component {
    constructor(props) {
        super(props);

    }

    static emit(eventName, detail) {
        if (typeof window === 'undefined' || typeof document === 'undefined') {
            return;
        }

        let event;
        if (typeof window.CustomEvent === 'function') {
            event = new window.CustomEvent(eventName, {detail: detail});
        } else {
            event = document.createEvent('CustomEvent');
            event.initCustomEvent(eventName, false, false, detail);
        }

        window.dispatchEvent(event);
    }

    static on(eventName, callback) {
        if (typeof window === 'undefined' || !eventName || !callback) {
            return function () {};
        }

        window.addEventListener(eventName, callback);

        return function unsubscribe() {
            window.removeEventListener(eventName, callback);
        };
    }

    static init(config, options, callback) {
        if (typeof window === 'undefined') {
            return Promise.reject(new Error('GafaThemeSDK.init requires a browser runtime'));
        }

        if (typeof config === 'function') {
            callback = config;
            config = null;
            options = {};
        } else if (typeof options === 'function') {
            callback = options;
            options = {};
        }

        options = options || {};

        if (config) {
            window.GFThemeOptions = config;
        }

        return new Promise(function (resolve, reject) {
            try {
                GafaFitSDKWrapper.initValues(function () {
                    StringStore.initLang();

                    if (options.autoRender !== false) {
                        GafaThemeSDK.renderDefaultComponents();
                    }

                    GafaThemeSDK.emit('buq:sdk:ready', {
                        autoRender: options.autoRender !== false,
                    });

                    if (callback) {
                        callback(GafaThemeSDK);
                    }

                    resolve(GafaThemeSDK);
                });
            } catch (error) {
                GafaThemeSDK.emit('buq:sdk:error', {error: error});
                reject(error);
            }
        });
    }

    static reinit(config, options) {
        GlobalStorage.resetValues();
        CalendarStorage.resetValues();

        return GafaThemeSDK.init(config, options);
    }

    static renderDefaultComponents() {
        GafaThemeSDK.renderLogin('[data-gf-theme="login"]');
        GafaThemeSDK.renderRegister('[data-gf-theme="register"]');
        GafaThemeSDK.renderPasswordRecovery('[data-gf-theme="password-recovery"]');
        GafaThemeSDK.renderProfileUserInfo('[data-gf-theme="profile-info"]');
        GafaThemeSDK.renderLoginRegister('[data-gf-theme="login-register"]');
        GafaThemeSDK.renderLoginRegisterPages('[data-gf-theme="login-register-pages"]');
        GafaThemeSDK.renderStaffList('[data-gf-theme="staff-list"]');
        GafaThemeSDK.renderServiceList('[data-gf-theme="service-list"]');
        GafaThemeSDK.renderComboList('[data-gf-theme="combo-list"]');
        GafaThemeSDK.renderMembershipList('[data-gf-theme="membership-list"]');
        GafaThemeSDK.renderMeetingsCalendar('[data-gf-theme="meetings-calendar"]');
        GafaThemeSDK.renderPurchaseBtton('[data-gf-theme="purchase-button"]');
        GafaThemeSDK.ensureFancyContainer();
    }

    static mount(capability, selector, options) {
        const capabilities = {
            calendar: 'renderMeetingsCalendar',
            profile: 'renderProfileUserInfo',
            account: 'renderLoginRegister',
            accountPages: 'renderLoginRegisterPages',
            login: 'renderLogin',
            register: 'renderRegister',
            passwordRecovery: 'renderPasswordRecovery',
            staff: 'renderStaffList',
            services: 'renderServiceList',
            combos: 'renderComboList',
            memberships: 'renderMembershipList',
            purchaseButton: 'renderPurchaseBtton',
        };

        const method = capabilities[capability];

        if (!method || typeof GafaThemeSDK[method] !== 'function') {
            throw new Error(`Unsupported SDK capability: ${capability}`);
        }

        if (options) {
            GafaThemeSDK.applyMountOptions(selector, options);
        }

        GafaThemeSDK[method](selector);

        const handle = {
            capability: capability,
            selector: selector,
            unmount: function () {
                return GafaThemeSDK.unmount(selector);
            },
        };

        GafaThemeSDK.emit('buq:sdk:mounted', {
            capability: capability,
            selector: selector,
        });

        return handle;
    }

    static unmount(target) {
        if (!target) {
            return 0;
        }

        const selector = typeof target === 'string' ? target : target.selector;
        const domContainers = GafaThemeSDK.getContainers(selector);
        let unmounted = 0;

        domContainers.forEach(function (domContainer) {
            if (ReactDOM.unmountComponentAtNode(domContainer)) {
                unmounted++;
            }
        });

        GafaThemeSDK.emit('buq:sdk:unmounted', {
            selector: selector,
            count: unmounted,
        });

        return unmounted;
    }

    static destroy(target) {
        return GafaThemeSDK.unmount(target);
    }

    static getSessionStatus() {
        return new Promise(function (resolve) {
            GafaFitSDKWrapper.getMe(function (me) {
                resolve({
                    authenticated: me !== null,
                    user: me,
                });
            });
        });
    }

    static openAccount(options) {
        options = options || {};
        const container = options.container || GafaThemeSDK.ensureAccountContainer();
        const initial = options.initial || 'login';

        if (!container) {
            throw new Error('GafaThemeSDK.openAccount requires a browser container');
        }

        GafaThemeSDK.renderElementIntoContainer(container, LoginRegister, {
            initial: initial,
            setShowLogin: initial !== 'register' ? function () {} : null,
            setShowRegister: initial === 'register' ? function () {} : null,
            combineWaitlist: options.combineWaitlist === true,
        });

        return {
            container: container,
            close: function () {
                ReactDOM.unmountComponentAtNode(container);
            },
        };
    }

    static openReservationCheckout(params) {
        return CheckoutController.openReservationCheckout(params);
    }

    static openComboCheckout(params) {
        return CheckoutController.openComboCheckout(params);
    }

    static openMembershipCheckout(params) {
        return CheckoutController.openMembershipCheckout(params);
    }

    static openProductCheckout(params) {
        return CheckoutController.openProductCheckout(params);
    }

    static openStoreCheckout(params) {
        return CheckoutController.openStoreCheckout(params);
    }

    static getCheckoutEvents() {
        return CheckoutController.events;
    }

    static applyMountOptions(selector, options) {
        const domContainers = GafaThemeSDK.getContainers(selector);

        domContainers.forEach(function (domContainer) {
            Object.keys(options).forEach(function (key) {
                if (options[key] !== undefined && options[key] !== null) {
                    domContainer.setAttribute(key, options[key]);
                }
            });
        });
    }

    static getContainers(selector) {
        if (typeof document === 'undefined') {
            return [];
        }

        if (!selector) {
            return [];
        }

        if (typeof selector === 'string') {
            return Array.prototype.slice.call(document.querySelectorAll(selector));
        }

        if (selector.nodeType === 1) {
            return [selector];
        }

        if (selector.length) {
            return Array.prototype.slice.call(selector);
        }

        return [];
    }

    static ensureFancyContainer() {
        if (typeof document === 'undefined') {
            return null;
        }

        let fancy = document.querySelector('[data-gf-theme="fancy"]');

        if (!fancy) {
            return null;
        }

        if (fancy.innerHTML === '') {
            fancy.innerHTML = '<div class="spinner"><div class="bounce1"></div><div class="bounce2"></div><div class="bounce3"></div></div>';
        }

        return fancy;
    }

    static ensureAccountContainer() {
        if (typeof document === 'undefined') {
            return null;
        }

        let container = document.querySelector('[data-gf-theme-runtime="account"]');

        if (!container) {
            container = document.createElement('div');
            container.setAttribute('data-gf-theme-runtime', 'account');
            document.body.appendChild(container);
        }

        return container;
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

    static renderElementIntoContainer(domContainer, elementToRender, props) {
        ReactDOM.render(React.createElement(elementToRender, props), domContainer);
    }

    /**
     * Lleva la cuenta de cuantas peticiones de reuniones siguen pendientes
     * (una por cada tramo de fechas x ubicacion/sala que dispara
     * renderMeetingsCalendar). El calendario usa esto para mostrar un
     * indicador chico de "cargando mas dias..." mientras la primera semana ya
     * se ve real pero el resto sigue en camino.
     */
    static incrementPendingMeetingRequests(by = 1) {
        let current = CalendarStorage.get('pendingMeetingRequests') || 0;
        CalendarStorage.set('pendingMeetingRequests', current + by);
    }

    static decrementPendingMeetingRequests() {
        let current = CalendarStorage.get('pendingMeetingRequests') || 0;
        CalendarStorage.set('pendingMeetingRequests', Math.max(0, current - 1));
    }

    //  static renderStaffListWithoutPagination(selector) {
    //    let domContainers = document.querySelectorAll(selector);
    //    if (domContainers.length > 0) {
    //       GafaFitSDKWrapper.getStaffList({}, function (result) {
    //             let props = GafaThemeSDK.propsForPagedListComponent(result);
    //             GafaThemeSDK.renderElementIntoContainers(domContainers, StaffList, props);
    //       });
    //    }
    //  };

    //  static renderLocationsFilter(selector){
    //      let domContainers = document.querySelectorAll(selector);

    //      if (domContainers.length > 0) {
    //          GafaFitSDKWrapper.getBrandList({}, function(result){
    //              let brands = result.data;
    //              let locations = [];

    //              brands.forEach(brand => {
    //                  GafaFitSDKWrapper.getBrandLocationsWithoutBrand(brand.slug, {}, function (result) {
    //                      locations.push(result.data[0]);
    //                      const currentLocation = locations.find(location => location.slug === window.GFtheme.location);

    //                      let props = {
    //                          brands: brands,
    //                          locations: locations,
    //                          currentLocation : currentLocation,
    //                      }

    //                      if(locations.length > 1){
    //                          GafaThemeSDK.renderElementIntoContainers(domContainers, LocationsFilter, props);
    //                      }
    //                  })
    //              });
    //          });
    //      }
    //  }

    static renderStaffList(selector) {
        let domContainers = document.querySelectorAll(selector);
        let brands = GlobalStorage.get('brands');
        let staff = [];
        let props = {};


        if (domContainers.length > 0) {
            domContainers.forEach(function (domContainer) {
                GafaThemeSDK.renderElementIntoContainer(domContainer, StaffList, props);
            });
        }

        brands.forEach(function (brand) {
            GafaFitSDKWrapper.getStaffList(
                brand.slug,
                {per_page: 1000,},
                function (result) {
                    result.data.forEach(function (person) {
                        person.brand = brand;
                        staff.push(person);
                    });
                    GlobalStorage.set('staff', staff);
                });
        });
    };

    static renderServiceList(selector) {
        let domContainers = document.querySelectorAll(selector);
        let brands = GlobalStorage.get('brands');

        let services = [];
        let props = {};

        if (domContainers.length > 0) {
            domContainers.forEach(function (domContainer) {
                GafaThemeSDK.renderElementIntoContainer(domContainer, ServiceList, props);
            });
        }

        brands.forEach(function (brand) {
            GafaFitSDKWrapper.getServiceList(
                brand.slug,
                {
                    per_page: 1000,
                }
                , function (result) {
                    services = services.concat(result.data);
                    GlobalStorage.set('services', services);
                }
            );
        });
    };

    static renderComboList(selector) {
        let domContainers = document.querySelectorAll(selector);
        let brands = GlobalStorage.get('brands');
        let combos = [];
        let props = {};

        if (domContainers.length > 0) {
            domContainers.forEach(function (domContainer) {
                let byName = domContainer.getAttribute("data-gf-filterbyname");
                let byBrand = domContainer.getAttribute("data-buq-brand");
                let blockAfterLogin = domContainer.getAttribute("data-bq-block-after-login") ? domContainer.getAttribute("data-bq-block-after-login") === 'true' : false;
                props.filterByName = byName;
                props.filterByBrand = byBrand;
                props.block_after_login = blockAfterLogin;

                GafaThemeSDK.renderElementIntoContainer(domContainer, ComboList, props);
            });
        }

        brands.forEach(function (brand) {
            GafaFitSDKWrapper.getComboList(brand.slug,
                {per_page: 10000, only_actives: true, propagate: true},
                function (result) {
                    combos = combos.concat(result.data);
                    GlobalStorage.set('combos', combos);
                }
            );
        });
    };

    static renderMembershipList(selector) {
        let domContainers = document.querySelectorAll(selector);
        let brands = GlobalStorage.get('brands');
        let memberships = [];
        let props = {};
        if (domContainers.length > 0) {
            domContainers.forEach(function (domContainer) {
                let byName = domContainer.getAttribute("data-gf-filterbyname");
                let byBrand = domContainer.getAttribute("data-buq-brand");
                let blockAfterLogin = domContainer.getAttribute("data-bq-block-after-login") ? domContainer.getAttribute("data-bq-block-after-login") === 'true' : false;
                props.filterByName = byName;
                props.filterByBrand = byBrand;
                props.block_after_login = blockAfterLogin;
                GafaThemeSDK.renderElementIntoContainer(domContainer, MembershipList, props);
            });
        }

        brands.forEach(function (brand) {
            GafaFitSDKWrapper.getMembershipList(
                brand.slug,
                {per_page: 10000, only_actives: true, propagate: true},
                function (result) {
                    result.data.forEach(function (item) {
                        item.brand = brand;
                        memberships.push(item);
                    });
                    GlobalStorage.set('memberships', memberships);
                }
            );
        });
    };

    static renderMeetingsCalendar(selector) {
        let domContainers = document.querySelectorAll(selector);
        let locations = GlobalStorage.get('locations');
        let daaMin = null;
        let dataMax = null;

        if (Array.isArray(locations)) {
            locations.forEach(location => {
                if (!daaMin || new Date(location.since) < new Date(daaMin)) {
                    daaMin = location.since; // Encuentra la fecha mínima
                }
                if (!dataMax || new Date(location.until) > new Date(dataMax)) {
                    dataMax = location.until; // Encuentra la fecha máxima
                }
            });
        } else {
            console.log("No es un array o los datos no están en el formato esperado.");
        }

        let meetings = [];
        let partial_loading = false;

        if (domContainers.length > 0) {
            domContainers.forEach(function (domContainer) {
                let limit = domContainer.getAttribute("data-gf-limit") ? domContainer.getAttribute("data-gf-limit") : '';
                let filterService = domContainer.getAttribute("filter-bq-service") ? Boolean(domContainer.getAttribute("filter-bq-service")) : false;
                let filterServiceDefault = domContainer.getAttribute("filter-bq-service-default") ? domContainer.getAttribute("filter-bq-service-default") : undefined;
                let filterStaff = domContainer.getAttribute("filter-bq-staff") ? Boolean(domContainer.getAttribute("filter-bq-staff")) : false;
                let filterStaffDefault = domContainer.getAttribute("filter-bq-staff-default") ? domContainer.getAttribute("filter-bq-staff-default") : undefined;
                let filterRoom = domContainer.getAttribute("filter-bq-room") ? Boolean(domContainer.getAttribute("filter-bq-room")) : false;
                let filterRoomDefault = domContainer.getAttribute("filter-bq-room-default") ? domContainer.getAttribute("filter-bq-room-default") : undefined;
                let filterLocation = domContainer.getAttribute("filter-bq-location") ? Boolean(domContainer.getAttribute("filter-bq-location")) : false;
                let filterLocationDefault = domContainer.getAttribute("filter-bq-location-default") ? domContainer.getAttribute("filter-bq-location-default") : false;
                let filterBrand = domContainer.getAttribute("filter-bq-brand") ? Boolean(domContainer.getAttribute("filter-bq-brand")) : false;
                let filterBrandDefault = domContainer.getAttribute("filter-bq-brand-default") ? domContainer.getAttribute("filter-bq-brand-default") : undefined;
                let loginInitial = domContainer.getAttribute("data-login-initial") ? domContainer.getAttribute("data-login-initial") : false;
                let showDescription = domContainer.getAttribute("data-bq-show-description") ? domContainer.getAttribute("data-bq-show-description") === 'true' : false;
                let blockAfterLogin = domContainer.getAttribute("data-bq-block-after-login") ? domContainer.getAttribute("data-bq-block-after-login") === 'true' : false;
                let visualization = domContainer.getAttribute("data-bq-calendar-visualization") ? domContainer.getAttribute("data-bq-calendar-visualization") : false;
                partial_loading = domContainer.getAttribute("data-bq-partial-loading") ? Boolean(domContainer.getAttribute("data-bq-partial-loading")) : false;
                let show_parent = domContainer.getAttribute("data-bq-show-parent") ? Boolean(domContainer.getAttribute("data-bq-show-parent")) : false;

                if (limit) {
                    if (limit > 3 && limit < 6) {
                        limit = limit;
                    } else if (limit < 3) {
                        limit = 3;
                    } else if (limit > 6) {
                        limit = limit;
                    }
                }

                let props = {
                    'limit': limit,
                    'filter_service': filterService,
                    'filter_service_default': filterServiceDefault,
                    'filter_staff': filterStaff,
                    'filter_staff_default': filterStaffDefault,
                    'filter_room': filterRoom,
                    'filter_room_default': filterRoomDefault,
                    'filter_location': filterLocation,
                    'filter_location_default': filterLocationDefault,
                    'filter_brand': filterBrand,
                    'filter_brand_default': filterBrandDefault,
                    'login_initial': loginInitial,
                    'show_description': showDescription,
                    'block_after_login': blockAfterLogin,
                    'visualization': visualization,
                    'show_parent': show_parent,
                    'date_min': daaMin,
                    'date_max': dataMax,
                };

                GafaThemeSDK.renderElementIntoContainer(domContainer, Calendar, props);
            });
        }

        let rooms = GlobalStorage.get('rooms');


        locations.forEach(function (location, location_index) {
            let start_date = moment().toDate();
            let end_date = moment().toDate();

            start_date = !location.date_start ? start_date : moment(location.date_start).toDate();
            end_date.setDate(start_date.getDate() + (location.calendar_days - 1));

            let start_string = `${start_date.getFullYear()}-${start_date.getMonth() + 1}-${start_date.getDate()}`;
            let end_string = `${end_date.getFullYear()}-${end_date.getMonth() + 1}-${end_date.getDate()}`;

            if (partial_loading) {
                let location_rooms = rooms.filter(function (room) {
                    return location.id === room.locations_id && room.status === 'active';
                });
                if (location_rooms.length) {
                    let index = 0;
                    GafaThemeSDK.incrementPendingMeetingRequests();
                    let process_room_meetings = function (result) {
                        result.forEach(function (meeting) {
                            meeting.location = location;
                            meetings.push(meeting);
                        });
                        let next_room = location_rooms[index + 1];
                        if (!!next_room) {
                            index++;
                            GafaThemeSDK.incrementPendingMeetingRequests();
                            GafaFitSDKWrapper.getMeetingsInRoom(next_room.id, location.id, start_string, end_string, process_room_meetings);
                        } else {
                            CalendarStorage.set('meetings', meetings);
                            CalendarStorage.set('start_date', start_date);
                        }
                        GafaThemeSDK.decrementPendingMeetingRequests();
                    };

                    let room = location_rooms[index];
                    if (!!room) {
                        GafaFitSDKWrapper.getMeetingsInRoom(room.id, location, start_string, end_string, process_room_meetings);
                    }

                }
            } else {
                let mergeMeetingsResult = function (result) {
                    result.forEach(function (meeting) {
                        meeting.location = location;
                        meetings.push(meeting);
                    });
                    CalendarStorage.set('meetings', meetings);
                    if (location_index === 0)
                        CalendarStorage.set('start_date', start_date);
                    GafaThemeSDK.decrementPendingMeetingRequests();
                };

                // Antes se pedian TODOS los dias de location.calendar_days en una sola
                // llamada (p.ej. 21 dias de golpe), aunque la vista inicial solo muestra
                // 7. Eso hacia que el usuario esperara el payload completo (que puede ser
                // de varios MB con muchas reuniones) antes de ver una sola clase.
                //
                // Ahora, si el rango es mayor a FIRST_CHUNK_DAYS, se piden 2 tramos EN
                // PARALELO: la primera semana (para pintar rapido) y el resto del rango
                // (para que "siguiente semana" siga funcionando exactamente igual que
                // antes, sin cambiar esa logica). El resultado final acumulado en
                // `meetings` es identico al de antes, solo que llega en 2 partes en vez
                // de 1, y la primera parte llega mucho mas rapido.
                //
                // GetlocationMeetingList trata `end` como exclusivo. El primer tramo
                // tiene que pedir start + FIRST_CHUNK_DAYS (no - 1); si no, el ultimo
                // dia visible de la semana queda fuera de ambos requests.
                const FIRST_CHUNK_DAYS = 7;
                const totalDays = location.calendar_days || FIRST_CHUNK_DAYS;

                if (totalDays > FIRST_CHUNK_DAYS) {
                    let firstChunkEnd = new Date(start_date.getTime());
                    firstChunkEnd.setDate(start_date.getDate() + FIRST_CHUNK_DAYS);
                    let firstChunkEndString = `${firstChunkEnd.getFullYear()}-${firstChunkEnd.getMonth() + 1}-${firstChunkEnd.getDate()}`;

                    let restStart = new Date(start_date.getTime());
                    restStart.setDate(start_date.getDate() + FIRST_CHUNK_DAYS);
                    let restStartString = `${restStart.getFullYear()}-${restStart.getMonth() + 1}-${restStart.getDate()}`;

                    GafaThemeSDK.incrementPendingMeetingRequests(2);
                    GafaFitSDKWrapper.getMeetingsInLocation(location, start_string, firstChunkEndString, mergeMeetingsResult);
                    GafaFitSDKWrapper.getMeetingsInLocation(location, restStartString, end_string, mergeMeetingsResult);
                } else {
                    GafaThemeSDK.incrementPendingMeetingRequests();
                    GafaFitSDKWrapper.getMeetingsInLocation(location, start_string, end_string, mergeMeetingsResult);
                }
            }

        });
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
            domContainers.forEach(function (domContainer) {
                let combineWaitlist = domContainer.getAttribute("data-bq-combine-waitlist") ? domContainer.getAttribute("data-bq-combine-waitlist") === 'true' : false;
                GafaThemeSDK.renderElementIntoContainer(domContainer, ProfileUserInfo, {
                    combineWaitlist: combineWaitlist
                });
            });
        }
    };

    static renderLoginRegister(selector) {
        let domContainers = document.querySelectorAll(selector);

        if (domContainers.length > 0) {
            domContainers.forEach(function (domContainer) {
                let initial = domContainer.getAttribute("data-gf-initial") ? domContainer.getAttribute("data-gf-initial") : 'login';
                let allowsPreLoading = domContainer.getAttribute("data-bq-preloading") ? domContainer.getAttribute("data-bq-preloading") === 'true' : false;
                let combineWaitlist = domContainer.getAttribute("data-bq-combine-waitlist") ? domContainer.getAttribute("data-bq-combine-waitlist") === 'true' : false;

                GafaThemeSDK.renderElementIntoContainer(domContainer, LoginRegister, {
                    initial: initial,
                    allowsPreLoading: allowsPreLoading,
                    combineWaitlist: combineWaitlist,
                });
            });
        }

        GafaFitSDKWrapper.getCatalogSpecialTextsGroupsWithFields(1, {'section': 'register'}, function (result) {
            GlobalStorage.set('special_texts_register', result);
        });
    };

    static renderLoginRegisterPages(selector) {
        let domContainers = document.querySelectorAll(selector);

        if (domContainers.length > 0) {
            domContainers.forEach(function (domContainer) {
                let initial = domContainer.getAttribute("data-gf-initial") ? domContainer.getAttribute("data-gf-initial") : 'login';
                let allowsPreLoading = domContainer.getAttribute("data-bq-preloading") ? domContainer.getAttribute("data-bq-preloading") === 'true' : false;
                let combineWaitlist = domContainer.getAttribute("data-bq-combine-waitlist") ? domContainer.getAttribute("data-bq-combine-waitlist") === 'true' : false;
                let baseUrl = domContainer.getAttribute("data-gf-base-url") ? domContainer.getAttribute("data-gf-base-url") : '/auth';

                GafaThemeSDK.renderElementIntoContainer(domContainer, LoginRegisterPages, {
                    initial: initial,
                    allowsPreLoading: allowsPreLoading,
                    combineWaitlist: combineWaitlist,
                    baseUrl: baseUrl,
                });
            });
        }

        GafaFitSDKWrapper.getCatalogSpecialTextsGroupsWithFields(1, {'section': 'register'}, function (result) {
            GlobalStorage.set('special_texts_register', result);
        });
    };

    static renderPurchaseBtton(selector) {
        let buttons = document.querySelectorAll(selector);

        if (buttons.length > 0) {
            buttons.forEach(function (button) {
                let domContainer = document.createElement('div');
                domContainer.style.display = 'none';
                GafaThemeSDK.renderElementIntoContainer(domContainer, PurchaseButton, {
                    container: button,
                    combo_id: button.getAttribute('data-bq-combo-id'),
                    membership_id: button.getAttribute('data-bq-membership-id'),
                    product_id: button.getAttribute('data-bq-product-id'),
                    reservation_id: button.getAttribute('data-bq-reservation-id'),
                    location_id: button.getAttribute('data-bq-location-id'),
                    default_store_tab: button.getAttribute('data-bq-default-store-tab'),
                    no_loading: button.getAttribute('data-bq-no-loading') === 'true'
                })
                button.append(domContainer);
            });
        }
    }

}

export default GafaThemeSDK;
