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
         function (result) {

            // document.body.addEventListener("click", 
         }
      );
   }

   showLoginForNotLoggedUsers() {
      let comp = this;
      let locations = GlobalStorage.get('locations');
      locations = locations.filter(function(location){ return location.brand.slug === comp.props.combo.brand.slug});

      window.GFtheme.combo_id = this.props.combo.id;
      window.GFtheme.brand_slug = this.props.combo.brand.slug;
      window.GFtheme.location_slug = locations[0].slug;

      this.props.setShowRegister(true);
   }

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