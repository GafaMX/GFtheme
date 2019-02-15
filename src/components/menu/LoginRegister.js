'use strict';

import React from "react";
import GafaFitSDKWrapper from "../utils/GafaFitSDKWrapper";
import Strings from "../utils/Strings/Strings_ES";
import Login from "../auth/Login";
import ProfileUserInfo from "../profile/info/ProfileUserInfo";
import Register from "../auth/Register";
import PasswordRecovery from "../auth/PasswordRecovery";
import {Modal} from "react-bootstrap";
import GlobalStorage from "../store/GlobalStorage";

class LoginRegister extends React.Component {
    constructor(props) {
        super(props);

        this.state = {
            showLogin: false,
            showRegister: false,
            showProfile: false,
            passwordRecovery: false,
            showButtons: true,
            serverError: "",
            email: null,
            token: null,
            me: null,
            loading: false
        };

        this._isMounted = false;
        GlobalStorage.addSegmentedListener(['me'], this.updateMe.bind(this));
    }

    updateMe() {
        this.setState({
            me: GlobalStorage.get('me')
        });
    }

    componentDidMount() {
        const query = new URLSearchParams(window.location.search);
        const token = query.get('token');
        const email = query.get('email');
        let currentComponent = this;
        if (token != null && email != null) {
            this.setState({
                showLogin: false,
                showRegister: false,
                showProfile: false,
                passwordRecovery: true,
                showButtons: false,
                email: email,
                token: token
            });
        }

        GafaFitSDKWrapper.getMeWithCredits(
            function (result) {
                GlobalStorage.set("me", result);
            }
        );

        if (this.props.setShowLogin) {
            this.handleClickLogin();
        }
        this._isMounted = true;
    }

    componentWillUnmount() {
        this._isMounted = false;
    }

    handleClickLogin() {
        this.setState({
            showLogin: true,
            showRegister: false,
            showProfile: false,
            passwordRecovery: false,
            showButtons: false
        });
    }

    handleClickRegister() {
        this.setState({
            showLogin: false,
            showRegister: true,
            showProfile: false,
            passwordRecovery: false,
            showButtons: false
        });
    }

    handleClickProfile() {
        this.setState({
            showLogin: false,
            showRegister: false,
            showProfile: true,
            passwordRecovery: false,
            showButtons: false
        });
    }

    handleClickForgot() {
        this.setState({
            showLogin: false,
            showRegister: false,
            showProfile: false,
            passwordRecovery: true,
            showButtons: false
        });
    }

    handleClickBack() {
        this.setState({
            showLogin: false,
            showRegister: false,
            showProfile: false,
            passwordRecovery: false,
            showButtons: true
        });
        if (this.props.setShowLogin) {
            this.props.setShowLogin(false);
        }
    }

    successLogoutCallback(result) {
        if (this.props.setShowLogin) {
            this.props.setShowLogin(false);
        }
        this.setState({
            showLogin: false,
            showRegister: false,
            showProfile: false,
            passwordRecovery: false,
            showButtons: true
        });
    }

    errorLogoutCallback(error) {
        this.setState({serverError: '', logged: false});
    }

    successLoginCallback(result) {
        if (this.props.setShowLogin) {
            this.props.setShowLogin(false);
        }
        if (this._isMounted) {
            let currentComponent = this;
            GafaFitSDKWrapper.getMeWithCredits(
                function (result) {
                    GlobalStorage.set("me", result);
                    currentComponent.setState({
                        showLogin: false,
                        showRegister: false,
                        showProfile: false,
                        passwordRecovery: false,
                        showButtons: true
                    });
                }
            );
        }
    }

    successProfileSaveCallback(result) {
        if (this._isMounted) {
            GlobalStorage.set("me", result);
        }
    }

    successRecoveryCallback() {
        this.setState({
            showLogin: false,
            showRegister: false,
            showProfile: false,
            passwordRecovery: false,
            showButtons: true
        });
        if (this.props.setShowLogin) {
            this.props.setShowLogin(false);
        }
    }

    handleClickLogout() {
        let currentElement = this;
        this.setState({serverError: ''});
        GafaFitSDKWrapper.logout(
            currentElement.successLogoutCallback.bind(this),
            currentElement.errorLogoutCallback.bind(this)
        );
    }

