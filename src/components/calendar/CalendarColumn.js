'use strict';

import React from "react";
import CalendarMeeting from "./CalendarMeeting";

class CalendarColumn extends React.Component {
    constructor(props) {
        super(props);
    }

    render() {
        let day = this.props.day;
        let index = this.props.index;

        return (
            <div
                className={'calendar-day-column' + (index === 0 ? ' first-day' : '') + (index >= 6 ? ' last-day' : '')}>
                <p className={'column-day-title'}>{day.title}</p>
                {day.meetings.map(function (meeting) {
                    return (
                        <CalendarMeeting key={`column-day--${day.date}--meeting--${meeting.id}`} meeting={meeting}
                                         day={day}/>
                    );
                })}
            </div>
        );
    }
}

export default CalendarColumn;