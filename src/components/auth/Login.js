'use strict';

import React from "react";
import {FormControl, FormGroup} from "react-bootstrap";
import {FormErrors} from "../form/FormErrors";
import GlobalStorage from "../store/GlobalStorage";
import GafaFitSDKWrapper from "../utils/GafaFitSDKWrapper";
import StringStore from "../utils/Strings/StringStore";

class Login extends React.Component {
    constructor(props) {
        super(props);

        this.state = {
            email: "",
            password: "",
            formErrors: {email: '', password: ''},
            emailValid: false,
            passwordValid: false,
            formValid: false,
            serverError: '',
            logged: false,
        };
    }

    validateField(fieldName, value) {
        let fieldValidationErrors = this.state.formErrors;
        let emailValid = this.state.emailValid;
        let passwordValid = this.state.passwordValid;

        switch (fieldName) {
            case 'email':
                emailValid = this.validateEmail(value, fieldValidationErrors);
                break;
            case 'password':
                passwordValid = this.validatePassword(value, fieldValidationErrors);
                break;
            default:
                break;
        }
        this.setState({
            formErrors: fieldValidationErrors,
            emailValid: emailValid,
            passwordValid: passwordValid
        }, this.validateForm);
    }

    validatePassword(value, fieldValidationErrors) {
        let passwordValid = value.length >= 6;
        fieldValidationErrors.password = passwordValid ? '' : StringStore.get('VALIDATION_PASSWORD');
        return passwordValid;
    }

    validateEmail(value, fieldValidationErrors) {
        let emailValid = value.match(/^([\w.%+-]+)@([\w-]+\.)+([\w]{2,})$/i);
        fieldValidationErrors.email = emailValid ? '' : StringStore.get('VALIDATION_EMAIL');
        return emailValid;
    }

    validateForm() {
        this.setState({formValid: this.state.emailValid && this.state.passwordValid});
    }

    handleChangeField(event) {
        let fieldName = event.target.id;
        let fieldValue = event.target.value;
        this.setState({
            [fieldName]: fieldValue
        }, () => {
            this.validateField(fieldName, fieldValue)
        });
    };

    handleSubmit(event) {
        event.preventDefault();
        let currentElement = this;
        currentElement.setState({serverError: ''});
        GafaFitSDKWrapper.getToken(this.state.email, this.state.password,
            currentElement.successLoginCallback.bind(currentElement),
            currentElement.errorLoginCallback.bind(currentElement));
    };

    successLoginCallback(result) {
        let comp = this;
        this.setState({logged: true});

        if (this.props.successCallback) {
            this.props.successCallback(result);

            if (!GlobalStorage.get('block_after_login')) {
                if (window.GFtheme.combo_id != null) {
                    this.buyComboAfterLogin();
                }

                if (window.GFtheme.membership_id != null) {
                    this.buyMembershipAfterLogin();
                }

                if (window.GFtheme.meetings_id != null && window.GFtheme.location_slug != null) {
                    this.reserveMeetingAfterLogin();
                }

                if (!window.GFtheme.meetings_id &&
                    !window.GFtheme.location_slug &&
                    !window.GFtheme.membership_id &&
                    !window.GFtheme.combo_id) {
                    comp.props.handleClickBack();
                }
            } else {
                comp.props.handleClickBack();
            }
        }
    }

    errorLoginCallback(error) {
        this.setState({serverError: error, logged: false});
    }

    /**
     * Abre visualmente el contenedor [data-gf-theme="fancy"] (agrega las clases
     * `active`/`show` que su CSS requiere para dejar de estar en opacity:0 y
     * pointer-events:none) y engancha el boton de cerrar una vez que el
     * contenido llegue. Sin esto, el fancy se rellenaba de contenido pero
     * quedaba invisible/no interactivo: CalendarMeeting/ComboItem/MembershipItem
     * ya hacen esto para el flujo de click directo estando logueado, pero el
     * flujo de "comprar/reservar despues de hacer login" (mas abajo) nunca lo
     * hacia.
     */
    openFancyContainerAndWireClose() {
        const fancy = document.querySelector('[data-gf-theme="fancy"]');
        fancy.classList.add('active');

        setTimeout(function () {
            fancy.classList.add('show');
        }, 400);

        function getFancy() {
            if (document.querySelector('[data-gf-theme="fancy"]').firstChild) {
                const closeFancy = document.getElementById('CreateReservationFancyTemplate--Close');

                closeFancy.addEventListener('click', function (e) {
                    var event_before = new Event('buq__reservation_fancy_before_closed');
                    dispatchEvent(event_before);
                    fancy.removeChild(document.querySelector('[data-gf-theme="fancy"]').firstChild);

                    fancy.classList.remove('show');

                    setTimeout(function () {
                        fancy.classList.remove('active');
                        fancy.innerHTML = '<div class="spinner"><div class="bounce1"></div><div class="bounce2"></div><div class="bounce3"></div></div>';
                    }, 400);
                });
            } else {
                setTimeout(getFancy, 1000);
            }
        }

        return getFancy;
    }

