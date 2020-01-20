'use strict';

import React from 'react';
import Strings from "../../utils/Strings/Strings_ES";
import {ControlLabel, FormControl, FormGroup} from "react-bootstrap";

class ChangePassword extends React.Component{
    constructor(props){
        super(props);

    }

    render(){
        let preE = 'GFSDK-e';
        let preC = 'GFSDK-c';
        let formClass = preE + '-form';
        let profileClass = preC + '-profile';

        return(
            <div className={profileClass + '__section is-password'}>

                {/* <h4>{Strings.CHANGEPASSWORD}</h4> */}
                <FormGroup className={formClass + "__section is-email_confirm"} controlId="email_confirm">
                    <FormControl className={formClass + "__input"} type={'text'} value={this.props.info.email} disabled/>
                </FormGroup>

                <FormGroup className={formClass + "__section is-first_name_confirm"} controlId="first_name_confirm">
                    <FormControl className={formClass + "__input"} type={'text'} value={this.props.info.first_name} disabled/>
                </FormGroup>

                <FormGroup className={formClass + "__section is-password"} controlId="password">
                    <ControlLabel className={formClass + "__label"}>{Strings.NEWPASSWORD}</ControlLabel>
                    <FormControl 
                        type={'password'}
                        className={formClass + "__input"}
                        value={this.props.info.password}
                        onChange={this.props.handleChangePassword}/>
                </FormGroup>

                <FormGroup className={formClass + "__section is-confirmationPassword"} controlId="confirmationPassword" bsSize={'large'}>
                    <ControlLabel className={formClass + "__label"}>{Strings.PASSWORDCONFIRM}</ControlLabel>
                    <FormControl 
                        type={'password'}
                        className={formClass + "__input"}
                        value={this.props.info.password_confirmation}
                        onChange={this.props.handleChangeConfirmationPassword}/>
                </FormGroup>
            </div>
        )
    }
}

export default ChangePassword;