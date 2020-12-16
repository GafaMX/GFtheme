'use strict';

import React from "react";
import Strings from "../utils/Strings/Strings_ES";
import CalendarFilters from './CalendarFilters';
import CalendarStorage from './CalendarStorage';
import GlobalStorage from '../store/GlobalStorage';
import CalendarBody from "./CalendarBody";
import GafaFitSDKWrapper from "../utils/GafaFitSDKWrapper";
import LoginRegister from "../menu/LoginRegister";
import moment from "moment";

import IconSelectDownArrow from "../utils/Icons/IconSelectDownArrow";

import Loading from '../common/Loading';

// Estilos
import '../../styles/newlook/components/GFSDK-c-Calendar.scss';
import '../../styles/newlook/components/GFSDK-c-Filter.scss';
import '../../styles/newlook/elements/GFSDK-e-meeting.scss';
import '../../styles/newlook/elements/GFSDK-e-navigation.scss';

class Calendar extends React.Component {
    constructor(props) {
      super(props);

      this.state = {
         showLogin: false,
         showRegister: false,
         meetings: [],
         filter_staff: "Todos",
         staff: [],
         filter_service: "Todos",
         services: [],
         filter_brand: "Todos",
         brands: [],
         filter_room: "Todos",
         rooms: [],
         filter_location: "Todos",
         locations: [],
         is_mounted: false,
      };

      this.selectFilter = this.selectFilter.bind(this);
      CalendarStorage.set('show_login', this.setShowLogin.bind(this));
      CalendarStorage.set('show_register', this.setShowRegister.bind(this));
      CalendarStorage.addSegmentedListener(['meetings'], this.setInitialValues.bind(this));
   }


   setInitialValues(){
      let comp = this;
      let meetings = CalendarStorage.get('meetings');
      let rooms = GlobalStorage.get('rooms');
      let {filter_service, filter_service_default, filter_staff, filter_location, filter_brand, filter_room} = this.props;
      let meetingsWithRoom = [];
      let meetingsLocations = [];
      let meetingsBrands = [];
      let meetingsServices = [];
      let meetingsStaff = [];
      let meetingsRooms = [];

      let preFilterStaff = 'Todos';
      let preFilterService = 'Todos';

      let gafa = gafa ? gafa : null;
      
      let params = (new URL(document.location)).searchParams;
      let memberParams;
      
      if(!gafa && window.GFtheme){
         let staffParam = window.GFtheme.StaffName.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
         memberParams = params.get(staffParam);
      }

      meetings = meetings.filter(function(meeting){return meeting.passed === false});

      meetings.forEach(function(meeting){
         let room = rooms.find(function(room){return meeting.rooms_id === room.id});
         meeting.room = room
         meetingsWithRoom.push(meeting);
      });

      if(filter_brand){
         meetingsWithRoom.forEach(function(meeting){
            if(meeting.location != null && !meetingsBrands.includes(meeting.location.brand.name)){
               meetingsBrands.push(meeting.location.brand.name);
            }
         });
      }

      if(filter_location){
         meetingsWithRoom.forEach(function(meeting){
            if(meeting.location != null && !meetingsLocations.includes(meeting.location.name)){
               meetingsLocations.push(meeting.location.name);
            }
         });
      }

      if(filter_room){
         meetingsWithRoom.forEach(function(meeting){
            if(meeting.room != null && !meetingsRooms.includes(meeting.room.name)){
               meetingsRooms.push(meeting.room.name);
            }
         });
      }

      if(filter_staff){
         meetingsWithRoom.forEach(function(meeting){
            if(meeting.staff != null && !meetingsStaff.includes(meeting.staff.name)){
               meetingsStaff.push(meeting.staff.name);

               if(memberParams){
                  if(memberParams === meeting.staff.slug){
                     preFilterStaff = meeting.staff.name;
                  }
               }
            }
         });
      }

      if(filter_service){
         meetingsWithRoom.forEach(function(meeting){
            if(meeting.service != null && !meetingsServices.includes(meeting.service.name)){
               meetingsServices.push(meeting.service.name);
               
               if(filter_service_default){
                  if(filter_service_default === meeting.service.name){
                     preFilterService = meeting.service.name;
                  }
               }
            }
         });
      }

      setTimeout(function(){ 
         comp.setState({
            locations: meetingsLocations,
            brands: meetingsBrands,
            rooms: meetingsRooms,
            services: meetingsServices,
            filter_staff: preFilterStaff,
            filter_service: preFilterService,
            staff: meetingsStaff,
            meetings: meetings,
            is_mounted: true,
         });
      }, 3000);
   }
   
   selectFilter(e) {
      let name = e.target.getAttribute('data-name');
      let value = e.target.value;

      this.setState({
         [name]: value,
      });
   }

   setShowLogin(showLogin) {
      this.setState({
         showLogin: showLogin
      });
   }

   setShowRegister(showRegister) {
      this.setState({
         showRegister: showRegister
      });
   }

