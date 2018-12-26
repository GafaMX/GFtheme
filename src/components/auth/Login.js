'use strict';

import React from "react";
import {Button, FormGroup, FormControl, ControlLabel} from "react-bootstrap";
import {FormErrors} from "./FormErrors";
import GafaFitSDKWrapper from "../utils/GafaFitSDKWrapper";
import Strings from "../utils/Strings/Strings_ES";

class Login extends React.Component {
    constructor(props) {
        super(props);

        this.state = {
            email: "",
            password: "",
            formErrors: {email: '', password: ''},
            emailValid: false,
            passwordValid: false,
            formValid: false,
            serverError: '',
            logged: false
        };
    }

    validateField(fieldName, value) {
        let fieldValidationErrors = this.state.formErrors;
        let emailValid = this.state.emailValid;
        let passwordValid = this.state.passwordValid;

        switch (fieldName) {
            case 'email':
                emailValid = value.match(/^([\w.%+-]+)@([\w-]+\.)+([\w]{2,})$/i);
                fieldValidationErrors.email = emailValid ? '' : Strings.VALIDATION_EMAIL;
                break;
            case 'password':
                passwordValid = value.length >= 6;
                fieldValidationErrors.password = passwordValid ? '' : Strings.VALIDATION_PASSWORD;
                break;
            default:
                break;
        }
        this.setState({
            formErrors: fieldValidationErrors,
            emailValid: emailValid,
            passwordValid: passwordValid
        }, this.validateForm);
    }

    validateForm() {
        this.setState({formValid: this.state.emailValid && this.state.passwordValid});
    }

    handleChange(event) {
        let fieldName = event.target.id;
        let fieldValue = event.target.value;
        this.setState({
            [fieldName]: fieldValue
        }, () => {
            this.validateField(fieldName, fieldValue)
        });
    };

    handleSubmit(event) {
        event.preventDefault();
        let elem = this;
        elem.setState({serverError: ''});
        GafaFitSDKWrapper.getToken(this.state.email, this.state.password,
            function (result) {
                elem.setState({logged: true});
            },
            function (error) {
                elem.setState({serverError: error});
            });
    };

    render() {
        return (
            <div className="login">
                <form onSubmit={this.handleSubmit.bind(this)}>
                    <FormGroup controlId="email" bsSize="large">
                        <ControlLabel>{Strings.LABEL_EMAIL}</ControlLabel>
                        <FormControl
                            autoFocus
                            type="email"
                            value={this.state.email}
                            onChange={this.handleChange.bind(this)}
                        />
                    </FormGroup>
                    <FormGroup controlId="password" bsSize="large">
                        <ControlLabel>{Strings.LABEL_PASSWORD}</ControlLabel>
                        <FormControl
                            value={this.state.password}
                            onChange={this.handleChange.bind(this)}
                            type="password"
                        />
                    </FormGroup>
                    <Button
                        block
                        bsSize="large"
                        disabled={!this.state.formValid}
                        type="submit"
                    >
                        {Strings.BUTTON_LOGIN}
                    </Button>
                    <div className="panel panel-default">
                        <FormErrors formErrors={this.state.formErrors}/>
                        {this.state.serverError !== '' && <p>{this.state.serverError}</p>}
                        {this.state.logged && <p>{Strings.LOGIN_SUCCESS}</p>}
                    </div>
                </form>
            </div>
        );
    }
}

export default Login;