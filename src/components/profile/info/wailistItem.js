'use strict'; 

import React from 'react';
import moment from 'moment';
import 'moment/locale/es';

class WailistItem extends React.Component {
    constructor(props) {
        super(props);
    }

    render() {
        const { waitlist } = this.props;
        const { meeting_start, staff, service, location } = waitlist;

        // Formatear fecha de la clase
        const formattedDateDay = meeting_start ? moment(meeting_start).format('D [de] MMM') : 'Sin fecha';
        const formattedDateTime = meeting_start ? moment(meeting_start).format('h:mm a') : 'Sin horario';

        // Verificar datos de staff, servicio y ubicación
        const staffName = (staff && staff.name) ? staff.name : 'Sin nombre de staff';
        const serviceName = (service && service.name) ? service.name : 'Sin servicio';
        const locationName = (location && location.name) ? location.name : 'Sin ubicación';

        return (
            <div className={'pastClass-item'}>
                <div className={'pastClass-item__header'}>
                    <h4>{serviceName}</h4>
                </div>
                <div className={'pastClass-item__body'}>
                    <p className={'reservation-item-day'}>{formattedDateDay}</p>
                    <p className={'reservation-item-location'}>{locationName}</p>
                    <p className={'reservation-item-time'}>{formattedDateTime}</p>
                    <p className={'reservation-item-staff'}><strong>{staffName}</strong></p>
                    <p className={'reservation-item-cancelled'}><strong>Waitlist</strong></p>
                </div>
            </div>
        );
    }
}

export default WailistItem;