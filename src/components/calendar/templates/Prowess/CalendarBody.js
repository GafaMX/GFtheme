'use strict';

import React from "react";
// import Strings from "../utils/Strings/Strings_ES";
import CalendarStorage from "../../CalendarStorage";
import CalendarColumnProwess from './CalendarColumn';
import Moment from 'moment';

export default class CalendarBodyProwess extends React.Component {
    constructor(props) {
        super(props);

        this.state = {
            meetings_to_show: this.initialMeetings(),
            meetings: CalendarStorage.get('meetings'),
        };

        CalendarStorage.addSegmentedListener(['filter_location', 'filter_service', 'filter_room', 'meetings', 'start_date', 'filter_time_of_day'], this.updateMeetings.bind(this));
    }

    initialMeetings() {
        let shown_meetings = [];
        let meetings = CalendarStorage.get('meetings');
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
                        let meeting_date = Moment(meeting.start_date, 'YYYY-MM-DD HH:mm:ss');

                        return new Date(date.toDateString()).getTime() === new Date(meeting_date.toDateString()).getTime();
                    })
                };

                shown_meetings.push(meet);
            });
        }
        return shown_meetings;
    }

    updateMeetings() {
        let location = CalendarStorage.get('filter_location');
        let service = CalendarStorage.get('filter_service');
        let room = CalendarStorage.get('filter_room');
        let meetings = CalendarStorage.get('meetings');
        let start = CalendarStorage.get('start_date');
        let end = new Date(start.getTime());
        end.setDate(start.getDate() + 6);
        let time_of_day = CalendarStorage.get('filter_time_of_day');

        let shown_meetings = [];

        if (location) {
            meetings = meetings.filter(function (meeting) {
                return meeting.locations_id === location.id;
            })
        }

        if (service) {
            meetings = meetings.filter(function (meeting) {
                return meeting.services_id === service.id;
            })
        }

        if (room) {
            meetings = meetings.filter(function (meeting) {
                return meeting.rooms_id === room.id;
            })
        }

        if (time_of_day) {
            if (time_of_day === 'morning') {
                meetings = meetings.filter(function (meeting) {
                    let date = Moment(meeting.start_date, 'YYYY-MM-DD HH:mm:ss');
                    return date.getHours() < 12;
                })
            } else if (time_of_day === 'afternoon') {
                meetings = meetings.filter(function (meeting) {
                    let date = Moment(meeting.start_date, 'YYYY-MM-DD HH:mm:ss');
                    return date.getHours() >= 12;
                })
            }
        }

        let date_array = this.getDates(start, end);

        date_array.forEach(function (date) {
            let meet = {
                title: date.toLocaleDateString(),
                date: date.toISOString(),
                meetings: meetings.filter(function (meeting) {
                    let meeting_date = Moment(meeting.start_date, 'YYYY-MM-DD HH:mm:ss').toDate();

                    return new Date(date.toDateString()).getTime() === new Date(meeting_date.toDateString()).getTime();
                })
            };

            shown_meetings.push(meet);
        });

        this.setState({
            meetings_to_show: shown_meetings
        });
    }

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
        return (
            <div className={'tt_timetable is-responsive'}>
                {this.state.meetings_to_show.map(function (day, index) {
                    return (
                        <CalendarColumnProwess key={`calendar-day--${index}`}
                                        index={index}
                                        day={day}/>
                    );
                })}
            </div>
        );

    }
}