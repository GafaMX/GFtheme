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
        return (
            <div className="row col-md-12">
                <h4 className="col-md-12">
                    {Strings.LABEL_CONTACT}
                </h4>
                <FormGroup className="col-md-12" controlId="email" bsSize="large">
                    <ControlLabel>{Strings.LABEL_EMAIL}</ControlLabel>
                    <FormControl
                        type="email"
                        value={this.props.info.email}
                        onChange={this.props.handleChangeField}
                        disabled
                    />
                </FormGroup>
                <FormGroup className="col-md-6" controlId="phone" bsSize="large">
                    <ControlLabel>{Strings.LABEL_PHONE}</ControlLabel>
                    <FormControl
                        type="number"
                        value={this.props.info.phone}
                        onChange={this.props.handleChangeField}
                    />
                </FormGroup>
                <FormGroup className="col-md-6" controlId="cel_phone" bsSize="large">
                    <ControlLabel>{Strings.LABEL_CEL_PHONE}</ControlLabel>
                    <FormControl
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