'use strict';

import React from 'react';
import Strings from "../../utils/Strings/Strings_ES";
import {ControlLabel, FormControl, FormGroup} from "react-bootstrap";

class ChangePassword extends React.Component{
    constructor(props){
        super(props);

    }

    render(){
        return(
            <div className={"row col-md-12 pt-4"}>

                <h4 className={'col-md-12'}>
                    {Strings.CHANGEPASSWORD}
                </h4>
                <FormGroup className={'confirmation-info'} controlId="email_confirm">
                    <FormControl type={'text'} value={this.props.info.email} disabled/>
                </FormGroup>

                <FormGroup className={'confirmation-info'} controlId="first_name_confirm">
                    <FormControl type={'text'} value={this.props.info.first_name} disabled/>
                </FormGroup>

                <FormGroup className={'col-md-6'} controlId="password" bsSize={'large'}>
                    <ControlLabel>{Strings.NEWPASSWORD}</ControlLabel>
                    <FormControl type={'password'}
                                 value={this.props.info.password}
                                 onChange={this.props.handleChangePassword}/>
                </FormGroup>

                <FormGroup className={'col-md-6'} controlId="confirmationPassword" bsSize={'large'}>
                    <ControlLabel>{Strings.PASSWORDCONFIRM}</ControlLabel>
                    <FormControl type={'password'}
                                 value={this.props.info.password_confirmation}
                                 onChange={this.props.handleChangeConfirmationPassword}/>
                </FormGroup>
            </div>
        )
    }
}

export default ChangePassword;