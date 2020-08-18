'use strict';

import React from "react";
import Strings from "../utils/Strings/Strings_ES";
import GlobalStorage from "../store/GlobalStorage";
import GafaFitSDKWrapper from "../utils/GafaFitSDKWrapper";

import {formatMoney} from "../utils/FormatUtils";

class MembershipItem extends React.Component {
   constructor(props) {
      super(props);
      this.state = {
         currentBrand: null,
         currentLocation: null,
      }
   }

   componentDidMount(){
      let {membership} = this.props;
      let locations = GlobalStorage.get('locations');

      if(locations){
         locations = locations.filter(function(location){
            return membership.brands_id === location.brand.id
         })
      }

      this.setState({
         currentBrand: locations[0].brand,
         currentLocation: locations[0],
      })
   }

   handleClick(event) {
      event.preventDefault();
      let currentElement = this;
      GafaFitSDKWrapper.isAuthenticated(function(auth) {
         if (auth) {
            currentElement.showBuyFancyForLoggedUsers();
         } else {
            currentElement.showLoginForNotLoggedUsers();
         }
      })
   };

   showBuyFancyForLoggedUsers() {
      let {membership} = this.props;
      let {currentBrand, currentLocation} = this.state
      GafaFitSDKWrapper.getFancyForBuyMembership(
         currentBrand.slug,
         currentLocation.slug,
         membership.id, 
         function (result) {}
      );
   }

   showLoginForNotLoggedUsers() {
      window.GFtheme.membership_id = this.props.membership.id;
      this.props.setShowRegister(true);
   }

   //  getServicesAndParentsForMembership() {
   //    let servicesForMembership = [];
   //    servicesForMembership['services'] = "";
   //    servicesForMembership['parents'] = "";

   //    this.props.membership.credits.forEach(function (credit) {
   //       credit.services.forEach(function (service) {
   //                if (service.category != null && !servicesForMembership['services'].includes(service.category)) {
   //                   servicesForMembership['services'] === "" ? servicesForMembership['services'] += service.category :
   //                         servicesForMembership['services'] += ", " + service.category;
   //                }

   //                if (service.service_parent != null && !servicesForMembership['parents'].includes(service.service_parent)) {
   //                   servicesForMembership['parents'] === "" ? servicesForMembership['parents'] += service.service_parent :
   //                         servicesForMembership['parents'] += ", " + service.service_parent;
   //                }
   //             }
   //       )
   //    });

   //    return servicesForMembership;
   //  }

    render() {
      let preC = 'GFSDK-c';
      let preE = 'GFSDK-e';
      let productClass = preE + '-product';
      let membershipClass = preC + '-membershipList';
      let {membership} = this.props;
      // const services = this.getServicesAndParentsForMembership();
      
      return (
         <div className={membershipClass + '__item ' + productClass}>
               <div className={productClass + '__head'}>
                  <h3 className={'this-name'}>{this.props.membership.name}</h3>
               </div>
               <div className={productClass + '__body'}>
                  {this.props.membership.has_discount &&
                  <div>
                     <div className={'this-price has-discount'}>
                           <p>
                              ${formatMoney(this.props.membership.price, 0)} MXN
                           </p>
                     </div>
                  </div>
                  }
                  <div className="this-price has-total">
                     <p>
                        ${formatMoney(this.props.membership.price_final, 0)} MXN
                     </p>
                  </div>

                  <button className="buq-accentColor" onClick={this.handleClick.bind(this)}> Comprar </button>

               </div>
               <div className={productClass + '__footer'}>
                  {membership.expiration_days
                     ?   <p className={'this-expiration'}><span>{Strings.EXPIRE_IN}</span> <strong>{membership.expiration_days} {Strings.DAYS}</strong></p>
                     :   null
                  }
               </div>
         </div>
      );
   }
}

export default MembershipItem;