'use strict';

import React from "react";
import moment from 'moment';
import IconCalendarAlt from '../../utils/Icons/IconCalendarAlt';
import Strings from "../../utils/Strings/Strings_ES";

class UserMembership extends React.Component {

    constructor(props) {
        super(props);
    }

    render() {
        return (
            <div className="UserMembership">
               <div className="UserMembership__amount">
                  <p className="UserMembership__credits"><IconCalendarAlt /></p>
               </div>
                <div className="UserMembership__data">
                    <p className="UserMembership__credits-name">{this.props.name}</p>
                    {/* <p className="UserMembership__credits-name">{Strings.CREATE} {moment(this.props.from).format('YYYY-MM-DD')}, </p> */}
                    <p> {Strings.EXPIRATION} {moment(this.props.to).format('DD[/]MMM[/]YYYY')}</p>
                </div>
            </div>
        )
    }
}

export default UserMembership;