'use strict';

import React from 'react';

class ClassItem extends React.Component {
    constructor(props) {
        super(props)
    }

    handleClick(event) {
        event.preventDefault();
        let currentElement = this;
        //todo este click para abrir el modal de cancelacion
    }


    render() {
        return (
            <div className={'reservation-item-container col-md-4'}>
                <div className={'card-header'}>
                    <h4 className={'reservation-item-name'}>{}</h4>
                </div>
            </div>
        )
    }
}

export default ClassItem;