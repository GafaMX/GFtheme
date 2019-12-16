'use strict';

import React from "react";
import {ControlLabel, FormControl, FormGroup} from "react-bootstrap";
import Strings from "../../utils/Strings/Strings_ES";
import 'moment/locale/es';

class ContactInfo extends React.Component {
    constructor(props) {
        super(props);
    }

    render() {
        let preE = 'GFSDK-e';
        let preC = 'GFSDK-c';
        let formClass = preE + '-form';
        let profileClass = preC + '-profile';

        return (
            <div className={profileClass + '__section is-contact'}>
                <h4>{Strings.LABEL_CONTACT}</h4>
                <FormGroup className={formClass + "__section is-email"} controlId="email">
                    <ControlLabel className={formClass + "__label"}>{Strings.LABEL_EMAIL}</ControlLabel>
                    <FormControl
                        className={formClass + "__input"}
                        type="email"
                        value={this.props.info.email}
                        onChange={this.props.handleChangeField}
                        disabled
                    />
                </FormGroup>
                <FormGroup className={formClass + "__section is-phone"} controlId="phone" bsSize="large">
                    <ControlLabel className={formClass + "__label"}>{Strings.LABEL_PHONE}</ControlLabel>
                    <FormControl
                        className={formClass + "__input"}
                        type="number"
                        value={this.props.info.phone}
                        onChange={this.props.handleChangeField}
                    />
                </FormGroup>
                <FormGroup className={formClass + "__section is-phone"} controlId="cel_phone" bsSize="large">
                    <ControlLabel className={formClass + "__label"}>{Strings.LABEL_CEL_PHONE}</ControlLabel>
                    <FormControl
                        className={formClass + "__input"}
                        type="number"
                        value={this.props.info.cel_phone}
                        onChange={this.props.handleChangeField}
                    />
                </FormGroup>
            </div>
        );
    }
}

export default ContactInfo;