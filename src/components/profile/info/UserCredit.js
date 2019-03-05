'use strict';

import React from "react";
import Moment from 'moment';
import Strings from "../../utils/Strings/Strings_ES";

class UserCredit extends React.Component {
    constructor(props) {
        super(props);
    }

    render() {
        return (
            <div>
                <h3>{this.props.creditsTotal} {Strings.CREDITS}</h3>
                <span> {this.props.name}, </span>
                <span>  {Strings.EXPIRATION} {Moment(this.props.expirationDate).format('YYYY-MM-DD')}</span>
            </div>
        )
    }
}

export default UserCredit;