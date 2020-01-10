'use strict';

import React from 'react';
import GafaFitSDKWrapper from "../utils/GafaFitSDKWrapper";
import PastClassItem from "./PastClassItem";
import Slider from "react-slick";
import 'slick-carousel/slick/slick.css';
import 'slick-carousel/slick/slick-theme.css';

class PastClasses extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            list: [],
            windowWidth: 0,
        }

        // this.updateRows = this.updateRows.bind(this);
    }

    componentDidMount() {
        const currentComponent = this;
        const container = document.querySelector("#HistoryTabs");
        GafaFitSDKWrapper.getUserPastReservationsInBrand({
            reducePopulation: true,
        }, function (result) {
            currentComponent.setState({
                list: result.data,
            });
            currentComponent.updateRows();
        })

        currentComponent.setState({ 
            // windowWidth: container.offsetWidth,
        });

        window.addEventListener('resize', this.updateDimensions);
    }

    updateDimensions() {
        let comp = this;
        const container = document.querySelector("#HistoryTabs");
        comp.setState({
            // windowWidth: container.offsetWidth,
        });
    };

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
                        slidesToShow: 1,
                        slidesToScroll: 1,
                    }
                },
            ],
        };

        const listItems = this.state.list.map((pastreservation) =>
            <PastClassItem key={pastreservation.id} reservation={pastreservation} id={pastreservation.id}/>
        );

        return (
            <div className={profileClass + '__section is-pastClass'}>
               <Slider {...settings} className={ ordersClass + '__section'}>
                    {listItems}
                </Slider>
            </div>
        );
    }
}

export default PastClasses;