import React from "react";
import {Modal} from "react-bootstrap";
import PasswordRecovery from "../../../auth/PasswordRecovery/PasswordRecovery";
import Strings from "../../../utils/Strings/Strings_ES";
import StringStore from "../../../utils/Strings/StringStore";
// import './styles/LoginProwessContainer.scss'


export default class LoginProwessContainer extends React.Component{

    render(){
        return(
            <Modal className="modal-password" show={this.props.passwordRecovery} animation={false} onHide={this.props.handleClickBack}>
                <div className="row">
                    <div className="col-lg-6">
                        <div className="container">
                            <Modal.Header className="modal-password-header" closeButton>
                                <h2>{StringStore.get('BUTTON_PASSWORD_FORGOT')}</h2>
                            </Modal.Header>
                            <Modal.Body className="modal-password-body">
                                <PasswordRecovery template={this.props.template} token={this.props.token} email={this.props.email} successCallback={this.props.successRecoveryCallback}/>
                            </Modal.Body>
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