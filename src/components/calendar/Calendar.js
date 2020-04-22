'use strict';

import React from "react";
import Strings from "../utils/Strings/Strings_ES";
import CalendarFilters from './CalendarFilters';
import CalendarStorage from './CalendarStorage';
import GlobalStorage from '../store/GlobalStorage';
import CalendarBody from "./CalendarBody";
import GafaFitSDKWrapper from "../utils/GafaFitSDKWrapper";
import LoginRegister from "../menu/LoginRegister";
import moment from "moment";

// Estilos
import '../../styles/newlook/components/GFSDK-c-Calendar.scss';
import '../../styles/newlook/components/GFSDK-c-Filter.scss';
import '../../styles/newlook/elements/GFSDK-e-meeting.scss';
import '../../styles/newlook/elements/GFSDK-e-navigation.scss';

class Calendar extends React.Component {
    constructor(props) {
        super(props);

        this.state = {
            showLogin: false,
            calendarHeight: CalendarStorage.get('calendarHeight'),
            calendarWidth: CalendarStorage.get('calendarWidth'),
            currentLocation: GlobalStorage.get('currentLocation'),
            meetings: null,
            rooms:null,

        };

        CalendarStorage.set('locations', this.props.locations);
        CalendarStorage.set('show_login', this.setShowLogin.bind(this));
        this.getMeetings = this.getMeetings.bind(this);
        CalendarStorage.addSegmentedListener(['calendarHeight', 'calendarWidth'], this.updateCalendarDimensions.bind(this));
        GlobalStorage.addSegmentedListener(['currentLocation'], this.updateCalendar.bind(this));
    }

    componentDidMount() {
        this.getMeetings();
        this.getRooms();
    }

    updateCalendarDimensions(){
        this.setState({
            calendarHeight: CalendarStorage.get('calendarHeight'),
            calendarWidth: CalendarStorage.get('calendarWidth'),
        });
    }

    updateCalendar(){
        this.getMeetings();
        this.getRooms();

        this.setState({
            meetings: CalendarStorage.get('meetings'),
            rooms: CalendarStorage.get('rooms'),
        })
    }

    getMeetings() {
        let location = GlobalStorage.get('currentLocation');

        if(location){
            let start_date = moment().toDate();
            let end_date = moment().toDate();

            let push_meetings = function (result) {
                CalendarStorage.set('meetings', []);
                CalendarStorage.push('meetings', result);
                CalendarStorage.set('start_date', start_date);
            };

            start_date = !location.date_start ? start_date : moment(location.date_start).toDate();
            end_date.setDate(start_date.getDate() + (location.calendar_days - 1));

            let start_string = `${start_date.getFullYear()}-${start_date.getMonth() + 1}-${start_date.getDate()}`;
            let end_string = `${end_date.getFullYear()}-${end_date.getMonth() + 1}-${end_date.getDate()}`;

            GafaFitSDKWrapper.getMeetingsInLocation(start_string, end_string, push_meetings);
            CalendarStorage.set('start_date', start_date);
        }
    }

    getRooms() {
        let component = this;
        let locations = GlobalStorage.get('currentLocation');

        if(locations){
            GafaFitSDKWrapper.getBrandRoomsWithoutBrand(locations.brand.slug, {}, function (result) {
                CalendarStorage.set('rooms', result.data)
            });
        }
    }

    setShowLogin(showLogin) {
        this.setState({
            showLogin: showLogin
        });
    }

    render() {
        let preC = 'GFSDK-c';
        let calendarClass = preC + '-Calendar';
        let widthDimension = CalendarStorage.get('calendarWidth');
        let heightDimension = CalendarStorage.get('calendarHeight');

        const mystyles = {
            width:  widthDimension + 'px',
        }

        return (
            <div className={calendarClass}>
                <div className={calendarClass + '__container'} style={mystyles}>
                    <CalendarFilters/>
                    <CalendarBody limit={this.props.limit} />
                </div>
                {this.state.showLogin &&
                <LoginRegister setShowLogin={this.setShowLogin.bind(this)}/>
                }
            </div>
        );
    }
}

export default Calendar;
