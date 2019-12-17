'use strict';

import React from 'react';
import GafaFitSDKWrapper from "../utils/GafaFitSDKWrapper";
import Strings from "../utils/Strings/Strings_ES";
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
            dots: true,
            infinite: false,
            speed: 500,
            rows: 1,
            slidesToScroll: 6,
            slidesToShow: 6,
            responsive: [
                {
                    breakpoint: 768,
                    settings: {
                        dots: true,
                        rows: 3,
                        slidesToShow: 1,
                        slidesToScroll: 1,
                    }
                },
            ],
        };

        const listItems = this.state.list.map((purchase) =>
            <PurchaseItem key={purchase.id} purchase={purchase} id={purchase.id}/>
        );
        return (

            <div className={profileClass + '__section is-buyOverall'} style={{width : this.state.windowWidth}}>
                <Slider {...settings} className={ ordersClass + '__section' + (this.state.list.length <= 6 ? ' is-singleLine' : '')}>
                    {listItems}
                </Slider>
            </div>
        )
    }
}

export default PurchasesList;