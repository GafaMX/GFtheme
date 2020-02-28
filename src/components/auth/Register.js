'use strict';

import React from "react";
import {Button, FormGroup, FormControl, ControlLabel} from "react-bootstrap";
import {FormErrors} from "../form/FormErrors";
import GafaFitSDKWrapper from "../utils/GafaFitSDKWrapper";
import Strings from "../utils/Strings/Strings_ES";

class Register extends React.Component {
    constructor(props) {
        super(props);

        this.state = {
            email: "",
            password: "",
            passwordConfirmation: "",
            fullName: "",
            first_name: "",
            last_name: "",
            formErrors: {email: '', password: '', passwordConfirmation: '', fullName: ''},
            emailValid: false,
            passwordValid: false,
            passwordConfirmationValid: false,
            fullNameValid: false,
            formValid: false,
            serverError: '',
            registered: false,
            g_recaptcha_response: null,
        };
    }

    splitFullName(value) {
        let splittedNames = value.split(" ");
        let firstName = splittedNames[0];
        let lastName = splittedNames.slice(1, splittedNames.length).join(" ");
        this.setState({first_name: firstName, last_name: lastName});
    }

    validateField(fieldName, value) {
        let fieldValidationErrors = this.state.formErrors;
        let emailValid = this.state.emailValid;
        let passwordValid = this.state.passwordValid;
        let passwordConfirmationValid = this.state.passwordConfirmationValid;
        let fullNameValid = this.state.fullNameValid;

        switch (fieldName) {
            case 'fullName':
                fullNameValid = this.validateFullName(value, fieldValidationErrors);
                this.splitFullName(value);
                break;
            case 'email':
                emailValid = this.validateEmail(value, fieldValidationErrors);
                break;
            case 'password':
                passwordValid = this.validatePassword(value, fieldValidationErrors);
                break;
            case 'passwordConfirmation':
                passwordConfirmationValid = this.validatePasswordConfirmation(value, fieldValidationErrors);
                break;
            default:
                break;
        }
        this.setState({
            formErrors: fieldValidationErrors,
            emailValid: emailValid,
            passwordValid: passwordValid,
            passwordConfirmationValid: passwordConfirmationValid,
            fullNameValid: fullNameValid
        }, this.validateForm);
    }

    validatePassword(value, fieldValidationErrors) {
        let passwordValid = value.length >= 6;
        fieldValidationErrors.password = passwordValid ? '' : Strings.VALIDATION_PASSWORD;
        return passwordValid;
    }

    validatePasswordConfirmation(value, fieldValidationErrors) {
        let passwordConfirmationValid = value === this.state.password;
        fieldValidationErrors.passwordConfirmation = passwordConfirmationValid ? '' : Strings.VALIDATION_EQUAL_PASSWORDS;
        return passwordConfirmationValid;
    }

    validateEmail(value, fieldValidationErrors) {
        let emailValid = value.match(/^([\w.%+-]+)@([\w-]+\.)+([\w]{2,})$/i);
        fieldValidationErrors.email = emailValid ? '' : Strings.VALIDATION_EMAIL;
        return emailValid;
    }

    validateFullName(value, fieldValidationErrors) {
        let fullNameValid = value !== '' && value !== null;
        fieldValidationErrors.fullName = fullNameValid ? '' : Strings.VALIDATION_FULL_NAME;
        return fullNameValid;
    }

    validateForm() {
        this.setState(
            {
                formValid: this.state.emailValid && this.state.passwordValid && this.state.passwordConfirmationValid &&
                this.state.fullNameValid
            });
    }

    handleChangeField(event) {
        let fieldName = event.target.id;
        let fieldValue = event.target.value;
        this.setState({
            [fieldName]: fieldValue
        }, () => {
            this.validateField(fieldName, fieldValue)
        });
    }

    handleSubmit(event) {
        event.preventDefault();

        let currentElement = this;

        grecaptcha.ready(function () {
            grecaptcha.execute(window.GFtheme.CaptchaPublicKey, { action: 'register' })
                .then(function (token) {
                    $('#register-form').prepend('<input type="hidden" name="g-recaptcha-response" value="' + token + '">');

                    currentElement.setState({serverError: '', registered: false, g_recaptcha_response: token});

                    GafaFitSDKWrapper.postRegister(currentElement.state,
                        currentElement.successRegisterCallback.bind(currentElement),
                        currentElement.errorRegisterCallback.bind(currentElement));

                        
                });
        });
    }

    successRegisterCallback(result) {
        this.setState({registered: true});
    }

    errorRegisterCallback(error) {
        this.setState({serverError: error});
    }

    render() {
        let preE = 'GFSDK-e';
        let buttonClass = preE + '-buttons';
        let formClass = preE + '-form';

        return (
            <div className="register auth">
                <form id="register-form" onSubmit={this.handleSubmit.bind(this)}>
                    <FormGroup className={formClass + "__section"} controlId="fullName" bsSize="large">
                        <ControlLabel className={formClass + "__label"}>{Strings.LABEL_FULL_NAME}</ControlLabel>
                        <FormControl
                            autoFocus
                            className={formClass + "__input"}
                            type="text"
                            value={this.state.fullName}
                            onChange={this.handleChangeField.bind(this)}
                        />
                    </FormGroup>
                    <FormGroup className={formClass + "__section"} controlId="email" bsSize="large">
                        <ControlLabel className={formClass + "__label"}>{Strings.LABEL_EMAIL}</ControlLabel>
                        <FormControl
                            className={formClass + "__input"}
                            type="email"
                            value={this.state.email}
                            onChange={this.handleChangeField.bind(this)}
                        />
                    </FormGroup>
                    <FormGroup className={formClass + "__section"} controlId="password" bsSize="large">
                        <ControlLabel className={formClass + "__label"}>{Strings.LABEL_PASSWORD}</ControlLabel>
                        <FormControl
                            className={formClass + "__input"}
                            value={this.state.password}
                            onChange={this.handleChangeField.bind(this)}
                            type="password"
                        />
                    </FormGroup>
                    <FormGroup className={formClass + "__section"} controlId="passwordConfirmation" bsSize="large">
                        <ControlLabel className={formClass + "__label"}>{Strings.LABEL_PASSWORD_CONFIRM}</ControlLabel>
                        <FormControl
                            className={formClass + "__input"}
                            value={this.state.passwordConfirmation}
                            onChange={this.handleChangeField.bind(this)}
                            type="password"
                        />
                    </FormGroup>
                    <button
                        className={buttonClass + ' ' + buttonClass + "--submit is-primary"}
                        disabled={!this.state.formValid}
                        type="submit"
                    >
                        {Strings.BUTTON_REGISTER}
                    </button>
                    <div className="text-danger">
                        <FormErrors formErrors={this.state.formErrors}/>
                        {this.state.serverError !== '' && <small>{this.state.serverError}</small>}
                    </div>
                    <div className="text-success">
                        {this.state.registered && <small>{Strings.REGISTER_SUCCESS}</small>}
                    </div>
                </form>
            </div>
        );
    }
}

export default Register;
