'use strict';

import React from 'react';
import GlobalStorage from '../store/GlobalStorage';
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
        GlobalStorage.addSegmentedListener(['currentBrand'], this.updatePastClasses.bind(this));
    }

    componentDidMount() {
        const currentComponent = this;
        GafaFitSDKWrapper.getUserPastReservationsInBrand({
            reducePopulation: true,
        }, function (result) {
            currentComponent.setState({
                list: result.data,
            });
            currentComponent.updateRows();
        })

        window.addEventListener('resize', this.updateDimensions);
    }

    updatePastClasses() {
        const currentComponent = this;
        GafaFitSDKWrapper.getUserPastReservationsInBrand({
            reducePopulation: true,
        }, function (result) {
            currentComponent.setState({
                list: result.data,
            });
            currentComponent.updateRows();
        })

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
                        slidesToShow: 3,
                        slidesToScroll: 3,
                    }
                },
            ],
        };

        const listItems = this.state.list.map((pastreservation) =>
            <PastClassItem key={pastreservation.id} reservation={pastreservation} id={pastreservation.id}/>
        );

        return (
            <div className={profileClass + '__section is-pastClass'}>
                {this.state.list.length > 0
                    ?   <Slider {...settings} className={ ordersClass + '__section'}>{listItems}</Slider>
                    :   <div className="is-empty">
                            <div className="is-notification">
                                <h3>No cuentas con historial de clases</h3>
                                {/* <p>Lorem ipsum dolor sit amet</p> */}
                            </div>
                        </div>
                }
            </div>
        );
    }
}

export default PastClasses;