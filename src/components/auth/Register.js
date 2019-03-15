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
            registered: false
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
        currentElement.setState({serverError: '', registered: false});
        GafaFitSDKWrapper.postRegister(this.state,
            currentElement.successRegisterCallback.bind(this),
            currentElement.errorRegisterCallback.bind(this));
    }

    successRegisterCallback(result) {
        this.setState({registered: true});
    }

    errorRegisterCallback(error) {
        this.setState({serverError: error});
    }

    render() {
        return (
            <div className="register auth">
                <form onSubmit={this.handleSubmit.bind(this)}>
                    <FormGroup controlId="fullName" bsSize="large">
                        <ControlLabel>{Strings.LABEL_FULL_NAME}</ControlLabel>
                        <FormControl
                            autoFocus
                            type="text"
                            value={this.state.fullName}
                            onChange={this.handleChangeField.bind(this)}
                        />
                    </FormGroup>
                    <FormGroup controlId="email" bsSize="large">
                        <ControlLabel>{Strings.LABEL_EMAIL}</ControlLabel>
                        <FormControl
                            type="email"
                            value={this.state.email}
                            onChange={this.handleChangeField.bind(this)}
                        />
                    </FormGroup>
                    <FormGroup controlId="password" bsSize="large">
                        <ControlLabel>{Strings.LABEL_PASSWORD}</ControlLabel>
                        <FormControl
                            value={this.state.password}
                            onChange={this.handleChangeField.bind(this)}
                            type="password"
                        />
                    </FormGroup>
                    <FormGroup controlId="passwordConfirmation" bsSize="large">
                        <ControlLabel>{Strings.LABEL_PASSWORD_CONFIRM}</ControlLabel>
                        <FormControl
                            value={this.state.passwordConfirmation}
                            onChange={this.handleChangeField.bind(this)}
                            type="password"
                        />
                    </FormGroup>
                    <Button
                        block
                        bsSize="large"
                        bsStyle="primary"
                        disabled={!this.state.formValid}
                        type="submit"
                    >
                        {Strings.BUTTON_REGISTER}
                    </Button>
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