'use strict';

import React from "react";
import GlobalStorage from "../store/GlobalStorage";
import CalendarStorage from "./CalendarStorage";
import GafaFitSDKWrapper from "../utils/GafaFitSDKWrapper";
import moment from 'moment';
import 'moment/locale/es';
import Strings from "../utils/Strings/Strings_ES";
import StringStore from "../utils/Strings/StringStore";

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
       let login_initial = this.props.login_initial;

       GafaFitSDKWrapper.isAuthenticated(function(auth){
           if (auth) {
               currentElement.showBuyFancyForLoggedUsers();
           } else {
               login_initial ? currentElement.showLoginForNotLoggedUsers() : currentElement.showRegisterForNotLoggedUsers();
               /*currentElement.showRegisterForNotLoggedUsers();*/
           }
       });
   };

   showBuyFancyForLoggedUsers() {
      let comp = this;
      let meeting = this.props.meeting;

      comp.setState({
         openFancy: true,
      });

      const fancy = document.querySelector('[data-gf-theme="fancy"]');
      fancy.classList.add('active');

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
                           fancy.innerHTML = '<div class="spinner"><div class="bounce1"></div><div class="bounce2"></div><div class="bounce3"></div></div>';
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
        let no_availability_display = meeting.location.brand.no_availability_display ? meeting.location.brand.no_availability_display : 'default';

        return (
            <div key={`column-day--${day.date}--meeting--${meeting.id}`} style={{ pointerEvents: openFancy ? 'none' : 'auto' }}
                 className={calendarClass + '__item ' + meetingClass + (meeting.passed ? ' has-pasted' : '') + ` ${meeting.available > 0 ? '' : 'no-availability'}` + ` ${no_availability_display!=='default' ? no_availability_display : ''}`}
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
                   <p className={'this-availability'}>{StringStore.get('AVAILABILITY')}: {meeting.available} / {meeting.capacity}</p>
                  <p className={'this-service'}>{meeting.service.name.toLowerCase()}</p>
                  <p className={'this-location'}>{meeting.location.name.toLowerCase()}</p>
               </div>
            </div>
        );
    }
}

export default CalendarMeeting;