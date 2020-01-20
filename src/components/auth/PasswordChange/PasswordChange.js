'use strict';

import React from "react";
import PasswordChangeProwess from "./Prowess/PasswordChangeProwess";

export default class PasswordChange extends React.Component {
    template() {
        let template = this.props.template;
        if (template === null || template === '' || template === undefined){
            template = template
        } else {
            template = template.toUpperCase();
        }

        switch(template) {
            case 'PROWESS':
                return  <PasswordChangeProwess
                            email = {this.props.email}
                            token = {this.props.token}
                            successCallback = {this.props.successCallback}
                        />;
        //   case null:
        //       return <LoginDefault />;
        //   default:
        //       return <LoginDefault />;
        }
    }

    render() {
        return (
            <div className="password-change auth">
                {this.template()}
            </div>
        );
    }
}