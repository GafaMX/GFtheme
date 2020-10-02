'use strict';

import React from "react";
import Strings from "../utils/Strings/Strings_ES";
import IconLeftArrow from "../utils/Icons/IconLeftArrow";
import IconRightArrow from "../utils/Icons/IconRightArrow";
import CalendarStorage from "./CalendarStorage";
import MorningIcon from "../utils/Icons/MorningIcon";
import AfternoonIcon from "../utils/Icons/AfternoonIcon";
import AllTimeIcon from "../utils/Icons/AllTimeIcon";
import IconSelectDownArrow from "../utils/Icons/IconSelectDownArrow";
// import moment from 'moment';
import Select from 'react-select';
import GlobalStorage from "../store/GlobalStorage";


class CalendarFilters extends React.Component {
    constructor() {
        super();

      this.state = {
         services: [],
         staff: [],
         filter_brand:'',
         filter_service:'',
         filter_location:'',
         filter_staff:'',
         // room_groups: [],
         // time_of_day: null,
         // has_next: true,
         // has_prev: false,
      };

      // CalendarStorage.addSegmentedListener(['rooms', 'filter_location'], this.updateRooms.bind(this));
      // CalendarStorage.addSegmentedListener(['services'], this.updateServiceFilter.bind(this));
      // CalendarStorage.addSegmentedListener(['meetings'], this.updateMeetings.bind(this));
      // CalendarStorage.addSegmentedListener(['start_date'], this.updateStart.bind(this));
      // CalendarStorage.addSegmentedListener(['filter_time_of_day'], this.updateTimeOfDay.bind(this));

      // this.nextWeek = this.nextWeek.bind(this);
      // this.prevWeek = this.prevWeek.bind(this);
      // this.hasNextPrev = this.hasNextPrev.bind(this);
      // this.getNextButton = this.getNextButton.bind(this);
      this.updateServicesStaff = this.updateServicesStaff.bind(this);
      this.updateMeetings = this.updateMeetings.bind(this);
      this.selectFilter = this.selectFilter.bind(this);
   }

   componentDidMount(){
      this.updateServicesStaff();

      let curComp = this;
      let locations = GlobalStorage.get('locations');
      let services = CalendarStorage.get('services');
      let {filterServiceDefault} = this.props;

      // if(locations){
      //    CalendarStorage.set('filter_location', locations[0]);
      // }
   }

   updateServicesStaff() {
      let {filterStaff, filterService, meetings} = this.props;

      let services = [];
      let personal = [];

      if(filterService){
         meetings.forEach(function (meeting) {
            let service = meeting.service;
            
            if (service && !services.find(o => o.id === service.id)) {
               services.push(service);
            }
         });
      }

      if(filterStaff){
         meetings.forEach(function (meeting) {
            let staff = meeting.staff;
            if (staff && !personal.find(i => i.id === staff.id)) {
               personal.push(staff);
            }
         });
      }
      
      this.setState({
         services: services,
         staff: personal
      });

      CalendarStorage.set('services', services);
      CalendarStorage.set('staff', personal);
   }

   updateRooms() {
      let show_rooms = [];
      let rooms = CalendarStorage.get('rooms');
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
      let curComp = this;
      let name = e.target.getAttribute('data-name');
      let origin = e.target.getAttribute('data-origin');
      let id = e.target.value;
      let model = null;

      if (id && id !== '')
         model = CalendarStorage.find(origin, id);
         curComp.setState({[name]: model});
   }

   // getDates(startDate, stopDate) {
   //    let dateArray = [];
   //    let currentDate = new Date(startDate.getTime());
   //    while (currentDate <= stopDate) {
   //       let new_date = new Date(currentDate.getTime());
   //       dateArray.push(new_date);
   //       currentDate.setDate(currentDate.getDate() + 1);
   //    }

   //    return dateArray;
   // }

