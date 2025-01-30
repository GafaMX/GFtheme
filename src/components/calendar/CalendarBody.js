'use strict';

import React from "react";
import CalendarStorage from "./CalendarStorage";
import CalendarColumn from './CalendarColumn';
import Slider from "react-slick";
import IconLeftArrow from "../utils/Icons/IconLeftArrow";
import IconRightArrow from "../utils/Icons/IconRightArrow";
import 'slick-carousel/slick/slick.css';
import 'slick-carousel/slick/slick-theme.css';

import moment from 'moment';
// import 'moment/min/moment-with-locales';
import 'moment/locale/es';
import StringStore from "../utils/Strings/StringStore";
import VerticalCalendarBody from "./vertical/VerticalCalendarBody";
import MonthCalendarBody from "./vertical/MonthCalendarBody";

moment.locale('es');

class CalendarBody extends React.Component {
    constructor(props) {
        super(props);

        this.state = {
            meetings_to_show: [],
            initialDay: null,
            start: null,
            end: null,
            has_next: this.hasNextPrev(),
            has_prev: this.hasNextPrev(false),
        };

        this.getMeetingsToShow = this.getMeetingsToShow.bind(this);
        this.hasNextPrev = this.hasNextPrev.bind(this);

        CalendarStorage.addSegmentedListener(['start_date'], this.updateStart.bind(this));
    }

    componentDidMount() {
        let start = CalendarStorage.get('start_date');
        let end = new Date(start.getTime());


        let daysToAdd = getDaysToAddToEndBasedOnVisualization(); //funcion para evaluar los dias

        end.setDate(start.getDate() + daysToAdd); // aumenta la consulta de meetings del dia actual +60 dias        

        this.setState({
            start,
            end
        });
    }


    getMeetingsToShow(props, start, end) {
        let meetings = props.meetings;
        let shown_meetings = [];

        if (start && end) {
            let date_array = this.getDates(start, end);

            if (!!meetings && !!start) {
                let end = new Date(start.getTime());


                let daysToAdd = getDaysToAddToEndBasedOnVisualization(); //funcion para evaluar los dias

                end.setDate(start.getDate() + daysToAdd); // aumenta la consulta de meetings del dia actual +60 dias

                date_array.forEach(function (date) {
                    let meet = {
                        title: date.toLocaleDateString(),
                        date: date.toISOString(),
                        meetings: meetings.filter(function (meeting) {
                            let meeting_date = moment(meeting.start_date, 'YYYY-MM-DD HH:mm:ss').toDate();
                            return new Date(date.toDateString()).getTime() === new Date(meeting_date.toDateString()).getTime() && meeting.passed === false;
                        })
                    };
                    shown_meetings.push(meet);
                });
            }

            return shown_meetings;
        }
    }

