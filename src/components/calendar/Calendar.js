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
         meetings_to_show: [],
         // filter: {
         //    filter_location: '',
         //    filter_staff: '',
         //    filter_service: '',
         // },
         rooms:null,
         _is_mounted: false,
      };

   //   CalendarStorage.set('locations', this.props.locations);
      this.getMeetings = this.getMeetings.bind(this);
      CalendarStorage.set('show_login', this.setShowLogin.bind(this));
      CalendarStorage.set('show_register', this.setShowRegister.bind(this));
      CalendarStorage.set('locations', GlobalStorage.get('locations')); // TODO:Eliminar al tener todo en el store global
      // CalendarStorage.addSegmentedListener(['calendarHeight', 'calendarWidth'], this.updateCalendarDimensions.bind(this));
      // CalendarStorage.addSegmentedListener(['filter_location'], this.updateCalendar.bind(this));
   }

   componentDidMount() {
      this.getMeetings();
      this.getRooms();
   }

   // updateCalendarDimensions(){
   //    this.setState({
   //       calendarHeight: CalendarStorage.get('calendarHeight'),
   //       calendarWidth: CalendarStorage.get('calendarWidth'),
   //    });
   // }

   // updateCalendar(){
      // this.getMeetings();
      // this.getRooms();

      // this.setState({
      //    meetings: CalendarStorage.get('meetings'),
      //    rooms: CalendarStorage.get('rooms'),
      // });
   // }

   // getFilters(){

   // }

   getMeetings() {
      let curComp = this;

      GafaFitSDKWrapper.setMeetings(function(){
         curComp.setState({
            is_mounted: true,
            meetings: CalendarStorage.get('meetings'),
         });
      });
   }

   getRooms() {
      GafaFitSDKWrapper.getBrandRooms({}, function (result) {
         CalendarStorage.push('rooms', result.data)
      })
   }

   updateMeetings(meetingsList){
      this.setState({
         meetings_to_show: meetingsList
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
      let {is_mounted, meetings, filter, meetings_to_show} = this.state;
      let preC = 'GFSDK-c';
      let calendarClass = preC + '-Calendar';
      let widthDimension = CalendarStorage.get('calendarWidth');
      let heightDimension = CalendarStorage.get('calendarHeight');

      const mystyles = {
         width:  widthDimension + 'px',
      }

      console.log(meetings_to_show.length != 0);

      return (
         <div className={calendarClass}>
               {is_mounted 
                  ?
                     <div className={calendarClass + '__container ' + (is_mounted ? 'mounted' : '')} style={mystyles}>
                        <CalendarFilters
                           filterService={this.props.filter_service}
                           filterServiceDefault={this.props.filter_service_default}
                           filterStaff={this.props.filter_staff}
                           updateMeetings={this.updateMeetings.bind(this)}
                           meetings={meetings}
                        />
                        {meetings_to_show.length != 0
                           ?
                           <CalendarBody stateFilter={filter} meetings={meetings_to_show} limit={this.props.limit} />
                           :
                           <p>Cargando...</p>
                        }
                     </div>
                  : 
                     null
               }
               {this.state.showRegister &&
               <LoginRegister setShowRegister={this.setShowRegister.bind(this)}/>
               }
         </div>
      );
   }
}

export default Calendar;
