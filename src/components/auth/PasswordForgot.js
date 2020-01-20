'use strict';

import React from "react";
import {Button, FormGroup, FormControl, ControlLabel} from "react-bootstrap";
import {FormErrors} from "../form/FormErrors";
import GafaFitSDKWrapper from "../utils/GafaFitSDKWrapper";
import Strings from "../utils/Strings/Strings_ES";

class PasswordForgot extends React.Component {
    constructor(props) {
        super(props);

        this.state = {
            email: "",
            returnUrl: window.location.href,
            formErrors: {email: ''},
            emailValid: false,
            formValid: false,
            serverError: '',
            sent: ''
        };
    }

    validateField(fieldName, value) {
        let fieldValidationErrors = this.state.formErrors;
        let emailValid = this.validateEmail(value, fieldValidationErrors);

        this.setState({
            formErrors: fieldValidationErrors,
            emailValid: emailValid
        }, this.validateForm);
    }

    validateEmail(value, fieldValidationErrors) {
        let emailValid = value.match(/^([\w.%+-]+)@([\w-]+\.)+([\w]{2,})$/i);
        fieldValidationErrors.email = emailValid ? '' : Strings.VALIDATION_EMAIL;
        return emailValid;
    }

    validateForm() {
        this.setState({formValid: this.state.emailValid});
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
        currentElement.setState({serverError: '', sent: '' });
        GafaFitSDKWrapper.postPasswordForgot(this.state,
            currentElement.successPasswordForgotCallback.bind(this),
            currentElement.errorPasswordForgotCallback.bind(this));
    };

    successPasswordForgotCallback(result) {
        this.setState({sent: true});
        if (this.props.successCallback) {
            this.props.successCallback();
        }
    }

    errorPasswordForgotCallback(error) {
        this.setState({serverError: error});
    }

    render() {
        let preE = 'GFSDK-e';
        let buttonClass = preE + '-buttons';
        let formClass = preE + '-form';

        return (
            <div className="password-forgot auth">
                <form onSubmit={this.handleSubmit.bind(this)}>
                    <FormGroup className={formClass + "__section"} controlId="email" bsSize="large">
                        <ControlLabel className={formClass + "__label"}>{Strings.LABEL_EMAIL}</ControlLabel>
                        <FormControl
                            autoFocus
                            className={formClass + "__input"}
                            type="email"
                            value={this.state.email}
                            onChange={this.handleChangeField.bind(this)}
                        />
                    </FormGroup>
                    <button
                        className={buttonClass + ' ' + buttonClass + "--submit is-primary"}
                        disabled={!this.state.formValid}
                        type="submit"
                    >
                        {Strings.BUTTON_PASSWORD_FORGOT}
                    </button>
                    <div className="text-danger">
                        <FormErrors formErrors={this.state.formErrors}/>
                        {this.state.serverError !== '' && <small>{this.state.serverError}</small>}
                    </div>
                    <div className="text-success">
                        {this.state.sent && <small>{Strings.PASSWORD_FORGOT_SUCCESS}</small>}
                    </div>
                </form>
            </div>
        );
    }
}

export default PasswordForgot;