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

    /**
     * Devuelve los contenedores que todavia no tienen un componente montado, y los
     * marca.
     *
     * Algunos sitios host reinyectan el bundle en cada render de su ruta (Bunker lo
     * agrega con un ?t=<timestamp> distinto cada vez): el navegador lo ejecuta de
     * nuevo, app.js repite todo el arranque y se duplican los montajes y las
     * peticiones. Cada ejecucion tiene su propio registro de modulos, asi que el DOM
     * es lo unico que comparten y por eso la marca vive ahi. Un contenedor nuevo,
     * remontado por el sitio, no trae la marca y se renderiza normal.
     */
    static takePendingContainers(domContainers) {
        let pending = Array.prototype.filter.call(domContainers, function (domContainer) {
            return domContainer.getAttribute('data-gf-mounted') !== 'true';
        });

        pending.forEach(function (domContainer) {
            domContainer.setAttribute('data-gf-mounted', 'true');
        });

        return pending;
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
        // Sin contenedor no hay nada que mostrar: antes se pedia la lista igual, en
        // paginas que ni siquiera la usan.
        let domContainers = GafaThemeSDK.takePendingContainers(document.querySelectorAll(selector));
        if (!domContainers.length) {
            return;
        }

        let brands = GlobalStorage.get('brands');
        let staff = [];
        let props = {};

        domContainers.forEach(function (domContainer) {
            GafaThemeSDK.renderElementIntoContainer(domContainer, StaffList, props);
        });

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
        let domContainers = GafaThemeSDK.takePendingContainers(document.querySelectorAll(selector));
        if (!domContainers.length) {
            return;
        }

        let brands = GlobalStorage.get('brands');

        let services = [];
        let props = {};

        domContainers.forEach(function (domContainer) {
            GafaThemeSDK.renderElementIntoContainer(domContainer, ServiceList, props);
        });

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
        let domContainers = GafaThemeSDK.takePendingContainers(document.querySelectorAll(selector));
        if (!domContainers.length) {
            return;
        }

        let brands = GlobalStorage.get('brands');
        let combos = [];
        let props = {};

        domContainers.forEach(function (domContainer) {
            let byName = domContainer.getAttribute("data-gf-filterbyname");
            let byBrand = domContainer.getAttribute("data-buq-brand");
            let blockAfterLogin = domContainer.getAttribute("data-bq-block-after-login") ? domContainer.getAttribute("data-bq-block-after-login") === 'true' : false;
            props.filterByName = byName;
            props.filterByBrand = byBrand;
            props.block_after_login = blockAfterLogin;

            GafaThemeSDK.renderElementIntoContainer(domContainer, ComboList, props);
        });

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
        let domContainers = GafaThemeSDK.takePendingContainers(document.querySelectorAll(selector));
        if (!domContainers.length) {
            return;
        }

        let brands = GlobalStorage.get('brands');
        let memberships = [];
        let props = {};

        domContainers.forEach(function (domContainer) {
            let byName = domContainer.getAttribute("data-gf-filterbyname");
            let byBrand = domContainer.getAttribute("data-buq-brand");
            let blockAfterLogin = domContainer.getAttribute("data-bq-block-after-login") ? domContainer.getAttribute("data-bq-block-after-login") === 'true' : false;
            props.filterByName = byName;
            props.filterByBrand = byBrand;
            props.block_after_login = blockAfterLogin;
            GafaThemeSDK.renderElementIntoContainer(domContainer, MembershipList, props);
        });

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

        // Si ya hay un calendario montado en el contenedor, sigue vivo y con sus datos:
        // ni se remonta ni se vuelven a pedir los horarios (que son las llamadas mas
        // caras de toda la pagina).
        domContainers = GafaThemeSDK.takePendingContainers(domContainers);
        if (!domContainers.length) {
            return;
        }

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
        // Se usa fuera del forEach para priorizar la ubicacion filtrada al pedir
        // las reuniones (ver el reparto priority/deferred mas abajo).
        let filter_location_default = false;

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
                filter_location_default = filterLocationDefault;
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

        // El calendario se revela cuando la vista inicial ya tiene TODOS sus datos.
        // Antes se revelaba en cuanto contestaba la primera ubicacion: en sitios con
        // varias sedes el usuario veia el esqueleto desaparecer y quedarse un
        // calendario casi vacio, que crecia a saltos durante 1-2 segundos (se lee
        // como un parpadeo en blanco). El esqueleto ahora se mantiene hasta que las
        // ubicaciones de la vista inicial terminaron su primer tramo.
        const INITIAL_REVEAL_TIMEOUT_MS = 8000;
        // Sitios con muchas sedes y sin filtro por defecto tendrian que esperar a la
        // sede mas lenta. En cuanto llega la primera respuesta se abre una ventana de
        // gracia corta: si las demas no alcanzan a llegar, se muestra lo que haya.
        const INITIAL_REVEAL_GRACE_MS = 1500;
        let deferredRequests = [];
        let pendingInitialRequests = 0;
        let initialRevealed = false;
        let revealTimeoutId = null;
        let graceTimeoutId = null;

        let revealCalendar = function () {
            if (initialRevealed) {
                return;
            }
            initialRevealed = true;
            if (revealTimeoutId) {
                clearTimeout(revealTimeoutId);
                revealTimeoutId = null;
            }
            if (graceTimeoutId) {
                clearTimeout(graceTimeoutId);
                graceTimeoutId = null;
            }
            CalendarStorage.set('initial_meetings_ready', true);

            let queued = deferredRequests;
            deferredRequests = [];
            queued.forEach(function (runRequest) {
                runRequest();
            });
        };

        let finishInitialRequest = function () {
            pendingInitialRequests = Math.max(0, pendingInitialRequests - 1);
            if (pendingInitialRequests === 0) {
                revealCalendar();
                return;
            }
            if (!graceTimeoutId && !initialRevealed) {
                graceTimeoutId = setTimeout(revealCalendar, INITIAL_REVEAL_GRACE_MS);
            }
        };

        // GafaFitSDKWrapper.getMeetingsInLocation solo invoca su callback cuando
        // error === null: una peticion que falle nunca decrementaria el contador y
        // dejaria el esqueleto puesto para siempre. Este timeout es la red de seguridad.
        revealTimeoutId = setTimeout(revealCalendar, INITIAL_REVEAL_TIMEOUT_MS);

        let requestMeetingsForLocation = function (location, is_first_location, is_initial) {
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
                            // Aqui se pide sala por sala en cadena, no por tramos de fecha:
                            // la ubicacion esta lista cuando termina su ultima sala.
                            if (is_initial) {
                                finishInitialRequest();
                            }
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
                    if (is_first_location)
                        CalendarStorage.set('start_date', start_date);
                    GafaThemeSDK.decrementPendingMeetingRequests();
                };

                // Solo el primer tramo cuenta para revelar el calendario: el resto
                // del rango sigue llegando en segundo plano con su propio indicador.
                let mergeFirstChunkResult = function (result) {
                    mergeMeetingsResult(result);
                    if (is_initial) {
                        finishInitialRequest();
                    }
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
                const FIRST_CHUNK_DAYS = 7;
                const totalDays = location.calendar_days || FIRST_CHUNK_DAYS;

                if (totalDays > FIRST_CHUNK_DAYS) {
                    // El `end` de la API es EXCLUSIVO (start=11&end=11 devuelve cero
                    // reuniones, verificado contra produccion). El corte del primer
                    // tramo tiene que caer en el mismo dia donde empieza el segundo,
                    // o ese dia no lo pide nadie y desaparece del calendario.
                    let firstChunkEnd = new Date(start_date.getTime());
                    firstChunkEnd.setDate(start_date.getDate() + FIRST_CHUNK_DAYS);
                    let firstChunkEndString = `${firstChunkEnd.getFullYear()}-${firstChunkEnd.getMonth() + 1}-${firstChunkEnd.getDate()}`;

                    let restStart = new Date(start_date.getTime());
                    restStart.setDate(start_date.getDate() + FIRST_CHUNK_DAYS);
                    let restStartString = `${restStart.getFullYear()}-${restStart.getMonth() + 1}-${restStart.getDate()}`;

                    GafaThemeSDK.incrementPendingMeetingRequests(2);
                    GafaFitSDKWrapper.getMeetingsInLocation(location, start_string, firstChunkEndString, mergeFirstChunkResult);
                    GafaFitSDKWrapper.getMeetingsInLocation(location, restStartString, end_string, mergeMeetingsResult);
                } else {
                    GafaThemeSDK.incrementPendingMeetingRequests();
                    GafaFitSDKWrapper.getMeetingsInLocation(location, start_string, end_string, mergeFirstChunkResult);
                }
            }
        };

        // Cuando el sitio fija una sede por defecto (atributo filter-bq-location-default,
        // que varios clientes ponen desde la URL con un snippet), esa sede es la unica
        // que el usuario va a ver al abrir la pagina. Se pide primero y sola; las demas
        // se piden despues, en segundo plano, para que el selector de sede las siga
        // ofreciendo. Antes se pedian todas de golpe: en Fitspin son 6 ubicaciones (12
        // peticiones) para mostrar 1.
        let priorityLocations = [];
        let deferredLocations = [];

        if (filter_location_default) {
            locations.forEach(function (location) {
                if (location.name === filter_location_default) {
                    priorityLocations.push(location);
                } else {
                    deferredLocations.push(location);
                }
            });
        }

        // Sin filtro por defecto (o si el nombre no coincide con ninguna sede) se
        // mantiene el comportamiento de siempre: todas las ubicaciones en paralelo.
        if (!priorityLocations.length) {
            priorityLocations = locations;
            deferredLocations = [];
        }

        pendingInitialRequests = priorityLocations.length;

        priorityLocations.forEach(function (location, location_index) {
            requestMeetingsForLocation(location, location_index === 0, true);
        });

        deferredLocations.forEach(function (location) {
            deferredRequests.push(function () {
                requestMeetingsForLocation(location, false, false);
            });
        });

        if (!pendingInitialRequests) {
            revealCalendar();
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
            let combineWaitlist = domContainer.getAttribute("data-bq-combine-waitlist") ? domContainer.getAttribute("data-bq-combine-waitlist") === 'true' : false;
            GafaThemeSDK.renderElementIntoContainers(domContainers, ProfileUserInfo, {
                combineWaitlist: combineWaitlist
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
