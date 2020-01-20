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
        let preE = 'GFSDK-e';
        let preC = 'GFSDK-c';
        let formClass = preE + '-form';
        let profileClass = preC + '-profile';

        return (
            <div className={profileClass + '__section is-address'}>
                <h4>{Strings.LABEL_ADDRESS}</h4>
                <FormGroup className={formClass + "__section is-address"} controlId="address">
                    <ControlLabel className={formClass + "__label"}>{Strings.LABEL_ADDRESS}</ControlLabel>
                    <FormControl
                        className={formClass + "__input"}
                        type="text"
                        value={this.props.info.address}
                        onChange={this.props.handleChangeField}
                    />
                </FormGroup>
                <FormGroup className={formClass + "__section is-external_number"} controlId="external_number">
                    <ControlLabel className={formClass + "__label"}>{Strings.LABEL_EXTERNAL_NUMBER}</ControlLabel>
                    <FormControl
                        className={formClass + "__input"}
                        type="text"
                        value={this.props.info.external_number}
                        onChange={this.props.handleChangeField}
                    />
                </FormGroup>
                <FormGroup className={formClass + "__section is-internal_number"} controlId="internal_number">
                    <ControlLabel className={formClass + "__label"}>{Strings.LABEL_INTERNAL_NUMBER}</ControlLabel>
                    <FormControl
                        className={formClass + "__input"}
                        type="text"
                        value={this.props.info.internal_number}
                        onChange={this.props.handleChangeField}
                    />
                </FormGroup>
                <FormGroup className={formClass + "__section is-postal_code"} controlId="postal_code">
                    <ControlLabel className={formClass + "__label"}>{Strings.LABEL_POSTAL_CODE}</ControlLabel>
                    <FormControl
                        className={formClass + "__input"}
                        type="text"
                        value={this.props.info.postal_code}
                        onChange={this.props.handleChangeField}
                    />
                </FormGroup>
                <FormGroup className={formClass + "__section is-municipality"} controlId="municipality">
                    <ControlLabel className={formClass + "__label"}>{Strings.LABEL_MUNICIPALITY}</ControlLabel>
                    <FormControl
                        className={formClass + "__input"}
                        type="text"
                        value={this.props.info.municipality}
                        onChange={this.props.handleChangeField}
                    />
                </FormGroup>
                <FormGroup className={formClass + "__section is-city"} controlId="city">
                    <ControlLabel className={formClass + "__label"}>{Strings.LABEL_CITY}</ControlLabel>
                    <FormControl
                        className={formClass + "__input"}
                        type="text"
                        value={this.props.info.city}
                        onChange={this.props.handleChangeField}
                    />
                </FormGroup>
                <div className={formClass + "__section is-country"}>
                    <ControlLabel className={formClass + "__label"}>{Strings.LABEL_COUNTRY}</ControlLabel>
                    <Select options={this.props.info.countries}
                            placeholder={'Seleccionar'}
                            value={this.props.info.countries.find(option => option.value === this.props.info.countries_id)}
                            onChange={this.handleChangeCountry.bind(this)}
                    />
                </div>
                <div className={formClass + "__section is-state"}>
                    <ControlLabel className={formClass + "__label"}>{Strings.LABEL_STATE}</ControlLabel>
                    <Select options={this.props.info.states}
                            placeholder={'Seleccionar'}
                            value={this.props.info.states.find(option => option.value === this.props.info.country_states_id)}
                            onChange={this.handleChangeState.bind(this)}
                    />
                </div>
            </div>
        );
    }
}

export default AddressInfo;