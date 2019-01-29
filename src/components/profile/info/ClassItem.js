'use strict';

import React from 'react';
import Moment from 'moment';
import Strings from "../../utils/Strings/Strings_ES";
import GafaFitSDKWrapper from "../../utils/GafaFitSDKWrapper";
import Glyphicon from "react-bootstrap/es/Glyphicon";


class ClassItem extends React.Component {
    constructor(props) {
        super(props)
    }

    handleClick(event) {
        event.preventDefault();

        let reservationID = this.props.id;
        console.log(this.props.id);
        GafaFitSDKWrapper.postUserCancelReservation(reservationID,'',
            function(result){
            alert(Strings.CANCELEDRESERVATION);
                window.location.reload();
            })


    }


    render() {
        let membershipCredits = '';
        let cancelation = '';
        let today= Moment().format('DD-MM-YYYY HH:MM');
        if (this.props.reservation.credit === null) {
            membershipCredits = (
                <p className={'reservation-item-membership'}>{Strings.MEMBERSHIP}{this.props.reservation.user_membership.membership['name']}</p>)
        } else {
            membershipCredits = (
                <p className={'reservation-item-credits'}>{Strings.CREDIT}{this.props.reservation.credit['name']}</p>)
        }

     if(this.props.reservation.cancelled === true){
         cancelation =(
             <span className={'reservation-item-cancelled close'} aria-label="Close"> <Glyphicon glyph="ban-circle" /> {Strings.CANCELLED} </span>
         )
     }else if(Moment(this.props.reservation.meeting_start).format('DD-MM-YYYY HH:MM') >= today){
            cancelation = (
                <button type="button" className="close " aria-label="Close" onClick={this.handleClick.bind(this)}>
                    {/*<span aria-hidden="true">&times;</span>*/}
                    <Glyphicon glyph="remove" /> {Strings.CANCELATION}
                </button>
            )
     }


        return (
            <div className={'reservation-item-container col-md-4'}>

                <div className={'reservation-item mb-4 card shadow-sm'}>

                    <div className={'card-header'}>
                        <h4 className={'reservation-item-name'}>{this.props.reservation.location['slug']}</h4>
                    </div>
                    <div className={'card-body'}>
                        <p className={'reservation-item-staff'}>{this.props.reservation.staff['name']}</p>
                        <p className={'reservation-item-service'}>{this.props.reservation.service['name']}</p>
                        <p className={'reservation-item-position'}>{Strings.POSITION}{this.props.reservation.meeting_position}</p>
                        <p className={'reservation-item-meeting'}>{Strings.BEGINS}{Moment(this.props.reservation.meeting_start).format('DD-MM-YYYY HH:MM')}</p>
                        {membershipCredits}
                    </div>
                    {cancelation}
                    <br/>
                </div>
            </div>
        )
    }
}

export default ClassItem;