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

      this.state = {
         openFancy: false,
      }
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
      let comp = this;
      let meeting = this.props.meeting;

      const fancy = document.querySelector('[data-gf-theme="fancy"]');
      fancy.classList.add('active');

      comp.setState({
         openFancy: true,
      })

      setTimeout(function(){
         fancy.classList.add('show');
      }, 400);

      if (meeting) {

         GafaFitSDKWrapper.getFancyForMeetingReservation(
            meeting.location.brand.slug, 
            meeting.location.slug, 
            meeting.id, 
            function (result) {
               getFancy();

               function getFancy(){
                  if(document.querySelector('[data-gf-theme="fancy"]').firstChild){
                     const closeFancy = document.getElementById('CreateReservationFancyTemplate--Close');
                     
                     closeFancy.addEventListener('click', function(e){
                        fancy.removeChild(document.querySelector('[data-gf-theme="fancy"]').firstChild);

                        fancy.classList.remove('show');

                        setTimeout(function(){
                           fancy.classList.remove('active');
                        }, 400);

                        comp.setState({
                           openFancy: false,
                        })
                     })
                  } else {
                     setTimeout(getFancy, 1000);
                  }
               }
            }
         );
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
        let {openFancy} = this.state;
        let day = this.props.day;
        let classStart = moment(meeting.start_date).toDate();
        let time_format = meeting.location.brand.time_format;
        let preC = 'GFSDK-c';
        let preE = 'GFSDK-e';
        let calendarClass = preC + '-Calendar';
        let meetingClass = preE + '-meeting';

        return (
            <div key={`column-day--${day.date}--meeting--${meeting.id}`} style={{ pointerEvents: openFancy ? 'none' : 'auto' }}
                 className={calendarClass + '__item ' + meetingClass + (meeting.passed ? ' has-pasted' : '')}
                 data-id={meeting.id}
                 onClick={openFancy ? null : this.handleClick.bind(this)}>
               <div className={meetingClass + '__header'}>
                     { time_format === '12'
                     ? <p className={'this-time'}>{moment(classStart).format('hh')}.{moment(classStart).format('mm')} {moment(classStart).format('a')}</p>
                        : <p className={'this-time'}>{moment(classStart).format('kk')}.{moment(classStart).format('mm')} </p>
                     }
               </div>
               <hr></hr>
               <div className={meetingClass + '__body'}>
                  <p className={'this-staff'}>{meeting.staff.name.toLowerCase()}</p>
                  <p className={'this-service'}>{meeting.service.name.toLowerCase()}</p>
                  <p className={'this-location'}>{meeting.location.name.toLowerCase()}</p>
               </div>
            </div>
        );
    }
}

export default CalendarMeeting;