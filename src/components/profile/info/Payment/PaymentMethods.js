'use strict';

import React from "react";
import GafaFitSDKWrapper from "../../../utils/GafaFitSDKWrapper";
import {ControlLabel, FormControl, FormGroup} from "react-bootstrap";
import Card from "../Payment/Card";

class PaymentMethods extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            list: [],
        }
    }

    componentDidMount() {
        const currentComponent = this;
        GafaFitSDKWrapper.getUserPaymentInfo('', function (result) {
            currentComponent.setState({
                list: result.conekta,
            });
        });
    }

    handleSubmit(){
        console.log('Token Send');
    }

    render() {
        let preC = 'GFSDK-c';
        let preE = 'GFSDK-e';
        let formClass = preE + '-form';
        let buttonClass = preE + '-buttons';
        let profileClass = preC + '-profile';
        const {list} = this.state;

        // Buscando tarjetas de conekta
        const ConektaCards = list
            ?   list.map((card, index) => {
                    return <Card key={index} card={card} paymentMethod={2} updatePaymentList={this.updatePaymentList}/>
                })
            :   null
        ;
        // Buscando tarjetas de conekta
        return (
            <div>
                <div className={profileClass + '__section is-payment'}>
                    {this.state.list.length > 0
                        ?   <div>{ ConektaCards }</div>
                        :   <div className="is-empty">
                                <div className="is-notification">
                                    <h3>No cuentas con tarjetas para pagos</h3>
                                </div>
                            </div>
                    }
                </div>
                <div className={profileClass + '__section is-addPayment'}>
                    <form className={profileClass + '__form is-UserConf'} onSubmit={this.handleSubmit.bind(this)}>
                        <div className={profileClass + '__section is-addCard'}>
                            <FormGroup className={formClass + "__section is-CardPhone"} controlId="cardPhone">
                                <ControlLabel className={formClass + "__label"}>Télefono</ControlLabel>
                                <FormControl className={formClass + "__input"} type={'text'}/>
                            </FormGroup>

                            <FormGroup className={formClass + "__section is-CardNumber"} controlId="cardNumber">
                                <ControlLabel className={formClass + "__label"}>Número de tarjeta</ControlLabel>
                                <FormControl className={formClass + "__input"} type={'text'}/>
                            </FormGroup>

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
        )
    }
}

export default PaymentMethods;