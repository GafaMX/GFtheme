'use strict';

import React from "react";
import GafaFitSDKWrapper from "../../utils/GafaFitSDKWrapper";


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
                <h3>{this.state.creditsTotal}</h3>
                <p>Creditos disponibles</p>
                <p>{this.state.service}</p>
                <p>{this.state.expirationDate}</p>
            </div>
        )
    }
}

export default UserCredits;