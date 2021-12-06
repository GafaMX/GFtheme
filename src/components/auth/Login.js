'use strict';

import React from "react";
import {FormControl, FormGroup} from "react-bootstrap";
import {FormErrors} from "../form/FormErrors";
import GafaFitSDKWrapper from "../utils/GafaFitSDKWrapper";
import StringStore from "../utils/Strings/StringStore";

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
            logged: false,
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
        fieldValidationErrors.password = passwordValid ? '' : StringStore.get('VALIDATION_PASSWORD');
        return passwordValid;
    }

    validateEmail(value, fieldValidationErrors) {
        let emailValid = value.match(/^([\w.%+-]+)@([\w-]+\.)+([\w]{2,})$/i);
        fieldValidationErrors.email = emailValid ? '' : StringStore.get('VALIDATION_EMAIL');
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
        let comp = this;
        this.setState({logged: true});

        if (this.props.successCallback) {
            this.props.successCallback(result);

            if (window.GFtheme.combo_id != null) {
                this.buyComboAfterLogin();
            }

            if (window.GFtheme.membership_id != null) {
                this.buyMembershipAfterLogin();
            }

            if (window.GFtheme.meetings_id != null && window.GFtheme.location_slug != null) {
                this.reserveMeetingAfterLogin();
            }

            if (!window.GFtheme.meetings_id &&
                !window.GFtheme.location_slug &&
                !window.GFtheme.membership_id &&
                !window.GFtheme.combo_id) {
                comp.props.handleClickBack();
            }
        }
    }

    errorLoginCallback(error) {
        this.setState({serverError: error, logged: false});
    }

    buyComboAfterLogin() {
        let comp = this;

        GafaFitSDKWrapper.getFancyForBuyCombo(
            window.GFtheme.brand_slug,
            window.GFtheme.location_slug,
            window.GFtheme.combo_id,
            function (result) {
                comp.props.handleClickBack();
                window.GFtheme.combo_id = null;
                window.GFtheme.brand_slug = null;
                window.GFtheme.location_slug = null;
            });
    }

    buyMembershipAfterLogin() {
        let comp = this;
        GafaFitSDKWrapper.getFancyForBuyMembership(
            window.GFtheme.brand_slug,
            window.GFtheme.location_slug,
            window.GFtheme.membership_id,
            function (result) {
                comp.props.handleClickBack();
                window.GFtheme.membership_id = null;
                window.GFtheme.brand_slug = null;
                window.GFtheme.location_slug = null;
            });
    }

    reserveMeetingAfterLogin() {
        let comp = this;
        GafaFitSDKWrapper.getFancyForMeetingReservation(
            window.GFtheme.brand_slug,
            window.GFtheme.location_slug,
            window.GFtheme.meetings_id,
            function (result) {
                comp.props.handleClickBack();
                window.GFtheme.meetings_id = null;
                window.GFtheme.location_slug = null;
                window.GFtheme.brand_slug = null;
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
                        {/* <ControlLabel className={formClass + "__label"}>{StringStore.get('LABEL_EMAIL}</ControlLabel> */}
                        <FormControl
                            className={formClass + "__input"}
                            autoFocus
                            placeholder={StringStore.get('LABEL_EMAIL')}
                            type="email"
                            value={this.state.email}
                            onChange={this.handleChangeField.bind(this)}
                        />
                    </FormGroup>
                    <FormGroup className={formClass + "__section"} controlId="password" bsSize="large">
                        {/* <ControlLabel className={formClass + "__label"}>{StringStore.get('LABEL_PASSWORD')}</ControlLabel> */}
                        <FormControl
                            className={formClass + "__input"}
                            value={this.state.password}
                            placeholder={StringStore.get('LABEL_PASSWORD')}
                            onChange={this.handleChangeField.bind(this)}
                            type="password"
                        />
                    </FormGroup>
                    <button
                        className={buttonClass + ' ' + buttonClass + "--submit is-primary"}
                        disabled={!this.state.formValid}
                        type="submit"
                    >
                        {StringStore.get('BUTTON_LOGIN')}
                    </button>
                    <div className="text-danger">
                        <FormErrors formErrors={this.state.formErrors}/>
                        {this.state.serverError !== '' && <small>{this.state.serverError}</small>}
                    </div>
                    <div className="text-success">
                        {this.state.logged && <small>{StringStore.get('LOGIN_SUCCESS')}</small>}
                    </div>
                </form>
            </div>
        );
    }
}

export default Login;