'use strict';

import React from "react";
import PasswordForgotProwess from "./Prowess/PasswordForgotProwess"

export default class PasswordForgot extends React.Component {
    template() {
        let template = this.props.template;
        if (template === null || template === '' || template === undefined){
            template = template
        } else {
            template = template.toUpperCase();
        }

        switch(template) {
            case 'PROWESS':
                return  <PasswordForgotProwess successCallback = {this.props.successCallback} />;
        //   case null:
        //       return <LoginDefault />;
        //   default:
        //       return <LoginDefault />;
        }
    }

    render() {
        return (
            <div className="password-forgot auth">
                {this.template()}
            </div>
        );
    }
}