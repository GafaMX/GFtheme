'use strict';

import React from "react";
import GafaFitSDKWrapper from "../utils/GafaFitSDKWrapper";
import Strings from "../utils/Strings/Strings_ES";
import Login from "../auth/Login";
import ProfileUserInfo from "../profile/info/ProfileUserInfo";
import Register from "../auth/Register";
import PasswordRecovery from "../auth/PasswordRecovery";

class LoginRegister extends React.Component {
    constructor(props) {
        super(props);

        this.state = {
            isAuthenticated: GafaFitSDKWrapper.isAuthenticated(),
            showLogin: false,
            showRegister: false,
            showProfile: false,
            passwordRecovery: false,
            showButtons: true,
            serverError: "",
            email: null,
            token: null,
            me: null
        };
    }

    componentDidMount() {
        const query = new URLSearchParams(window.location.search);
        const token = query.get('token');
        const email = query.get('email');
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
        let currentComponent = this;
        GafaFitSDKWrapper.getMeWithCredits(
            function (result) {
                currentComponent.setState({
                    me: result
                });
            }
        );
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
    }

    successLogoutCallback(result) {
        this.setState({
            isAuthenticated: false,
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
        let currentComponent = this;
        GafaFitSDKWrapper.getMeWithCredits(
            function (result) {
                currentComponent.setState({
                    isAuthenticated: true,
                    showLogin: false,
                    showRegister: false,
                    showProfile: false,
                    passwordRecovery: false,
                    showButtons: true,
                    me: result
                });
            }
        );
    }

    successRecoveryCallback() {
        this.setState({
            isAuthenticated: false,
            showLogin: false,
            showRegister: false,
            showProfile: false,
            passwordRecovery: false,
            showButtons: true
        });
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
                {!this.state.isAuthenticated && this.state.showButtons && <div>
                    <a onClick={this.handleClickLogin.bind(this)}>{Strings.BUTTON_LOGIN}</a> /
                    <a onClick={this.handleClickRegister.bind(this)}> {Strings.BUTTON_REGISTER}</a>
                </div>}
                {this.state.isAuthenticated && this.state.showButtons && <div>
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
                {this.state.showLogin &&
                <div>
                    <Login successCallback={this.successLoginCallback.bind(this)}/>
                    <p>{Strings.NOT_ACCOUNT_QUESTION}
                        <a
                            onClick={this.handleClickRegister.bind(this)}> {Strings.BUTTON_REGISTER}</a>
                    </p>
                    <p>{Strings.FORGOT_PASSWORD_QUESTION}
                        <a
                            onClick={this.handleClickForgot.bind(this)}> {Strings.BUTTON_PASSWORD_FORGOT}</a>
                    </p>
                </div>
                }
                {this.state.showRegister &&
                <div>
                    <Register/>
                    <p>{Strings.ACCOUNT_QUESTION}
                        <a
                            onClick={this.handleClickLogin.bind(this)}> {Strings.BUTTON_LOGIN}</a>
                    </p>
                    <div>
                        <p>{Strings.FORGOT_PASSWORD_QUESTION}<a
                            onClick={this.handleClickForgot.bind(this)}> {Strings.BUTTON_PASSWORD_FORGOT}</a></p>
                    </div>
                </div>
                }
                {this.state.showProfile &&
                <div>
                    <ProfileUserInfo/>
                    <a onClick={this.handleClickLogout.bind(this)}>{Strings.BUTTON_LOGOUT}</a>
                </div>
                }
                {this.state.passwordRecovery &&
                <PasswordRecovery token={this.state.token} email={this.state.email}
                                  successCallback={this.successRecoveryCallback.bind(this)}/>}
                <div className="panel panel-default mt-4 text-danger">
                    {this.state.serverError !== '' && <small>{this.state.serverError}</small>}
                </div>
                {!this.state.showButtons && <div>
                    <a onClick={this.handleClickBack.bind(this)}>{Strings.BUTTON_BACK}</a>
                </div>}
            </div>
        );
    }
}

export default LoginRegister;