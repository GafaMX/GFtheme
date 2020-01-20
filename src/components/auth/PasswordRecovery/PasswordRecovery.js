'use strict';

import React from "react";
import PasswordForgot from "../../auth/PasswordForgot/PasswordForgot";
import PasswordChange from "../../auth/PasswordChange/PasswordChange";

class PasswordRecovery extends React.Component {
    constructor(props) {
        super(props);
    }

    render() {
        let token = this.props.token;
        let email = this.props.email;
        if (this.props.token == null || this.props.email == null) {
            const query = new URLSearchParams(window.location.search);
            token = query.get('token');
            email = query.get('email');
        }

        let componentToReturn = <PasswordForgot template={this.props.template}  successCallback={this.props.successCallback.bind(this)}/>;

        if (token != null && email != null) {
            componentToReturn =
                <PasswordChange template={this.props.template} email={email} token={token} successCallback={this.props.successCallback.bind(this)}/>;
        }

        return componentToReturn;
    }
}

export default PasswordRecovery;