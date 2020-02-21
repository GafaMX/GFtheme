'use strict';

import React from 'react';
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
                    ?   <Slider {...settings} className={ ordersClass + '__section'}>{listItems}</Slider>
                    :   <div className="is-empty">
                            <div className="is-notification">
                                <h3>No cuentas con compras</h3>
                                <p>Lorem ipsum dolor sit amet</p>
                            </div>
                        </div>
                }
            </div>
        )
    }
}

export default PurchasesList;