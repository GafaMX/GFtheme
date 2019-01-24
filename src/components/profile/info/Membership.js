'use strict';

import React from "react";
import GafaFitSDKWrapper from "../../utils/GafaFitSDKWrapper";

class UserMembership extends React.Component {

    constructor(props) {
        super(props);

        this.state = {
            membership: [],
            membershipName: '',
            expirationDate: '',

        }
    }

    componentDidMount() {
        const currentComponent = this;

        GafaFitSDKWrapper.getUserMemberships(function (result) {
            currentComponent.setState({
                membership: result[0],
                expirationDate: result[0].expiration_date,
                creationDate: result[0].created_at,
                membershipName: result[0].membership['name'],
            })
        })
    }

    render() {
        console.log(this.state.membership);
        console.log(this.state.membershipName);
        return (
            <div>
                <h3>{this.state.membershipName}</h3>
                <span>Creado: {this.state.creationDate}, </span>
                <span> Expira: {this.state.expirationDate}</span>
            </div>
        )
    }

}

export default UserMembership;