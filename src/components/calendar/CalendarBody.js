'use strict';

import React from "react";
import Strings from "../utils/Strings/Strings_ES";
import CalendarStorage from "./CalendarStorage";
import CalendarColumn from './CalendarColumn';

import Slider from "react-slick";
import 'slick-carousel/slick/slick.css';
import 'slick-carousel/slick/slick-theme.css';

import moment from 'moment';
import 'moment/min/moment-with-locales';
import 'moment/locale/es';

moment.locale('es');

class CalendarBody extends React.Component {
   constructor(props) {
      super(props);

      this.state = {
         meetings_to_show: [],
         initialDay: null,
      };
      
      this.initialMeetings = this.initialMeetings.bind(this);
      // CalendarStorage.addSegmentedListener(['start_date', 'filter_time_of_day'], this.updateMeetings.bind(this));
   }

   componentDidMount() {
      this.initialMeetings();
   }

   initialMeetings(){
      let curComp = this;
      let {meetings, state} = this.props;

      let beginsIn;
      let shown_meetings = [];
      let start = CalendarStorage.get('start_date');

      if (!!meetings && !!start) {
         let end = new Date(start.getTime());
         end.setDate(start.getDate() + 6);
         let date_array = this.getDates(start, end);

         date_array.forEach(function (date) {
            let meet = {
               title: date.toLocaleDateString(),
               date: date.toISOString(),
               meetings: meetings.filter(function (meeting) {
                  let meeting_date = moment(meeting.start_date, 'YYYY-MM-DD HH:mm:ss').toDate();
                  return new Date(date.toDateString()).getTime() === new Date(meeting_date.toDateString()).getTime() && meeting.passed === false;
               })
            };
            shown_meetings.push(meet);
         });
      }

      curComp.setState({
         meetings_to_show: shown_meetings,
      });
   }

   // isFunction(functionToCheck) {
   //    return functionToCheck && {}.toString.call(functionToCheck) === '[object Function]';
   // }


   getDates(startDate, stopDate) {
      let dateArray = [];
      let currentDate = new Date(startDate.getTime());
      while (currentDate <= stopDate) {
         let new_date = new Date(currentDate.getTime());
         dateArray.push(new_date);
         currentDate.setDate(currentDate.getDate() + 1);
      }

      return dateArray;
   }

   render() {
      const {limit, stateFilter} = this.props;
      const {meetings_to_show, initialDay} = this.state;
      let preC = 'GFSDK-c';
      let calendarClass = preC + '-Calendar';
      let beginsIn;
      
      const dayList = meetings_to_show.map(function (day) {
         return(
            moment(day.date).toDate()
         );
      });

      if(meetings_to_show.length > 0){
         for (var i = 0; i < meetings_to_show.length; i++) {
            let day = meetings_to_show[i];
            if(day.meetings.length > 0){
               beginsIn = i;
               break;
            }
         }
      }
      
      const listItems =  meetings_to_show.map(function (day, index) {
                           return (
                              <CalendarColumn
                                    key={`calendar-day--${index}`}
                                    index={index}
                                    day={day}
                                    limit={limit}
                              />
                           );
                        });
      
      let settings = {
         draggable : false,
         infinite: false,
         adaptiveHeight: true,
         initialSlide: initialCal,
         speed: 500,
         slidesToScroll: 1,
         slidesToShow: 1,
         customPaging: function(i) {
               return (
                  <a className={meetings_to_show[i].meetings.length === 0 ? 'empty-slide' : ''}>
                     <div>
                        <p className="this-date">{moment(dayList[i]).format('dd')}</p>
                        <p className="this-number">{moment(dayList[i]).format('D')}</p>
                     </div>
                  </a>
               );
         },
         dots: true,
         dotsClass: "slick-dots slick-thumb " + calendarClass + '__day-dots',
         responsive: [
            {
               breakpoint: 992,
               settings: {
                  slidesToShow: 1,
                  slidesToScroll: 1,
               }
            },
         ],
      };

      return (
         <div className={calendarClass + '__body horizontal' }>
               <div className={calendarClass + '__body-container'}>
                  { meetings_to_show.length > 0   
                     ?  <Slider {...settings}>
                           {listItems}
                        </Slider>
                     :  null
                  }
               </div>
         </div>
      );
   }
}

export default CalendarBody;
