'use strict';

import React from 'react';
import Moment from 'moment';
import Strings from "../utils/Strings/Strings_ES";


class ClassItem extends React.Component {
    constructor(props) {
        super(props);

    }

    render() {
        let membershipCredits = '';

        if (this.props.reservation.credit === null) {
            membershipCredits = (
                <p className={'reservation-item-membership'}>{Strings.MEMBERSHIP}</p>)
        } else {
            membershipCredits = (
                <p className={'reservation-item-credits'}>{Strings.CREDIT}{this.props.reservation.credit['name']}</p>)
        }


        return (
            <div className={'futureClasses-item'}>
                <div className={'card-header'}>
                    <h4>{this.props.reservation.meetings.service['name']}</h4>
                    {/* <h4 className={'reservation-item-name'}><strong>Tuvo lugar:</strong> {Moment(this.props.reservation.meeting_start).locale('es').calendar()} en {this.props.reservation.location['name']}</h4> */}
                </div>
                <hr></hr>
                <div className={'card-body'}>
                    <p className={'reservation-item-time'}>{Moment(this.props.reservation.meeting_start).format('h:mm a')}</p>
                    <p className={'reservation-item-staff'}><strong>{this.props.reservation.staff['name']}</strong></p>
                    {/* <p className={'reservation-item-service'}><strong>{this.props.reservation.meetings.service['name']}</strong></p> */}
                    {/* <p className={'reservation-item-service'}>{this.props.reservation.service['name']}</p> */}
                    {/* <p className={'reservation-item-position'}>{Strings.POSITION}{this.props.reservation.meeting_position}</p> */}
                    {/* {membershipCredits} */}
                </div>
            </div>
        )
    }
}

export default ClassItem;