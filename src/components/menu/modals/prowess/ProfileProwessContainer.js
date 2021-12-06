import React from "react";
import {Modal} from "react-bootstrap";
import ProfileUserInfo from "../../../profile/info/ProfileUserInfo";
import ProfileUserImage from "../../../profile/info/ProfileUserImage";
import ProfileUserSidebar from "../../../profile/info/ProfileUserSidebar";
// import PasswordRecovery from "../../../auth/PasswordRecovery/PasswordRecovery";
import Strings from "../../../utils/Strings/Strings_ES";
import './styles/ProfileProwessContainer.scss';


export default class ProfileProwessContainer extends React.Component{

    render(){
        return(
            <Modal className="modal-profile" show={this.props.showProfile} onHide={this.props.handleClickBack} animation={false}>
                <div className="row">
                    {/* <div className="col-lg-2 col-xl-3 modal-profile__image">
                        <div className="modal-profile__image-image">
                        </div>
                        <div className="modal-profile__image-nav">
                            <ul>
                                <li className="nav-item">
                                    <a className="qodef-btn qodef-btn-small qodef-btn-solid qodef-btn-icon" onClick={this.props.handleClickBack}>
                                        <span className={"qodef-btn-text"}>
                                            <span className={"qodef-btn-text-inner"}>Regresar al sitio</span>
                                        </span>
                                        <span className={"qodef-btn-text-inner qodef-btn-text-inner-icon"}>
                                            <i className={"qodef-icon-ion-icon ion-arrow-right-c "}></i> 
                                            <i className={"qodef-icon-ion-icon ion-arrow-right-c "}></i>
                                        </span>
                                    </a>
                                </li>
                                <li className="nav-item">
                                    <a className="qodef-btn qodef-btn-small qodef-btn-solid qodef-btn-icon" onClick={this.props.handleClickLogout}>
                                        <span className={"qodef-btn-text"}>
                                            <span className={"qodef-btn-text-inner"}>{StringStore.get('BUTTON_LOGOUT')}</span>
                                        </span>
                                        <span className={"qodef-btn-text-inner qodef-btn-text-inner-icon"}>
                                            <i className={"qodef-icon-ion-icon ion-arrow-right-c "}></i> 
                                            <i className={"qodef-icon-ion-icon ion-arrow-right-c "}></i>
                                        </span>
                                    </a>
                                </li>
                            </ul>
                        </div>
                    </div> */}
                    <div className="col-lg-12 col-xl-12 modal-profile__body">
                        <div className="container">
                            {/* <div className="row"> */}
                                {/* <div className="col-lg-3 profile-intro">
                                    <div className="container">
                                        <ProfileUserImage />
                                        <ProfileUserSidebar />
                                    </div>
                                </div> */}
                                <div className="col-lg-12 profile-content">
                                    <Modal.Header closeButton></Modal.Header>
                                    <Modal.Body className="modal-profile__body">
                                        <ProfileUserInfo 
                                            handleClickLogout={this.props.handleClickLogout}
                                            successCallback={this.props.successProfileSaveCallback}
                                        />
                                    </Modal.Body>
                                </div>
                            {/* </div> */}
                        </div>
                    </div>
                </div>
            </Modal>
        )
    }
}