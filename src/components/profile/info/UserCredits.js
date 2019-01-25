'use strict';

import React from "react";
import GafaFitSDKWrapper from "../../utils/GafaFitSDKWrapper";
import  Moment from 'moment';
import Strings from "../../utils/Strings/Strings_ES";

class UserCredits extends React.Component {
//call to get User credits in sdk wrapper
    constructor(props) {
        super(props);

        this.state = {
            credits: [],
            credit: [],
            creditsTotal: '',
            expirationDate: '',
            service: '',
        }
    }

    componentDidMount() {
        const currentComponent = this;

            GafaFitSDKWrapper.getUserCredits(function (result) {
                currentComponent.setState({
                    credits: result[0],
                    creditsTotal: result[0].total,
                    expirationDate: result[0].expiration_date.toString(),
                    service: result[0].credit['name'],
                });
            });


    }

    render() {

        // in line how many credits have the user, service , and date of caducity

        return (
            <div>
                <h3>{this.state.creditsTotal} {Strings.CREDITS}</h3>
                <span> {this.state.service}, </span>
                <span>  {Strings.EXPIRATION} {Moment(this.state.expirationDate).format('YYYY-MM-DD')}</span>
            </div>
        )
    }
}

export default UserCredits;