'use strict';

import React from "react";
import Strings from "../utils/Strings/Strings_ES";
import IconLeftArrow from "../utils/Icons/IconLeftArrow";
import IconRightArrow from "../utils/Icons/IconRightArrow";
import CalendarStorage from "./CalendarStorage";
import MorningIcon from "../utils/Icons/MorningIcon";
import AfternoonIcon from "../utils/Icons/AfternoonIcon";
import AllTimeIcon from "../utils/Icons/AllTimeIcon";
import moment from 'moment';
import Select from 'react-select';
import GlobalStorage from "../store/GlobalStorage";


class CalendarFilters extends React.Component {
    constructor() {
        super();

        this.state = {
            services: [],
            room_groups: [],
            time_of_day: null,
            has_next: true,
            has_prev: false,
        };

      CalendarStorage.addSegmentedListener(['rooms', 'filter_location'], this.updateRooms.bind(this));
      CalendarStorage.addSegmentedListener(['meetings'], this.updateServices.bind(this));
      CalendarStorage.addSegmentedListener(['start_date'], this.updateStart.bind(this));
      CalendarStorage.addSegmentedListener(['filter_time_of_day'], this.updateTimeOfDay.bind(this));

      this.nextWeek = this.nextWeek.bind(this);
      this.prevWeek = this.prevWeek.bind(this);
      this.hasNextPrev = this.hasNextPrev.bind(this);
      this.getNextButton = this.getNextButton.bind(this);
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

    updateRooms() {
        let show_rooms = [];
        let rooms = CalendarStorage.get('rooms');
        let currentLocation = GlobalStorage.get('currentLocation');
        let locations = GlobalStorage.get('locations');

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
                return group.location.id === currentLocation.id;
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

    updateTimeOfDay(){
        this.setState({
            'time_of_day': CalendarStorage.get('filter_time_of_day'),
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
                   className={'next-button calendar-control-button'}>{Strings.NEXT_WEEK} <IconRightArrow /></a>
            );
        }
    }

    getPrevButton() {
        if (this.state.has_prev) {
            return (
               <a onClick={this.prevWeek} className={'prev-button calendar-control-button'}><IconLeftArrow /> {Strings.PREVIOUS_WEEK}</a>
            );
        }
    }

    render() {
        let locations = CalendarStorage.get('locations');
        let rooms = CalendarStorage.get('rooms');
        let {alignment} = this.props;
        let {time_of_day} = this.state;
        let filter_name = 'meetings-calendar--filters';

        let preC = 'GFSDK-c';
        let preE = 'GFSDK-e';
        let calendarClass = preC + '-Calendar';
        let filterClass = preC + '-filter';
        let formClass = preE + '-form';
        let navigationClass = preE + '-navigation';

        return (
            <div className={calendarClass + '__head' + (alignment === 'horizontal' ? '-horizontal' : '')}>
                <div className={calendarClass + '__filter ' + filterClass}>
                    <div className={filterClass + '__item ' + formClass + '__section is-day-filter'}>
                        <label htmlFor={'calendar-time-of-day'}  className={formClass + '__label'}>{Strings.TIME_OF_DAY}: </label>
                        <div className={formClass + "__radio-container has-3-columns"}>
                            <label className={formClass + "__radio " + (time_of_day === null || time_of_day === ' ' ? 'checked' : '')}>
                                <input  type="radio"
                                        className="mr-2"
                                        value={''}
                                        checked={time_of_day === null || time_of_day === ' '}
                                        name="time_of_day"
                                        data-name="filter_time_of_day"
                                        onChange={this.updateStore.bind(this)}
                                />
                                <p className={formClass + "__label"}>
                                    <AllTimeIcon />
                                </p>
                            </label>
                            <label className={formClass + "__radio " + (time_of_day === 'morning' ? 'checked' : '')}>
                                <input  type="radio"
                                        className="mr-2"
                                        value={'morning'}
                                        name="time_of_day"
                                        checked={time_of_day === 'morning'}
                                        data-name="filter_time_of_day"
                                        onChange={this.updateStore.bind(this)}
                                />
                                <p className={formClass + "__label"}>
                                    <MorningIcon />
                                </p>
                            </label>
                            <label className={formClass + "__radio " + (time_of_day === 'afternoon' ? 'checked' : '')}>
                                <input  type="radio"
                                        className="mr-2"
                                        value={'afternoon'}
                                        checked={time_of_day === 'afternoon'}
                                        name="time_of_day"
                                        data-name="filter_time_of_day"
                                        onChange={this.updateStore.bind(this)}
                                />
                                <p className={formClass + "__label"}>
                                    <AfternoonIcon />
                                </p>
                            </label>
                        </div>
                    </div>

                    {alignment === 'horizontal'
                        ?
                        <div className={filterClass + '__item ' + formClass + '__section is-location-filter ' + (locations.length <= 1 ? 'is-empty' : '' )}>
                           <select className={formClass + '__select'} id={'calendar-filter-location'} data-name="filter_location"
                                 data-origin="locations"
                                 onChange={this.selectLocation.bind(this)}>
                                 <option value={''}>{Strings.LOCATION}</option>
                                 {locations.map(function (location, index) {
                                    return (
                                       <option value={location.id} key={`${filter_name}-location--option-${index}`}>{location.name}</option>
                                    );
                                 })}
                           </select>
                        </div>
                        :
                        <div className={filterClass + '__item ' + formClass + '__section is-location-filter ' + (locations.length <= 1 ? 'is-empty' : '' )}>
                           <label htmlFor={'calendar-filter-location'} className={formClass + '__label'}>{Strings.LOCATION}: </label>
                           <select className={formClass + '__select'} id={'calendar-filter-location'} data-name="filter_location"
                                 data-origin="locations"
                                 onChange={this.selectLocation.bind(this)}>
                                 <option value={''}>{Strings.ALL}</option>
                                 {locations.map(function (location, index) {
                                    return (
                                       <option value={location.id} key={`${filter_name}-location--option-${index}`}>{location.name}</option>
                                    );
                                 })}
                           </select>
                        </div>
                        
                     }

                    <div className={filterClass + '__item ' + formClass + '__section is-room-filter ' + (rooms.length <= 1 ? 'is-empty' : '' )}>
                        <label htmlFor={'calendar-filter-room'}  className={formClass + '__label'}>{Strings.ROOM}: </label>
                        <select className={formClass + '__select'} id={'calendar-filter-room'} data-name="filter_room"
                                data-origin="rooms" ref={'room'}
                                onChange={this.selectFilter}>
                            <option value={''}>{Strings.ALL}</option>
                            {/* {this.state.room_groups.map(function (group, index) {
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
                            })} */}
                            {this.state.room_groups.map(function (group, index) {
                                return (
                                    group.rooms.map(function (room, r_index) {
                                        return (
                                            <option key={`${filter_name}-room--option-${r_index}`}
                                                    value={room.id}>{room.name}</option>
                                        );
                                    })
                                );
                            })}
                        </select>
                    </div>

                     <div className={filterClass + '__item ' + formClass + '__section is-service-filter ' + (this.state.services.length <= 1 ? 'is-empty' : '' )}>
                        <label htmlFor={'calendar-filter-service'}  className={formClass + '__label'}>{Strings.SERVICE}: </label>
                        <select className={formClass + '__select'} id={'calendar-filter-service'} data-name="filter_service"
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
                <div className={calendarClass + '__navigation ' + navigationClass}>
                    <div className={navigationClass + '__prev'}>
                        {this.getPrevButton()}
                    </div>
                    <div className={navigationClass + '__next'}>
                        {this.getNextButton()}
                    </div>
                </div>
            </div>
        );
    }
}

export default CalendarFilters;