'use strict';

import React from "react";
import {Button, Carousel, ControlLabel, FormControl, FormGroup, HelpBlock, Tab, Tabs} from "react-bootstrap";
import {FormErrors} from "../../form/FormErrors";
import GafaFitSDKWrapper from "../../utils/GafaFitSDKWrapper";
import Strings from "../../utils/Strings/Strings_ES";
import {isFunction} from "../../utils/TypeUtils";
import 'moment/locale/es';
import UserInfo from "./UserInfo";
import AddressInfo from "./AddressInfo";
import ContactInfo from "./ContactInfo";
import UserCredits from "./UserCredits";
import UserMembership from "./Membership";

class ProfileUserInfo extends React.Component {
    constructor(props) {
        super(props);

        this.state = {
            email: "",
            first_name: "",
            last_name: "",
            birthDate: new Date(),
            birth_date: "",
            password: "",
            confirmationPassword: "",
            address: "",
            internal_number: "",
            external_number: "",
            municipality: "",
            postal_code: "",
            city: "",
            countries_id: "",
            country_states_id: "",
            countries: [],
            states: [],
            phone: "",
            cel_phone: "",
            gender: "",
            formErrors: {first_name: ''},
            first_nameValid: true,
            formValid: true,
            serverError: '',
            saved: false
        };
    }

    componentDidMount() {
        const currentComponent = this;
        GafaFitSDKWrapper.getMe(function (result) {
            currentComponent.setState(
                {
                    email: result.email,
                    first_name: result.first_name,
                    last_name: result.last_name,
                    birthDate: new Date(result.birth_date.substring(0, 11)),
                    birth_date: result.birth_date,
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
            currentComponent.getCountryList(currentComponent.getStatesListByCountry.bind(currentComponent));
        });
    }

    findCountryCodeById() {
        let country = this.state.countries.find(option => option.value === this.state.countries_id);
        let countryCode = "";
        if (country != null) {
            countryCode = country.code;
        }
        return countryCode;
    }

    getCountryList(callback) {
        const currentComponent = this;
        GafaFitSDKWrapper.getCountries(function (result) {
            currentComponent.setState(
                {
                    countries: result.map(function (item) {
                        return {label: item.name, value: item.id, code: item.code}
                    }),
                });
            if (isFunction(callback)) callback();
        });
    }

    getStatesListByCountry(callback) {
        const currentComponent = this;
        let countrySelected = currentComponent.findCountryCodeById();
        GafaFitSDKWrapper.getCountryStates(countrySelected, function (result) {
            currentComponent.setState(
                {
                    states: result.map(function (item) {
                        return {label: item.name, value: item.id}
                    })
                });
            if (isFunction(callback)) callback();
        });
    }

    handleChangeField(event) {
        let fieldName = event.target.id;
        let fieldValue = event.target.value;
        this.setState({
            [fieldName]: fieldValue
        });
    }

    handleChangePassword(event) {
        let passvalue = event.target.value;

        this.setState({
            password: passvalue,
        })
    }

    handleChangeConfirmationPassword(event) {
        let passvalue = event.target.value;

        this.setState({
            confirmationPassword: passvalue
        })
    }

    updateState(state) {
        this.setState(state);
    }

    handleSubmit(event) {
        event.preventDefault();
        let currentElement = this;
        currentElement.setState({serverError: '', saved: false});
        GafaFitSDKWrapper.putMe(this.state,
            currentElement.successSaveMeCallback.bind(this),
            currentElement.errorSaveMeCallback.bind(this));
    }

    successSaveMeCallback(result) {
        this.setState({saved: true});
        if (this.props.successCallback) {
            this.props.successCallback(result);
        }
    }


    errorSaveMeCallback(error) {
        this.setState({serverError: error});
    }

    render() {
        return (
            <div className="profile-info">
                <div className={'creditosUser col-md-6'}>
                    <Carousel interval={null} indicators={false}>
                        <Carousel.Item>
                            {/*<img width={350} height={200} src={'https://placehold.it/350x150?text=Slide1'}/>*/}
                            <Carousel.Caption>
                                <UserCredits/>
                            </Carousel.Caption>
                        </Carousel.Item>
                        <Carousel.Item>
                            {/*<img width={350} height={200} src={'https://placehold.it/350x150?text=Slide1'}/>*/}
                            <Carousel.Caption>
                                <UserMembership/>
                            </Carousel.Caption>
                        </Carousel.Item>
                    </Carousel>
                </div>
                <Tabs defaultActiveKey={2} id={'ProfileTabs'} animation={false}>
                    <Tab eventKey={1} title={'Clases'}>

                    </Tab>
                    <Tab eventKey={2} title={'Perfil'}>
                        <form onSubmit={this.handleSubmit.bind(this)}>
                            <UserInfo info={this.state} updateState={this.updateState.bind(this)}
                                      handleChangeField={this.handleChangeField.bind(this)}/>
                            <AddressInfo info={this.state} updateState={this.updateState.bind(this)}
                                         getStatesListByCountry={this.getStatesListByCountry.bind(this)}
                                         handleChangeField={this.handleChangeField.bind(this)}/>
                            <ContactInfo info={this.state} updateState={this.updateState.bind(this)}
                                         handleChangeField={this.handleChangeField.bind(this)}/>

                            <div className="col-md-12">
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
                    </Tab>
                    <Tab eventKey={3} title={'Formas de pago'}>

                    </Tab>
                    <Tab eventKey={4} title={'Cambiar Contraseña'}>
                        <form>
                            <div className={"row col-md-12 pt-4"}>
                                <h4 className={'col-md-12'}>
                                    Cambiar Contraseña
                                </h4>
                                <FormGroup className={'col-md-6'} controlId="password" bsSize={'large'}>
                                    <ControlLabel> Nueva Contraseña</ControlLabel>
                                    <FormControl type={'password'}
                                                 value={this.state.password}
                                                 onChange={this.handleChangePassword.bind(this)}/>
                                </FormGroup>

                                <FormGroup className={'col-md-6'} controlId="confirmationPassword" bsSize={'large'}>
                                    <ControlLabel>Confirmar Contraseña</ControlLabel>
                                    <FormControl type={'password'}
                                                 value={this.state.confirmationPassword}
                                                 onChange={this.handleChangeConfirmationPassword.bind(this)}/>
                                </FormGroup>
                            </div>

                            <div className="col-md-12">
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
                    </Tab>
                </Tabs>
            </div>
        );
    }
}

export default ProfileUserInfo;