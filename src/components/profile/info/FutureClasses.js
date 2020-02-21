'use strict';

import React from 'react';
import ClassItem from "./ClassItem";
import GafaFitSDKWrapper from "../../utils/GafaFitSDKWrapper";
import Slider from "react-slick";
import 'slick-carousel/slick/slick.css';
import 'slick-carousel/slick/slick-theme.css';
import IconLeftArrow from "../../utils/Icons/IconLeftArrow";
import IconRightArrow from "../../utils/Icons/IconRightArrow";

class FutureClasses extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            list: [],
            counterBuyItems: '',
            sliderRows: 2,
            windowWidth: 0,
        }

        this.updateDimensions = this.updateDimensions.bind(this);
        this.updateRows = this.updateRows.bind(this);
    }

    componentDidMount() {
        const currentComponent = this;
        const container = document.querySelector("#HistoryTabs");
        GafaFitSDKWrapper.getUserFutureReservationsInBrand({
            reducePopulation: true,
        }, function (result) {
            currentComponent.setState({
                list: result,
            });
            currentComponent.updateRows();
        })

        currentComponent.setState({ 
            // windowWidth: container.offsetWidth,
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
            // windowWidth: container.offsetWidth,
        });
    };

    updateList(list) {
        this.setState({
            list: list
        });
    }

    render() {

        let preC = 'GFSDK-c';
        let profileClass = preC + '-profile';
        let ordersClass = preC + '-orders';

        function NextArrow(props){
            const {onClick} = props;
            return (
                <div className={paginationClass + '__controls is-next'}>
                    <button className={buttonClass + ' ' + buttonClass + '--icon is-primary is-small'} onClick={onClick}>
                        <IconRightArrow />
                    </button>
                </div>
            );
        };
    
        function PrevArrow(props){
            const {onClick} = props;
            return (
                <div className={paginationClass + '__controls is-prev'}>
                    <button className={buttonClass + ' ' + buttonClass + '--icon is-primary is-small'} onClick={onClick}>
                        <IconLeftArrow />
                    </button>
                </div>
            );
        };

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


        const listItems = this.state.list.map((reservation) => <ClassItem key={reservation.id} reservation={reservation} id={reservation.id}/>);

        return (
            <div className={profileClass + '__section is-futureClass'}>
                {this.state.list.length > 0
                    ?   <Slider {...settings} className={ ordersClass + '__section'}>{listItems}</Slider>
                    :   <div className="is-empty">
                            <div className="is-notification">
                                <h3>No cuentas con próximas clases</h3>
                                <p>Lorem ipsum dolor sit amet</p>
                            </div>
                        </div>
                }
            </div>
        )
    }

}

export default FutureClasses;