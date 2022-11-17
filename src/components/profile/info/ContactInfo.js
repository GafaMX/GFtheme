'use strict';

import React from "react";
import {ControlLabel, FormControl, FormGroup} from "react-bootstrap";
import Strings from "../../utils/Strings/Strings_ES";
import 'moment/locale/es';
import StringStore from "../../utils/Strings/StringStore";

class ContactInfo extends React.Component {
    constructor(props) {
        super(props);
    }

    render() {
        let preE = 'GFSDK-e';
        let preC = 'GFSDK-c';
        let formClass = preE + '-form';
        let profileClass = preC + '-profile';
        let {info} = this.props;

        let email = info.email === null ? '' : info.email;
        let phone = info.phone === null ? '' : info.phone;
        let cel_phone = info.cel_phone === null ? '' : info.cel_phone;



        return (
            <div className={profileClass + '__section is-contact'}>
                <h4>{StringStore.get('LABEL_CONTACT')}</h4>
                <FormGroup className={formClass + "__section is-email"} controlId="email">
                    <ControlLabel className={formClass + "__label"}>{StringStore.get('LABEL_EMAIL')}</ControlLabel>
                    <FormControl
                        className={formClass + "__input"}
                        type="email"
                        value={email}
                        onChange={this.props.handleChangeField}
                        disabled
                    />
                </FormGroup>
                <FormGroup className={formClass + "__section is-phone"} controlId="phone" bsSize="large">
                    <ControlLabel className={formClass + "__label"}>{StringStore.get('LABEL_PHONE')}</ControlLabel>
                    <FormControl
                        className={formClass + "__input"}
                        type="number"
                        value={phone}
                        onChange={this.props.handleChangeField}
                    />
                </FormGroup>
                <FormGroup className={formClass + "__section is-phone"} controlId="cel_phone" bsSize="large">
                    <ControlLabel className={formClass + "__label"}>{StringStore.get('LABEL_CEL_PHONE')}</ControlLabel>
                    <FormControl
                        className={formClass + "__input"}
                        type="number"
                        value={cel_phone}
                        onChange={this.props.handleChangeField}
                    />
                </FormGroup>
            </div>
        );
    }
}

export default ContactInfo;