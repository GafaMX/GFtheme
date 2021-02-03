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
import IconRunningMan from "../utils/Icons/IconRunningMan";
import CloseIcon from "../utils/Icons/CloseIcon";

//Estilos
import '../../styles/newlook/components/GFSDK-c-Login.scss';
import '../../styles/newlook/thirdParties/modalComp.scss';
import '../../styles/newlook/elements/GFSDK-e-form.scss';
import '../../styles/newlook/elements/GFSDK-e-buttons.scss';

class LoginRegister extends React.Component {
   constructor(props) {
      super(props);
      this.state = {
         showLogin: false,
         showRegister: false,
         showProfile: false,
         passwordRecovery: false,
         serverError: "",
         email: null,
         token: null,
         me: null,
         loading: false,
         triggeredByLogin: true,
         triggeredByRegister: true,
      };

      this._isMounted = false;
      GlobalStorage.addSegmentedListener(['me'], this.updateMe.bind(this));
      this.handleClickLogout = this.handleClickLogout.bind(this);
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
            email: email,
            token: token
         });
      }

      GafaFitSDKWrapper.getMeWithPurchase(
         function (result) {
            GlobalStorage.set("me", result);
         }
      );

      if(token && email){
         this.handleClickRecovery.bind(this);
      }

      if (this.props.setShowLogin) {
         this.setState({
            triggeredByLogin: false
         });
         this.handleClickLogin();
      }

      if (this.props.setShowRegister) {
         this.setState({
            triggeredByRegister: false
         });
         this.handleClickRegister();
      }

      this._isMounted = true;
   }

   // componentWillUnmount() {
   //     this._isMounted = false;
   // }

   updateMe() {
      this.setState({
         me: GlobalStorage.get('me')
      });
   }

   handleClickRegister() {
      this.setState({
         showLogin: false,
         showRegister: true,
         showProfile: false,
         passwordRecovery: false,
      });
   }

   handleClickLogin() {
      this.setState({
         showLogin: true,
         showRegister: false,
         showProfile: false,
         passwordRecovery: false,
      });
   }

   handleClickProfile() {
      this.setState({
         showLogin: false,
         showRegister: false,
         showProfile: true,
         passwordRecovery: false,
      });
   }
   handleCloseProfile(){
      this.setState({
         showLogin: false,
         showRegister: false,
         showProfile: false,
         passwordRecovery: false,
      });
   }

   handleClickRecovery() {
      this.setState({
         showLogin: false,
         showRegister: false,
         showProfile: false,
         passwordRecovery: true,
      });
   }

   handleClickBack() {
      const query = new URLSearchParams(window.location.search);
      const token = query.get('token');
      const email = query.get('email');

      this.setState({
         showLogin: false,
         showRegister: false,
         showProfile: false,
         passwordRecovery: false,
      });

      if (this.props.setShowLogin) {
         this.props.setShowLogin(false);
      }

      if (this.props.setShowRegister) {
         this.props.setShowRegister(false);
      }

      if(token && email){
         location.replace(window.location.origin);
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
         showLogin: false,
         showRegister: false,
         showProfile: false,
         passwordRecovery: false,
      });

      GlobalStorage.set("me", null);
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
               currentComponent.setState({
                  showLogin: false,
                  showRegister: false,
                  showProfile: false,
                  passwordRecovery: false,
               });
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

    render() {

        let preC = 'GFSDK-c';
        let preE = 'GFSDK-e';
        let loginClass = preC + '-login';
        let buttonClass = preE + '-buttons';
        let {me} = this.state;

        const combo = !window.GFtheme.combo_id ? null : window.GFtheme.combo_id;

        return (
            <div className={loginClass + '__menu'}>
                <div className={loginClass + '__menu-nav'}>
                    {this.state.triggeredByLogin || this.state.triggeredByRegister
                        ?  (!this.state.me
                              ?   <div className={'this-item ' + buttonClass + ' ' + buttonClass + '--icon' + ' is-primary not-logged'} onClick={this.handleClickRegister.bind(this)}>
                                    <IconRunningMan />
                                 </div>
                              :   <div onClick={this.handleClickProfile.bind(this)}>
                                    {this.state.me != null 
                                       ?   <div className={'this-item ' + buttonClass + ' ' + buttonClass + '--icon' + ' is-primary'}>
                                             <IconRunningMan />
                                          </div>
                                       :   Strings.BUTTON_PROFILE
                                    }
                                 </div>

                           )
                        :   null
                    }

                     <Modal className="modal-login" show={this.state.showLogin} onHide={this.handleClickBack.bind(this)}>
                        <div className="modal-login__container">  
                           <div className="modal-login__close" onClick={this.handleClickBack.bind(this)}>
                              <CloseIcon />
                           </div>
                           <Modal.Header className="modal-login__header">
                                 <Modal.Title className="section-title container">{Strings.BUTTON_LOGIN}</Modal.Title>
                           </Modal.Header>
                           <Modal.Body className="modal-login__body">
                                 <Login 
                                    triggeredByLogin={this.state.triggeredByLogin} 
                                    handleClickBack={this.handleClickBack.bind(this)} 
                                    successCallback={this.successLoginCallback.bind(this)}
                                 />
                           </Modal.Body>
                           <Modal.Footer className="modal-login__footer ">
                           <nav className="nav">
                                 <ul>
                                    <li>
                                       <a onClick={this.handleClickRegister.bind(this)}> {Strings.NOT_ACCOUNT_QUESTION}</a>
                                    </li>

                                    <li>
                                       <a onClick={this.handleClickRecovery.bind(this)}> {Strings.FORGOT_PASSWORD_QUESTION}</a>
                                    </li>
                                 </ul>
                           </nav>
                           </Modal.Footer>
                        </div>
                     </Modal>

                     <Modal className="modal-register" show={this.state.showRegister} onHide={this.handleClickBack.bind(this)}>
                        <div className="modal-register__container">
                           <div className="modal-register__close" onClick={this.handleClickBack.bind(this)}>
                              <CloseIcon />
                           </div>  
                           <Modal.Header className="modal-register__header">
                                 <Modal.Title className="section-title container">{Strings.BUTTON_REGISTER}</Modal.Title>
                           </Modal.Header>
                           <Modal.Body className="modal-register__body">
                                 <Register 
                                    triggeredByRegister={this.state.triggeredByRegister}
                                    handleClickBack={this.handleClickBack.bind(this)} 
                                    successCallback={this.successLoginCallback.bind(this)}
                                 />
                           </Modal.Body>
                           <Modal.Footer className="modal-register__footer">
                                 <nav className="nav">
                                    <ul>
                                       <li>
                                          <a onClick={this.handleClickLogin.bind(this)}> {Strings.ACCOUNT_QUESTION}</a>
                                       </li>
                                       <li>
                                          <a onClick={this.handleClickRecovery.bind(this)}> {Strings.FORGOT_PASSWORD_QUESTION}</a>
                                       </li>
                                    </ul>
                                 </nav>
                           </Modal.Footer>
                        </div>
                     </Modal>

                    <Modal className="modal-profile" show={this.state.showProfile} onHide={this.handleClickBack.bind(this)}>
                        <div className="modal-profile__container">
                           <div className="modal-profile__body">
                              <div className="profile-content">
                                 <div className="modal-profile__close" onClick={this.handleClickBack.bind(this)}>
                                    <CloseIcon />
                                 </div> 
                                 <Modal.Body>
                                    <ProfileUserInfo 
                                       handleClickLogout={this.handleClickLogout} 
                                       successCallback={this.successProfileSaveCallback.bind(this)} 
                                       userData={me}
                                    />
                                 </Modal.Body>
                              </div>
                           </div>
                        </div>
                    </Modal>

                    <Modal className="modal-password" show={this.state.passwordRecovery} onHide={this.handleClickBack.bind(this)}>
                        <div className="modal-password__container">
                        <div className="modal-password__close" onClick={this.handleClickBack.bind(this)}>
                              <CloseIcon />
                           </div>
                           <Modal.Header className="modal-password-header">
                                 <Modal.Title className="section-title container">{Strings.BUTTON_PASSWORD_FORGOT}</Modal.Title>
                           </Modal.Header>
                           <Modal.Body className="modal-password-body">
                                 <PasswordRecovery 
                                    token={this.state.token} 
                                    email={this.state.email} 
                                    handleClickBack={this.handleClickBack.bind(this)}   
                                 />
                           </Modal.Body>
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