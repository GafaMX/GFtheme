'use strict';

import React from "react";
import {FormControl, FormGroup} from "react-bootstrap";
import {FormErrors} from "../form/FormErrors";
import GafaFitSDKWrapper from "../utils/GafaFitSDKWrapper";
import StringStore from "../utils/Strings/StringStore";
import GlobalStorage from "../store/GlobalStorage";
import Checkbox from "react-bootstrap/lib/Checkbox";
import {Select} from "react-select";

class Register extends React.Component {
    constructor(props) {
        super(props);

        let special_texts = GlobalStorage.get('special_texts_register');
        let special_texts_values = this.defaultSpecialTexts(special_texts);

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
            tokenmovil: window.GFtheme.TokenMovil,
            passwordConfirmationValid: false,
            fullNameValid: false,
            formValid: false,
            serverError: '',
            registered: false,
            g_recaptcha_response: '',
            special_texts: special_texts,
            special_texts_values: special_texts_values
        };

        GlobalStorage.addListener(this.updateSpecialTexts.bind(this));
    }

    defaultSpecialTexts(special_texts) {
        let special_texts_values = {};

        if (special_texts.length) {
            special_texts.forEach(function (group) {
                special_texts_values[group.id] = {};
                special_texts_values[group.id][0] = {};
                group.active_fields.forEach(function (field) {
                    special_texts_values[group.id][0][field.id] = {};
                    special_texts_values[group.id][0][field.id][0] = '';
                })
            });
        }

        return special_texts_values;
    }

    updateSpecialTexts() {
        let special_texts = GlobalStorage.get('special_texts_register');

        let special_texts_values = this.defaultSpecialTexts(special_texts);

        this.setState({
            special_texts: special_texts,
            special_texts_values: special_texts_values
        })
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
        fieldValidationErrors.password = passwordValid ? '' : StringStore.get('VALIDATION_PASSWORD');
        return passwordValid;
    }

    validatePasswordConfirmation(value, fieldValidationErrors) {
        let passwordConfirmationValid = value === this.state.password;
        fieldValidationErrors.passwordConfirmation = passwordConfirmationValid ? '' : StringStore.get('VALIDATION_EQUAL_PASSWORDS');
        return passwordConfirmationValid;
    }

    validateEmail(value, fieldValidationErrors) {
        let emailValid = value.match(/^([\w.%+-]+)@([\w-]+\.)+([\w]{2,})$/i);
        fieldValidationErrors.email = emailValid ? '' : StringStore.get('VALIDATION_EMAIL');
        return emailValid;
    }

    validateFullName(value, fieldValidationErrors) {
        let fullNameValid = value !== '' && value !== null;
        fieldValidationErrors.fullName = fullNameValid ? '' : StringStore.get('VALIDATION_FULL_NAME');
        return fullNameValid;
    }

    validateSpecialTexts() {
        let special_texts = this.state.special_texts;
        let special_texts_values = this.state.special_texts_values;
        let valid = true;

        if (special_texts) {
            special_texts.forEach(function (group) {
                if (group.active_fields) {
                    group.active_fields.forEach(function (field) {
                        let validation = field.validation;
                        if (validation && validation.includes('required')) {
                            let fieldValue = special_texts_values[group.id][0][field.id][0];
                            valid &= !!(fieldValue && fieldValue !== '');
                        }
                    });
                }
            });
        }

        return valid;
    }

    validateForm() {

        this.setState(
            {
                formValid: this.state.emailValid && this.state.passwordValid && this.state.passwordConfirmationValid &&
                    this.state.fullNameValid && this.validateSpecialTexts()
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

    handleChangeSpecialText(event) {
        let fieldId = event.target.getAttribute('data-field-id');
        let groupId = event.target.getAttribute('data-group-id');
        let fieldType = event.target.getAttribute('data-field-type');

        let fieldValue = '';

        if (fieldType === 'checkbox' || fieldType === 'radio') {
            fieldValue = event.target.checked ? event.target.value : '';
        } else {
            fieldValue = event.target.value;
        }

        let special_texts = this.state.special_texts_values;
        if (!special_texts[groupId][0][fieldId][0]) {
            if (!special_texts[groupId]) {
                special_texts[groupId] = {};
                special_texts[groupId][0] = {}
            }
            if (!special_texts[fieldId]) {
                special_texts[groupId][0][fieldId] = {};
                special_texts[groupId][0][fieldId][0] = {}
            }
        }
        special_texts[groupId][0][fieldId][0] = fieldValue;
        this.setState({
            special_texts_values: special_texts
        }, () => {
            this.validateForm()
        });
    }

    handleSubmit(event) {
        event.preventDefault();

        let currentElement = this;

        grecaptcha.ready(function () {
            grecaptcha.execute(window.GFtheme.CaptchaPublicKey, {action: 'register'}).then(function (token) {
                currentElement.setState({serverError: '', registered: false, g_recaptcha_response: token});
                GafaFitSDKWrapper.postRegister(
                    currentElement.state,
                    currentElement.successRegisterCallback.bind(currentElement),
                    currentElement.errorRegisterCallback.bind(currentElement)
                );
            });
        });
    }

    successRegisterCallback(result) {
        let comp = this;
        this.setState(
            {
                registered: true
            }, () => {
                setTimeout(() => {
                    if (comp.props.successCallback) {
                        comp.props.successCallback(result);

                        if (window.GFtheme.combo_id != null) {
                            comp.buyComboAfterRegister();
                        }

                        if (window.GFtheme.membership_id != null) {
                            comp.buyMembershipAfterRegister();
                        }

                        if (window.GFtheme.meetings_id != null && window.GFtheme.location_slug != null) {
                            comp.reserveMeetingAfterRegister();
                        }

                        if (!window.GFtheme.meetings_id &&
                            !window.GFtheme.location_slug &&
                            !window.GFtheme.membership_id &&
                            !window.GFtheme.combo_id) {
                            comp.props.handleClickBack();
                        }
                    }
                }, 3500);
            }
        );
    }

    buyComboAfterRegister() {
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

    buyMembershipAfterRegister() {
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

    reserveMeetingAfterRegister() {
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

    errorRegisterCallback(error) {
        this.setState({serverError: error});
    }

    printSpecialTextsFields() {
        var component = this;
        let {special_texts} = this.state;
        if (special_texts.length) {
            let to_print = [];
            special_texts.forEach(function (group) {
                to_print.push((<h4 key={`register-form--group-${group.id}`}>{group.name}</h4>));
                group.active_fields.forEach(function (field) {
                    to_print.push(component.printSpecialText(field, group));
                });
            });

            return (<div>{to_print}</div>);
        }
    }

    printSpecialText(text, group) {
        let preE = 'GFSDK-e';
        let buttonClass = preE + '-buttons';
        let formClass = preE + '-form';
        let input = null;
        let input_name = text.slug;

        let type = text.type;

        switch (type) {
            case 'checkbox':
                let value = text.catalog_field_options.length ? text.catalog_field_options[0].value : '';
                input = (<FormGroup key={`register-form--input-${text.slug}`} className={formClass + "__section"}
                                    controlId={input_name} bsSize="large">
                    <Checkbox
                        className={formClass + "__input"}
                        title={text.name}
                        onChange={this.handleChangeSpecialText.bind(this)}
                        id={input_name}
                        name={input_name}
                        data-group-id={group.id}
                        data-field-id={text.id}
                        data-field-type={type}
                        value={value}
                    >
                        <span dangerouslySetInnerHTML={{__html: text.name}}></span>
                    </Checkbox>
                </FormGroup>);
                break;
            case 'textarea':
                input = (<FormGroup
                    key={`register-form--input-${text.slug}`}
                    className={formClass + "__section"}
                    controlId={input_name}
                    bsSize="large"
                >
                    <textarea
                        className={formClass + "__input"}
                        title={text.name}
                        onChange={this.handleChangeSpecialText.bind(this)}
                        id={input_name}
                        name={input_name}
                        placeholder={text.name}
                        data-group-id={group.id}
                        data-field-id={text.id}
                        data-field-type={type}
                    >
                    </textarea>
                </FormGroup>);
                break;
            case 'select':
                let options = text.catalog_field_options.map(function (item) {
                    return (<option key={`${text.slug}--option_${item.id}`} value={item.value}>{item.value}</option>)
                });
                input = (<FormGroup
                    key={`register-form--input-${text.slug}`}
                    className={formClass + "__section"}
                    controlId={input_name}
                    bsSize="large">
                    <label htmlFor={text.slug}>{text.name}</label>
                    <select
                        onChange={this.handleChangeSpecialText.bind(this)}
                        id={input_name}
                        className={formClass + '__select'}
                        placeholder={text.name}
                        name={input_name}
                        data-group-id={group.id}
                        data-field-id={text.id}
                        data-field-type={type}
                    >
                        {options}
                    </select>
                </FormGroup>);
                break;
            case 'radio':
                let component = this;
                let radio_options = text.catalog_field_options.map(function (item) {
                    let name = `${text.slug}--radio_option_${item.id}`;
                    return (<span key={name}>
                        <label htmlFor={name}>
                            <input
                                className={formClass + "__radio"}
                                type={'radio'}
                                value={item.value}
                                name={input_name}
                                data-group-id={group.id}
                                data-field-id={text.id}
                                data-field-type={type}
                                onChange={component.handleChangeSpecialText.bind(component)}
                            />
                            {item.value}
                        </label>
                    </span>)
                });
                input = (<FormGroup
                    key={`register-form--input-${text.slug}`}
                    className={formClass + "__section"}
                    controlId={input_name}
                    bsSize="large"
                >
                    {radio_options}
                </FormGroup>);
                break;
            default:
                input = (<FormGroup
                    key={`register-form--input-${text.slug}`}
                    className={formClass + "__section"}
                    controlId={input_name}
                    bsSize="large">
                    <FormControl
                        className={formClass + "__input"}
                        placeholder={text.name}
                        type={text.type}
                        onChange={this.handleChangeSpecialText.bind(this)}
                        data-group-id={group.id}
                        data-field-id={text.id}
                        data-field-type={type}
                    />
                </FormGroup>);
                break;
        }

        return input;
    }

    render() {
        let preE = 'GFSDK-e';
        let buttonClass = preE + '-buttons';
        let formClass = preE + '-form';
        let {
            g_recaptcha_response,
            registered
        } = this.state;

        return (
            <div className="register auth">
                <form id="register-form"
                      className={`register-form ${registered ? 'register-form__registered' : ''}`}
                      onSubmit={this.handleSubmit.bind(this)}>
                    <input type="hidden" name="g-recaptcha-response" value={g_recaptcha_response}/>
                    <FormGroup className={formClass + "__section"} controlId="fullName" bsSize="large">
                        {/* <ControlLabel className={formClass + "__label"}>{StringStore.get('LABEL_FULL_NAME')}</ControlLabel> */}
                        <FormControl
                            autoFocus
                            className={formClass + "__input"}
                            placeholder={StringStore.get('LABEL_FULL_NAME')}
                            type="text"
                            onChange={this.handleChangeField.bind(this)}
                        />
                    </FormGroup>
                    <FormGroup className={formClass + "__section"} controlId="email" bsSize="large">
                        <FormControl
                            className={formClass + "__input"}
                            placeholder={StringStore.get('LABEL_EMAIL')}
                            type="email"
                            value={this.state.email}
                            onChange={this.handleChangeField.bind(this)}
                        />
                    </FormGroup>
                    <FormGroup className={formClass + "__section"} controlId="password" bsSize="large">
                        <FormControl
                            className={formClass + "__input"}
                            placeholder={StringStore.get('LABEL_PASSWORD')}
                            value={this.state.password}
                            onChange={this.handleChangeField.bind(this)}
                            type="password"
                        />
                    </FormGroup>
                    <FormGroup className={formClass + "__section"} controlId="passwordConfirmation" bsSize="large">
                        <FormControl
                            className={formClass + "__input"}
                            placeholder={StringStore.get('LABEL_PASSWORD_CONFIRM')}
                            value={this.state.passwordConfirmation}
                            onChange={this.handleChangeField.bind(this)}
                            type="password"
                        />
                    </FormGroup>
                    {this.printSpecialTextsFields()}
                    <button
                        className={buttonClass + ' ' + buttonClass + "--submit is-primary"}
                        disabled={!this.state.formValid}
                        type="submit"
                    >
                        {StringStore.get('BUTTON_REGISTER')}
                    </button>
                    <div className="text-danger">
                        <FormErrors formErrors={this.state.formErrors}/>
                        {this.state.serverError !== '' && <small>{this.state.serverError}</small>}
                    </div>
                    <div className="register-form-success text-success">
                        {StringStore.get('REGISTER_SUCCESS')}
                    </div>
                </form>
            </div>
        );
    }
}

export default Register;
