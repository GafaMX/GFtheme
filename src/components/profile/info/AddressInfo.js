'use strict';

import React from "react";
import {ControlLabel, FormControl, FormGroup} from "react-bootstrap";
import Strings from "../../utils/Strings/Strings_ES";
import 'moment/locale/es';
import Select from "react-select";
import StringStore from "../../utils/Strings/StringStore";

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

        let address = this.props.info.address ? this.props.info.address : '';
        let external_number = this.props.info.external_number ? this.props.info.external_number : '';
        let internal_number = this.props.info.internal_number ? this.props.info.internal_number : '';
        let postal_code = this.props.info.postal_code ? this.props.info.postal_code : '';
        let municipality = this.props.info.municipality ? this.props.info.municipality : '';
        let city = this.props.info.city ? this.props.info.city : '';

        return (
            <div className={profileClass + '__section is-address'}>
                <h4>{StringStore.get('LABEL_ADDRESS')}</h4>
                <FormGroup className={formClass + "__section is-address"} controlId="address">
                    <ControlLabel className={formClass + "__label"}>{StringStore.get('LABEL_ADDRESS')}</ControlLabel>
                    <FormControl
                        className={formClass + "__input"}
                        type="text"
                        value={address}
                        onChange={this.props.handleChangeField}
                    />
                </FormGroup>
                <FormGroup className={formClass + "__section is-external_number"} controlId="external_number">
                    <ControlLabel className={formClass + "__label"}>{StringStore.get('LABEL_EXTERNAL_NUMBER')}</ControlLabel>
                    <FormControl
                        className={formClass + "__input"}
                        type="text"
                        value={external_number}
                        onChange={this.props.handleChangeField}
                    />
                </FormGroup>
                <FormGroup className={formClass + "__section is-internal_number"} controlId="internal_number">
                    <ControlLabel className={formClass + "__label"}>{StringStore.get('LABEL_INTERNAL_NUMBER')}</ControlLabel>
                    <FormControl
                        className={formClass + "__input"}
                        type="text"
                        value={internal_number}
                        onChange={this.props.handleChangeField}
                    />
                </FormGroup>
                <FormGroup className={formClass + "__section is-postal_code"} controlId="postal_code">
                    <ControlLabel className={formClass + "__label"}>{StringStore.get('LABEL_POSTAL_CODE')}</ControlLabel>
                    <FormControl
                        className={formClass + "__input"}
                        type="text"
                        value={postal_code}
                        onChange={this.props.handleChangeField}
                    />
                </FormGroup>
                <FormGroup className={formClass + "__section is-municipality"} controlId="municipality">
                    <ControlLabel className={formClass + "__label"}>{StringStore.get('LABEL_MUNICIPALITY')}</ControlLabel>
                    <FormControl
                        className={formClass + "__input"}
                        type="text"
                        value={municipality}
                        onChange={this.props.handleChangeField}
                    />
                </FormGroup>
                <FormGroup className={formClass + "__section is-city"} controlId="city">
                    <ControlLabel className={formClass + "__label"}>{StringStore.get('LABEL_CITY')}</ControlLabel>
                    <FormControl
                        className={formClass + "__input"}
                        type="text"
                        value={city}
                        onChange={this.props.handleChangeField}
                    />
                </FormGroup>
                <div className={formClass + "__section is-country"}>
                    <ControlLabel className={formClass + "__label"}>{StringStore.get('LABEL_COUNTRY')}</ControlLabel>
                    <Select options={this.props.info.countries}
                            placeholder={'Seleccionar'}
                            value={this.props.info.countries.find(option => option.value === this.props.info.countries_id)}
                            onChange={this.handleChangeCountry.bind(this)}
                    />
                </div>
                <div className={formClass + "__section is-state"}>
                    <ControlLabel className={formClass + "__label"}>{StringStore.get('LABEL_STATE')}</ControlLabel>
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