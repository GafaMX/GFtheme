'use strict';

import React from "react";
import GafaFitSDKWrapper from "../../../utils/GafaFitSDKWrapper";
import Strings from "../../../utils/Strings/Strings_ES";
import Modal from "react-bootstrap/es/Modal";
// import CloseIcon from "../../../utils/Icons/CloseIcon";

export default class Card extends React.Component {
    constructor(props) {
        super(props);

        this.state = {
            showDelete:false,
        }
    }

    handleShowDelete(){
        this.setState({
            showDelete:true
        })
    }

    handleClickBack(){
        this.setState({
            showDelete:false,
        })
    }

    handleClick(e){
        e.preventDefault();
        
        let currentComponent = this;
        const {card} = currentComponent.props;
        const {paymentMethod} = currentComponent.props;
        GafaFitSDKWrapper.postUserRemovePaymentOption(
            paymentMethod,
            card.id,
            function(result){
                window.location.reload();
            }
        );
    }

    render(){
        const {card} = this.props;

        return(
            <div className={'Payment_item is-card'}>
                <h3>●●●● ●●●● ●●●● {card.last4}</h3>
                <button onClick={this.handleShowDelete.bind(this)}>Delete</button>

                <Modal className={'modal-cancelation'} show={this.state.showDelete} animation={false}
                       onHide={this.handleClickBack.bind(this)}>

                    <div className="row">
                        <div className="col-lg-12 col-xl-12 modal-cancelation__body">
                            <div className="container">
                                <Modal.Header className={'modal-cancelation-header'} closeButton>
                                    <Modal.Title>{Strings.CANCELATION}</Modal.Title>
                                </Modal.Header>
                                <Modal.Body className={'modal-cancelation-body'}>
                                    <h4>{Strings.CANCELATIONMESSAGE}</h4>

                                </Modal.Body>
                                <Modal.Footer className={'modal-reservation-footer'}>
                                    <div className="GFSDK-form__section" id="cancel-class">
                                        <button type="button" className="qodef-btn qodef-btn-solid btn btn-lg btn-primary btn-block" onClick={this.handleClick.bind(this)}>
                                            {/* <Glyphicon glyph="ok-circle" />  */}
                                            {Strings.BUTTON_ACCEPT}
                                        </button>
                                        <button type="button" className="qodef-btn qodef-btn-solid btn btn-lg btn-primary btn-block" onClick={this.handleClickBack.bind(this)}>
                                            {/* <Glyphicon glyph="remove" />  */}
                                            {Strings.BUTTON_CANCEL}
                                        </button>
                                    </div>
                                </Modal.Footer>
                            </div>
                        </div>
                    </div>
                </Modal>
            </div>
        )
    }
}