    buyComboAfterLogin() {
        let comp = this;
        let getFancy = this.openFancyContainerAndWireClose();

        GafaFitSDKWrapper.getFancyForBuyCombo(
            window.GFtheme.brand_slug,
            window.GFtheme.location_slug,
            window.GFtheme.combo_id,
            function (result) {
                comp.props.handleClickBack();
                window.GFtheme.combo_id = null;
                window.GFtheme.brand_slug = null;
                window.GFtheme.location_slug = null;
                getFancy();
            });
    }

    buyMembershipAfterLogin() {
        let comp = this;
        let getFancy = this.openFancyContainerAndWireClose();

        GafaFitSDKWrapper.getFancyForBuyMembership(
            window.GFtheme.brand_slug,
            window.GFtheme.location_slug,
            window.GFtheme.membership_id,
            function (result) {
                comp.props.handleClickBack();
                window.GFtheme.membership_id = null;
                window.GFtheme.brand_slug = null;
                window.GFtheme.location_slug = null;
                getFancy();
            });
    }

    reserveMeetingAfterLogin() {
        let comp = this;
        let getFancy = this.openFancyContainerAndWireClose();

        GafaFitSDKWrapper.getFancyForMeetingReservation(
            window.GFtheme.brand_slug,
            window.GFtheme.location_slug,
            window.GFtheme.meetings_id,
            function (result) {
                comp.props.handleClickBack();
                window.GFtheme.meetings_id = null;
                window.GFtheme.location_slug = null;
                window.GFtheme.brand_slug = null;
                getFancy();
            });
    }

    render() {
        let preE = 'GFSDK-e';
        let buttonClass = preE + '-buttons';
        let formClass = preE + '-form';

        return (
            <div className="login auth">
                <form onSubmit={this.handleSubmit.bind(this)}>
                    <FormGroup className={formClass + "__section"} controlId="email" bsSize="large">
                        {/* <ControlLabel className={formClass + "__label"}>{StringStore.get('LABEL_EMAIL')}</ControlLabel> */}
                        <FormControl
                            className={formClass + "__input"}
                            autoFocus
                            placeholder={StringStore.get('LABEL_EMAIL')}
                            type="email"
                            value={this.state.email}
                            onChange={this.handleChangeField.bind(this)}
                        />
                    </FormGroup>
                    <FormGroup className={formClass + "__section"} controlId="password" bsSize="large">
                        {/* <ControlLabel className={formClass + "__label"}>{StringStore.get('LABEL_PASSWORD')}</ControlLabel> */}
                        <FormControl
                            className={formClass + "__input"}
                            value={this.state.password}
                            placeholder={StringStore.get('LABEL_PASSWORD')}
                            onChange={this.handleChangeField.bind(this)}
                            type="password"
                        />
                    </FormGroup>
                    <button
                        className={buttonClass + ' ' + buttonClass + "--submit is-primary"}
                        disabled={!this.state.formValid}
                        type="submit"
                    >
                        {StringStore.get('BUTTON_LOGIN')}
                    </button>
                    <div className="text-danger">
                        <FormErrors formErrors={this.state.formErrors}/>
                        {this.state.serverError !== '' && <small>{this.state.serverError}</small>}
                    </div>
                    <div className="text-success">
                        {this.state.logged && <small>{StringStore.get('LOGIN_SUCCESS')}</small>}
                    </div>
                </form>
            </div>
        );
    }
}

export default Login;