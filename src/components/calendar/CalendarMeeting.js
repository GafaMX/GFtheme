'use strict';

import React from "react";
import CalendarStorage from "./CalendarStorage";
import GafaFitSDKWrapper from "../utils/GafaFitSDKWrapper";

class CalendarMeeting extends React.Component {
    constructor(props) {
        super(props);

        this.state = {
            room: this.getRoom()
        };

        CalendarStorage.addSegmentedListener(['rooms'], this.updateRoom.bind(this));
    }

    getRoom() {
        return CalendarStorage.find('rooms', this.props.meeting.rooms_id);
    }

    updateRoom() {
        let room = CalendarStorage.find('rooms', this.props.meeting.rooms_id);
        this.setState({
            room: room
        });
    }

    handleClick(event) {
        event.preventDefault();
        let currentElement = this;
        if (GafaFitSDKWrapper.isAuthenticated()) {
            currentElement.showBuyFancyForLoggedUsers();
        } else {
            currentElement.showLoginForNotLoggedUsers();
        }
    };

    showBuyFancyForLoggedUsers() {
        let meeting = this.props.meeting;
        let location = CalendarStorage.find('locations', meeting.locations_id);
        if (meeting && location) {
            GafaFitSDKWrapper.getFancyForMeetingReservation(location.slug, meeting.id, function (result) {

            });
        }
    }

    showLoginForNotLoggedUsers() {
        let location = CalendarStorage.find('locations', this.props.meeting.locations_id);
        window.GFtheme.meetings_id = this.props.meeting.id;
        window.GFtheme.location_slug = location.slug;
        let login = CalendarStorage.get('show_login');
        login(true);
    }

    render() {
        let meeting = this.props.meeting;
        let day = this.props.day;
        let date = new Date(meeting.start_date);
        let room = this.state.room;
        let location = CalendarStorage.find('locations', meeting.locations_id);

        return (
            <div key={`column-day--${day.date}--meeting--${meeting.id}`}
                 className={`calendar-meeting shadow-sm ${meeting.passed ? 'past-meeting' : ''}`} data-id={meeting.id}
                 onClick={this.handleClick.bind(this)}>
                <div className={'mb-4 card'}>
                    <div className={'card-header'}>
                        <p className={'meeting-room-name calendar-meeting-info-line'}>{location ? location.name : ''}</p>
                    </div>
                    <div className={'card-body'}>
                        <p className={'meeting-start-time calendar-meeting-info-line'}>{date.getHours().toString().padStart(2, '0')}:{date.getMinutes().toString().padStart(2, '0')}</p>
                        <p className={'meeting-staff-name calendar-meeting-info-line'}>{meeting.staff.name}</p>
                        <p className={'meeting-service-name calendar-meeting-info-line'}>{meeting.service.name}</p>
                        <p className={'meeting-room-name calendar-meeting-info-line'}>{room ? room.name : ''}</p>
                    </div>
                </div>
            </div>
        );
    }
}

export default CalendarMeeting;