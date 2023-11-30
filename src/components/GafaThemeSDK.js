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
import ProfileUserInfo from "./profile/info/ProfileUserInfo";
import LoginRegister from "./menu/LoginRegister";

import moment from "moment";

import "../styles/newlook/reset.scss";
import "../styles/newlook/fancy.scss";
import PurchaseButton from "./purchase_button/PurchaseButton";

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

    static renderElementIntoContainer(domContainer, elementToRender, props) {
        ReactDOM.render(React.createElement(elementToRender, props), domContainer);
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
                {per_page: 1000,}
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
                    'visualization': visualization
                };

                GafaThemeSDK.renderElementIntoContainer(domContainer, Calendar, props);
            });
        }

        let rooms = GlobalStorage.get('rooms');


        locations.forEach(function (location) {
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
                    let process_room_meetings = function (result) {
                        result.forEach(function (meeting) {
                            meeting.location = location;
                            meetings.push(meeting);
                        });
                        let next_room = location_rooms[index + 1];
                        if (!!next_room) {
                            index++;
                            GafaFitSDKWrapper.getMeetingsInRoom(next_room.id, location.id, start_string, end_string, process_room_meetings);
                        } else {
                            CalendarStorage.set('meetings', meetings);
                            CalendarStorage.set('start_date', start_date);
                        }
                    };

                    let room = location_rooms[index];
                    if (!!room) {
                        GafaFitSDKWrapper.getMeetingsInRoom(room.id, location.id, start_string, end_string, process_room_meetings);
                    }

                }
            } else {
                GafaFitSDKWrapper.getMeetingsInLocation(location.id, start_string, end_string, function (result) {
                    result.forEach(function (meeting) {
                        meeting.location = location;
                        meetings.push(meeting);
                    });
                    CalendarStorage.set('meetings', meetings);
                    CalendarStorage.set('start_date', start_date);
                });
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
            GafaThemeSDK.renderElementIntoContainers(domContainers, ProfileUserInfo, {});
        }
    };

    static renderLoginRegister(selector) {
        let domContainers = document.querySelectorAll(selector);

        if (domContainers.length > 0) {
            domContainers.forEach(function (domContainer) {
                let initial = domContainer.getAttribute("data-gf-initial") ? domContainer.getAttribute("data-gf-initial") : 'login';
                let allowsPreLoading = domContainer.getAttribute("data-bq-preloading") ? domContainer.getAttribute("data-bq-preloading") === 'true' : false;

                GafaThemeSDK.renderElementIntoContainer(domContainer, LoginRegister, {
                    initial: initial,
                    allowsPreLoading: allowsPreLoading
                });
            });
        }

        GafaFitSDKWrapper.getCatalogSpecialTextsGroupsWithFields(1, ['register'], function (result) {
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
