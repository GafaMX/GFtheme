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
            <div>
                <h3>{this.props.name}</h3>
                <span>{Strings.CREATE} {Moment(this.props.from).format('YYYY-MM-DD')}, </span>
                <span> {Strings.EXPIRATION} {Moment(this.props.to).format('YYYY-MM-DD')}</span>
            </div>
        )
    }

}

export default UserMembership;