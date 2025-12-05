'use strict';

import React from 'react';
import moment from 'moment';
import Strings from "../utils/Strings/Strings_ES";
import StringStore from "../utils/Strings/StringStore";
import CheckIcon from "../utils/Icons/CheckIcon";


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
                    <p className={'reservation-item-position'}>{StringStore.get('PROFILE_POSITION', [text])}</p>
                );
            }
        }

        return _return;
    }

    printStaff() {
        let {reservation} = this.props;
        let staff = reservation.hasOwnProperty('meetings') && typeof reservation.meetings === 'object' &&
        reservation.meetings.hasOwnProperty('staff') &&
        typeof reservation.meetings.staff === 'object' ?
            reservation.meetings.staff :
            reservation.staff;

        if (staff && staff.hasOwnProperty('job') && staff.job !== null) {
            return (
                <p className={'reservation-item-staff'}><strong>{staff['job']}</strong></p>
            )
        } else {
            return (
                <p className={'reservation-item-staff'}>
                    <strong>{staff['name']} {staff.hasOwnProperty('lastname') ? staff['lastname'] : ''}</strong></p>
            );
        }
    }

    printSubstituteStaff() {
        let {reservation} = this.props;
        let staff = reservation.hasOwnProperty('meetings') &&
        typeof reservation.meetings === 'object' &&
        reservation.meetings.hasOwnProperty('substitute_staff') &&
        typeof reservation.meetings.substitute_staff === 'object' ?
            reservation.meetings.substitute_staff :
            reservation.substitute_staff;

        if (staff) {
            if (staff.hasOwnProperty('job') && staff.job !== null) {
                return (
                    <p className={'reservation-item-staff'}>
                        <strong>{StringStore.get('SUBSTITUTE_INDICATOR')} {staff['job']}</strong></p>
                )
            } else {
                return (
                    <p className={'reservation-item-staff'}>
                        <strong>{StringStore.get('SUBSTITUTE_INDICATOR')} {staff['name']} {staff.hasOwnProperty('lastname') ? staff['lastname'] : ''}</strong>
                    </p>
                );
            }
        }

        return null;
    }

    render() {
        let membershipCredits = '';
        let preE = 'GFSDK-e';
        let buttonClass = preE + '-buttons';
        let {reservation}=this.props;

        if (this.props.reservation.credit === null) {
            membershipCredits = (
                <p className={'reservation-item-membership'}>{StringStore.get('MEMBERSHIP')}</p>)
        } else {
            membershipCredits = (
                <p className={'reservation-item-credits'}>{StringStore.get('CREDIT')}{this.props.reservation.credit['name']}</p>)
        }

        let lang = StringStore.getLanguage();
        let format = StringStore.get('PROFILE_RESERVATIONS_FORMAT');
        let extra_class = this.props.reservation.is_overbooking === 1 ? 'is-overbooking' : 'is-reservation';

        let attendance = null;
        if (reservation.attendance === 'attended' || reservation.attendance === 'first-time') {
            attendance = (
                <div className={buttonClass + "__attendance"}>
                    <span>{StringStore.get('PROFILE_ASSISTED')}</span>
                    <CheckIcon></CheckIcon>
                </div>
            )
        }

        return (
            <div className={'futureClasses-item ' + extra_class}>
                <div className={'futureClasses-item__header'}>
                    <h4>{this.props.reservation.meetings.service['name']}</h4>
                </div>
                <div className={'futureClasses-item__body'}>
                    <p className={'reservation-item-time'}>{moment(this.props.reservation.meeting_start).locale(lang).format(format)}</p>
                    {this.printStaff()}
                    {this.printSubstituteStaff()}
                    <p className={'reservation-item-location'}>{this.props.reservation.location.name}</p>
                    {this.printPosition()}
                    {this.props.reservation.is_overbooking === 1 ? (
                        <p className={'reservation-item-overbooking'}>{StringStore.get('PROFILE_IS_OVERBOOKING')}</p>) : null}
                </div>
                {attendance}
            </div>
        )
    }
}

export default ClassItem;
