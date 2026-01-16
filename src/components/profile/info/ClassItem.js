'use strict';

import React from 'react';
import moment from 'moment';
import 'moment/locale/es';
import Strings from "../../utils/Strings/Strings_ES";
import GafaFitSDKWrapper from "../../utils/GafaFitSDKWrapper";
import Glyphicon from "react-bootstrap/es/Glyphicon";
import Modal from "react-bootstrap/es/Modal";
import CalendarStorage from "../../calendar/CalendarStorage";
import CloseIcon from "../../utils/Icons/CloseIcon";
import StringStore from "../../utils/Strings/StringStore";
import CheckIcon from "../../utils/Icons/CheckIcon";

class ClassItem extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            showCancelation: false,
            errorCancelation: null,
        }
    }

    handleClick(event) {
        event.preventDefault();
        let comp = this;
        let reservationID = this.props.id;
        let reservation = this.props.reservation;

        GafaFitSDKWrapper.postUserCancelReservation(
            reservation.brand.slug,
            reservationID,
            '',
            function (result) {
                alert(StringStore.get('CANCELEDRESERVATION'));
                window.location.reload();
            },
            function (error) {
                comp.setState({
                    errorCancelation: error.error,
                })
            }
        )
    }

    handleShowCancelation() {
        this.setState({
            showCancelation: true
        })
    }

    handleClickBack() {
        this.setState({
            showCancelation: false,
        })
    }

    handleClose() {
        this.setState({show: false});
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
                    <p className={'reservation-item-staff'}><strong>{staff['job']}</strong></p>
                )
            } else {
                return (
                    <p className={'reservation-item-staff'}>
                        <strong>{staff['name']} {staff.hasOwnProperty('lastname') ? staff['lastname'] : ''}</strong></p>
                );
            }
        }

        return null;
    }

    render() {
        let preE = 'GFSDK-e';
        let buttonClass = preE + '-buttons';
        let {reservation} = this.props;
        let {errorCancelation} = this.state;

        let membershipCredits = '';
        let cancelation = '';
        let today = moment().format('X');
        // if (this.props.reservation.credit === null) {
        //    membershipCredits = (
        //          <p className={'reservation-item-membership'}>{StringStore.get('MEMBERSHIP')}{this.props.reservation.user_membership.membership['name']}</p>)
        // } else {
        //    membershipCredits = (
        //          <p className={'reservation-item-credits'}>{StringStore.get('CREDIT')}{this.props.reservation.credit['name']}</p>)
        // }

        if (reservation.cancelled === true) {
            cancelation = (
                <p className={'reservation-item-cancelled'}>  {StringStore.get('CANCELLED')} </p>
            )
        } else if (reservation.canBeCancelled || reservation.canBeCancelledWithoutCredit) {
            cancelation = (
                <button type="button" className={buttonClass + "__close"}
                        onClick={this.handleShowCancelation.bind(this)}>
                    <CloseIcon/>
                </button>
            );
        }

        let attendance = null;
        if (reservation.attendance === 'attended' || reservation.attendance === 'first-time') {
            attendance = (
                <div className={buttonClass + "__attendance"}>
                    <span>{StringStore.get('PROFILE_ASSISTED')}</span>
                    <CheckIcon></CheckIcon>
                </div>
            )
        }

        let lang = StringStore.getLanguage();
        let format = StringStore.get('PROFILE_RESERVATIONS_FORMAT');
        let time_format = reservation.hasOwnProperty('format_start_time') &&
        reservation.format_start_time !== '' &&
        reservation.format_start_time !== null ?
            reservation.format_start_time : moment(this.props.reservation.meeting_start).locale(lang).format('h:mm a');
        let date_format = reservation.hasOwnProperty('format_start_date') &&
        reservation.format_start_date !== '' &&
        reservation.format_start_date !== null ?
            reservation.format_start_date : moment(this.props.reservation.meeting_start).locale(lang).format(format);

        return (
            <div className={'pastClass-item'}>
                <div className={'pastClass-item__header'}>
                    <h4>{this.props.reservation.service['name']}</h4>
                </div>
                <div className={'pastClass-item__body'}>
                    <p className={'reservation-item-day'}>{date_format}</p>
                    <p className={'reservation-item-location'}>{this.props.reservation.location.name}</p>
                    <p className={'reservation-item-time'}>{time_format}</p>
                    {this.printStaff()}
                    {this.printSubstituteStaff()}
                    {this.printPosition()}
                    {reservation.is_overbooking === 1 ? (
                        <p className={'reservation-item-overbooking'}>{StringStore.get('PROFILE_IS_OVERBOOKING')}</p>) : null}
                </div>

                {cancelation}
                {attendance}

                <Modal className={'modal-cancelation'} show={this.state.showCancelation} animation={false}
                       onHide={this.handleClickBack.bind(this)}>

                    <div className="modal-cancelation__container">
                        <div className="modal-login__close" onClick={this.handleClickBack.bind(this)}>
                            <CloseIcon/>
                        </div>
                        <div className={'modal-cancelation__body'}>
                            <h3>{StringStore.get('CANCELATION')}</h3>
                            <p>{StringStore.get('CANCELATIONMESSAGE')}</p>
                            {reservation.canBeCancelledWithoutCredit ? (
                                <p className={'modal_cancelation__container--alert'}>{StringStore.get('CANCELLATION_WITHOUT_CREDIT_ALERT')}</p>
                            ) : null}
                        </div>
                        <div className={'modal-cancelation__footer'}>
                            <div className="GFSDK-form__section" id="cancel-class">
                                <button type="button" className="GFSDK-e-buttons GFSDK-e-buttons--submit is-primary"
                                        onClick={this.handleClick.bind(this)}>
                                    {StringStore.get('CANCELATIONCONFIRM')}
                                </button>
                                {/* <button type="button" className="GFSDK-e-buttons GFSDK-e-buttons--submit is-primary" onClick={this.handleClickBack.bind(this)}>
                              {StringStore.get('BUTTON_CANCEL')}
                           </button> */}
                            </div>

                            <div className={"modal-cancelation__error " + (errorCancelation ? 'res_has_error' : null)}>
                                {errorCancelation
                                    ? errorCancelation
                                    : null
                                }
                            </div>
                        </div>
                    </div>

                </Modal>
            </div>
        )
    }
}

export default ClassItem;
