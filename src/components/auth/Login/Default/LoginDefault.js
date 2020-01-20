'use strict';

import React from "react";
import {Button, FormGroup, FormControl, ControlLabel} from "react-bootstrap";
import {FormErrors} from "../../../form/FormErrors";
import Strings from "../../../utils/Strings/Strings_ES";

export default class LoginDefault extends React.Component {
    render() {
        return (
            <form onSubmit={this.props.handleSubmit}>
                <FormGroup controlId="email" bsSize="large">
                    <ControlLabel>{Strings.LABEL_EMAIL}</ControlLabel>
                    <FormControl
                        autoFocus
                        type="email"
                        value={this.props.email}
                        onChange={this.props.handleChangeField}
                    />
                </FormGroup>
                <FormGroup controlId="password" bsSize="large">
                    <ControlLabel>{Strings.LABEL_PASSWORD}</ControlLabel>
                    <FormControl
                        value={this.props.password}
                        onChange={this.props.handleChangeField}
                        type="password"
                    />
                </FormGroup>
                <Button
                    block
                    bsSize="large"
                    bsStyle="primary"
                    disabled={!this.props.formValid}
                    type="submit"
                >
                    {Strings.BUTTON_LOGIN}
                </Button>
                <div className="text-danger">
                    <FormErrors formErrors={this.props.formErrors}/>
                    {this.props.serverError !== '' && <small>{this.props.serverError}</small>}
                </div>
                <div className="text-success">
                    {this.props.logged && <small>{Strings.LOGIN_SUCCESS}</small>}
                </div>
            </form>
        );
    }
}