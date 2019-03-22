'use strict';

import React from "react";
import {ControlLabel, FormControl, FormGroup} from "react-bootstrap";
import Strings from "../../utils/Strings/Strings_ES";
import 'moment/locale/es';
import Select from "react-select";

class AddressInfo extends React.Component {
    constructor(props) {
        super(props);
    }

    handleChangeCountry(selectedOption) {
        this.props.info.countries_id = selectedOption.value;
        this.props.getStatesListByCountry();
    }

    handleChangeState(selectedOption) {
        this.props.info.country_states_id = selectedOption.value;
    }

    render() {
        return (
            <div className="row col-md-12">
                <h4 className="col-md-12">
                    {Strings.LABEL_ADDRESS}
                </h4>
                <FormGroup className="col-md-6" controlId="address" bsSize="large">
                    <ControlLabel>{Strings.LABEL_ADDRESS}</ControlLabel>
                    <FormControl
                        type="text"
                        value={this.props.info.address}
                        onChange={this.props.handleChangeField}
                    />
                </FormGroup>
                <FormGroup className="col-md-3" controlId="external_number" bsSize="large">
                    <ControlLabel>{Strings.LABEL_EXTERNAL_NUMBER}</ControlLabel>
                    <FormControl
                        type="text"
                        value={this.props.info.external_number}
                        onChange={this.props.handleChangeField}
                    />
                </FormGroup>
                <FormGroup className="col-md-3" controlId="internal_number" bsSize="large">
                    <ControlLabel>{Strings.LABEL_INTERNAL_NUMBER}</ControlLabel>
                    <FormControl
                        type="text"
                        value={this.props.info.internal_number}
                        onChange={this.props.handleChangeField}
                    />
                </FormGroup>
                <FormGroup className="col-md-6" controlId="postal_code" bsSize="large">
                    <ControlLabel>{Strings.LABEL_POSTAL_CODE}</ControlLabel>
                    <FormControl
                        type="text"
                        value={this.props.info.postal_code}
                        onChange={this.props.handleChangeField}
                    />
                </FormGroup>
                <FormGroup className="col-md-3" controlId="municipality" bsSize="large">
                    <ControlLabel>{Strings.LABEL_MUNICIPALITY}</ControlLabel>
                    <FormControl
                        type="text"
                        value={this.props.info.municipality}
                        onChange={this.props.handleChangeField}
                    />
                </FormGroup>
                <FormGroup className="col-md-3" controlId="city" bsSize="large">
                    <ControlLabel>{Strings.LABEL_CITY}</ControlLabel>
                    <FormControl
                        type="text"
                        value={this.props.info.city}
                        onChange={this.props.handleChangeField}
                    />
                </FormGroup>
                <div className="col-md-6 select-group">
                    <ControlLabel>{Strings.LABEL_COUNTRY}</ControlLabel>
                    <Select options={this.props.info.countries}
                            value={this.props.info.countries.find(option => option.value === this.props.info.countries_id)}
                            onChange={this.handleChangeCountry.bind(this)}
                    />
                </div>
                <div className="col-md-6 select-group">
                    <ControlLabel>{Strings.LABEL_STATE}</ControlLabel>
                    <Select options={this.props.info.states}
                            value={this.props.info.states.find(option => option.value === this.props.info.country_states_id)}
                            onChange={this.handleChangeState.bind(this)}
                    />
                </div>
            </div>
        );
    }
}

export default AddressInfo;