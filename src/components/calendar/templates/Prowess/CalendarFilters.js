'use strict';

import React from "react";
import Select from 'react-select';
import Strings from "../../../utils/Strings/Strings_ES";
import GafaFitSDKWrapper from "../../../utils/GafaFitSDKWrapper";
import CalendarStorage from "../../CalendarStorage";


export default class CalendarFiltersProwess extends React.Component {
    constructor() {
        super();

        this.state = {
            services: [],
            room_groups: [],
            has_next: true,
            has_prev: false,
            location: {},
            // serviceRender: '',
            locations: CalendarStorage.get('locations'),
        };

        CalendarStorage.addSegmentedListener(['locations', 'rooms', 'filter_location'], this.updateRooms.bind(this));
        CalendarStorage.addSegmentedListener(['meetings'], this.updateServices.bind(this));
        CalendarStorage.addSegmentedListener(['start_date'], this.updateStart.bind(this));
        CalendarStorage.addSegmentedListener(['locations'], this.updateLocations.bind(this));

        this.nextWeek = this.nextWeek.bind(this);
        this.prevWeek = this.prevWeek.bind(this);
        this.hasNextPrev = this.hasNextPrev.bind(this);
        this.getNextButton = this.getNextButton.bind(this);
        this.selectLocation = this.selectLocation.bind(this);
    }

    updateServices() {
        let meetings = CalendarStorage.get('meetings');
        let services = [];

        meetings.forEach(function (meeting) {
            let service = meeting.service;
            if (service && !services.find(o => o.id === service.id)) {
                services.push(service);
            }
        });

        this.setState({
            services: services
        });

        CalendarStorage.set('services', services);
    }

    updateLocations() {
        let locations = CalendarStorage.get('locations');
        let start_date = new Date();
        let end_date = new Date();
        this.setState({
            locations: locations,
        });

        CalendarStorage.set('meetings', []);
        CalendarStorage.set('start_date', start_date);
        CalendarStorage.set('filter_location', null);
        CalendarStorage.set('filter_service', null);
        let push_meetings = function (result) {
            CalendarStorage.push('meetings', result);
            CalendarStorage.set('start_date', start_date);
        };

        locations.forEach(function (location) {
            end_date.setDate(start_date.getDate() + (location.calendar_days - 1));
            let start_string = `${start_date.getFullYear()}-${start_date.getMonth() + 1}-${start_date.getDate()}`;
            let end_string = `${end_date.getFullYear()}-${end_date.getMonth() + 1}-${end_date.getDate()}`;
            GafaFitSDKWrapper.getMeetingsInLocation(location.id, start_string, end_string, push_meetings);
        });
    }

    updateRooms() {
        let show_rooms = [];
        let rooms = CalendarStorage.get('rooms');
        let location = CalendarStorage.get('filter_location');
        let locations = CalendarStorage.get('locations');
        let groups = [];

        locations.forEach(function (location) {
            let obj = {
                location: location,
                rooms: []
            };
            obj.rooms = rooms.filter(function (room) {
                return room.locations_id === location.id;
            });

            groups.push(obj);
        });

        if (location) {
            show_rooms = groups.filter(function (group) {
                return group.location.id === location.id;
            })
        } else {
            show_rooms = groups;
        }

        this.setState({
            room_groups: show_rooms
        });
    }

    updateStart() {
        this.setState({
            has_next: this.hasNextPrev(),
            has_prev: this.hasNextPrev(false)
        })
    }

    // selectFilter(name, origin, id, serviceRender) {
    selectFilter(e) {
        // e.preventDefault();
        let name = e.target.getAttribute('data-name');
        let origin = e.target.getAttribute('data-origin');
        let id = e.target.value;

        let model = null;
        if (id && id !== '')
        model = CalendarStorage.find(origin, id);
            CalendarStorage.set(name, model);
    }

    updateStore(e) {
        let val = e.target.value;
        let name = e.target.getAttribute('data-name');
        CalendarStorage.set(name, val);
    }

    selectLocation(e) {
        this.selectFilter(e);
        this.refs.room.value = '';
    }
    
