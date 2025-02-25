'use strict';

import React, { useState } from 'react';
import moment from "moment";
import CalendarMeeting from "../CalendarMeeting";
import uid from "uid";
import Slider from "react-slick";
import Calendar from "react-calendar"; // Importar react-calendar
import 'react-calendar/dist/Calendar.css'; // Importar estilos predeterminados
import './css/MonthCalendarBody.css'; // Custom css
import GlobalStorage from "../../store/GlobalStorage";

export default class VerticalCalendarBody extends React.Component {
    constructor(props) {
        super(props);

        // Estado para la fecha seleccionada
        this.state = {
            selectedDate: new Date(),
        };
  
        this.handleDateChange = this.handleDateChange.bind(this);
    }

    componentDidMount() {
        let locations = GlobalStorage.get('locations');
        let daaMin = null;
        let dataMax = null;
    
        if (Array.isArray(locations)) {
            locations.forEach(location => {
                if (!daaMin || new Date(location.since) < new Date(daaMin)) {
                    daaMin = location.since; // Encuentra la fecha mínima
                }
                if (!dataMax || new Date(location.until) > new Date(dataMax)) {
                    dataMax = location.until; // Encuentra la fecha máxima
                }
            });
        } else {
            console.log("No es un array o los datos no están en el formato esperado.");
        }
    
        // Valores predeterminados si no se encuentran fechas válidas
        const now = new Date();
        this.minDate = daaMin ? new Date(daaMin) : now; // La fecha mínima es hoy
        this.maxDate = dataMax ? new Date(dataMax) : moment(now).add(60, 'days').toDate(); // La fecha máxima es 60 días en el futuro
    }
    // Método para manejar cambios de fecha
    handleDateChange(newDate) {
        this.setState({ selectedDate: newDate });

        // actualizar las reuniones según la fecha seleccionada
        if (this.props.onDateChange) {
            this.props.onDateChange(moment(newDate).format('YYYY-MM-DD'));
        }
    }

    printDaysHeader() {
        let { meetings_to_show } = this.props;
        let preC = 'GFSDK-c';

        const dayList = meetings_to_show.map(function (day) {
            return moment(day.date).toDate();
        });

        let dayTags = !!dayList && dayList.length
            ? dayList.map(function (item, i) {
                  return (
                      <a
                          key={`${preC}-Calendar--vertical-head--${item}`}
                          className={meetings_to_show[i].meetings.length === 0 ? 'empty-slide' : ''}
                      >
                          <div>
                              <p className="this-date">{moment(item).format('dd')}</p>
                              <p className="this-number">{moment(item).format('D')}</p>
                          </div>
                      </a>
                  );
              })
            : [];

        return <div className={`${preC}-Calendar__header_vertical calendar-month`}>{dayTags}</div>;
    }

    printMeetingsBody() {
        let { meetings_to_show, openFancy, closedFancy, login_initial, limit } = this.props;
        let { selectedDate } = this.state;
        let preC = 'GFSDK-c';

        const formattedDate = moment(selectedDate)
        .format('dddd, D [de] MMMM')
        .replace(/^\w/, (c) => c.toUpperCase());

        // Filtrar reuniones del día seleccionado
        const filteredMeetings = meetings_to_show.filter((day) => {
            return moment(day.date).isSame(moment(selectedDate), 'day');
        });

        let listItems = [];

        if (filteredMeetings.length === 0 || filteredMeetings.every(day => day.meetings.length === 0)) {
            return (
                <div>
                    <div className="selected-date-wrapper">
                        <p className="selected-date">{formattedDate}</p>
                    </div>

                <div className={`${preC}-Calendar__week_body_vertical no-meetings`}>
                    <p className="no-meetings-message">"Sin horarios disponibles para este día"</p>
                </div>
                </div>
            );
        }

        filteredMeetings.forEach(function (day, index) {
            let column_days = [];
            let activeClass = day.meetings.filter((meeting) => {
                if (meeting.passed === false) {
                    return meeting;
                }
            });
            if (limit) {
                activeClass = activeClass.slice(0, limit);
            }

            column_days = activeClass.map((meeting) => {
                if (meeting) {
                    return (
                        <CalendarMeeting
                            key={`column-day--${uid()}--meeting--${meeting.id}`}
                            meeting={meeting}
                            day={day}
                            openFancy={openFancy}
                            closedFancy={closedFancy}
                            login_initial={login_initial}
                        />
                    );
                }
            });

            listItems.push(
                <div
                    key={`${preC}-Calendar__day_column_vertical--${day.date}`}
                    className={`${preC}-Calendar__day_column_vertical month-calendar`}
                    data-date={day.date}
                >
                    {column_days}
                </div>
            );
        });
 
        return (
            <div>
                <div className="selected-date-wrapper">
                    <p className="selected-date">{formattedDate}</p>
                </div>
                <div className={`${preC}-Calendar__week_body_vertical`}>
                    {listItems}
                </div>
            </div>
        );
    }

    printMeetingsBodyMobile() {
        let { sliderSettings, sliderItems } = this.props;

        return <Slider {...sliderSettings} className={'vertical-calendar--mobile'}>{sliderItems}</Slider>;
    }

    render() {
        const { selectedDate } = this.state;

        return (
            <div className="calendar-wrapper">
            {/* React Calendar */}
            <div className="calendar-selector">
                <Calendar
                    onChange={this.handleDateChange}
                    value={selectedDate}
                    minDate={this.minDate} 
                    maxDate={this.maxDate}
                />
            </div>

            {/* Meetings Body */}
            {this.printMeetingsBody()}
            {this.printMeetingsBodyMobile()}
        </div>
        );
    }
}