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
            sliderRows: 1,
            windowWidth: 0,
        }

        this.updateDimensions = this.updateDimensions.bind(this);
        this.updateRows = this.updateRows.bind(this);
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
            windowWidth: container.offsetWidth,
        });

        window.addEventListener('resize', this.updateDimensions);
    }

    updateRows() {
        let comp = this;
        let classes = comp.state.list.length;
        if (classes <= 6 ){
            comp.setState({ 
                sliderRows : 1,
            });
        } else if (classes > 6 ){
            comp.setState({ 
                sliderRows : 2,
            });
        }
    }

    updateDimensions() {
        let comp = this;
        const container = document.querySelector("#HistoryTabs");
        comp.setState({
            windowWidth: container.offsetWidth,
        });
    };

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
                        rows: 2,
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
            <div className={profileClass + '__section is-pastClass'} style={{width : this.state.windowWidth}}>
                <Slider {...settings} className={ ordersClass + '__section' + (this.state.sliderRows <= 6 ? ' is-singleLine' : '')}>
                    {listItems}
                </Slider>
            </div>
        );
    }
}

export default PastClasses;