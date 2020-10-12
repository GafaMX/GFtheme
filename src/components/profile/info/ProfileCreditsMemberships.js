'use strict';

import React from "react";
// import {Carousel} from "react-bootstrap";
import Slider from "react-slick";
import 'slick-carousel/slick/slick.css';
import 'slick-carousel/slick/slick-theme.css';
import GafaFitSDKWrapper from "../../utils/GafaFitSDKWrapper";
import GlobalStorage from "../../store/GlobalStorage";
import UserCredit from "./UserCredit";
import UserMembership from "./UserMembership";
import Loading from '../../common/Loading';
import IconLeftArrow from "../../utils/Icons/IconLeftArrow";
import IconRightAngle from "../../utils/Icons/IconRightAngle";

import 'moment/locale/es';
class ProfileCreditsMemberships extends React.Component {
   constructor(props) {
      super(props);

      this.state = {
         credits: [],
         memberships: [],
         is_mounted: false,
      };

      this.updatePurchase = this.updatePurchase.bind(this); 
      GlobalStorage.addSegmentedListener(['me'], this.updatePurchase.bind(this));
   }

   updatePurchase(){
      let comp = this;
      let {credits, memberships} = GlobalStorage.get('me');

      setTimeout(function(){
         comp.setState({
            credits, 
            memberships,
            is_mounted : true,
         });
      }, 1500);
   }

   render() {
      let preC = 'GFSDK-c';
      let preE = 'GFSDK-e';
      let paginationClass = preE + '-pagination';
      let buttonClass = preE + '-buttons';
      let {credits, memberships, is_mounted} = this.state;
      let list = [];

      if(credits){
         credits.forEach(function(credit){
            list = list.concat(
               <UserCredit
               key={credit.id}
               creditsTotal={credit.total}
               name={credit.credit.name}
               expirationDate={credit.expiration_date}/>
            )
         });
      }

      if(memberships){

         memberships.forEach(function(membership){
            list = list.concat(
               <UserMembership
                  key={membership.id}
                  from={membership.created_at} 
                  to={membership.expiration_date} 
                  name={membership.membership.name}/>
            )
         });
      }
      
      function PurchaseActive(props){
         return (
            <div className={className + ' ' + paginationClass + '__controls is-next'}>
               <button className={buttonClass + ' ' + buttonClass + '--icon'} onClick={onClick}>
               </button>
            </div>
         );
      };

      function NextArrow(props){
         const {className, onClick} = props;
         return (
            <div className={className + ' ' + paginationClass + '__controls is-next'}>
               <button className={buttonClass + ' ' + buttonClass + '--icon'} onClick={onClick}>
                  <IconRightAngle />
               </button>
            </div>
         );
      };
   
      function PrevArrow(props){
         const {className, onClick} = props;
         return (
            <div className={className + ' ' + paginationClass + '__controls is-prev'}>
               <button className={buttonClass + ' ' + buttonClass + '--icon'} onClick={onClick}>
                  <IconLeftArrow />
               </button>
            </div>
         );
      };

      let settings = {
         dots: false,
         speed: 500,
         infinite: true,
         adaptiveHeight: true,
         slidesToShow: 1,
         slidesToScroll: 1,
         prevArrow: <PrevArrow />,
         nextArrow: <NextArrow />
      };

      return (
         <div className={'creditosUser'}>
            {is_mounted 

               ?  <Slider {...settings} className={'creditosUser__container'}>
                     {list.length > 0
                        ?  list
                        :  null
                     }
                  </Slider>
               :  <Loading />
            }
         </div>
      );
   }
}

export default ProfileCreditsMemberships;