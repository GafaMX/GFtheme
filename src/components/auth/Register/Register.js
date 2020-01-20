'use strict';

import React from "react";
import RegisterProwess from "./Prowess/RegisterProwess";

export default class Register extends React.Component {

    template() {
        let template = this.props.template;
        if (template === null || template === '' || template === undefined){
            template = template
        } else {
            template = template.toUpperCase();
        }

        switch(template) {
            case 'PROWESS':
                return  <RegisterProwess />;
        //   case null:
        //       return <LoginDefault />;
        //   default:
        //       return <LoginDefault />;
        }
    }

    render() {
        return (
            <div className="register auth">
                {this.template()}
            </div>
        );
    }
}