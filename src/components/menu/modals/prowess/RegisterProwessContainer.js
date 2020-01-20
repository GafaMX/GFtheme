import React from "react";
import {Modal} from "react-bootstrap";
import Register from "../../../auth/Register/Register";
import Strings from "../../../utils/Strings/Strings_ES";

export default class RegisterProwessContainer extends React.Component{
    render(){
        return(
            <Modal className="modal-register" show={this.props.showRegister} animation={false} onHide={this.props.handleClickBack}>
                <div className="row">
                    <div className="col-lg-6">
                        <div className="container">
                            <Modal.Header className="modal-register__header" closeButton>
                                <h2>{Strings.BUTTON_REGISTER}</h2>
                            </Modal.Header>
                            <Modal.Body className="modal-register__body">
                                <Register template = {this.props.template}/>
                            </Modal.Body>
                            <Modal.Footer className="modal-register__footer">
                                <nav className="modal-footer__nav">
                                    <ul>
                                        <li>
                                            <a onClick={this.props.handleClickLogin}> {Strings.ACCOUNT_QUESTION}</a>
                                        </li>
                                        <li>
                                            <a onClick={this.props.handleClickForgot}> {Strings.FORGOT_PASSWORD_QUESTION}</a>
                                        </li>
                                    </ul>
                                </nav>
                            </Modal.Footer>
                        </div>
                    </div>
                    <div className="col-lg-6">
                        <div className="modal-login__image"></div>
                    </div>
                </div>
            </Modal>
        )
    }
}