'use strict';

import React from "react";
import CalendarMeetingProwess from "./CalendarMeeting";
import Moment from 'react-moment';
import 'moment/locale/es';

export default class CalendarColumnProwess extends React.Component {
    constructor(props) {
        super(props);
    }

    render() {
        let day = this.props.day;
        let index = this.props.index;
        let daySessions = day.meetings.length;

        return (
            <div className={'calendar-day-column' + (index === 0 ? ' first-day' : '') + (index >= 6 ? ' last-day' : '') + (daySessions < 1 ? ' is-empty' : '') }>

                <div className={'column-day-title'}>
                    <Moment element="span" format='MMMM' locale="es">{day.date}</Moment>
                    <Moment element="span" format='D' locale="es">{day.date}</Moment>
                </div>
                {day.meetings.map(function (meeting) {
                    return (
                        <CalendarMeetingProwess key={`column-day--${day.date}--meeting--${meeting.id}`} meeting={meeting} day={day}/>
                    );
                })}
            </div>
        );
    }
}