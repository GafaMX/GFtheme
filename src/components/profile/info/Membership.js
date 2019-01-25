'use strict';

import React from "react";
import GafaFitSDKWrapper from "../../utils/GafaFitSDKWrapper";
import Moment from 'moment';
import Strings from "../../utils/Strings/Strings_ES";

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
        // console.log(this.state.membership);
        // console.log(this.state.membershipName);
        return (
            <div>
                <h3>{this.state.membershipName}</h3>
                <span>{Strings.CREATE} {Moment(this.state.creationDate).format('YYYY-MM-DD')}, </span>
                {/*Moment(this.props.stat.dateFrom).format('YYYY-MM-DD')*/}
                <span> {Strings.EXPIRATION} {Moment(this.state.expirationDate).format('YYYY-MM-DD')}</span>
            </div>
        )
    }

}

export default UserMembership;