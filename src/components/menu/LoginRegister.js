'use strict';

import React from "react";
import GafaFitSDKWrapper from "../utils/GafaFitSDKWrapper";
import Strings from "../utils/Strings/Strings_ES";
import Login from "../auth/Login";
import ProfileUserInfo from "../profile/info/ProfileUserInfo";
import ProfileUserImage from "../profile/info/ProfileUserImage";
import ProfileUserSidebar from "../profile/info/ProfileUserSidebar";
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
    handleCloseProfile(){
        this.setState({
            showLogin: false,
            showRegister: false,
            showProfile: false,
            passwordRecovery: false,
            showButtons: true
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
            <div className="container">
                <div className="logo-element">
                    <a href="#">GAFAFIT</a>
                </div>
                <div className="login-register">
                    {!this.state.me && this.state.showButtons && <nav className="nav is-login">
                        <ul>
                            <li>
                                <a onClick={this.handleClickLogin.bind(this)}>{Strings.BUTTON_LOGIN}</a>
                            </li>
                            <li>
                                <a onClick={this.handleClickRegister.bind(this)}> {Strings.BUTTON_REGISTER}</a>
                            </li>
                        </ul>
                    </nav>}
                    {this.state.me !== null && this.state.showButtons && <div>
                        <a onClick={this.handleClickProfile.bind(this)}>
                            {this.state.me != null ?
                                <div className="profile-data">
                                    <p className="profile-button-first-name">{this.state.me.first_name}</p>
                                    <p className="profile-button-last-name">&nbsp;{this.state.me.last_name}</p>
                                    <p className="profile-button-credits-total">&nbsp;{this.state.me.creditsTotal}</p>
                                </div>
                                : Strings.BUTTON_PROFILE}
                        </a>
                    </div>}

                    <Modal className="modal-login" show={this.state.showLogin} animation={false}
                        onHide={this.handleClickBack.bind(this)}>
                        <div className="row">
                            <div className="col-lg-6">
                                <div className="container">
                                    <Modal.Header className="modal-login__header" closeButton>
                                        <Modal.Title className="section-title container text-center">{Strings.BUTTON_LOGIN}</Modal.Title>
                                        <hr></hr>
                                    </Modal.Header>
                                    <Modal.Body className="modal-login__body">
                                        <Login successCallback={this.successLoginCallback.bind(this)}/>
                                    </Modal.Body>
                                    <Modal.Footer className="modal-login__footer ">
                                    <nav className="nav">
                                        <ul>
                                            <li>
                                                <a onClick={this.handleClickRegister.bind(this)}> {Strings.NOT_ACCOUNT_QUESTION}</a>
                                            </li>

                                            <li>
                                                <a onClick={this.handleClickForgot.bind(this)}> {Strings.FORGOT_PASSWORD_QUESTION}</a>
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

                    <Modal className="modal-register" show={this.state.showRegister} animation={false}
                        onHide={this.handleClickBack.bind(this)}>
                        <div className="row">
                            <div className="col-lg-6">
                                <div className="container">
                                    <Modal.Header className="modal-register__header" closeButton>
                                        <Modal.Title className="section-title container text-center">{Strings.BUTTON_REGISTER}</Modal.Title>
                                        <hr></hr>
                                    </Modal.Header>
                                    <Modal.Body className="modal-register__body">
                                        <Register/>
                                    </Modal.Body>
                                    <Modal.Footer className="modal-register__footer">
                                        <nav className="nav">
                                            <ul>
                                                <li>
                                                    <a onClick={this.handleClickLogin.bind(this)}> {Strings.ACCOUNT_QUESTION}</a>
                                                </li>
                                                <li>
                                                    <a onClick={this.handleClickForgot.bind(this)}> {Strings.FORGOT_PASSWORD_QUESTION}</a>
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

                    <Modal className="modal-profile" show={this.state.showProfile} onHide={this.handleClickBack.bind(this)} animation={false}>
                        <div className="row">
                            <div className="col-lg-2 col-xl-3 modal-profile__image">
                                <div className="modal-profile__image-image">
                                </div>
                                <div className="modal-profile__image-nav">
                                    <ul>
                                        <li className="nav-item">
                                            <a>Regresar al sitio</a>
                                        </li>
                                        <li className="nav-item">
                                            <a onClick={this.handleClickLogout.bind(this)}>{Strings.BUTTON_LOGOUT}</a>
                                        </li>
                                    </ul>
                                </div>
                            </div>
                            <div className="col-lg-10 col-xl-9 modal-profile__body">
                                <div className="container-fluid">
                                    <div className="row">
                                        <div className="col-lg-3 profile-intro">
                                            <div className="container">
                                                <ProfileUserImage / >
                                                <ProfileUserSidebar / >
                                            </div>
                                        </div>
                                        <div className="col-lg-9 profile-content">
                                            <Modal.Body className="modal-profile__body">
                                                <ProfileUserInfo successCallback={this.successProfileSaveCallback.bind(this)}/>
                                            </Modal.Body>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </Modal>

                    <Modal className="modal-password" show={this.state.passwordRecovery} animation={false}
                        onHide={this.handleClickBack.bind(this)}>
                        <div className="row">
                            <div className="col-lg-6">
                                <div className="container">
                                    <Modal.Header className="modal-password-header" closeButton>
                                        <Modal.Title className="section-title container text-center">{Strings.BUTTON_PASSWORD_FORGOT}</Modal.Title>
                                        <hr></hr>
                                    </Modal.Header>
                                    <Modal.Body className="modal-password-body">
                                        <PasswordRecovery token={this.state.token} email={this.state.email}
                                                        successCallback={this.successRecoveryCallback.bind(this)}/>
                                    </Modal.Body>
                                </div>
                            </div>
                            <div className="col-lg-6">
                                <div className="modal-login__image"></div>
                            </div>
                        </div>
                    </Modal>

                    <div className="text-danger">
                        {this.state.serverError !== '' && <small>{this.state.serverError}</small>}
                    </div>
                    {this.state.loading &&
                    <div className="modal-backdrop">
                        <div className="circle-loading"/>
                    </div>}
                </div>
            </div>
        );
    }
}

export default LoginRegister;