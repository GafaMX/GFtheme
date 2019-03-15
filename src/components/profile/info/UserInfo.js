'use strict';

import React from "react";
import {ControlLabel, FormControl, FormGroup} from "react-bootstrap";
import Strings from "../../utils/Strings/Strings_ES";
import DatePicker from 'react-date-picker';
import moment from 'moment'
import 'moment/locale/es';

class UserInfo extends React.Component {
    constructor(props) {
        super(props);
    }

    validateFirstName(fieldName, value) {
        let fieldValidationErrors = this.props.info.formErrors;
        let first_nameValid = value !== '' && value !== null;
        fieldValidationErrors.first_name = first_nameValid ? '' : Strings.VALIDATION_FULL_NAME;
        this.props.info.formErrors = fieldValidationErrors;
        this.props.info.first_nameValid = first_nameValid;
        this.validateForm();
    }

    validateForm() {
        this.props.info.formValid = this.props.info.first_nameValid;
        this.props.updateState(this.props.info);
    }

    handleChangeFirstName(event) {
        let fieldName = event.target.id;
        let fieldValue = event.target.value;
        this.props.info[fieldName] = fieldValue;
        this.validateFirstName(fieldName, fieldValue);
        this.props.updateState(this.props.info);
    }

    handleGenderChange(event) {
        this.props.info.gender = event.target.value;
        this.props.updateState(this.props.info);
    }

    handleChangeBirthDate(date) {
        const dateFormatted = moment(date).format('YYYY-MM-DD');
        this.props.info.birthDate = date;
        this.props.info.birth_date = dateFormatted + " 00:00:00";
        this.props.updateState(this.props.info);
    }

    render() {
        return (
            <div className="row col-md-12 pt-4">
                <h4 className="col-md-12">
                    {Strings.LABEL_PROFILE_INFO}
                </h4>

                <FormGroup className="col-md-6" controlId="first_name" bsSize="large">
                    <ControlLabel>{Strings.LABEL_FIRST_NAME}</ControlLabel>
                    <FormControl
                        autoFocus
                        type="text"
                        value={this.props.info.first_name}
                        onChange={this.handleChangeFirstName.bind(this)}
                    />
                </FormGroup>
                <FormGroup className="col-md-6" controlId="last_name" bsSize="large">
                    <ControlLabel>{Strings.LABEL_LAST_NAME}</ControlLabel>
                    <FormControl
                        type="text"
                        value={this.props.info.last_name}
                        onChange={this.props.handleChangeField}
                    />
                </FormGroup>
                <FormGroup className="col-md-6 radio-inline">
                    <div>
                        <label className="radio-group">
                            <input className="mr-2" type="radio" value="male"
                                   checked={this.props.info.gender === "male"}
                                   name="gender"
                                   onChange={this.handleGenderChange.bind(this)}/>
                            <p>Hombre</p>
                        </label>
                        <label className="radio-group">
                            <input className="mr-2" type="radio" value="female"
                                   checked={this.props.info.gender === "female"}
                                   name="gender"
                                   onChange={this.handleGenderChange.bind(this)}/>
                            <p>Mujer</p>
                        </label>
                    </div>
                </FormGroup>
                <div className="col-md-6">
                    <ControlLabel className="mr-2">{Strings.LABEL_BIRTH_DATE}</ControlLabel>
                    <DatePicker
                        onChange={this.handleChangeBirthDate.bind(this)}
                        value={this.props.info.birthDate}
                        maxDate={new Date()}
                    />
                </div>
            </div>
        );
    }
}

export default UserInfo;