    render() {
        return (
            <div className="login-register col-md-12">
                {!this.state.me && this.state.showButtons && <div>
                    <a onClick={this.handleClickLogin.bind(this)}>{Strings.BUTTON_LOGIN}</a> /
                    <a onClick={this.handleClickRegister.bind(this)}> {Strings.BUTTON_REGISTER}</a>
                </div>}
                {this.state.me !== null && this.state.showButtons && <div>
                    <a onClick={this.handleClickProfile.bind(this)}>
                        {this.state.me != null ?
                            <div className="form-inline">
                                <p className="profile-button-first-name">{this.state.me.first_name}</p>
                                <p className="profile-button-last-name">&nbsp;{this.state.me.last_name}</p>
                                <p className="profile-button-credits-total">&nbsp;{this.state.me.creditsTotal}</p>
                            </div>
                            : Strings.BUTTON_PROFILE}
                    </a>
                </div>}

                <Modal className="modal-login" show={this.state.showLogin} animation={false}
                       onHide={this.handleClickBack.bind(this)}>
                    <Modal.Header className="modal-login-header" closeButton>
                        <Modal.Title>{Strings.BUTTON_LOGIN}</Modal.Title>
                    </Modal.Header>
                    <Modal.Body className="modal-login-body">
                        <Login successCallback={this.successLoginCallback.bind(this)}/>
                    </Modal.Body>
                    <Modal.Footer className="modal-login-footer">
                        <p>{Strings.NOT_ACCOUNT_QUESTION}
                            <a
                                onClick={this.handleClickRegister.bind(this)}> {Strings.BUTTON_REGISTER}</a>
                        </p>
                        <p>{Strings.FORGOT_PASSWORD_QUESTION}
                            <a
                                onClick={this.handleClickForgot.bind(this)}> {Strings.BUTTON_PASSWORD_FORGOT}</a>
                        </p>
                    </Modal.Footer>
                </Modal>

                <Modal className="modal-register" show={this.state.showRegister} animation={false}
                       onHide={this.handleClickBack.bind(this)}>
                    <Modal.Header className="modal-register-header" closeButton>
                        <Modal.Title>{Strings.BUTTON_REGISTER}</Modal.Title>
                    </Modal.Header>
                    <Modal.Body className="modal-register-body">
                        <Register/>
                    </Modal.Body>
                    <Modal.Footer className="modal-register-footer">
                        <p>{Strings.ACCOUNT_QUESTION}
                            <a
                                onClick={this.handleClickLogin.bind(this)}> {Strings.BUTTON_LOGIN}</a>
                        </p>
                        <p>{Strings.FORGOT_PASSWORD_QUESTION}<a
                            onClick={this.handleClickForgot.bind(this)}> {Strings.BUTTON_PASSWORD_FORGOT}</a></p>

                    </Modal.Footer>
                </Modal>

                <Modal className="modal-profile" show={this.state.showProfile} onHide={this.handleClickBack.bind(this)}
                       animation={false}>
                    <Modal.Header className="modal-profile-header" closeButton>
                        <Modal.Title>{Strings.BUTTON_PROFILE}</Modal.Title>
                    </Modal.Header>
                    <Modal.Body className="modal-profile-body">
                        <ProfileUserInfo successCallback={this.successProfileSaveCallback.bind(this)}/>
                    </Modal.Body>
                    <Modal.Footer className="modal-profile-footer">
                        <a onClick={this.handleClickLogout.bind(this)}>{Strings.BUTTON_LOGOUT}</a>
                    </Modal.Footer>
                </Modal>

                <Modal className="modal-password" show={this.state.passwordRecovery} animation={false}
                       onHide={this.handleClickBack.bind(this)}>
                    <Modal.Header className="modal-password-header" closeButton>
                        <Modal.Title>{Strings.BUTTON_PASSWORD_FORGOT}</Modal.Title>
                    </Modal.Header>
                    <Modal.Body className="modal-password-body">
                        <PasswordRecovery token={this.state.token} email={this.state.email}
                                          successCallback={this.successRecoveryCallback.bind(this)}/>
                    </Modal.Body>
                </Modal>

                <div className="panel panel-default mt-4 text-danger">
                    {this.state.serverError !== '' && <small>{this.state.serverError}</small>}
                </div>
                {this.state.loading &&
                <div className="modal-backdrop">
                    <div className="circle-loading"/>
                </div>}
            </div>
        );
    }
}

export default LoginRegister;