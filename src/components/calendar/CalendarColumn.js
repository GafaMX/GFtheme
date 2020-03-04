'use strict';

import React from "react";
import CalendarMeeting from "./CalendarMeeting";
import Moment from "react-moment";
import 'moment/locale/es';

class CalendarColumn extends React.Component {
    constructor(props) {
        super(props);

        this.renderMeetings = this.renderMeetings.bind(this);
    }

    renderMeetings(){
        let day = this.props.day;

        day.meetings.map(function (meeting) {
            return ( <CalendarMeeting key={`column-day--${dayDate}--meeting--${meeting.id}`} meeting={meeting} day={day}/> )
        });
    }

    render() {
        let {day, index, limit} = this.props;
        let dayDate = day.date.toDateString();
        let listItems;
        let preC = 'GFSDK-c';
        let calendarClass = preC + '-Calendar';
        let activeClass =
            day.meetings.map((meeting) => {
                if(meeting.passed === false){
                    return meeting;
                }
            });

        var today = new Date();
        var date = today.getFullYear()+'-'+(today.getMonth()+1)+'-'+today.getDate();

        if(limit){
            listItems = activeClass.slice(0, limit).map((meeting) => {
                if(meeting){
                    return (<CalendarMeeting key={`column-day--${dayDate}--meeting--${meeting.id}`} meeting={meeting} day={day}/> )
                }
            });
        } else {
            listItems = day.meetings.map((meeting) => {
                return (<CalendarMeeting key={`column-day--${dayDate}--meeting--${meeting.id}`} meeting={meeting} day={day}/> )
            });
        }

        return (
            <div className={calendarClass + '__column' + (index === 0 ? ' first-day' : '') + (index >= 6 ? ' last-day' : '') + (dayDate.includes(date)? ' is-today' : '')}>
                <div className={calendarClass + '__column__day'}>
                    <Moment className={'is-short'} calendar locale="es" format="dd">{dayDate}</Moment>
                    <Moment className={'is-long'} calendar locale="es" format="dddd">{dayDate}</Moment>
                    <Moment className='this-day' calendar locale="es" format="D">{dayDate}</Moment>
                </div>
                <div className={calendarClass + '__column__meeting'}>
                    {listItems}
                </div>
            </div>
        );
    }
}

export default CalendarColumn;
