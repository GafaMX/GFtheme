'use strict';

import React from 'react';
import moment from 'moment';
import 'moment/locale/es';

class WailistItem extends React.Component {
    constructor(props) {
        super(props);
    }

    render() {
        const { meeting_start, staff } = this.props;
        
        // Formatear la fecha de la clase
        const formattedDate = meeting_start ? moment(meeting_start).format('LLLL') : 'Sin fecha';
        
        // Verificar si existe el nombre del staff
        const staffName = staff && staff.name ? staff.name : 'Sin nombre de staff';

        return (
            <div className={'pastClass-item'}>
                <div className={'pastClass-item__header'}>
                    <h3>Inicio de la Clase: {formattedDate}</h3>
                </div>
                <div className={'pastClass-item__body'}>
                    <p>Instructor: {staffName}</p>
                </div>
            </div>
        );
    }
}

export default WailistItem;

