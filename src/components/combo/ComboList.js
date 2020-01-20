'use strict';

import React from "react";
import ComboItem from "./ComboItem";
// import Strings from "../utils/Strings/Strings_ES";
import PaginationList from "../utils/PaginationList";
// import GafaFitSDKWrapper from "../utils/GafaFitSDKWrapper";
import LoginRegister from "../menu/LoginRegister";
import Slider from "react-slick";
import 'slick-carousel/slick/slick.css';
import 'slick-carousel/slick/slick-theme.css';
import IconLeftArrow from "../utils/Icons/IconLeftArrow";
import IconRightArrow from "../utils/Icons/IconRightArrow";

//Estilos
import '../../styles/newlook/components/GFSDK-c-PackagesMemberships.scss';
import '../../styles/newlook/elements/GFSDK-e-product.scss';

class ComboList extends React.Component {
    constructor(props) {
        super(props);

        this.state = {
            showLogin: false,
            list: this.props.list,
            slidesToShow: parseInt(this.props.slidesToShow, 10),
        };
    }

    setShowLogin(showLogin) {
        this.setState({
            showLogin: showLogin
        });
    }

    updatePaginationData(result) {
        this.setState({
            list: result.data,
            currentPage: result.current_page
        })
    }

    render() {
        let preC = 'GFSDK-c';
        let preE = 'GFSDK-e';
        let comboClass = preC + '-comboList';
        let paginationClass = preE + '-pagination';
        let buttonClass = preE + '-buttons';

        // let sliderCentered = this.state.list.length > this.state.slidesToShow ? true : false ;
        // let slidesToShow = this.state.slidesToShow > 1 ? this.state.slidesToShow : 3 ;

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
            dots: true,
            speed: 500,
            infinite: false,
            slidesToShow: 5,
            slidesToScroll: 5,
            prevArrow: <PrevArrow />,
            nextArrow: <NextArrow />,
            responsive: [
                {
                    breakpoint: 481,
                    settings: {
                        slidesToShow: 1,
                        slidesToScroll: 1,
                    }
                },
                {
                    breakpoint: 769,
                    settings: {
                        slidesToShow: 2,
                        slidesToScroll: 2,
                    }
                },
                {
                    breakpoint: 992,
                    settings: {
                        slidesToShow: 3,
                        slidesToScroll: 3,
                    }
                },
                {
                    breakpoint: 1200,
                    settings: {
                        slidesToShow: 4,
                        slidesToScroll: 4,
                    }
                },
            ],
        };

        const listItems = this.state.list.map((combo) =>
            <ComboItem key={combo.id} combo={combo} setShowLogin={this.setShowLogin.bind(this)}/>
        );
        return (
            <div className={comboClass}>
                <Slider {...settings} className={(comboClass + '__container ')}>
                    {listItems}
                </Slider>

                {this.state.showLogin &&
                <LoginRegister setShowLogin={this.setShowLogin.bind(this)}/>
                }
            </div>
        );
    }
}

export default ComboList;

