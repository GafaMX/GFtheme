'use strict';

import React from "react";
import {ControlLabel, FormControl, FormGroup} from "react-bootstrap";
import Strings from "../../utils/Strings/Strings_ES";
import DatePicker from 'react-date-picker';
import moment from 'moment'
import 'moment/locale/es';
import StringStore from "../../utils/Strings/StringStore";
import ImageSelect from "./ImageSelect";

class UserInfo extends React.Component {
    constructor(props) {
        super(props);
    }

    validateFirstName(fieldName, value) {
        let fieldValidationErrors = this.props.info.formErrors;
        let first_nameValid = value !== '' && value !== null;
        fieldValidationErrors.first_name = first_nameValid ? '' : StringStore.get('VALIDATION_FULL_NAME');
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
        this.props.info.birth_date = dateFormatted;
        this.props.updateState(this.props.info);
    }

    handleChangePicture(file, remove = false) {
        this.props.info.picture = file;
        this.props.info['_delete-picture'] = remove ? 'on' : null;
        this.props.updateState(this.props.info);
    }

    render() {
        let preE = 'GFSDK-e';
        let preC = 'GFSDK-c';
        let formClass = preE + '-form';
        let profileClass = preC + '-profile';

        let first_name = this.props.info.first_name === null ? '' : this.props.info.first_name;
        let last_name = this.props.info.last_name === null ? '' : this.props.info.last_name;
        let birth_date = this.props.info.birth_date === null ? moment().toDate() : moment(this.props.info.birth_date).toDate();

        return (
            <div className={profileClass + '__section is-user'}>
                <h4>
                    {StringStore.get('LABEL_PROFILE_INFO')}
                </h4>

                <FormGroup className={formClass + "__section is-first_name"} controlId="first_name">
                    <ControlLabel className={formClass + "__label"}>{StringStore.get('LABEL_FIRST_NAME')}</ControlLabel>
                    <FormControl
                        className={formClass + "__input"}
                        autoFocus
                        type="text"
                        value={first_name}
                        onChange={this.handleChangeFirstName.bind(this)}
                    />
                </FormGroup>
                <FormGroup className={formClass + "__section is-last_name"} controlId="last_name">
                    <ControlLabel className={formClass + "__label"}>{StringStore.get('LABEL_LAST_NAME')}</ControlLabel>
                    <FormControl
                        className={formClass + "__input"}
                        type="text"
                        value={last_name}
                        onChange={this.props.handleChangeField}
                    />
                </FormGroup>
                <FormGroup className={formClass + "__section is-gender"}>
                    <div className={formClass + "__radio-container"}>
                        <label className={formClass + "__radio"}>
                            <input className="mr-2" type="radio" value="male"
                                   checked={this.props.info.gender === "male"}
                                   name="gender"
                                   onChange={this.handleGenderChange.bind(this)}/>
                            <div className={'this-radio ' + (this.props.info.gender === 'male' ? 'checked' : '')}></div>
                            <p className={formClass + "__label"}>{StringStore.get('PROFILE_MALE_GENDER')}</p>
                        </label>
                        <label className={formClass + "__radio"}>
                            <input className="mr-2" type="radio" value="female"
                                   checked={this.props.info.gender === "female"}
                                   name="gender"
                                   onChange={this.handleGenderChange.bind(this)}/>
                            <div
                                className={'this-radio ' + (this.props.info.gender === 'female' ? 'checked' : '')}></div>
                            <p className={formClass + "__label"}>{StringStore.get('PROFILE_FEMALE_GENDER')}</p>
                        </label>
                    </div>
                </FormGroup>
                <div className={formClass + "__section is-birthday"}>
                    <ControlLabel className={formClass + "__label"}>{StringStore.get('LABEL_BIRTH_DATE')}</ControlLabel>
                    <DatePicker
                        onChange={this.handleChangeBirthDate.bind(this)}
                        calendarClassName={formClass + "__calendar"}
                        className={formClass + "__calendar-input"}
                        value={this.props.info.birth_date ? birth_date : moment().toDate()}
                        maxDate={new Date()}
                    />
                </div>

                <div className={'placeholder-block'}></div>
                <FormGroup className={formClass + "__section is-picture"}>
                    {/*<div className={formClass + "__section "}>*/}
                    <ControlLabel
                        className={formClass + "__label"}>{StringStore.get('LABEL_PICTURE')}</ControlLabel>
                    <ImageSelect
                        picture={this.props.info.picture}
                        handleChangePicture={this.handleChangePicture.bind(this)}
                    />
                    {/*</div>*/}
                </FormGroup>
            </div>
        );
    }
}

export default UserInfo;