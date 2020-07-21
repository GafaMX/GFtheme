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
        GlobalStorage.addSegmentedListener(['currentBrand'], this.updatePurchasesList.bind(this));
    }

    componentDidMount() {
        const currentComponent = this;
        GafaFitSDKWrapper.getUserPurchasesInBrand({
            reducePopulation: true,
        }, function (result) {
            currentComponent.setState({
                list: result.data,
            })
        })
    }

    updatePurchasesList() {
        const currentComponent = this;
        GafaFitSDKWrapper.getUserPurchasesInBrand({
            reducePopulation: true,
        }, function (result) {
            currentComponent.setState({
                list: result.data,
            })
        })
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