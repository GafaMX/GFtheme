'use strict';

import React from "react";
import {Button, FormGroup, FormControl, ControlLabel} from "react-bootstrap";
import {FormErrors} from "../form/FormErrors";
import GafaFitSDKWrapper from "../utils/GafaFitSDKWrapper";
import Strings from "../utils/Strings/Strings_ES";
import DatePicker from 'react-date-picker';

class ProfileUserInfo extends React.Component {
    constructor(props) {
        super(props);

        this.state = {
            email: "",
            first_name: "",
            last_name: "",
            birth_date: new Date(),
            address: "",
            internal_number: "",
            external_number: "",
            municipality: "",
            postal_code: "",
            city: "",
            countries_id: "",
            country_states_id: "",
            phone: "",
            cel_phone: "",
            gender: "",
            formErrors: {first_name: ''},
            first_nameValid: false,
            formValid: true,
            serverError: '',
            saved: false
        };

        this.initValues();
    }

    initValues() {
        const currentComponent = this;
        GafaFitSDKWrapper.getMe(function (result) {
            currentComponent.setState(
                {
                    email: result.email,
                    first_name: result.first_name,
                    last_name: result.last_name,
                    birth_date: new Date(result.birth_date.substring(0, 11)),
                    address: result.address,
                    internal_number: result.internal_number,
                    external_number: result.external_number,
                    municipality: result.municipality,
                    postal_code: result.postal_code,
                    city: result.city,
                    countries_id: result.countries_id,
                    country_states_id: result.country_states_id,
                    phone: result.phone,
                    cel_phone: result.cel_phone,
                    gender: result.gender,
                });
        });
    }

    validateField(fieldName, value) {
        let fieldValidationErrors = this.state.formErrors;
        let first_nameValid = this.state.first_nameValid;

        switch (fieldName) {
            case 'fullName':
                first_nameValid = this.validateFirstName(value, fieldValidationErrors);
                break;
            default:
                break;
        }
        this.setState({
            formErrors: fieldValidationErrors,
            first_nameValid: first_nameValid
        }, this.validateForm);
    }

    validateFirstName(value, fieldValidationErrors) {
        let first_nameValid = value !== '' && value !== null;
        fieldValidationErrors.fullName = first_nameValid ? '' : Strings.VALIDATION_FULL_NAME;
        return first_nameValid;
    }

