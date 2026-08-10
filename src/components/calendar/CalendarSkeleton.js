'use strict';

import React from "react";
import moment from "moment";
import 'moment/locale/es';
import StringStore from "../utils/Strings/StringStore";
import '../../styles/newlook/components/GFSDK-c-CalendarSkeleton.scss';

/**
 * Vista "fantasma" que se muestra mientras el calendario todavia no tiene
 * datos (is_mounted === false), en vez del loading generico de puntos.
 *
 * Imita la forma REAL del calendario (columnas por dia en desktop, una sola
 * columna con varias tarjetas en mobile) en vez de una simple lista vertical
 * generica, para que la transicion a los datos reales se sienta continua.
 * Los encabezados de dia (nombre/numero) se calculan con la fecha real de
 * hoy +6 dias, ya que eso no depende de que la data ya haya llegado.
 */
class CalendarSkeleton extends React.Component {
    getUpcomingDays(count) {
        moment.locale(StringStore.getLanguage().toLowerCase());
        const today = moment();
        const days = [];

        for (let i = 0; i < count; i++) {
            const date = moment(today).add(i, 'days');
            days.push({
                dayName: date.format('dd'),
                dayNumber: date.format('D'),
            });
        }

        return days;
    }

    renderCard(columnIndex, cardIndex) {
        const preC = 'GFSDK-c';
        const skeletonClass = preC + '-CalendarSkeleton';

        return (
            <div className={skeletonClass + '__card'} key={`calendar-skeleton-card--${columnIndex}-${cardIndex}`}>
                <div className={skeletonClass + '__time'}/>
                <div className={skeletonClass + '__line ' + skeletonClass + '__line--title'}/>
                <div className={skeletonClass + '__line ' + skeletonClass + '__line--subtitle'}/>
                <div className={skeletonClass + '__line ' + skeletonClass + '__line--meta'}/>
                <div className={skeletonClass + '__pill'}/>
            </div>
        );
    }

    render() {
        const preC = 'GFSDK-c';
        const skeletonClass = preC + '-CalendarSkeleton';
        const days = this.getUpcomingDays(7);

        return (
            <div className={skeletonClass} aria-hidden="true">
                <div className={skeletonClass + '__header'}>
                    {days.map((day, index) => (
                        <div className={skeletonClass + '__header-day'} key={`calendar-skeleton-header--${index}`}>
                            <p className={skeletonClass + '__header-day-name'}>{day.dayName}</p>
                            <p className={skeletonClass + '__header-day-number'}>{day.dayNumber}</p>
                        </div>
                    ))}
                </div>
                <div className={skeletonClass + '__columns'}>
                    {days.map((day, columnIndex) => (
                        <div className={skeletonClass + '__column'} key={`calendar-skeleton-column--${columnIndex}`}>
                            {[0, 1].map((cardIndex) => this.renderCard(columnIndex, cardIndex))}
                        </div>
                    ))}
                </div>
                <div className={skeletonClass + '__mobile'}>
                    {[0, 1, 2, 3].map((cardIndex) => this.renderCard('mobile', cardIndex))}
                </div>
            </div>
        );
    }
}

export default CalendarSkeleton;
