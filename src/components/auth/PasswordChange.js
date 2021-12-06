'use strict';

import React from "react";
import {FormControl, FormGroup} from "react-bootstrap";
import {FormErrors} from "../form/FormErrors";
import GafaFitSDKWrapper from "../utils/GafaFitSDKWrapper";
import StringStore from "../utils/Strings/StringStore";

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
        fieldValidationErrors.password = passwordValid ? '' : StringStore.get('VALIDATION_PASSWORD');
        return passwordValid;
    }

    validatePasswordConfirmation(value, fieldValidationErrors) {
        let passwordConfirmationValid = value === this.state.password;
        fieldValidationErrors.passwordConfirmation = passwordConfirmationValid ? '' : StringStore.get('VALIDATION_EQUAL_PASSWORDS');
        return passwordConfirmationValid;
    }

    validateForm() {
        this.setState({
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
        currentElement.setState({serverError: '', passwordChanged: ''});
        GafaFitSDKWrapper.postPasswordChange(this.state,
            currentElement.successPasswordForgotCallback.bind(this),
            currentElement.errorPasswordForgotCallback.bind(this));
    };

    successPasswordForgotCallback(result) {
        this.setState({passwordChanged: true});
        alert("¡Felicidades, tienes una nueva contraseña!");
        this.props.handleClickBack();
    }

    errorPasswordForgotCallback(error) {
        this.setState({serverError: error});
    }

    render() {
        let preE = 'GFSDK-e';
        let buttonClass = preE + '-buttons';
        let formClass = preE + '-form';

        return (
            <div className="password-change auth">
                <form onSubmit={this.handleSubmit.bind(this)}>
                    <FormGroup className={formClass + "__section"} controlId="password">
                        <FormControl
                            autoFocus
                            className={formClass + "__input"}
                            value={this.state.password}
                            placeholder={StringStore.get('LABEL_PASSWORD')}
                            onChange={this.handleChangeField.bind(this)}
                            type="password"
                        />
                    </FormGroup>
                    <FormGroup className={formClass + "__section"} controlId="passwordConfirmation">
                        <FormControl
                            autoFocus
                            className={formClass + "__input"}
                            value={this.state.passwordConfirmation}
                            placeholder={StringStore.get('LABEL_PASSWORD_CONFIRM')}
                            onChange={this.handleChangeField.bind(this)}
                            type="password"
                        />
                    </FormGroup>
                    <button
                        className={buttonClass + ' ' + buttonClass + "--submit is-primary"}
                        disabled={!this.state.formValid}
                        type="submit"
                    >
                        {StringStore.get('BUTTON_PASSWORD_CHANGE')}
                    </button>
                    <div className="text-danger">
                        <FormErrors formErrors={this.state.formErrors}/>
                        {this.state.serverError !== '' && <small>{this.state.serverError}</small>}
                    </div>
                    <div className="text-success">
                        {this.state.passwordChanged && <small>{StringStore.get('PASSWORD_CHANGE_SUCCESS')}</small>}
                    </div>
                </form>
            </div>
        );
    }
}

export default PasswordChange;