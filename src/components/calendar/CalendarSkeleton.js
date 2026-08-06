'use strict';

import React from "react";
import '../../styles/newlook/components/GFSDK-c-CalendarSkeleton.scss';

/**
 * Vista "fantasma" que se muestra mientras el calendario todavia no tiene
 * datos (is_mounted === false), en vez del loading generico de puntos.
 * Son tarjetas con la misma forma que una clase real (barra de hora, lineas
 * de texto, boton de reservar), con una animacion de "shimmer" para que se
 * sienta como que el calendario ya esta ahi, en vez de una pantalla en blanco.
 */
class CalendarSkeleton extends React.Component {
    render() {
        const preC = 'GFSDK-c';
        const skeletonClass = preC + '-CalendarSkeleton';
        const cards = [0, 1, 2, 3];

        return (
            <div className={skeletonClass} aria-hidden="true">
                {cards.map((index) => (
                    <div className={skeletonClass + '__card'} key={`calendar-skeleton-card--${index}`}>
                        <div className={skeletonClass + '__time'}/>
                        <div className={skeletonClass + '__body'}>
                            <div className={skeletonClass + '__line ' + skeletonClass + '__line--title'}/>
                            <div className={skeletonClass + '__line ' + skeletonClass + '__line--subtitle'}/>
                            <div className={skeletonClass + '__line ' + skeletonClass + '__line--meta'}/>
                        </div>
                        <div className={skeletonClass + '__pill'}/>
                    </div>
                ))}
            </div>
        );
    }
}

export default CalendarSkeleton;
