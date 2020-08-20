'use strict';

import React from "react";
import Strings from "../utils/Strings/Strings_ES";
import GlobalStorage from "../store/GlobalStorage";
import GafaFitSDKWrapper from "../utils/GafaFitSDKWrapper";

import {formatMoney} from "../utils/FormatUtils";

class ComboItem extends React.Component {
   constructor(props) {
      super(props);

      this.state = {
         currentBrand: null,
         currentLocation: null,
      }
   }

   componentDidMount(){
      let {combo} = this.props;
      let locations = GlobalStorage.get('locations');

      if(locations){
         locations = locations.filter(function(location){
            return combo.brand.id === location.brand.id
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

      GafaFitSDKWrapper.isAuthenticated(function(auth){
         if (auth) {
            currentElement.showBuyFancyForLoggedUsers();
         } else {
            currentElement.showLoginForNotLoggedUsers();
         }
      });
   };

   showBuyFancyForLoggedUsers() {
      let {combo} = this.props;
      let {currentBrand, currentLocation} = this.state

      GafaFitSDKWrapper.getFancyForBuyCombo(
         currentBrand.slug,
         currentLocation.slug,
         combo.id, 
         function (result) {}
      );
   }

   showLoginForNotLoggedUsers() {
      window.GFtheme.combo_id = this.props.combo.id;
      this.props.setShowRegister(true);
   }

   // getServicesAndParentsForCombo() {
   //    let servicesAndParentsForCombo = [];
   //    servicesAndParentsForCombo['services'] = "";
   //    servicesAndParentsForCombo['parents'] = "";

   //    this.props.combo.credit.services.forEach(function (service) {
   //       if (service.category != null && !servicesAndParentsForCombo['services'].includes(service.category)) {
   //             servicesAndParentsForCombo['services'] === "" ? servicesAndParentsForCombo['services'] += service.category :
   //                servicesAndParentsForCombo['services'] += ", " + service.category;
   //       }

   //       if (service.service_parent != null && !servicesAndParentsForCombo['parents'].includes(service.service_parent)) {
   //             servicesAndParentsForCombo['parents'] === "" ? servicesAndParentsForCombo['parents'] += service.service_parent :
   //                servicesAndParentsForCombo['parents'] += ", " + service.service_parent;
   //       }

   //    });
   //    return servicesAndParentsForCombo;
   // }

   render() {
      let preC = 'GFSDK-c';
      let preE = 'GFSDK-e';
      let productClass = preE + '-product';
      let comboClass = preC + '-membershipList';
      let {combo} = this.props;
      // const services = this.getServicesAndParentsForCombo();

      return (
         <div className={comboClass + 'item ' + productClass}>
            <div className={productClass + '__head'}>
               <h3 className="this-name">{this.props.combo.name}</h3>
            </div>
            <div className={productClass + '__body'}>
               {this.props.combo.has_discount &&
                  <div>
                        <div className="this-price has-discount">
                           <p>
                              ${formatMoney(this.props.combo.price, 0)} MXN
                           </p>
                        </div>
                  </div>
               }
               <div className="this-price has-total">
                  <p>
                     ${formatMoney(this.props.combo.price_final, 0)} MXN
                  </p>
               </div>

               <button className="buq-accentColor" onClick={this.handleClick.bind(this)}> Comprar </button>

            </div>
            <div className={productClass + '__footer'}>
               {combo.expiration_days
                  ?   <p className={'this-expiration'}><span>{Strings.EXPIRE_IN}</span> <strong>{combo.expiration_days} {Strings.DAYS}</strong></p>
                  :   null
               }
            </div>
         </div>
      );
   }
}

export default ComboItem;