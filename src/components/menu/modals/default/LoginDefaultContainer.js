import React from "react";
import {Modal} from "react-bootstrap";
import LoginDefault from "../../../auth/Login/Default/LoginDefault";
import StringStore from "../../../utils/Strings/StringStore";


export default class LoginDefaultContainer extends React.Component {

    render() {
        return (
            <Modal className="modal-login" show={this.props.showLogin} animation={false}
                   onHide={this.props.handleClickBack}>
                <div className="row">
                    <div className="col-lg-6">
                        <div className="container modal-grid__form">
                            <Modal.Header className="modal-login__header" closeButton>
                                <h2>{StringStore.get('BUTTON_LOGIN')}</h2>
                            </Modal.Header>
                            <Modal.Body className="modal-login__body">
                                <LoginDefault successCallback={this.props.successLoginCallback}/>
                            </Modal.Body>
                            <Modal.Footer className="modal-login__footer">
                                <nav className="modal-footer__nav">
                                    <ul>
                                        <li>
                                            <a onClick={this.props.handleClickRegister}> {StringStore.get('NOT_ACCOUNT_QUESTION')}</a>
                                        </li>

                                        <li>
                                            <a onClick={this.props.handleClickForgot}> {StringStore.get('FORGOT_PASSWORD_QUESTION')}</a>
                                        </li>
                                    </ul>
                                </nav>
                            </Modal.Footer>
                        </div>
                    </div>
                    <div className="col-lg-6 is-image">
                        <div className="modal-login__image"></div>
                    </div>
                </div>
            </Modal>
        )
    }
}