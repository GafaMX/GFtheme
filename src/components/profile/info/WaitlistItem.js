'use strict';

import React from 'react';
import moment from 'moment';
import 'moment/locale/es';
import GafaFitSDKWrapper from "../../utils/GafaFitSDKWrapper";
import Modal from "react-bootstrap/es/Modal";
import CloseIcon from "../../utils/Icons/CloseIcon";
import StringStore from "../../utils/Strings/StringStore";

class WaitlistItem extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            showCancelation: false,
            errorCancelation: null,
        }
    }

    handleClick(event) {
        event.preventDefault();
        let comp = this;
        const {waitlist} = this.props;
        const {brand, id,} = waitlist;

        GafaFitSDKWrapper.cancelWaitlist(
            brand.slug,
            id,
            '',
            function (result) {
                alert(StringStore.get('CANCELEDWAITLIST'));
                window.location.reload();
            },
            function (error) {
                comp.setState({
                    errorCancelation: error.error,
                })
            }
        )
    }

    handleShowCancelation() {
        this.setState({
            showCancelation: true
        })
    }

    handleClickBack() {
        this.setState({
            showCancelation: false,
        })
    }

    handleClose() {
        this.setState({show: false});
    }


    render() {
        let preE = 'GFSDK-e';
        let buttonClass = preE + '-buttons';
        const {waitlist} = this.props;
        const {meeting_start, staff, service, location, waitlist_number} = waitlist;

        let lang = StringStore.getLanguage();
        let format = StringStore.get('PROFILE_RESERVATIONS_FORMAT')

        // Formatear fecha de la clase
        const formattedDateDay = meeting_start ? moment(meeting_start).locale(lang).format(format) : StringStore.get('PROFILE_RESERVATIONS_NO_DATE');
        const formattedDateTime = meeting_start ? moment(meeting_start).locale(lang).format('h:mm a') : StringStore.get('PROFILE_RESERVATIONS_NO_TIME');

        // Verificar datos de staff, servicio y ubicación
        const staffName = (staff && staff.name) ? staff.name : StringStore.get('PROFILE_RESERVATIONS_NO_STAFF');
        const serviceName = (service && service.name) ? service.name : StringStore.get('PROFILE_RESERVATIONS_NO_SERVICE');
        const locationName = (location && location.name) ? location.name : StringStore.get('PROFILE_RESERVATIONS_NO_LOCATION');

        let cancelation = (
            <button type="button" className={buttonClass + "__close"}
                    onClick={this.handleShowCancelation.bind(this)}>
                <CloseIcon/>
            </button>
        );

        return (
            <div className={'pastClass-item waitlist'}>
                <div className={'pastClass-item__header'}>
                    <h4>{serviceName}</h4>
                </div>
                <div className={'pastClass-item__body'}>
                    <p className={'reservation-item-day'}>{formattedDateDay}</p>
                    <p className={'reservation-item-location'}>{locationName}</p>
                    <p className={'reservation-item-time'}>{formattedDateTime}</p>
                    <p className={'reservation-item-staff'}><strong>{staffName}</strong></p>
                    <p className={'reservation-item-cancelled'}><strong>{StringStore.get('IN_WAITLIST')}</strong></p>
                    {!!waitlist_number ? (
                        <p className={'reservation-item-position'}>{StringStore.get('PROFILE_POSITION', [waitlist_number])}</p>) : null}
                </div>
                {cancelation}

                <Modal className={'modal-cancelation'} show={this.state.showCancelation} animation={false}
                       onHide={this.handleClickBack.bind(this)}>

                    <div className="modal-cancelation__container">
                        <div className="modal-login__close" onClick={this.handleClickBack.bind(this)}>
                            <CloseIcon/>
                        </div>
                        <div className={'modal-cancelation__body'}>
                            <h3>{StringStore.get('CANCELATION')}</h3>
                            <p>{StringStore.get('CANCELATIONMESSAGEWAITLIST')}</p>
                        </div>
                        <div className={'modal-cancelation__footer'}>
                            <div className="GFSDK-form__section" id="cancel-waitlist">
                                <button type="button" className="GFSDK-e-buttons GFSDK-e-buttons--submit is-primary"
                                        onClick={this.handleClick.bind(this)}>
                                    {StringStore.get('CANCELATIONCONFIRM')}
                                </button>
                            </div>
                            <div
                                className={"modal-cancelation__error " + (this.state.errorCancelation ? 'res_has_error' : null)}>
                                {this.state.errorCancelation ? this.state.errorCancelation : null}
                            </div>
                        </div>
                    </div>
                </Modal>
            </div>
        );
    }
}

export default WaitlistItem;
