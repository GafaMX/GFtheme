'use strict';

import React from "react";
import ReactDOM from "react-dom";
import GlobalStorage from "./store/GlobalStorage";

import ServiceList from "./service/ServiceList";
import StaffList from "./staff/StaffList";
import Login from "./auth/Login";
import LocationsFilter from "./locations/LocationsFilters"
import GafaFitSDKWrapper from "./utils/GafaFitSDKWrapper";
import ComboList from "./combo/ComboList";
import MembershipList from "./membership/MembershipList";
import Register from "./auth/Register";
import PasswordRecovery from "./auth/PasswordRecovery";
import Calendar from "./calendar/Calendar";
import ProfileUserInfo from "./profile/info/ProfileUserInfo";
import LoginRegister from "./menu/LoginRegister";

import "../styles/newlook/reset.scss";
import "../styles/newlook/fancy.scss";

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
      if (domContainers.length > 0) {
         domContainers.forEach(function (domContainer) {
            let staff = [];
            let props = {};   
            
            brands.forEach(function(brand){
               GafaFitSDKWrapper.getStaffList(
               brand.slug,
               {per_page: 1000, }, 
               function (result) {
                  result.data.forEach(function(person){
                     person.brand = brand;
                     staff.push(person);
                  });
                  GlobalStorage.set('staff', staff);
                  GafaThemeSDK.renderElementIntoContainer(domContainer, StaffList, props);
               });
            });
         });
      }
   };

   static renderServiceList(selector) {
      let domContainers = document.querySelectorAll(selector);
      let brands = GlobalStorage.get('brands');
      if (domContainers.length > 0) {
         domContainers.forEach(function (domContainer) {
            let services = [];
            let props = {};
            brands.forEach(function(brand){
               GafaFitSDKWrapper.getServiceList(
                  brand.slug,
                  {per_page: 1000, }
                  , function (result) {
                     services = services.concat(result.data);
                     GlobalStorage.set('services', services);
                     GafaThemeSDK.renderElementIntoContainer(domContainer, ServiceList, props);
                  }   
               );
            });
         });
      }
   };

   static renderComboList(selector) {
      let domContainers = document.querySelectorAll(selector);
      let brands = GlobalStorage.get('brands');
      if (domContainers.length > 0) {
         domContainers.forEach(function (domContainer) {
            let byName = domContainer.getAttribute("data-gf-filterbyname");
            let byBrand = domContainer.getAttribute("data-buq-brand");
            let combos = [];
            let props = {};

            brands.forEach(function(brand){
               GafaFitSDKWrapper.getComboList( brand.slug,
                  {per_page: 10000, only_actives: true, propagate: true},
                  function (result) {
                     props.filterByName = byName;
                     props.filterByBrand = byBrand;
                     combos = combos.concat(result.data);
                     GlobalStorage.set('combos', combos);
                     GafaThemeSDK.renderElementIntoContainer(domContainer, ComboList, props);
                  }
               );
            });
            
         });
      }
   };

   static renderMembershipList(selector) {
      let domContainers = document.querySelectorAll(selector);
      let brands = GlobalStorage.get('brands');
      if (domContainers.length > 0) {
         domContainers.forEach(function (domContainer) {
            let byName = domContainer.getAttribute("data-gf-filterbyname");
            let byBrand = domContainer.getAttribute("data-buq-brand");
            let memberships = [];
            let props = {};

            brands.forEach(function(brand){
               GafaFitSDKWrapper.getMembershipList(
                  brand.slug,
                  {per_page: 10000, only_actives: true, propagate: true}, 
                  function (result) {
                     props.filterByName = byName;
                     props.filterByBrand = byBrand;
                     memberships = memberships.concat(result.data);
                     GlobalStorage.set('memberships', memberships);
                     GafaThemeSDK.renderElementIntoContainer(domContainer, MembershipList, props);
                  }
               );
            });
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
         domContainers.forEach(function (domContainer) {
            let limit = domContainer.getAttribute("data-gf-limit") ? domContainer.getAttribute("data-gf-limit") : '';
            let filterService = domContainer.getAttribute("filter-bq-service") ? Boolean(domContainer.getAttribute("filter-bq-service")) : false;
            let filterServiceDefault = domContainer.getAttribute("filter-bq-service-default") ? domContainer.getAttribute("filter-bq-service-default") : undefined;
            let filterStaff = domContainer.getAttribute("filter-bq-staff") ? Boolean(domContainer.getAttribute("filter-bq-staff")) : false;
   
            if(limit){
               if(limit > 3 && limit < 6){
                     limit = limit;
               } else if(limit < 3 ){
                     limit = 3;
               } else if(limit > 6){
                     limit = limit;
               }
            }
   
            let props = {
               'limit': limit,
               'filter_service': filterService,
               'filter_service_default': filterServiceDefault,
               'filter_staff': filterStaff,
            };
   
            GafaThemeSDK.renderElementIntoContainer(domContainer, Calendar, props);
         });
      }
   }

   // static renderMeetingsCalendarWithoutLimit(selector) {
   //    let domContainers = document.querySelectorAll(selector);
   //    if (domContainers.length > 0) {
   //       domContainers.forEach(function(domContainer) {
   //          GafaFitSDKWrapper.getBrandLocations({
   //              'page': 1,
   //              'per_page': 1000,
   //          }, function (result) {
   //              let limit = domContainer.getAttribute("data-gf-limit") ? domContainer.getAttribute("data-gf-limit") : 1000;
   //              let alignment = domContainer.getAttribute("config-bq-cal-alignment") ? domContainer.getAttribute("config-bq-cal-alignment") : 'vertical';
   //              let locations = result.data;

   //             if(limit){
   //                if(limit > 3 && limit < 6){
   //                   limit = limit;
   //                } else if(limit < 3 ){
   //                   limit = 3;
   //                } else if(limit > 6){
   //                   limit = 6;
   //                }
   //             }
   //             let props = {
   //               'locations': locations,
   //               'limit': limit,
   //               'alignment': alignment,
   //             };
   //             GafaThemeSDK.renderElementIntoContainer(domContainer, Calendar, props);
   //          });
   //       });
   //    }
   // }

    static renderLoginRegister(selector) {
        let domContainers = document.querySelectorAll(selector);
        if (domContainers.length > 0) {
            GafaThemeSDK.renderElementIntoContainers(domContainers, LoginRegister, {});
        }
    };
}

export default GafaThemeSDK;
