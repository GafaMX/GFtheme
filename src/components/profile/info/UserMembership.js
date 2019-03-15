'use strict';

import React from "react";
import Moment from 'moment';
import Strings from "../../utils/Strings/Strings_ES";

class UserMembership extends React.Component {

    constructor(props) {
        super(props);
    }

    render() {
        return (
            <div className="UserMembership">
                <div className="container">
                    <h2>{this.props.name}</h2>
                    <p>{Strings.CREATE} {Moment(this.props.from).format('YYYY-MM-DD')}, </p>
                    <p> {Strings.EXPIRATION} {Moment(this.props.to).format('YYYY-MM-DD')}</p>
                </div>
            </div>
        )
    }
}

export default UserMembership;