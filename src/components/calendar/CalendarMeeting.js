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
            room: this.getRoom(),
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

        GafaFitSDKWrapper.isAuthenticated(function(auth){
            if (auth) {
                currentElement.showBuyFancyForLoggedUsers();
            } else {
                currentElement.showLoginForNotLoggedUsers();
            }
        });
    };

    showBuyFancyForLoggedUsers() {
        let meeting = this.props.meeting;
        let location = CalendarStorage.find('locations', meeting.locations_id);
        if (meeting && location) {
            GafaFitSDKWrapper.getFancyForMeetingReservation(location.slug, meeting.id, function (result) {});
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
        let classStart = moment(meeting.start_date).toDate();
        let room = this.state.room;
        // let location = CalendarStorage.find('locations', meeting.locations_id);
        let location = GlobalStorage.get('currentLocation')
        let time_format = location.brand.time_format;

        let preC = 'GFSDK-c';
        let preE = 'GFSDK-e';
        let calendarClass = preC + '-Calendar';
        let meetingClass = preE + '-meeting';

        return (
            <div key={`column-day--${day.date}--meeting--${meeting.id}`}
                 className={calendarClass + '__item ' + meetingClass + (meeting.passed ? ' has-pasted' : '')}
                 data-id={meeting.id}
                 onClick={this.handleClick.bind(this)}>
                    <div className={meetingClass + '__header'}>
                        <p className={'this-service'}>{meeting.service.name}</p>
                        <p className={'this-room'}>{room ? room.name : ''}</p>
                    </div>
                    <hr></hr>
                    <div className={meetingClass + '__body'}>
                        {time_format === '12' 
                            ? <p className={'this-time'}>{moment(classStart).format('hh')}.{moment(classStart).format('mm')} {moment(classStart).format('a')}</p>
                            : <p className={'this-time'}>{moment(classStart).format('kk')}.{moment(classStart).format('mm')} </p>
                        }
                        <p className={'this-staff'}>{meeting.staff.name}</p>
                        <p className={'this-location'}>{location ? location.name : ''}</p>
                    </div>
            </div>
        );
    }
}

export default CalendarMeeting;