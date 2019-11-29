'use strict';

import React from "react";
import CalendarMeeting from "./CalendarMeeting";
import Moment from "react-moment";
import 'moment/locale/es';

class CalendarColumn extends React.Component {
    constructor(props) {
        super(props);
    }

    render() {
        let day = this.props.day;

        let index = this.props.index;

        let preC = 'GFSDK-c';
        let calendarClass = preC + '-Calendar';

        var today = new Date();
        var date = today.getFullYear()+'-'+(today.getMonth()+1)+'-'+today.getDate();

        // console.log((day.date), date);

        return (
            <div className={calendarClass + '__column' + (index === 0 ? ' first-day' : '') + (index >= 6 ? ' last-day' : '') + (day.date.includes(date)? ' is-today' : '')}>
                <div className={calendarClass + '__column__day'}>
                    <Moment calendar locale="es" format="dd">{day.date}</Moment>
                    <Moment className='this-day' calendar locale="es" format="D">{day.date}</Moment>
                </div>
                <div className={calendarClass + '__column__meeting'}>
                    {day.meetings.map(function (meeting) {
                        return (
                            <CalendarMeeting key={`column-day--${day.date}--meeting--${meeting.id}`} meeting={meeting}
                                            day={day}/>
                        );
                    })}
                </div>
            </div>
        );
    }
}

export default CalendarColumn;