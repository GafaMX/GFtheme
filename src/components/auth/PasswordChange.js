'use strict';

import React from "react";
import {Button, FormGroup, FormControl, ControlLabel} from "react-bootstrap";
import {FormErrors} from "../form/FormErrors";
import GafaFitSDKWrapper from "../utils/GafaFitSDKWrapper";
import Strings from "../utils/Strings/Strings_ES";

class PasswordChange extends React.Component {
    constructor(props) {
        super(props);

        this.state = {
            formErrors: {password: '', passwordConfirmation: ''},
            email: this.props.email,
            token: this.props.token,
            passwordValid: false,
            passwordConfirmationValid: false,
            formValid: false,
            serverError: '',
            passwordChanged: ''
        };
    }

    validateField(fieldName, value) {
        let fieldValidationErrors = this.state.formErrors;
        let passwordValid = this.state.passwordValid;
        let passwordConfirmationValid = this.state.passwordConfirmationValid;

        switch (fieldName) {
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
            passwordValid: passwordValid,
            passwordConfirmationValid: passwordConfirmationValid
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

    validateForm() {
        this.setState(
            {
                formValid: this.state.passwordValid && this.state.passwordConfirmationValid
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
    };

    handleSubmit(event) {
        event.preventDefault();
        let currentElement = this;
        currentElement.setState({serverError: '', passwordChanged: '' });
        GafaFitSDKWrapper.postPasswordChange(this.state,
            currentElement.successPasswordForgotCallback.bind(this),
            currentElement.errorPasswordForgotCallback.bind(this));
    };

    successPasswordForgotCallback(result) {
        this.setState({passwordChanged: true});
        if (this.props.successCallback) {
            this.props.successCallback();
        }
    }

    errorPasswordForgotCallback(error) {
        this.setState({serverError: error});
    }

    render() {
        return (
            <div className="password-change auth">
                <form onSubmit={this.handleSubmit.bind(this)}>
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
                        {Strings.BUTTON_PASSWORD_CHANGE}
                    </Button>
                    <div className="text-danger">
                        <FormErrors formErrors={this.state.formErrors}/>
                        {this.state.serverError !== '' && <small>{this.state.serverError}</small>}
                    </div>
                    <div className="text-success">
                        {this.state.passwordChanged && <small>{Strings.PASSWORD_CHANGE_SUCCESS}</small>}
                    </div>
                </form>
            </div>
        );
    }
}

export default PasswordChange;