   updateMeetings(){
      let {filter_staff, filter_service, filter_location} = this.state;
      let {updateMeetings} = this.props;
      let meetings = this.props.meetings;
      let start = CalendarStorage.get('start_date');
      let end = new Date(start.getTime());
      end.setDate(start.getDate() + 6);
      let time_of_day = CalendarStorage.get('filter_time_of_day');
      let shown_meetings = [];

      if (filter_location) {
         meetings = meetings.filter(function (meeting) {
            return meeting.locations_id === filter_location.id;
         });
      }

      // if (service) {
      //    meetings = meetings.filter(function (meeting) {
      //       return meeting.services_id === service.id;
      //    })
      // }

      // if (staff) {
      //    meetings = meetings.filter(function (meeting) {
      //       return meeting.staff_id === staff.id;
      //    })
      // }

      // if (room) {
      //    meetings = meetings.filter(function (meeting) {
      //       return meeting.rooms_id === room.id;
      //    })
      // }

      // if (time_of_day) {
      //    if (time_of_day === 'morning') {
      //       meetings = meetings.filter(function (meeting) {
      //          let date = Moment(meeting.start_date, 'YYYY-MM-DD HH:mm:ss').toDate();
      //          return date.getHours() < 12;
      //       })
      //    } else if (time_of_day === 'afternoon') {
      //       meetings = meetings.filter(function (meeting) {
      //          let date = Moment(meeting.start_date, 'YYYY-MM-DD HH:mm:ss').toDate();
      //          return date.getHours() >= 12;
      //       })
      //    }
      // }



      // let date_array = this.getDates(start, end);

      // date_array.forEach(function (date) {
      //    let meet = {
      //          title: date.toLocaleDateString(),
      //          date: date,
      //          meetings: meetings.filter(function (meeting) {
      //             let meeting_date = Moment(meeting.start_date).format('YYYY-MM-DD');
      //             return Moment(date).format('YYYY-MM-DD') === meeting_date && meeting.passed === false
      //             // return new Date(date.toDateString()).getTime() === new Date(meeting_date.toDateString()).getTime() && meeting.passed === false;
      //          })
      //    };
      //    shown_meetings.push(meet);
      // });
      // console.log(meetings);
      // updateMeetings(meetings);
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
      let locations = GlobalStorage.get('locations');
      // let filter_location = CalendarStorage.get('filter_location');
      let {filter_service, filter_location, filter_staff} = this.state;
      let rooms = CalendarStorage.get('rooms');
      let {filterService, filterStaff} = this.props;
      let {time_of_day} = this.state;
      let filter_name = 'meetings-calendar--filters';

      let preC = 'GFSDK-c';
      let preE = 'GFSDK-e';
      let calendarClass = preC + '-Calendar';
      let filterClass = preC + '-filter';
      let formClass = preE + '-form';
      let navigationClass = preE + '-navigation';

      let locationValue = filter_location ? filter_location.id : '';
      let serviceValue = filter_service ? filter_service.id : '';
      let staffValue = filter_staff ? filter_staff.id : '';

      // this.updateMeetings();

      return (
         <div className={calendarClass + '__head-horizontal'}>
            <p className={formClass + '__label'}>Filtros:</p> 
               <div className={calendarClass + '__filter ' + filterClass}>
                  {/* <div className={filterClass + '__item ' + formClass + '__section is-day-filter'}>
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
                  </div> */}

                  <div className={filterClass + '__item ' + formClass + '__section is-location-filter is-horizontal' + (locations.length <= 1 ? 'is-empty' : '' )}>
                     <select className={formClass + '__select'} id={'calendar-filter-location'} data-name="filter_location"
                           data-origin="locations"
                           value={locationValue}
                           // onChange={this.selectLocation.bind(this)}
                           >
                           <option value={''}>{Strings.ALL}</option>
                           {locations.map(function (location, index) {
                              return (
                                 <option value={location.id} key={`${filter_name}-location--option-${index}`}>{location.name}</option>
                              );
                           })}
                     </select>
                     <div className={formClass + '__select-icon'}>
                        <IconSelectDownArrow />
                     </div>
                  </div>

                  {/* <div className={filterClass + '__item ' + formClass + '__section is-room-filter ' + (rooms.length <= 1 ? 'is-empty' : '' )}>
                     <label htmlFor={'calendar-filter-room'}  className={formClass + '__label'}>{Strings.ROOM}: </label>
                     <select className={formClass + '__select'} id={'calendar-filter-room'} data-name="filter_room"
                              data-origin="rooms" ref={'room'}
                              onChange={this.selectFilter}>
                           <option value={''}>{Strings.ALL}</option> */}
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
                           {/* {this.state.room_groups.map(function (group, index) {
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
                  </div> */}
                  
                  {filterService ?
                        <div className={filterClass + '__item ' + formClass + '__section is-service-filter is-horizontal ' + (this.state.services.length <= 1 ? 'is-empty' : '' )}>
                           <select className={formClass + '__select'} id={'calendar-filter-service'} data-name="filter_service"
                              data-origin="services"
                              value={serviceValue}
                              onChange={this.selectFilter}>
                                 <option value={''}>{Strings.SERVICE}</option>
                                 {this.state.services.map(function (service, index) {
                                    return (
                                       <option value={service.id}
                                          className={service.parent_id ? 'calendar-filter-child-service' : 'calendar-filter-parent-service'}
                                          key={`${filter_name}-service--option-${index}`}>{service.name}</option>
                                    );
                                 })}
                           </select>
                           <div className={formClass + '__select-icon'}>
                              <IconSelectDownArrow />
                           </div>
                        </div>
                     :  null
                  }


                  {filterStaff ?
                        <div className={filterClass + '__item ' + formClass + '__section is-staff-filter is-horizontal ' + (this.state.staff.length <= 1 ? 'is-empty' : '' )}>
                           <select className={formClass + '__select'} id={'calendar-filter-staff'} data-name="filter_staff"
                              data-origin="staff"
                              onChange={this.selectFilter}>
                                 <option value={''}>{window.GFtheme.StaffName}</option>
                                 {this.state.staff.map(function (member, index) {
                                    return (
                                       <option value={member.id}
                                             className={member.parent_id ? 'calendar-filter-child-staff' : 'calendar-filter-parent-staff'}
                                             key={`${filter_name}-staff--option-${index}`}>{member.name}</option>
                                    );
                                 })}
                           </select>
                           <div className={formClass + '__select-icon'}>
                                 <IconSelectDownArrow />
                           </div>
                        </div>
                     :  null
                  }
               </div>
               {/* <div className={calendarClass + '__navigation ' + navigationClass}>
                  <div className={navigationClass + '__prev'}>
                     {this.getPrevButton()}
                  </div>
                  <div className={navigationClass + '__next'}>
                     {this.getNextButton()}
                  </div>
               </div> */}
         </div>
      );
   }
}

export default CalendarFilters;