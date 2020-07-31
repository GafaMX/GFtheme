'use strict';

import React from 'react';
import Moment from 'moment';
import 'moment/locale/es';
import Strings from "../../utils/Strings/Strings_ES";
import GafaFitSDKWrapper from "../../utils/GafaFitSDKWrapper";
import Glyphicon from "react-bootstrap/es/Glyphicon";
import Modal from "react-bootstrap/es/Modal";
import CalendarStorage from "../../calendar/CalendarStorage";
import CloseIcon from "../../utils/Icons/CloseIcon";

class ClassItem extends React.Component {
    constructor(props) {
        super(props);
        this.state={
            showCancelation:false,
        }
    }

    handleClick(event) {
        event.preventDefault();

        let reservationID = this.props.id;
        GafaFitSDKWrapper.postUserCancelReservation(reservationID,'',
            function(result){
            alert(Strings.CANCELEDRESERVATION);
                window.location.reload();
            }
        )
    }

   handleShowCancelation(){
      this.setState({
         showCancelation:true
      })
   }


   handleClickBack(){
      this.setState({
         showCancelation:false,
      })
   }

   handleClose() {
      this.setState({ show: false });
   }

    //todo hacer el modal mas pequeño

   render() {
      let preE = 'GFSDK-e';
      let buttonClass = preE + '-buttons';
      let {reservation} = this.props;

      let membershipCredits = '';
      let cancelation = '';
      let today= Moment().format('X');
      if (this.props.reservation.credit === null) {
         membershipCredits = (
               <p className={'reservation-item-membership'}>{Strings.MEMBERSHIP}{this.props.reservation.user_membership.membership['name']}</p>)
      } else {
         membershipCredits = (
               <p className={'reservation-item-credits'}>{Strings.CREDIT}{this.props.reservation.credit['name']}</p>)
      }
      
      if(this.props.reservation.cancelled === true){
         cancelation =(
            <span className={'reservation-item-cancelled close'} aria-label="Close"> <Glyphicon glyph="ban-circle" /> {Strings.CANCELLED} </span>
         )
      } else if (Moment(reservation.meeting_start).format('X') > today){
         cancelation = (
            <button type="button" className={buttonClass + "__close"} onClick={this.handleShowCancelation.bind(this)}>
               <CloseIcon />
            </button>
         )
      }

      return (
         <div className={'pastClass-item'}>
            <div className={'card-header'}>
               <h4>{this.props.reservation.service['name']}</h4>
            </div>
            <hr></hr>
            <div className={'card-body'}>
               <p className={'reservation-item-day'}>{Moment(this.props.reservation.meeting_start).format('D [de] MMM')}</p>
               <p className={'reservation-item-location'}>{this.props.reservation.location.name}</p>
               <p className={'reservation-item-time'}>{Moment(this.props.reservation.meeting_start).format('h:mm a')}</p>
               <p className={'reservation-item-staff'}><strong>{this.props.reservation.staff['name']}</strong></p>
            </div>

            {cancelation}

            <Modal className={'modal-cancelation'} show={this.state.showCancelation} animation={false}
                  onHide={this.handleClickBack.bind(this)}>

               <div className="row">
                  <div className="col-lg-12 col-xl-12 modal-cancelation__body">
                        <div className="container">
                           <Modal.Header className={'modal-cancelation-header'} closeButton>
                              <Modal.Title>{Strings.CANCELATION}</Modal.Title>
                           </Modal.Header>
                           <Modal.Body className={'modal-cancelation-body'}>
                              <h4>{Strings.CANCELATIONMESSAGE}</h4>
                           </Modal.Body>
                           <Modal.Footer className={'modal-reservation-footer'}>
                              <div className="GFSDK-form__section" id="cancel-class">
                                    <button type="button" className="qodef-btn qodef-btn-solid btn btn-lg btn-primary btn-block" onClick={this.handleClick.bind(this)}>
                                       <Glyphicon glyph="ok-circle" /> {Strings.BUTTON_ACCEPT}
                                    </button>
                                    <button type="button" className="qodef-btn qodef-btn-solid btn btn-lg btn-primary btn-block" onClick={this.handleClose.bind(this)}>
                                       <Glyphicon glyph="remove" /> {Strings.BUTTON_CANCEL}
                                    </button>
                              </div>
                           </Modal.Footer>
                        </div>
                  </div>
               </div>

            </Modal>
         </div>
      )
   }
}

export default ClassItem;