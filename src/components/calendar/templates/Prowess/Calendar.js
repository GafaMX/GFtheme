'use strict';

import React from "react";
import LoginRegister from "../../../menu/LoginRegister";
import CalendarFiltersProwess from './CalendarFilters';
import CalendarBodyProwess from "./CalendarBody";
import './styles/Calendar.scss'

export default class CalendarProwess extends React.Component {
    render() {
        return (
            <div className={'timetable_clearfix tt_tabs tt_responsive event_layout_1 ui-tabs ui-widget ui-widget-content ui-corner-all'}>
                <CalendarFiltersProwess/>
                <CalendarBodyProwess/>
                {this.props.showLogin &&
                    <LoginRegister template={this.props.template} setShowLogin={this.props.setShowLogin}/>
                }
            </div>
        );
    }
}
