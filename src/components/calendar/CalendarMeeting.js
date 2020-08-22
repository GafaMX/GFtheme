'use strict';

import React from "react";
import GlobalStorage from "../store/GlobalStorage";
import CalendarStorage from "./CalendarStorage";
import GafaFitSDKWrapper from "../utils/GafaFitSDKWrapper";
import moment from 'moment';
import 'moment/locale/es';

class CalendarMeeting extends React.Component {
   constructor(props) {
      super(props);
   }


   handleClick(event) {
      event.preventDefault();
      let currentElement = this;

      GafaFitSDKWrapper.isAuthenticated(function(auth){
         if (auth) {
            currentElement.showBuyFancyForLoggedUsers();
         } else {
            currentElement.showRegisterForNotLoggedUsers();
         }
      });
   };

   showBuyFancyForLoggedUsers() {
      let meeting = this.props.meeting;

      if (meeting) {
         GafaFitSDKWrapper.getFancyForMeetingReservation(meeting.location.brand.slug, meeting.location.slug, meeting.id, function (result) {});
      }
   }

   showLoginForNotLoggedUsers() {
      window.GFtheme.meetings_id = this.props.meeting.id;
      window.GFtheme.location_slug = this.props.meeting.location.slug;
      window.GFtheme.brand_slug = this.props.meeting.location.brand.slug;
      let login = CalendarStorage.get('show_login');
      login(true);
   }

   showRegisterForNotLoggedUsers() {
      window.GFtheme.meetings_id = this.props.meeting.id;
      window.GFtheme.location_slug = this.props.meeting.location.slug;
      window.GFtheme.brand_slug = this.props.meeting.location.brand.slug;
      let register = CalendarStorage.get('show_register');
      register(true);
   }

    render() {
        let {meeting} = this.props;
        let day = this.props.day;
        let classStart = moment(meeting.start_date).toDate();
        let time_format = meeting.location.brand.time_format;
        let preC = 'GFSDK-c';
        let preE = 'GFSDK-e';
        let calendarClass = preC + '-Calendar';
        let meetingClass = preE + '-meeting';

        return (
            <div key={`column-day--${day.date}--meeting--${meeting.id}`}
                 className={calendarClass + '__item ' + meetingClass + (meeting.passed ? ' has-pasted' : '')}
                 data-id={meeting.id}
                 onClick={this.handleClick.bind(this)}>
               <div className={meetingClass + '__header'}>
                     { time_format === '12'
                     ? <p className={'this-time'}>{moment(classStart).format('hh')}.{moment(classStart).format('mm')} {moment(classStart).format('a')}</p>
                        : <p className={'this-time'}>{moment(classStart).format('kk')}.{moment(classStart).format('mm')} </p>
                     }
               </div>
               <hr></hr>
               <div className={meetingClass + '__body'}>
                  <p className={'this-staff'}>{meeting.staff.name}</p>
                  <p className={'this-service'}>{meeting.service.name}</p>
                  <p className={'this-location'}>{meeting.location.name}</p>
               </div>
            </div>
        );
    }
}

export default CalendarMeeting;