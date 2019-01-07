'use strict';

import React from "react";
import PasswordForgot from "./PasswordForgot";
import PasswordChange from "./PasswordChange";

class PasswordRecovery extends React.Component {
    constructor(props) {
        super(props);
    }

    render() {
        const query = new URLSearchParams(window.location.search);
        const token = query.get('token');
        const email = query.get('email');
        let componentToReturn = <PasswordForgot/>;

        if (token != null && email != null) {
            componentToReturn = <PasswordChange email={email} token={token}/>;
        }

        return componentToReturn;
    }
}

export default PasswordRecovery;