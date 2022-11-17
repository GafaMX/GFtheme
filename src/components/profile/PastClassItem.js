'use strict';

import React from 'react';
import moment from 'moment';
import Strings from "../utils/Strings/Strings_ES";
import StringStore from "../utils/Strings/StringStore";


class ClassItem extends React.Component {
    constructor(props) {
        super(props);

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
               </div>
            </div>
        )
    }
}

export default ClassItem;