'use strict';

import React from "react";
import Strings from "../utils/Strings/Strings_ES";
import CalendarFilters from './CalendarFilters';
import CalendarStorage from './CalendarStorage';
import CalendarBody from "./CalendarBody";
import GafaFitSDKWrapper from "../utils/GafaFitSDKWrapper";
import LoginRegister from "../menu/LoginRegister";

// Estilos
import '../../styles/newlook/components/GFSDK-c-Calendar.scss';
import '../../styles/newlook/components/GFSDK-c-Filter.scss';
import '../../styles/newlook/elements/GFSDK-e-meeting.scss';
import '../../styles/newlook/elements/GFSDK-e-navigation.scss';

class Calendar extends React.Component {
    constructor(props) {
        super(props);

        this.state = {
            showLogin: false
        };

        CalendarStorage.set('locations', this.props.locations);
        CalendarStorage.set('show_login', this.setShowLogin.bind(this));
        this.getMeetings = this.getMeetings.bind(this);
    }

    componentDidMount() {
        this.getMeetings();
        this.getRooms();
    }

    getMeetings() {
        let locations = CalendarStorage.get('locations');
        let start_date = new Date();
        let end_date = new Date();

        CalendarStorage.set('start_date', start_date);

        let push_meetings = function (result) {
            CalendarStorage.push('meetings', result);
            CalendarStorage.set('start_date', start_date);
        };

        locations.forEach(function (location) {
            end_date.setDate(start_date.getDate() + (location.calendar_days - 1));
            let start_string = `${start_date.getFullYear()}-${start_date.getMonth() + 1}-${start_date.getDate()}`;
            let end_string = `${end_date.getFullYear()}-${end_date.getMonth() + 1}-${end_date.getDate()}`;
            GafaFitSDKWrapper.getMeetingsInLocation(location.id, start_string, end_string, push_meetings);
        });
    }

    getRooms() {
        GafaFitSDKWrapper.getBrandRooms({}, function (result) {
            CalendarStorage.push('rooms', result.data)
        })
    }

    setShowLogin(showLogin) {
        this.setState({
            showLogin: showLogin
        });
    }

    render() {
        let preC = 'GFSDK-c';
        let calendarClass = preC + '-Calendar';

        return (
            <div className={calendarClass}>
                <CalendarFilters/>
                <CalendarBody/>
                {this.state.showLogin &&
                <LoginRegister setShowLogin={this.setShowLogin.bind(this)}/>
                }
            </div>
        );
    }
}

export default Calendar;