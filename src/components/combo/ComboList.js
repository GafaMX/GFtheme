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
import '../../styles/newlook/elements/GFSDK-e-pagination.scss';

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

    nextArrow(props) {
        const {onClick} = props;
        let preE = 'GFSDK-e';
        let paginationClass = preE + '-pagination';
        return (
            <div className={paginationClass + '__next'}>
                <button onClick={onClick}>
                    <IconRightArrow />
                </button>
            </div>
        );
    }

    pastArrow(props) {
        const {onClick} = props;
        let preE = 'GFSDK-e';
        let paginationClass = preE + '-pagination';
        return (
            <div className={paginationClass + '__past'}>
                <button onClick={onClick}>
                    <IconLeftArrow />
                </button>
            </div>
        );
    }

    render() {
        let preC = 'GFSDK-c';
        let comboClass = preC + '-comboList';

        let settings = {
            dots: true,
            // infinite: false,
            speed: 500,
            slidesToShow: this.state.slidesToShow,
            centerMode: true,
            infinite: true,
            centerPadding: "10px",
        };

        const listItems = this.state.list.map((combo) =>
            <ComboItem key={combo.id} combo={combo} setShowLogin={this.setShowLogin.bind(this)}/>
        );
        return (
            <div className={comboClass}>
                <Slider {...settings} className={comboClass + '__container center'}>
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

