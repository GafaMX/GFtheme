'use strict';

import React from 'react';
import GlobalStorage from '../store/GlobalStorage';
import GafaFitSDKWrapper from "../utils/GafaFitSDKWrapper";
import PurchaseItem from "./PurchaseItem";
import Slider from "react-slick";
import 'slick-carousel/slick/slick.css';
import 'slick-carousel/slick/slick-theme.css';

class PurchasesList extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            list: [],
        }

        this.getPurchase = this.getPurchase.bind(this);
        GlobalStorage.addSegmentedListener(['purchase', 'filter_brand'], this.updatePurchasesList.bind(this));
    }

    componentDidMount() {
      this.getPurchase();
    }

    getPurchase(){
      const currentComponent = this;
      let brands = GlobalStorage.get('brands');
      let purchaseList = [];
      
      brands.forEach(function(brand){
         GafaFitSDKWrapper.getUserPurchasesInBrand(
            brand.slug,
            {reducePopulation: true,}, 
            function (result) {
               purchaseList = purchaseList.concat(result.data);
               GlobalStorage.set('purchase', purchaseList);
               currentComponent.setState({list: purchasesList});
         });
      });
   }

   updatePurchasesList() {
      let purchase = GlobalStorage.get('purchase');
      let brand = GlobalStorage.get('filter_brand');

      if(brand){
         purchase = purchase.filter(function (item) {return item.brands_id === brand.id; });
      }
      
      this.setState({list: purchase});
    }

    render() {

        let preC = 'GFSDK-c';
        let profileClass = preC + '-profile';
        let ordersClass = preC + '-orders';

        let settings = {
            arrows: false,
            infinite: false,
            speed: 500,
            slidesToScroll: 5,
            slidesToShow: 5,
            responsive: [
                {
                    breakpoint: 768,
                    settings: {
                        slidesToShow: 3,
                        slidesToScroll: 3,
                    }
                },
            ],
        };

        const listItems = this.state.list.map((purchase) =>
            <PurchaseItem key={purchase.id} purchase={purchase} id={purchase.id}/>
        );
        return (

            <div className={profileClass + '__section is-buyOverall'} style={{width : this.state.windowWidth}}>
                {this.state.list.length > 0
                    ?   <div className={ ordersClass + '__section'}>{listItems}</div>
                    :   <div className="is-empty">
                           <div className="is-notification">
                              <h3>No cuentas con compras</h3>
                           </div>
                        </div>
                }
            </div>
        )
    }
}

export default PurchasesList;