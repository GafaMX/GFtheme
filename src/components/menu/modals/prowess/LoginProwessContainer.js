import React from "react";
import {Modal} from "react-bootstrap";
import Login from "../../../auth/Login/Login";
import Strings from "../../../utils/Strings/Strings_ES";
import './styles/LoginProwessContainer.scss'


export default class LoginProwessContainer extends React.Component{

    render(){
        return(
            <Modal className="modal-login" show={this.props.showLogin} animation={false} onHide={this.props.handleClickBack}>
                <div className="row">
                    <div className="col-lg-6">
                        <div className="container modal-grid__form">
                            <Modal.Header className="modal-login__header" closeButton>
                                <h2>{Strings.BUTTON_LOGIN}</h2>
                            </Modal.Header>
                            <Modal.Body className="modal-login__body">
                                <Login template={this.props.template} successCallback={this.props.successLoginCallback}/>
                            </Modal.Body>
                            <Modal.Footer className="modal-login__footer">
                            <nav className="modal-footer__nav">
                                <ul>
                                    <li>
                                        <a onClick={this.props.handleClickRegister}> {Strings.NOT_ACCOUNT_QUESTION}</a>
                                    </li>

                                    <li>
                                        <a onClick={this.props.handleClickForgot}> {Strings.FORGOT_PASSWORD_QUESTION}</a>
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