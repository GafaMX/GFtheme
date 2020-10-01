'use strict';

import React from "react";
import PasswordForgot from "./PasswordForgot";
import PasswordChange from "./PasswordChange";

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

        let componentToReturn = <PasswordForgot handleClickBack={this.props.handleClickBack} />;

        if (token != null && email != null) {
            componentToReturn =
            <PasswordChange email={email} token={token} handleClickBack={this.props.handleClickBack}/>;
        }

        return componentToReturn;
    }
}

export default PasswordRecovery;