'use strict';

import React from "react";
import GafaFitSDKWrapper from "../../../utils/GafaFitSDKWrapper";
import Strings from "../../../utils/Strings/Strings_ES";
import Modal from "react-bootstrap/es/Modal";
import CloseIcon from "../../../utils/Icons/CloseIcon";
import GlobalStorage from "../../../store/GlobalStorage";

export default class Card extends React.Component {
    constructor(props) {
        super(props);

        this.handleAddNotification = this.handleAddNotification.bind(this);
    }

    handleAddNotification(){
        let currentComponent = this
        let {card, paymentMethod} = currentComponent.props;
        
        let obj =
            {
                'cardID': card.id,
                'paymentMethod': paymentMethod,
                'message': 'Estas seguro que quieres eliminar la tarjeta ●●●● ' + card.last4,
            }
        ;

        GlobalStorage.set('ConektaPaymentNotification', obj);
    }

    render(){
        let preC = 'GFSDK-c';
        let preE = 'GFSDK-e';
        let paymentClass = preC + '-payment';
        let buttonClass = preE + '-buttons';
        const {card} = this.props;

        return(
            <div className={paymentClass + '-card'}>
                <p>●●●● ●●●● ●●●● {card.last4}</p>
                <button className={buttonClass + "__close is-card qodef-btn qodef-btn-solid"} onClick={this.handleAddNotification}>
                    <CloseIcon />
                </button>
            </div>
        )
    }
}