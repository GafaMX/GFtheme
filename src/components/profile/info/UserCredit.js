'use strict';

import React from "react";
import moment from 'moment';
import Strings from "../../utils/Strings/Strings_ES";

class UserCredit extends React.Component {
    constructor(props) {
        super(props);
    }

    render() {
        return (
            <div className="UserCredit">
                <div className="row">
                    <div className="col-md-5">
                        <h2 className="UserCredit__credits">{this.props.creditsTotal}</h2>
                    </div>
                    <div className="col-md-7">
                        <p className="UserCredit__credits-name">{Strings.CREDITS}</p>
                        {/* <p> {this.props.name}</p> */}
                        <p className="UserCredit__expiration"> {Strings.EXPIRATION} {moment(this.props.expirationDate).format('YYYY-MM-DD')}</p>
                    </div>
                </div>
            </div>
        )
    }
}

export default UserCredit;