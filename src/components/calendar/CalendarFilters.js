'use strict';

import React from "react";
import Strings from "../utils/Strings/Strings_ES";
import CalendarStorage from "./CalendarStorage";


class CalendarFilters extends React.Component {
    constructor() {
        super();

        this.state = {
            services: [],
            room_groups: [],
            has_next: true,
            has_prev: false,
        };

        CalendarStorage.addSegmentedListener(['services'], this.updateServices.bind(this));
        CalendarStorage.addSegmentedListener(['rooms', 'filter_location'], this.updateRooms.bind(this));
        CalendarStorage.addSegmentedListener(['start_date'], this.updateStart.bind(this));

        this.nextWeek = this.nextWeek.bind(this);
        this.prevWeek = this.prevWeek.bind(this);
        this.hasNextPrev = this.hasNextPrev.bind(this);
        this.getNextButton = this.getNextButton.bind(this);
    }

    updateServices() {
        this.setState({
            services: CalendarStorage.get('services')
        })
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

    selectFilter(e) {
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
        CalendarStorage.set('filter_room', null);
        this.refs.room.value = '';
    }

    nextWeek(e) {
        let start = CalendarStorage.get('start_date');
        if (this.hasNextPrev()) {
            let compare_start = new Date(start.getTime());
            compare_start.setDate(compare_start.getDate() + 7);
            CalendarStorage.set('start_date', compare_start);
        }
    }

    prevWeek(e) {
        let start = CalendarStorage.get('start_date');
        if (this.hasNextPrev(false)) {
            let compare_start = new Date(start.getTime());
            compare_start.setDate(compare_start.getDate() - 7);
            CalendarStorage.set('start_date', compare_start);
        }
    }

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
    }

    getNextButton() {
        if (this.state.has_next) {
            return (
                <a onClick={this.nextWeek}
                   className={'next-button calendar-control-button'}>{Strings.NEXT_WEEK}</a>
            );
        }
    }

    getPrevButton() {
        if (this.state.has_prev) {
            return (
                <a onClick={this.prevWeek}
                   className={'prev-button calendar-control-button'}>{Strings.PREVIOUS_WEEK}</a>
            );
        }
    }

    render() {
        let locations = CalendarStorage.get('locations');
        let filter_name = 'meetings-calendar--filters';

        return (
            <div className={'meetings-calendar--filters row mb-4'}>
                <div className={'calendar-prev-next-buttons col-md-12 row'}>
                    <div className={'col-md-3 col-lg-2'}>
                        {this.getPrevButton()}
                    </div>
                    <div className={'col-md-3 col-lg-2'}>
                        {this.getNextButton()}
                    </div>
                </div>
                <div className={'col-md-12 row mb-4'}>
                    <div className={'calendar-filter-selector col-md-4'}>
                        <label htmlFor={'calendar-filter-location'}>{Strings.LOCATION}: </label>
                        <select className={'col-md-12'} id={'calendar-filter-location'} data-name="filter_location"
                                data-origin="locations"
                                onChange={this.selectLocation.bind(this)}>
                            <option value={''}>{Strings.ALL}</option>
                            {locations.map(function (location, index) {
                                return (
                                    <option value={location.id}
                                            key={`${filter_name}-location--option-${index}`}>{location.name}</option>
                                );
                            })}
                        </select>
                    </div>

                    <div className={'calendar-filter-selector col-md-4'}>
                        <label htmlFor={'calendar-filter-room'}>{Strings.ROOM}: </label>
                        <select className={'col-md-12'} id={'calendar-filter-room'} data-name="filter_room"
                                data-origin="rooms" ref={'room'}
                                onChange={this.selectFilter}>
                            <option value={''}>{Strings.ALL}</option>
                            {this.state.room_groups.map(function (group, index) {
                                return (
                                    <optgroup label={group.location.name}
                                              key={`${filter_name}-room-group--option-${index}`}>
                                        {group.rooms.map(function (room, r_index) {
                                            return (
                                                <option key={`${filter_name}-room--option-${r_index}`}
                                                        value={room.id}>{room.name}</option>
                                            );
                                        })}
                                    </optgroup>
                                );
                            })}
                        </select>
                    </div>

                    <div className={'calendar-filter-selector col-md-4'}>
                        <label htmlFor={'calendar-filter-service'}>{Strings.SERVICE}: </label>
                        <select className={'col-md-12'} id={'calendar-filter-service'} data-name="filter_service"
                                data-origin="services"
                                onChange={this.selectFilter}>
                            <option value={''}>{Strings.ALL}</option>
                            {this.state.services.map(function (service, index) {
                                return (
                                    <option value={service.id}
                                            key={`${filter_name}-service--option-${index}`}>{service.name}</option>
                                );
                            })}
                        </select>
                    </div>

                    <div className={'calendar-time-filters col-md-4'}>
                        <label htmlFor={'calendar-time-of-day'}>{Strings.TIME_OF_DAY}: </label>
                        <select id={'calendar-time-of-day'} className={'col-md-12'} data-name="filter_time_of_day" onChange={this.updateStore}>
                            <option value={''}>{Strings.ALL}</option>
                            <option value={'morning'}>{Strings.MORNING}</option>
                            <option value={'afternoon'}>{Strings.AFTERNOON}</option>
                        </select>
                    </div>
                </div>

            </div>
        );
    }
}

export default CalendarFilters;