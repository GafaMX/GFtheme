'use strict';

import React from 'react';
import moment from 'moment';
import Strings from "../utils/Strings/Strings_ES";
import StringStore from "../utils/Strings/StringStore";


class ClassItem extends React.Component {
    constructor(props) {
        super(props);

    }

    printPosition() {
        let _return = null;
        let {reservation} = this.props;
        if (reservation && typeof reservation === 'object') {
            let _object = reservation.object;
            if (_object && typeof _object === 'object' && _object.hasOwnProperty('position_number')) {
                let position_number = _object.position_text && !isNaN(_object.position_text) ? _object.position_text : _object.position_number;

                let text = _object.position_text && isNaN(_object.position_text) ? _object.position_text : `#${position_number}`;

                _return = (
                    <p className={'reservation-item-position'}>{StringStore.get('PROFILE_POSITION',[text])}</p>
                );
            }
        }

        return _return;
    }

    render() {
        let membershipCredits = '';

        if (this.props.reservation.credit === null) {
            membershipCredits = (
                <p className={'reservation-item-membership'}>{StringStore.get('MEMBERSHIP')}</p>)
        } else {
            membershipCredits = (
                <p className={'reservation-item-credits'}>{StringStore.get('CREDIT')}{this.props.reservation.credit['name']}</p>)
        }


        return (
            <div className={'futureClasses-item'}>
                <div className={'futureClasses-item__header'}>
                    <h4>{this.props.reservation.meetings.service['name']}</h4>
                </div>
                <div className={'futureClasses-item__body'}>
                    <p className={'reservation-item-time'}>{moment(this.props.reservation.meeting_start).format('D [de] MMM')}</p>
                    <p className={'reservation-item-staff'}><strong>{this.props.reservation.staff['name']}</strong></p>
                    <p className={'reservation-item-location'}>{this.props.reservation.location.name}</p>
                    {this.printPosition()}
                </div>
            </div>
        )
    }
}

export default ClassItem;