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
            // currentPage: 1,
            // perPage: 6,
            // lastPage: 0,
            // total: 0
        }
    }

    componentDidMount() {
        const currentComponent = this;
        GafaFitSDKWrapper.getUserPastReservationsInBrand({
            page: 1,
            per_page: 1000,
        }, function (result) {
            currentComponent.setState({
                list: result.data,
                // currentPage: result.current_page,
                // lastPage: result.last_page,
                // perPage: result.per_page,
                // total: result.total
            })
        })
    }

    // updatePaginationData(result) {
    //     this.setState({
    //         list: result.data,
    //         currentPage: result.current_page
    //     })
    // }

    render() {
        let preC = 'GFSDK-c';
        let profileClass = preC + '-profile';
        let ordersClass = preC + '-orders';

        let settings = {
            arrows: false,
            dots: true,
            infinite: false,
            speed: 500,
            rows: 2,
            slidesToScroll: 3,
            slidesToShow: 3,
            responsive: [
                {
                    breakpoint: 768,
                    settings: {
                        rows: 3,
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
            <div className={profileClass + '__section is-futureClass'}>
                <Slider {...settings} className={ ordersClass + '__section'}>
                    {listItems}
                </Slider>
            </div>
        );
    }
}

export default PastClasses;