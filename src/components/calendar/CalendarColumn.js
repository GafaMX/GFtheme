'use strict';

import React from "react";
import CalendarMeeting from "./CalendarMeeting";
import moment from "moment";
import 'moment/locale/es';
import uid from 'uid';

class CalendarColumn extends React.Component {
    constructor(props) {
        super(props);

        this.renderMeetings = this.renderMeetings.bind(this);
    }

   renderMeetings() {
      let day = this.props.day;

      day.meetings.map(function (meeting) {
         return ( <CalendarMeeting key={`column-day--${dayDate}--meeting--${meeting.id}`} meeting={meeting} day={day}/> )
      });
   }

   isString(myVar) {
      return typeof myVar === 'string' || myVar instanceof String;
   }

   render() {
      let {day, index, limit, alignment, login_initial} = this.props;

      let dayDate = this.isString(day.date) ? day.date :day.date.toDateString();
      let listItems;
      let preC = 'GFSDK-c';
      let calendarClass = preC + '-Calendar';

      let activeClass = day.meetings.filter((meeting) => {
                           if (meeting.passed === false) {
                              return meeting;
                           }
                        });

      let today = new Date();
      let date = today.getFullYear() + '-' + (today.getMonth() + 1) + '-' + today.getDate();

      if (limit) {
         listItems = activeClass.slice(0, limit).map((meeting) => {
               if (meeting) {
                  return(  
                     <CalendarMeeting 
                        key={`column-day--${uid()}--meeting--${meeting.id}`} 
                        meeting={meeting} day={day} 
                        alignment={alignment}
                        openFancy = {this.props.openFancy}
                        closedFancy = {this.props.closedFancy}
                        login_initial={login_initial}
                     /> 
                  )
               }
         });
      } else {
         listItems = activeClass.map((meeting) => {
            if (meeting) {
               return (
                  <CalendarMeeting 
                     key={`column-day--${uid()}--meeting--${meeting.id}`} 
                     meeting={meeting} 
                     day={day} 
                     alignment={alignment}
                     openFancy = {this.props.openFancy}
                     closedFancy = {this.props.closedFancy}
                  /> 
               );
            }
         });
      }

      return (
         <div
               className={calendarClass + '__column' + (index === 0 ? ' first-day' : '') + (index >= 6 ? ' last-day' : '') + (dayDate.includes(date) ? ' is-today' : '')}>
               <div className={calendarClass + '__column__day'}>
                  <p className={'is-short'} >{moment(dayDate).format('dd')}</p>
                  <p className={'is-long'}>{moment(dayDate).format('dddd')}</p>
                  <p className='this-day'>{moment(dayDate).format('D')}</p>
               </div>
               <div className={calendarClass + '__column__meeting'}>
                  {listItems.length === 0 
                     ? <div className={calendarClass + '__empty'}><p>{window.GFtheme.ClassName} no disponibles</p></div>
                     : listItems 
                  }
               </div>
         </div>
      );
   }
}

export default CalendarColumn;