    validateForm() {
        this.setState(
            {
                formValid: this.state.first_nameValid
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

    handleGenderChange(event) {
        this.setState({
            gender: event.target.value
        });
    }

    handleSubmit(event) {
        event.preventDefault();
        let currentElement = this;
        currentElement.setState({serverError: '', saved: false});
        // GafaFitSDKWrapper.postRegister(this.state,
        //     currentElement.successSaveMeCallback.bind(this),
        //     currentElement.errorSaveMeCallback.bind(this));
    }

    onBirthDateChange(date) {
        this.setState({birth_date: date})
    }

    successSaveMeCallback(result) {
        this.setState({saved: true});
    }

    errorSaveMeCallback(error) {
        this.setState({serverError: error});
    }

    render() {
        return (
            <div className="profile-info">
                <form onSubmit={this.handleSubmit.bind(this)}>
                    <div className="col-md-12">
                        <h4>
                            {Strings.LABEL_PROFILE_INFO}
                        </h4>
                        <FormGroup controlId="first_name" bsSize="large">
                            <ControlLabel>{Strings.LABEL_FIRST_NAME}</ControlLabel>
                            <FormControl
                                autoFocus
                                type="text"
                                value={this.state.first_name}
                                onChange={this.handleChangeField.bind(this)}
                            />
                        </FormGroup>
                        <FormGroup controlId="last_name" bsSize="large">
                            <ControlLabel>{Strings.LABEL_LAST_NAME}</ControlLabel>
                            <FormControl
                                type="text"
                                value={this.state.last_name}
                                onChange={this.handleChangeField.bind(this)}
                            />
                        </FormGroup>
                        <FormGroup>
                            <div className="radio">
                                <label>
                                    <input type="radio" value="male" checked={this.state.gender === "male"}
                                           name="gender"
                                           onChange={this.handleGenderChange.bind(this)}/>
                                    Hombre
                                </label>
                            </div>
                            <div className="radio">
                                <label>
                                    <input type="radio" value="female" checked={this.state.gender === "female"}
                                           name="gender"
                                           onChange={this.handleGenderChange.bind(this)}/>
                                    Mujer
                                </label>
                            </div>
                            <ControlLabel>{Strings.LABEL_BIRTH_DATE}</ControlLabel>
                            <DatePicker
                                onChange={this.onBirthDateChange.bind(this)}
                                value={this.state.birth_date}
                                maxDate={new Date()}
                            />
                        </FormGroup>
                        <div className="col-md-12">
                            <h4>
                                {Strings.LABEL_ADDRESS}
                            </h4>
                            <FormGroup controlId="address" bsSize="large">
                                <ControlLabel>{Strings.LABEL_ADDRESS}</ControlLabel>
                                <FormControl
                                    type="text"
                                    value={this.state.address}
                                    onChange={this.handleChangeField.bind(this)}
                                />
                            </FormGroup>
                            <FormGroup controlId="external_number" bsSize="large">
                                <ControlLabel>{Strings.LABEL_EXTERNAL_NUMBER}</ControlLabel>
                                <FormControl
                                    type="text"
                                    value={this.state.external_number}
                                    onChange={this.handleChangeField.bind(this)}
                                />
                            </FormGroup>
                            <FormGroup controlId="internal_number" bsSize="large">
                                <ControlLabel>{Strings.LABEL_INTERNAL_NUMBER}</ControlLabel>
                                <FormControl
                                    type="text"
                                    value={this.state.internal_number}
                                    onChange={this.handleChangeField.bind(this)}
                                />
                            </FormGroup>
                            <FormGroup controlId="postal_code" bsSize="large">
                                <ControlLabel>{Strings.LABEL_POSTAL_CODE}</ControlLabel>
                                <FormControl
                                    type="text"
                                    value={this.state.postal_code}
                                    onChange={this.handleChangeField.bind(this)}
                                />
                            </FormGroup>
                            <FormGroup controlId="municipality" bsSize="large">
                                <ControlLabel>{Strings.LABEL_MUNICIPALITY}</ControlLabel>
                                <FormControl
                                    type="text"
                                    value={this.state.municipality}
                                    onChange={this.handleChangeField.bind(this)}
                                />
                            </FormGroup>
                            <FormGroup controlId="city" bsSize="large">
                                <ControlLabel>{Strings.LABEL_CITY}</ControlLabel>
                                <FormControl
                                    type="text"
                                    value={this.state.city}
                                    onChange={this.handleChangeField.bind(this)}
                                />
                            </FormGroup>
                        </div>
                        <div className="col-md-12">
                            <h4>
                                {Strings.LABEL_CONTACT}
                            </h4>
                            <FormGroup controlId="email" bsSize="large">
                                <ControlLabel>{Strings.LABEL_EMAIL}</ControlLabel>
                                <FormControl
                                    type="email"
                                    value={this.state.email}
                                    onChange={this.handleChangeField.bind(this)}
                                />
                            </FormGroup>
                            <FormGroup controlId="phone" bsSize="large">
                                <ControlLabel>{Strings.LABEL_PHONE}</ControlLabel>
                                <FormControl
                                    type="number"
                                    value={this.state.phone}
                                    onChange={this.handleChangeField.bind(this)}
                                />
                            </FormGroup>
                            <FormGroup controlId="cel_phone" bsSize="large">
                                <ControlLabel>{Strings.LABEL_CEL_PHONE}</ControlLabel>
                                <FormControl
                                    type="number"
                                    value={this.state.cel_phone}
                                    onChange={this.handleChangeField.bind(this)}
                                />
                            </FormGroup>
                        </div>

                        <Button
                            block
                            bsSize="large"
                            bsStyle="primary"
                            disabled={!this.state.formValid}
                            type="submit"
                        >
                            {Strings.BUTTON_SAVE}
                        </Button>
                        <div className="panel panel-default mt-4 text-danger">
                            <FormErrors formErrors={this.state.formErrors}/>
                            {this.state.serverError !== '' && <small>{this.state.serverError}</small>}
                        </div>
                        <div className="panel panel-default mt-4 text-success">
                            {this.state.saved && <small>{Strings.SAVE_ME_SUCCESS}</small>}
                        </div>
                    </div>
                </form>
            </div>
        );
    }
}

export default ProfileUserInfo;