    updateStart() {
        let start = CalendarStorage.get('start_date');
        let end = new Date(start.getTime());


        let daysToAdd = getDaysToAddToEndBasedOnVisualization(); //funcion para evaluar los dias

        end.setDate(start.getDate() + daysToAdd); // aumenta la consulta de meetings del dia actual +60 dias

        this.setState({
            start,
            end,
            has_next: this.hasNextPrev(),
            has_prev: this.hasNextPrev(false)
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

    hasNextPrev(next = true) {
        let meetings = CalendarStorage.get('meetings');
        let start = CalendarStorage.get('start_date');
        let compare_start = new Date(start.getTime());

        let added = next ? 7 : 0;
        compare_start.setDate(compare_start.getDate() + added);

        let compare = function (date_compare, compare_start) {
            let compare_string = compare_start.toDateString();
            return next ? date_compare >= new Date(compare_string) : date_compare < new Date(compare_string);
        };

        let next_meetings = meetings.find(function (meeting) {
            let meeting_date = new Date(meeting.start);
            let date_compare = new Date(meeting_date.toDateString());
            return compare(date_compare, compare_start);
        });

        return !!next_meetings;
    }

    nextWeek(e) {
        let start = CalendarStorage.get('start_date');

        if (this.hasNextPrev()) {
            let compare_start = new Date(start.getTime());
            let daysToAdd = getDaysToAddToStartBasedOnVisualization(); //funcion para evaluar los dias
            compare_start.setDate(compare_start.getDate() + daysToAdd);
            CalendarStorage.set('start_date', compare_start);
        }
    }

    prevWeek(e) {
        let start = CalendarStorage.get('start_date');

        if (this.hasNextPrev(false)) {
            let compare_start = new Date(start.getTime());
            let daysToAdd = getDaysToAddToStartBasedOnVisualization(); //funcion para evaluar los dias
            compare_start.setDate(compare_start.getDate() - daysToAdd);
            CalendarStorage.set('start_date', compare_start);
        }
    }


    printCalendarColumns() {
        const {meetings, limit, login_initial} = this.props;
        let {start, end, has_next, has_prev} = this.state;
        let preC = 'GFSDK-c';
        let preE = 'GFSDK-e';
        let buttonClass = preE + '-buttons';
        let calendarClass = preC + '-Calendar';
        let beginsIn, settings, response;
        let meetings_to_show = [];
        let visualization = CalendarStorage.get('visualization');

        if (start && end) {
            meetings_to_show = this.getMeetingsToShow(this.props, start, end);

            const dayList = meetings_to_show.map(function (day) {
                return (
                    moment(day.date).toDate()
                );
            });

            if (meetings_to_show.length > 0) {
                for (var i = 0; i < meetings_to_show.length; i++) {
                    let day = meetings_to_show[i];
                    if (day.meetings.length > 0) {
                        beginsIn = i;
                        break;
                    }
                }
            }

            settings = {
                draggable: false,
                infinite: false,
                arrows: false,
                adaptiveHeight: true,
                initialSlide: beginsIn,
                speed: 500,
                slidesToScroll: 1,
                slidesToShow: 1,
                customPaging: function (i) {

                    moment.locale(StringStore.getLanguage().toLowerCase());
                    return (
                        <a className={meetings_to_show[i].meetings.length === 0 ? 'empty-slide' : ''}>
                            <div>
                                <p className="this-date">{moment(dayList[i]).format('dd')}</p>
                                <p className="this-number">{moment(dayList[i]).format('D')}</p>
                            </div>
                        </a>
                    );
                },
                dots: true,
                dotsClass: "slick-dots slick-thumb " + calendarClass + '__day-dots',
                responsive: [
                    {
                        breakpoint: 992,
                        settings: {
                            slidesToShow: 1,
                            slidesToScroll: 1,
                        }
                    },
                ],
            };
        }

        let listItems = meetings_to_show.map(
            (day, index) => {
                return <CalendarColumn
                    key={`calendar-day--${index}`}
                    index={index} day={day}
                    limit={limit}
                    openFancy={this.props.openFancy}
                    closedFancy={this.props.closedFancy}
                    login_initial={login_initial}
                />
            }
        );
        if (visualization === 'vertical') {
            response = (<VerticalCalendarBody
                meetings_to_show={meetings_to_show}
                openFancy={this.props.openFancy}
                closedFancy={this.props.closedFancy}
                login_initial={login_initial}
                sliderSettings={settings}
                sliderItems={listItems}
            />);
        } else if (visualization === 'month') { // se agrega un nuevo modo de vista
            response = (<MonthCalendarBody
                meetings_to_show={meetings_to_show}
                openFancy={this.props.openFancy}
                closedFancy={this.props.closedFancy}
                login_initial={login_initial}
                sliderSettings={settings}
                sliderItems={listItems}
            />);
        } else {
            response = meetings_to_show.length > 0 && settings && listItems
                ? (<Slider {...settings}>
                    {listItems}
                </Slider>)
                : null;
        }

        return response;
    }

    render() {
        const {meetings, limit, login_initial} = this.props;
        let {start, end, has_next, has_prev} = this.state;
        let preC = 'GFSDK-c';
        let preE = 'GFSDK-e';
        let buttonClass = preE + '-buttons';
        let calendarClass = preC + '-Calendar';
        let beginsIn, settings;
        let meetings_to_show = [];
        let visualization = CalendarStorage.get('visualization');
        visualization = !!visualization ? visualization : 'horizontal';

        if (start && end) {
            meetings_to_show = this.getMeetingsToShow(this.props, start, end);

            const dayList = meetings_to_show.map(function (day) {
                return (
                    moment(day.date).toDate()
                );
            });

            if (meetings_to_show.length > 0) {
                for (var i = 0; i < meetings_to_show.length; i++) {
                    let day = meetings_to_show[i];
                    if (day.meetings.length > 0) {
                        beginsIn = i;
                        break;
                    }
                }
            }

            settings = {
                draggable: false,
                infinite: false,
                arrows: false,
                adaptiveHeight: true,
                initialSlide: beginsIn,
                speed: 500,
                slidesToScroll: 1,
                slidesToShow: 1,
                customPaging: function (i) {
                    moment.locale(StringStore.getLanguage().toLowerCase());
                    return (
                        <a className={meetings_to_show[i].meetings.length === 0 ? 'empty-slide' : ''}>
                            <div>
                                <p className="this-date">{moment(dayList[i]).format('dd')}</p>
                                <p className="this-number">{moment(dayList[i]).format('D')}</p>
                            </div>
                        </a>
                    );
                },
                dots: true,
                dotsClass: "slick-dots slick-thumb " + calendarClass + '__day-dots',
                responsive: [
                    {
                        breakpoint: 992,
                        settings: {
                            slidesToShow: 1,
                            slidesToScroll: 1,
                        }
                    },
                ],
            };
        }

        let listItems = meetings_to_show.map(
            (day, index) => {
                return <CalendarColumn
                    key={`calendar-day--${index}`}
                    index={index} day={day}
                    limit={limit}
                    openFancy={this.props.openFancy}
                    closedFancy={this.props.closedFancy}
                    login_initial={login_initial}
                />
            }
        );

        return (
            <div className={calendarClass + '__body ' + visualization}>
                <div className={calendarClass + '__body-container'}>
                    {visualization === 'vertical' && (
                        <div className={calendarClass + '__body-weeks is-mobile'}>
                            <button className={calendarClass + '__body-weeksSection is-past'} disabled={!has_prev}
                                    onClick={this.prevWeek.bind(this)}>
                                <span className={buttonClass + ' ' + buttonClass + '--icon'}>
                                    <IconLeftArrow />
                                </span>
                                <span className={'this-label'}>{StringStore.get('PREVIOUS_WEEK')}</span>
                            </button>
                            <button className={calendarClass + '__body-weeksSection is-next'} disabled={!has_next}
                                    onClick={this.nextWeek.bind(this)}>
                                <span className={'this-label'}>{StringStore.get('NEXT_WEEK')}</span>
                                <span className={buttonClass + ' ' + buttonClass + '--icon'}>
                                    <IconRightArrow />
                                </span>
                            </button>
                        </div>
                    )}
        
                    {this.printCalendarColumns()}
        
                    {visualization === 'vertical' && (
                        <div className={calendarClass + '__body-weeks is-desktop'}>
                            <button className={calendarClass + '__body-weeksSection is-past'} disabled={!has_prev}
                                    onClick={this.prevWeek.bind(this)}>
                                <span className={buttonClass + ' ' + buttonClass + '--icon'}>
                                    <IconLeftArrow />
                                </span>
                                <span className={'this-label'}>{StringStore.get('PREVIOUS_WEEK')}</span>
                            </button>
                            <button className={calendarClass + '__body-weeksSection is-next'} disabled={!has_next}
                                    onClick={this.nextWeek.bind(this)}>
                                <span className={'this-label'}>{StringStore.get('NEXT_WEEK')}</span>
                                <span className={buttonClass + ' ' + buttonClass + '--icon'}>
                                    <IconRightArrow />
                                </span>
                            </button>
                        </div>
                    )}
                </div>
            </div>
        );
        
    }
}

/*
 *funcion para evaluar los dias a partir del tipo de visualizacion
 *
 * @returns {number}
 */
function getDaysToAddToStartBasedOnVisualization() {
    // Obtenemos el tipo de visualización
    let visualization = CalendarStorage.get('visualization');
    // Determinamos los días a agregar según el tipo
    return (visualization === 'vertical' || visualization === 'horizontal') ? 7  : 60;
}

/**
 *
 * @returns {number}
 */
function getDaysToAddToEndBasedOnVisualization() {
    // Obtenemos el tipo de visualización
    let visualization = CalendarStorage.get('visualization');
    // Determinamos los días a agregar según el tipo
    return (visualization === 'vertical' || visualization === 'horizontal') ? 6 : 60;
}

export default CalendarBody;
