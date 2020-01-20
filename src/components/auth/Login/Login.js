'use strict';

import React from "react";
// import LoginDefault from "./Default/LoginDefault"
import LoginProwess from "./Prowess/LoginProwess"

export default class Login extends React.Component {

    template() {
        let template = this.props.template;
        if (template === null || template === '' || template === undefined){
            template = template
        } else {
            template = template.toUpperCase();
        }

        switch(template) {
            case 'PROWESS':
                return  <LoginProwess successCallback = {this.props.successCallback} />;
        //   case null:
        //       return <LoginDefault />;
        //   default:
        //       return <LoginDefault />;
        }
    }

    render() {
        return (
            <div className="login auth">
                {this.template()}
            </div>
        );
    }
}