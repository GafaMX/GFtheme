'use strict';

import React from "react";
import moment from 'moment';
import Strings from "../../utils/Strings/Strings_ES";
import StringStore from "../../utils/Strings/StringStore";

class UserCredit extends React.Component {
    constructor(props) {
        super(props);
    }

    render() {
        return (
            <div className="UserCredit">
               <div className="UserCredit__amount">
                  <p className="UserCredit__credits">{this.props.creditsTotal}</p>
               </div>
               <div className="UserCredit__data">
                  <p className="UserCredit__credits-name">{this.props.name}</p>
                  <p className="UserCredit__expiration"> {StringStore.get('EXPIRATION')} {moment(this.props.expirationDate).format('DD[/]MMM[/]YYYY')}</p>
               </div>
            </div>
        )
    }
}

export default UserCredit;