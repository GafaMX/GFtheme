'use strict';

import React from "react";
import CalendarStorage from "../../CalendarStorage";
import GafaFitSDKWrapper from "../../../utils/GafaFitSDKWrapper";
import moment from 'moment';
import 'moment/locale/es';

export default class CalendarMeetingProwess extends React.Component {
    constructor(props) {
        super(props);

        this.state = {
            room: this.getRoom(),
            locations: CalendarStorage.get('locations'),
            brands: CalendarStorage.get('brands'),
            meeting: this.props.meeting,
        };

        CalendarStorage.addSegmentedListener(['rooms'], this.updateRoom.bind(this));
    };

    getRoom() {
        return CalendarStorage.find('rooms', this.props.meeting.rooms_id);
    };

    updateRoom() {
        let room = CalendarStorage.find('rooms', this.props.meeting.rooms_id);
        this.setState({
            room: room
        });
    };

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
        let brand = meeting.service.brand.slug;
        if (meeting && location) {
            GafaFitSDKWrapper.getFancyForMeetingReservation(brand, location.slug, meeting.id, function (result) {});
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
        const {day} = this.props;
        const {brands, meeting} = this.state;
        const brandFinder = brands.find(brand => brand.id = meeting.service.brand.id);
        let location = CalendarStorage.find('locations', meeting.locations_id);
        let time_format = location.brand.time_format;

        let classStart = moment(meeting.start_date).toDate();
        let classEnds = moment(meeting.end_date).toDate();
        // let brandName = locationFinder.name.toUpperCase().replace(meeting.service.brand.name.toUpperCase(), '');
        let brandName = meeting.service.brand.name.toUpperCase().replace(brandFinder.company.name.toUpperCase(), '');

        return (
            <div key={`column-day--${day.date}--meeting--${meeting.id}`}
                 className={`event tt_single_event ${meeting.passed ? 'past-meeting' : ''}`} data-id={meeting.id}
                 onClick={this.handleClick.bind(this)}>
                <div className={'event_container '}>
                    <p className={'event_location'}>{brandName}</p>
                    <p className={'event_header'}>{meeting ? meeting.service.name : ''}</p>
                    <div className="top_hour">
                        { time_format === '12'
                            ? <span className="hours">{moment(classStart).format('hh')}.{moment(classStart).format('mm')} {moment(classStart).format('a')}</span>
                            : <span className="hours">{moment(classStart).format('kk')}.{moment(classStart).format('mm')}</span>
                        }
                    </div>
                    <div className={'bottom_hour'}>
                        { time_format === '12'
                            ? <span className="hours">{moment(classEnds).format('hh')}.{moment(classEnds).format('mm')} {moment(classEnds).format('a')}</span>
                            : <span className="hours">{moment(classEnds).format('kk')}.{moment(classEnds).format('mm')}</span>
                        }
                    </div>
                    <div className={'after_hour_text'}>{meeting.staff.name}</div>
                </div>
            </div>
        );
    }
}