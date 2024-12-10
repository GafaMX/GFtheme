'use strict';

import React from 'react'
import moment from "moment";
import CalendarMeeting from "../CalendarMeeting";
import uid from "uid";
import Slider from "react-slick";

export default class VerticalCalendarBody extends React.Component {
    constructor(props) {
        super(props);

        this.state = {
            selectedDate: null // Día seleccionado para mostrar sus reuniones
        };

        this.selectDate = this.selectDate.bind(this);
        this.getMonthDays = this.getMonthDays.bind(this);
    }

    selectDate(date) {
        // Actualiza el estado para mostrar las reuniones del día seleccionado
        this.setState({ selectedDate: date });
    }

    getMonthDays() {
        // Genera una lista de fechas para el mes actual
        let { meetings_to_show } = this.props;
        let startOfMonth = moment().startOf('month');
        let endOfMonth = moment().endOf('month');
        let daysInMonth = [];

        for (let date = startOfMonth; date.isBefore(endOfMonth); date.add(1, 'days')) {
            let dayMeetings = meetings_to_show.find(function (day) {
                return moment(day.date).isSame(date, 'day');
            });

            daysInMonth.push({
                date: date.clone().toDate(),
                meetings: dayMeetings ? dayMeetings.meetings : []
            });
        }

        return daysInMonth;
    }

    printDaysHeader() {
        let daysInMonth = this.getMonthDays();
        let preC = 'GFSDK-c';

        let dayTags = daysInMonth.map(function (item, i) {
            return (
                <a
                    key={`${preC}-Calendar--vertical-head--${item.date}`}
                    className={item.meetings.length === 0 ? 'empty-slide' : ''}
                    onClick={this.selectDate.bind(this, item.date)}
                >
                    <div>
                        <p className="this-date">{moment(item.date).format('dd')}</p>
                        <p className="this-number">{moment(item.date).format('D')}</p>
                    </div>
                </a>
            );
        }, this);

        return (
            <div className={`${preC}-Calendar__header_vertical`}>
                {dayTags}
            </div>
        );
    }

    printMeetingsBody() {
        let { openFancy, closedFancy, login_initial, limit } = this.props;
        let { selectedDate } = this.state;
        let preC = 'GFSDK-c';

        if (!selectedDate) {
            return <p>Seleccione un día para ver los meetings.</p>;
        }

        let dayMeetings = this.props.meetings_to_show.find(function (day) {
            return moment(day.date).isSame(selectedDate, 'day');
        });

        if (!dayMeetings || dayMeetings.meetings.length === 0) {
            return <p>No hay meetings para este día.</p>;
        }

        let column_days = dayMeetings.meetings.map(function (meeting) {
            return (
                <CalendarMeeting
                    key={`column-day--${uid()}--meeting--${meeting.id}`}
                    meeting={meeting}
                    day={dayMeetings}
                    openFancy={openFancy}
                    closedFancy={closedFancy}
                    login_initial={login_initial}
                />
            );
        });

        return (
            <div
                key={`${preC}-Calendar__day_column_vertical--${selectedDate}`}
                className={`${preC}-Calendar__day_column_vertical`}
                data-date={selectedDate}
            >
                {column_days}
            </div>
        );
    }

    printMeetingsBodyMobile() {
        let {sliderSettings, sliderItems} = this.props;

        return (
            <Slider {...sliderSettings} className={'vertical-calendar--mobile'}>
                {sliderItems}
            </Slider>
        );
    }

    render() {
        return (
            <div>
                {this.printDaysHeader()}
                {this.printMeetingsBody()}
            </div>
        );
    }
}