    render() {
      let {is_mounted, meetings, locations, filter_location, rooms, filter_room, services, filter_service, staff, filter_staff, brands, filter_brand} = this.state;
      let preC = 'GFSDK-c';
      let preE = 'GFSDK-e';
      let formClass = preE + '-form';
      let filterClass = preC + '-filter';
      let calendarClass = preC + '-Calendar';
      let widthDimension = CalendarStorage.get('calendarWidth');
      let heightDimension = CalendarStorage.get('calendarHeight');

      // console.log(services);

      const mystyles = {
         width:  widthDimension + 'px',
      }

      if(filter_location && filter_location != 'Todos'){
         meetings = meetings.filter(function(meeting){ return meeting.location.name === filter_location });
      }

      if(filter_room && filter_room != 'Todos'){
         meetings = meetings.filter(function(meeting){ return meeting.room.name === filter_room });
      }

      if(filter_service && filter_service != 'Todos'){
         meetings = meetings.filter(function(meeting){ return meeting.service.name === filter_service });
      }

      if(filter_brand && filter_brand != 'Todos'){
         meetings = meetings.filter(function(meeting){ return meeting.location.brand.name === filter_brand });
      }

      if(filter_staff && filter_staff != 'Todos'){
         meetings = meetings.filter(function(meeting){ return meeting.staff.name === filter_staff});
      }

      return (
         <div className={calendarClass}>
            <div className={calendarClass + '__container'} style={mystyles}>
               {is_mounted 
                  ? 
                  <div className={calendarClass + '__head-horizontal'}>
                     {  brands.length <= 1 && locations.length <= 1 &&
                        rooms.length <= 1 && staff.length <= 1 &&
                        services.length <= 1 
                        ?
                           null
                        : 
                           <p className={formClass + '__label'}>Filtros:</p> 
                     }
                     <div className={calendarClass + '__filter ' + filterClass}>
                        <div className={filterClass + '__item is-brand-filter' + (brands.length <= 1 ? ' is-empty' : '' )}>
                           <select className={formClass + '__select'}
                                 data-name="filter_brand"
                                 value={filter_brand}
                                 onChange={this.selectFilter}
                                 >
                                 <option value={'Todos'}>Marcas</option>
                                 {brands.map(brand => {
                                    return <option value={brand} key={brand}>{brand}</option>
                                 })}
                           </select>
                           <div className={filterClass + '__item-icon'}>
                              <IconSelectDownArrow />
                           </div>
                        </div>

                        <div className={filterClass + '__item is-location-filter' + (locations.length <= 1 ? ' is-empty' : '' )}>
                           <select className={formClass + '__select'} data-name="filter_location" data-origin="locations"
                                 value={filter_location}
                                 onChange={this.selectFilter}
                                 >
                                 <option value={'Todos'}>Ubicaciones</option>
                                 {locations.map(location => {
                                    return <option value={location} key={location}>{location.toLowerCase()}</option>
                                 })}
                           </select>
                           <div className={filterClass + '__item-icon'}>
                              <IconSelectDownArrow />
                           </div>
                        </div>

                        <div className={filterClass + '__item is-room-filter' + (rooms.length <= 1 ? ' is-empty' : '' )}>
                           <select className={formClass + '__select'}
                                 data-name="filter_room"
                                 value={filter_room}
                                 onChange={this.selectFilter}
                                 >
                                 <option value={'Todos'}>Salones</option>
                                 {rooms.map(room => {
                                    return <option value={room} key={room}>{room}</option>
                                 })}
                           </select>
                           <div className={filterClass + '__item-icon'}>
                              <IconSelectDownArrow />
                           </div>
                        </div>
                        
                        <div className={filterClass + '__item is-staff-filter' + (staff.length <= 1 ? ' is-empty' : '' )}>
                           <select className={formClass + '__select'}
                                    data-name="filter_staff"
                                    value={filter_staff}
                                    onChange={this.selectFilter}
                                 >
                                 <option value={'Todos'}>{window.GFtheme.StaffName}</option>
                                 {staff.map(person => {
                                    return <option value={person} key={person}>{person.toLowerCase()}</option>
                                 })}
                           </select>
                           <div className={filterClass + '__item-icon'}>
                              <IconSelectDownArrow />
                           </div>
                        </div>

                        <div className={filterClass + '__item is-service-filter' + (services.length <= 1 ? ' is-empty' : '' )}>
                           <select className={formClass + '__select'}
                                 data-name="filter_service"
                                 value={filter_service}
                                 onChange={this.selectFilter}
                              >
                                 <option value={'Todos'}>Servicios</option>
                                 {services.map(service => {
                                    return <option value={service} key={service}>{service.toLowerCase()}</option>
                                 })}
                           </select>
                           <div className={filterClass + '__item-icon'}>
                              <IconSelectDownArrow />
                           </div>
                        </div>
                     </div>
                  </div>
                  : null
               }
               {is_mounted 
                  ?
                     <CalendarBody  
                        meetings={meetings} 
                        limit={this.props.limit} 
                        openFancy = {this.openFancy}
                        closedFancy = {this.closedFancy}
                     /> 
                  :
                     <Loading />
               }
            </div>
            
            {this.state.showRegister &&
            <LoginRegister setShowRegister={this.setShowRegister.bind(this)}/>
            }
         </div>
      );
   }
}

export default Calendar;
