'use strict';

import React from "react";
import GafaFitSDKWrapper from "../../../utils/GafaFitSDKWrapper";
import {ControlLabel, FormControl, FormGroup} from "react-bootstrap";
import Card from "../Payment/Card";
import GlobalStorage from "../../../store/GlobalStorage";


class PaymentMethods extends React.Component {
    constructor(props) {
        super(props);
        let me = GlobalStorage.get('me');

        this.state = {
            list: GlobalStorage.get('ConektaPaymentInfo'),
            cardNumber: null,
            cardPhone: me.phone,
            cardCVC: null,
            cardName: me.first_name + ' ' + me.last_name,
            cardExpMonth: null,
            cardExpYear: null,
        }

        this.onSuccessTokenHandler = this.onSuccessTokenHandler.bind(this);
        this.onFailTokenHandler = this.onFailTokenHandler.bind(this);
        GlobalStorage.addSegmentedListener(['ConektaPaymentInfo'], this.updateConektaInfo.bind(this))
    }

    handleChangeField(event) {
        let fieldName = event.target.id;
        let fieldValue = event.target.value;
        this.setState({
            [fieldName]: fieldValue
        }, () => {
            // this.validateField(fieldName, fieldValue)
        });
    };

    updateConektaInfo(){
        let currentComponent = this;

        currentComponent.setState({
            list: GlobalStorage.get('ConektaPaymentInfo'),
        });

        GlobalStorage.set('ConektaPaymentNotification', null);
    }

    handleSubmit(e){
        e.preventDefault();

        const currentComponent = this;
        let {cardNumber, cardName, cardExpYear, cardExpMonth, cardCVC} = currentComponent.state;

        Conekta.Token.create({
            "card": {
                "number": cardNumber,
                "name": cardName,
                "exp_year": cardExpYear,
                "exp_month": cardExpMonth,
                "cvc": cardCVC
            }},
            this.onSuccessTokenHandler,
            this.onFailTokenHandler
        );
    }

    onSuccessTokenHandler(token){
        const currentComponent = this;
        let {cardPhone} = currentComponent.state;

        if(token && cardPhone){
            GafaFitSDKWrapper.postUserAddPaymentOption(
                2,
                token.id,
                cardPhone,
                function (result) {
                    GlobalStorage.set('ConektaPaymentInfo', result.conekta);
                }
            );
        }
    };

    onFailTokenHandler(error){
        console.log('conekta err', error);
        // const messageTxt = `Ocurrió un error al completar el pago con Conekta. ${error.message_to_purchaser}`;
        // this.props.onGafaPayErrAction({
        //     err: error,
        //     message: messageTxt
        // });
        // cogoToast.error(messageTxt);
    };

    render() {
        let preC = 'GFSDK-c';
        let preE = 'GFSDK-e';
        let formClass = preE + '-form';
        let buttonClass = preE + '-buttons';
        let profileClass = preC + '-profile';
        let paymentClass = preC + '-payment';
        const {list, notification} = this.state;


        // Buscando tarjetas de conekta
        const ConektaCards = list
            ?   list.map((card, index) => {
                    return <Card key={index} card={card} paymentMethod={2} updatePaymentList={this.updatePaymentList}/>
                })
            :   null
        ;
        // Buscando tarjetas de conekta
        return (
            <div className={profileClass + '__section is-payment'}>
                <h4>Mis tarjetas</h4>
                <div className={paymentClass}>
                    <div className={paymentClass + "__card-container"}>
                    {this.state.list.length > 0
                        ?   <div>
                                { ConektaCards }
                            </div>
                        :   <div className="is-notification">
                                <h3>No cuentas con tarjetas para pagos</h3>
                            </div>
                    }
                    </div>
                    <hr class="GFSDK-e-form__divider"></hr>
                    <div className={paymentClass + "__addCard-container"}>
                        <form className={profileClass + '__form'} onSubmit={this.handleSubmit.bind(this)}>
                            <div className={profileClass + '__section is-addCard'}>
                                <FormGroup className={formClass + "__section is-CardNumber"} controlId="cardNumber">
                                    <ControlLabel className={formClass + "__label"}>Número de tarjeta</ControlLabel>
                                    <FormControl
                                        onChange={this.handleChangeField.bind(this)}
                                        className={formClass + "__input"}
                                        type={'text'}/>
                                </FormGroup>

                                <FormGroup className={formClass + "__section is-CardExpMonth"} controlId="cardExpMonth">
                                    <ControlLabel className={formClass + "__label"}>Mes (MM)</ControlLabel>
                                    <FormControl
                                        onChange={this.handleChangeField.bind(this)}
                                        className={formClass + "__input"}
                                        type={'text'}/>
                                </FormGroup>

                                <FormGroup className={formClass + "__section is-CardExpYear"} controlId="cardExpYear">
                                    <ControlLabel className={formClass + "__label"}>Año (AAAA)</ControlLabel>
                                    <FormControl
                                        onChange={this.handleChangeField.bind(this)}
                                        className={formClass + "__input"}
                                        type={'text'}/>
                                </FormGroup>

                                <FormGroup className={formClass + "__section is-CardCVC"} controlId="cardCVC">
                                    <ControlLabel className={formClass + "__label"}>CVC</ControlLabel>
                                    <FormControl
                                        onChange={this.handleChangeField.bind(this)}
                                        className={formClass + "__input"}
                                        type={'text'}/>
                                </FormGroup>

                                <FormGroup className={formClass + "__section is-CardName"} controlId="cardName">
                                    <ControlLabel className={formClass + "__label"}>Nombre de tarjeta</ControlLabel>
                                    <FormControl
                                        onChange={this.handleChangeField.bind(this)}
                                        className={formClass + "__input"}
                                        defaultValue={this.state.cardName}
                                        type={'text'}/>
                                </FormGroup>

                                <FormGroup className={formClass + "__section is-CardPhone"} controlId="cardPhone">
                                    <ControlLabel className={formClass + "__label"}>Télefono</ControlLabel>
                                    <FormControl
                                        onChange={this.handleChangeField.bind(this)}
                                        className={formClass + "__input"}
                                        defaultValue={this.state.cardPhone}
                                        type={'number'}/>
                                </FormGroup>
                            </div>
                            <div className={profileClass + '__section is-save'}>
                                <button
                                    type="submit"
                                    className={buttonClass + ' ' + buttonClass + "--submit is-primary"}
                                >
                                    Agregar tarjeta
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        )
    }
}

export default PaymentMethods;