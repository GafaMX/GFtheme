'use strict';

import React from "react";
import {Button, FormGroup, FormControl, ControlLabel} from "react-bootstrap";
import {FormErrors} from "../form/FormErrors";
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
                emailValid = this.validateEmail(value, fieldValidationErrors);
                break;
            case 'password':
                passwordValid = this.validatePassword(value, fieldValidationErrors);
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

    validatePassword(value, fieldValidationErrors) {
        let passwordValid = value.length >= 6;
        fieldValidationErrors.password = passwordValid ? '' : Strings.VALIDATION_PASSWORD;
        return passwordValid;
    }

    validateEmail(value, fieldValidationErrors) {
        let emailValid = value.match(/^([\w.%+-]+)@([\w-]+\.)+([\w]{2,})$/i);
        fieldValidationErrors.email = emailValid ? '' : Strings.VALIDATION_EMAIL;
        return emailValid;
    }

    validateForm() {
        this.setState({formValid: this.state.emailValid && this.state.passwordValid});
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
        currentElement.setState({serverError: ''});
        GafaFitSDKWrapper.getToken(this.state.email, this.state.password,
            currentElement.successLoginCallback.bind(this),
            currentElement.errorLoginCallback.bind(this));
    };

    successLoginCallback(result) {
        // TODO: Login Automatico
        // this.setState({logged: true});
        // if (this.props.successCallback) {
        //     this.props.successCallback(result);
        // }

        if (window.GFtheme.combo_id != null) {
            this.buyComboAfterLogin();
        }
        if (window.GFtheme.membership_id != null) {
            this.buyMembershipAfterLogin();
        }
        if (window.GFtheme.meetings_id != null && window.GFtheme.location_slug != null) {
            this.reserveMeetingAfterLogin();
        }
    }

    errorLoginCallback(error) {
        this.setState({serverError: error, logged: false});
    }

    buyComboAfterLogin() {
        GafaFitSDKWrapper.getFancyForBuyCombo(window.GFtheme.combo_id, function (result) {
            window.GFtheme.combo_id = null;
        });
    }

    buyMembershipAfterLogin() {
        GafaFitSDKWrapper.getFancyForBuyMembership(window.GFtheme.membership_id, function (result) {
            window.GFtheme.membership_id = null;
        });
    }

    reserveMeetingAfterLogin() {
        GafaFitSDKWrapper.getFancyForMeetingReservation(window.GFtheme.location_slug, window.GFtheme.meetings_id, function (result) {
            window.GFtheme.meetings_id = null;
            window.GFtheme.location_slug = null;
        });
    }

    render() {

        let preE = 'GFSDK-e';
        let buttonClass = preE + '-buttons';
        let formClass = preE + '-form';

        return (
            <div className="login auth">
                <form onSubmit={this.handleSubmit.bind(this)}>
                    <FormGroup className={formClass + "__section"} controlId="email" bsSize="large">
                        <ControlLabel className={formClass + "__label"}>{Strings.LABEL_EMAIL}</ControlLabel>
                        <FormControl
                            className={formClass + "__input"}
                            autoFocus
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
                    <button
                        className={buttonClass + ' ' + buttonClass + "--submit is-primary"}
                        disabled={!this.state.formValid}
                        type="submit"
                    >
                        {Strings.BUTTON_LOGIN}
                    </button>
                    <div className="text-danger">
                        <FormErrors formErrors={this.state.formErrors}/>
                        {this.state.serverError !== '' && <small>{this.state.serverError}</small>}
                    </div>
                    <div className="text-success">
                        {this.state.logged && <small>{Strings.LOGIN_SUCCESS}</small>}
                    </div>
                </form>
            </div>
        );
    }
}

export default Login;