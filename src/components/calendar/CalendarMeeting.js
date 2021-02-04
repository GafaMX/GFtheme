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
   
   componentDidMount(){
      let currentElement = this;
      let params = (new URL(document.location)).searchParams;
      let reservation_id = parseInt(params.get('reservation-id'));

      if (gafa && reservation_id) {
         GafaFitSDKWrapper.isAuthenticated(function(auth){
            if (auth) {
               currentElement.showReserveFancybyUrl(reservation_id);
            }
         });
      };
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

   showReserveFancybyUrl(reservation_id) {
      let comp = this;
      let meeting = this.props.meeting;

      if(reservation_id === meeting.id){
         const fancy = document.querySelector('[data-gf-theme="fancy"]');
         fancy.classList.add('active');
         
         comp.setState({
            openFancy: true,
         });

         setTimeout(function(){
            fancy.classList.add('show');
         }, 400);
         
         comp.getFancyForReservation(meeting, fancy, true);
      }
   }

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

      comp.getFancyForReservation(meeting, fancy, false);
   }


   getFancyForReservation(meeting, fancySelector , cleanUrl){
      let comp = this;
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
                     if(gafa && cleanUrl){
                        var url = window.location.href.split('?')[0];
                        window.history.pushState("buq-home", "Home", url);
                     }

                     fancySelector.removeChild(document.querySelector('[data-gf-theme="fancy"]').firstChild);
                     fancySelector.classList.remove('show');

                     setTimeout(function(){
                        fancySelector.classList.remove('active');
                        fancySelector.innerHTML = '<div class="spinner"><div class="bounce1"></div><div class="bounce2"></div><div class="bounce3"></div></div>';
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

   showLoginForNotLoggedUsers() {
      window.GFtheme.meetings_id = this.props.meeting.id;
      window.GFtheme.location_slug = this.props.meeting.location.slug;
      window.GFtheme.brand_slug = this.props.meeting.location.brand.slug;
      let login = CalendarStorage.get('show_login');
      login(true);
   }

   showRegisterForNotLoggedUsers() {
      window.GFtheme.location_slug = this.props.meeting.location.slug;
      window.GFtheme.brand_slug = this.props.meeting.location.brand.slug;
      
      if(!gafa){
         let register = CalendarStorage.get('show_register');
         window.GFtheme.meetings_id = this.props.meeting.id;
         register(true);
      } else {
         let reservation_url = gafa.b_login + '?reservation-id=' + this.props.meeting.id;
         window.location.replace(reservation_url);
      }
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