    selectBrand(e) {
        this.selectFilter(e);
        let brandGlobal = CalendarStorage.get('filter_brand');
        let meetings = CalendarStorage.get('meetings');
        window.GFtheme.brand = brandGlobal.slug;
        GafaFitSDKWrapper.getBrandLocations({
            'page': 1,
            'per_page': 1000,
        }, function (result) {
            let locations = result.data;
            CalendarStorage.set('locations', locations);
        });

        CalendarStorage.set('filter_room', null);
        // this.refs.room.value = '';
    };

    nextWeek(e) {
        let start = CalendarStorage.get('start_date');
        if (this.hasNextPrev()) {
            let compare_start = new Date(start.getTime());
            compare_start.setDate(compare_start.getDate() + 7);
            CalendarStorage.set('start_date', compare_start);
        }
    };

    prevWeek(e) {
        let start = CalendarStorage.get('start_date');
        if (this.hasNextPrev(false)) {
            let compare_start = new Date(start.getTime());
            compare_start.setDate(compare_start.getDate() - 7);
            CalendarStorage.set('start_date', compare_start);
        }
    };

    hasNextPrev(next = true) {
        let meetings = CalendarStorage.get('meetings');
        let start = CalendarStorage.get('start_date');
        let compare_start = new Date(start.getTime());

        let added = next ? 7 : 0;
        compare_start.setDate(compare_start.getDate() + added);

        let compare = function (date_compare, compare_start) {
            let compare_string = compare_start.toDateString();
            return next ? date_compare >= new Date(compare_string) : date_compare < new Date(compare_string);
        };

        let next_meetings = meetings.find(function (meeting) {
            let meeting_date = new Date(meeting.start);
            let date_compare = new Date(meeting_date.toDateString());
            return compare(date_compare, compare_start);
        });
        return !!next_meetings;
    };

    getNextButton() {
        if (this.state.has_next) {
            return (
                <a onClick={this.nextWeek}
                   className={'next-button calendar-control-button'}>{Strings.NEXT_WEEK}</a>
            );
        }
    };

    getPrevButton() {
        if (this.state.has_prev) {
            return (
                <a onClick={this.prevWeek}
                   className={'prev-button calendar-control-button'}>{Strings.PREVIOUS_WEEK}</a>
            );
        }
    };

    render() {
        let brands = CalendarStorage.get('brands');
        let filter_name = 'meetings-calendar--filters';

        return (
            <div className={'tt_navigation_wrapper'}>
                    <div className={'calendar-filter-selector form-group'}>
                        <label htmlFor={'calendar-filter-brand'}>Marca: </label>
                        <select className={'col-md-12 form-control'} id={'calendar-filter-brand'} data-name="filter_brand"
                                data-origin="brands"
                                onChange={this.selectBrand.bind(this)}
                            >
                            {brands.map(function (brand, index) {
                                return (
                                    <option value={brand.id}
                                            key={`${filter_name}-location--option-${index}`}>{brand.name}</option>
                                );
                            })}
                        </select>
                    </div>

                    <div className={'calendar-filter-selector form-group'}>
                        <label htmlFor={'calendar-filter-location'}>{Strings.LOCATION}: </label>
                        <select className={'col-md-12 form-control'} id={'calendar-filter-location'} data-name="filter_location"
                                data-origin="locations"
                                onChange={this.selectLocation.bind(this)}
                                >
                            <option value={''}>{Strings.ALL}</option>
                            {this.state.locations.map(function (location, index) {
                                return (
                                    <option value={location.id}
                                            key={`${filter_name}-location--option-${index}`}>{location.name}</option>
                                );
                            })}
                        </select>
                    </div>

                    <div className={'calendar-filter-selector form-group'}>
                        <label htmlFor={'calendar-filter-service'}>{Strings.SERVICE}: </label>
                        <select className={'col-md-12 form-control'} id={'calendar-filter-service'} data-name="filter_service"
                                data-origin="services"
                                onChange={this.selectFilter}>
                            <option value={''}>{Strings.ALL}</option>
                            {this.state.services.map(function (service, index) {
                                return (
                                    <option value={service.id}
                                            className={service.parent_id ? 'calendar-filter-child-service' : 'calendar-filter-parent-service'}
                                            key={`${filter_name}-service--option-${index}`}>{service.name}</option>
                                );
                            })}
                        </select>
                    </div>
            </div>
        );
    }
}