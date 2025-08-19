'use strict';

import React from "react";
import GafaFitSDKWrapper from "../utils/GafaFitSDKWrapper";
import Login from "../auth/Login";
import ProfileUserInfo from "../profile/info/ProfileUserInfo";
import Register from "../auth/Register";
import PasswordRecovery from "../auth/PasswordRecovery";
import GlobalStorage from "../store/GlobalStorage";
import IconRunningMan from "../utils/Icons/IconRunningMan";
//Estilos
import '../../styles/newlook/components/GFSDK-c-Login.scss';
import '../../styles/newlook/components/GFSDK-c-LoginPages.scss';
import '../../styles/newlook/elements/GFSDK-e-form.scss';
import '../../styles/newlook/elements/GFSDK-e-buttons.scss';
import StringStore from "../utils/Strings/StringStore";

class LoginRegisterPages extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            currentPage: 'login', // 'menu', 'login', 'register', 'profile', 'password-recovery'
            serverError: "",
            email: null,
            token: null,
            me: null,
            loading: false,
            triggeredByLogin: true,
            triggeredByRegister: true,
            preLoading: true
        };

        this._isMounted = false;
        this.updateMe = this.updateMe.bind(this);
        this.handlePopState = this.handlePopState.bind(this);
        GlobalStorage.addSegmentedListener(['me'], this.updateMe);
        this.handleClickLogout = this.handleClickLogout.bind(this);
        if (props.hasOwnProperty('block_after_login')) {
            GlobalStorage.set('block_after_login', props.block_after_login);
        }
    }

    static defaultProps() {
        return {
            initial: 'login',
            combineWaitlist: false,
            baseUrl: '/auth', // URL base para las páginas de autenticación
        };
    }

    componentDidMount() {
        const query = new URLSearchParams(window.location.search);
        const token = query.get('token');
        const email = query.get('email');
        const page = query.get('page');

        let currentComponent = this;
        
        // Determinar la página actual basada en la URL
        if (token != null && email != null) {
            this.setState({
                currentPage: 'password-recovery',
                email: email,
                token: token
            });
            this.updateUrl('password-recovery', { token, email });
        } else if (page) {
            this.setState({
                currentPage: page
            });
        }

        GafaFitSDKWrapper.getMeWithPurchase(
            function (result) {
                GlobalStorage.set("me", result);
                currentComponent.setState({
                    preLoading: false
                });
            }
        );

        if (this.props.setShowLogin) {
            this.setState({
                triggeredByLogin: false,
                currentPage: 'login'
            });
            this.updateUrl('login');
        }

        if (this.props.setShowRegister) {
            this.setState({
                triggeredByRegister: false,
                currentPage: 'register'
            });
            this.updateUrl('register');
        }

        // Agregar listener para el evento popstate (navegación del historial)
        window.addEventListener('popstate', this.handlePopState);

        this._isMounted = true;
    }

    componentWillUnmount() {
        // Limpiar el listener del evento popstate
        if (this.handlePopState) {
            window.removeEventListener('popstate', this.handlePopState);
        }
        
        // Limpiar el listener de GlobalStorage
        GlobalStorage.removeSegmentedListener(['me'], this.updateMe);
        
        this._isMounted = false;
    }

    updateMe() {
        this.setState({
            me: GlobalStorage.get('me')
        });
    }

    // Método para manejar la navegación del historial del navegador
    handlePopState() {
        const query = new URLSearchParams(window.location.search);
        const token = query.get('token');
        const email = query.get('email');
        const page = query.get('page');

        // Determinar la página actual basada en la URL actual
        if (token != null && email != null) {
            this.setState({
                currentPage: 'password-recovery',
                email: email,
                token: token
            });
        } else if (page) {
            this.setState({
                currentPage: page
            });
        } else {
            // Si no hay parámetros, volver al menú
            this.setState({
                currentPage: 'menu'
            });
        }
    }

    // Método para actualizar la URL sin recargar la página
    updateUrl(page, params = {}) {
        const url = new URL(window.location);
        url.searchParams.set('page', page);
        
        // Agregar parámetros adicionales
        Object.keys(params).forEach(key => {
            url.searchParams.set(key, params[key]);
        });
        
        window.history.pushState({}, '', url);
    }

    handleClickRegister() {
        this.setState({
            currentPage: 'register'
        });
        this.updateUrl('register');
    }

    handleClickLogin() {
        this.setState({
            currentPage: 'login'
        });
        this.updateUrl('login');
    }

    handleClickProfile() {
        this.setState({
            currentPage: 'profile'
        });
        this.updateUrl('profile');
    }

    handleClickRecovery() {
        this.setState({
            currentPage: 'password-recovery'
        });
        this.updateUrl('password-recovery');
    }

    handleClickBack() {
        const query = new URLSearchParams(window.location.search);
        const token = query.get('token');
        const email = query.get('email');

        this.setState({
            currentPage: 'menu'
        });

        if (this.props.setShowLogin) {
            this.props.setShowLogin(false);
        }

        if (this.props.setShowRegister) {
            this.props.setShowRegister(false);
        }

        // Si hay token y email, redirigir al origen
        if (token && email) {
            window.location.href = window.location.origin;
        } else {
            // Limpiar la URL y volver al menú
            const url = new URL(window.location);
            url.searchParams.delete('page');
            url.searchParams.delete('token');
            url.searchParams.delete('email');
            window.history.pushState({}, '', url);
        }
    }

    handleClickCancel() {
        const { currentPage } = this.state;
        
        // Si estamos en password-recovery, register o profile, ir al login
        if (currentPage === 'password-recovery' || currentPage === 'register' || currentPage === 'profile') {
            this.setState({
                currentPage: 'login'
            });
            this.updateUrl('login');
        } else {
            // Si estamos en login, volver al menú
            this.handleClickBack();
        }
    }

    successLogoutCallback(result) {
        if (this.props.setShowLogin) {
            this.props.setShowLogin(false);
        }

        if (this.props.setShowRegister) {
            this.props.setShowRegister(false);
        }
        
        this.setState({
            currentPage: 'menu'
        });

        GlobalStorage.set("me", null);
        
        // Limpiar URL de forma elegante sin recargar la página
        const url = new URL(window.location);
        url.searchParams.delete('page');
        url.searchParams.delete('token');
        url.searchParams.delete('email');
        window.history.pushState({}, '', url);
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
            GafaFitSDKWrapper.getMeWithPurchase(
                function (result) {
                    GlobalStorage.set("me", result);
                    if (!(currentComponent.props.hasOwnProperty('preventLoginStateChange') && currentComponent.props.preventLoginStateChange)) {
                        currentComponent.setState({
                            currentPage: 'menu'
                        });
                        // Limpiar URL después del login exitoso
                        const url = new URL(window.location);
                        url.searchParams.delete('page');
                        window.history.pushState({}, '', url);
                    }
                }
            );
        }
        this._isMounted = false;
    }

    successProfileSaveCallback(result) {
        if (this._isMounted) {
            GlobalStorage.set("me", result);
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

    renderPage() {
        const { currentPage, me, combineWaitlist } = this.state;
        
        switch (currentPage) {
            case 'login':
                return (
                    <div className="page-container">
                        <div className="Page-login__header">
                            <h2>{StringStore.get('BUTTON_LOGIN')}</h2>
                        </div>
                        <div className="Page-login__body">
                            <Login
                                triggeredByLogin={this.state.triggeredByLogin}
                                handleClickBack={this.handleClickBack.bind(this)}
                                successCallback={this.successLoginCallback.bind(this)}
                            />
                        </div>
                        <div className="Page-login__footer">
                            <nav className="nav">
                                <ul>
                                    <li>
                                        <a onClick={this.handleClickRegister.bind(this)}> {StringStore.get('NOT_ACCOUNT_QUESTION')}</a>
                                    </li>
                                    <li>
                                        <a onClick={this.handleClickRecovery.bind(this)}> {StringStore.get('FORGOT_PASSWORD_QUESTION')}</a>
                                    </li>
                                </ul>
                            </nav>
                        </div>
                    </div>
                );
                
            case 'register':
                return (
                    <div className="page-container">
                        <div className="Page-login__header">
                            <h2>{StringStore.get('BUTTON_REGISTER')}</h2>
                        </div>
                        <div className="Page-login__body">
                            <Register
                                triggeredByRegister={this.state.triggeredByRegister}
                                handleClickBack={this.handleClickBack.bind(this)}
                                successCallback={this.successLoginCallback.bind(this)}
                            />
                        </div>
                        <div className="Page-login__footer">
                            <nav className="nav">
                                <ul>
                                    <li>
                                        <a onClick={this.handleClickLogin.bind(this)}> {StringStore.get('ACCOUNT_QUESTION')}</a>
                                    </li>
                                    <li>
                                        <a onClick={this.handleClickRecovery.bind(this)}> {StringStore.get('FORGOT_PASSWORD_QUESTION')}</a>
                                    </li>
                                </ul>
                            </nav>
                        </div>
                        <div className="page-cancel">
                            <button 
                                className="btn-cancel" 
                                onClick={this.handleClickCancel.bind(this)}
                            >
                                {StringStore.get('BUTTON_CANCEL')}
                            </button>
                        </div>
                    </div>
                );
                
            case 'profile':
                return (
                    <div className="page-container-profile">
                        <div className="Page-profile__body">
                            <ProfileUserInfo
                                handleClickLogout={this.handleClickLogout}
                                successCallback={this.successProfileSaveCallback.bind(this)}
                                userData={me}
                                combineWaitlist={combineWaitlist}
                            />
                        </div>
                    </div>
                );
                
            case 'password-recovery':
                return (
                    <div className="page-container">
                        <div className="Page-login__header">
                            <h2>{StringStore.get('BUTTON_PASSWORD_FORGOT')}</h2>
                        </div>
                        <div className="Page-login__body">
                            <PasswordRecovery
                                token={this.state.token}
                                email={this.state.email}
                                handleClickBack={this.handleClickBack.bind(this)}
                            />
                        </div>
                        <div className="page-cancel">
                            <button 
                                className="btn-cancel" 
                                onClick={this.handleClickCancel.bind(this)}
                            >
                                {StringStore.get('BUTTON_CANCEL')}
                            </button>
                        </div>
                    </div>
                );
                
            default:
                return null;
        }
    }

    render() {
        let preC = 'GFSDK-c';
        let preE = 'GFSDK-e';
        let loginClass = preC + '-login';
        let buttonClass = preE + '-buttons';
        let {me, preLoading, currentPage} = this.state;
        let {initial, allowsPreLoading} = this.props;

        // Si estamos en una página específica, renderizar solo esa página
        if (currentPage !== 'menu') {
            return (
                <div className={loginClass + '__pages'}>
                    
                    {this.renderPage()}
                    <div className="text-danger">
                        {this.state.serverError !== '' && <small>{this.state.serverError}</small>}
                    </div>
                    {this.state.loading &&
                        <div className="page-backdrop">
                            <div className="circle-loading"/>
                        </div>}
                </div>
            );
        }

        // Renderizar el menú principal
        return (
            <div className={loginClass + '__menu' + ` ${preLoading && allowsPreLoading ? 'is-loading' : ''}`}>
                <div className={loginClass + '__menu-nav'}>
                    {this.state.triggeredByLogin || this.state.triggeredByRegister
                        ? (!this.state.me
                                ? <div
                                    className={'this-item ' + buttonClass + ' ' + buttonClass + '--icon' + ' is-primary not-logged'}
                                    onClick={initial === 'register' ? this.handleClickRegister.bind(this) : this.handleClickLogin.bind(this)}
                                >
                                    <IconRunningMan/>
                                </div>
                                : <div onClick={this.handleClickProfile.bind(this)}>
                                    {this.state.me != null
                                        ? <div
                                            className={'this-item ' + buttonClass + ' ' + buttonClass + '--icon' + ' is-primary'}>
                                            <IconRunningMan/>
                                        </div>
                                        : StringStore.get('BUTTON_PROFILE')
                                    }
                                </div>
                        )
                        : null
                    }

                    <div className="text-danger">
                        {this.state.serverError !== '' && <small>{this.state.serverError}</small>}
                    </div>
                    {this.state.loading &&
                        <div className="page-backdrop">
                            <div className="circle-loading"/>
                        </div>}
                </div>
            </div>
        );
    }
}

export default LoginRegisterPages; 