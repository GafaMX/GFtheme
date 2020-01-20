'use strict';

import React from "react";
import ComboProwessItem from "./ComboProwessItem";
import Strings from "../../utils/Strings/Strings_ES";
import PaginationList from "../../utils/PaginationList";
import LoginRegister from "../../menu/LoginRegister";
import GafaFitSDKWrapper from "../../utils/GafaFitSDKWrapper";
import IconLeftArrow from "../../ui/LeftArrowIcon";
import IconRightArrow from "../../ui/RightArrowIcon";
import "./style/ComboProwess.scss";

/* Slider */
import Slider from "react-slick";
import 'slick-carousel/slick/slick.css';
import 'slick-carousel/slick/slick-theme.css';


class ComboProwess extends React.Component {
    constructor(props) {
        super(props);

        this.state = {
            showLogin: false,
            list: this.props.combo.list,
            slidesToShow: parseInt(this.props.slidesToShow, 10),
            // currentPage: this.props.combo.currentPage,
            // extraPaginationOptions: {
            //     only_actives: true,
            //     propagate: true,
            // }
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

        const listItems = this.state.list.map((combo) => {
                if ((combo.status != "inactive") && (combo.hide_in_home != true)){
                    return <ComboProwessItem currentBrand={this.props.currentBrand} key={combo.id} combo={combo} setShowLogin={this.setShowLogin.bind(this)}/>
                }
            }
            // <ComboProwessItem currentBrand={this.props.currentBrand} key={combo.id} combo={combo} setShowLogin={this.setShowLogin.bind(this)}/>
        );

        let sliderCentered = this.state.list.length > this.state.slidesToShow ? true : false ;
        let slidesToShow = this.state.slidesToShow > 1 ? this.state.slidesToShow : 3 ;

        function PrevArrow(props) {
            const {onClick} = props;
            return (
                <div className={'qodef-ps-prev'}>
                    <button onClick={onClick} className="qodef-btn qodef-btn-solid" id="next">
                        <IconLeftArrow />
                    </button>
                </div>
            );
        }

        function NextArrow(props) {
            const {onClick} = props;
            return (
                <div className={'qodef-ps-next'}>
                    <button onClick={onClick} className="qodef-btn qodef-btn-solid" id="prev">
                        <IconRightArrow />
                    </button>
                </div>
            );
        }

        let settings = {
            dots: true,
            infinite: true,
            centerMode: sliderCentered,
            speed: 500,
            slidesToShow: slidesToShow,
            centerPadding: "10px",
            prevArrow: <PrevArrow />,
            nextArrow: <NextArrow />,

            responsive: [
                {
                  breakpoint: 768,
                  settings: {
                    slidesToShow: 1,
                    slidesToScroll: 1,
                    infinite: true,
                    dots: true
                  }
                },
            ],
        };

        return (
            <div>
                <div>
                    <Slider className={sliderCentered ? 'slick-centered' : null} {...settings}>
                        {listItems}
                    </Slider>
                </div>
                {
                    this.state.showLogin &&
                    <LoginRegister template={this.props.template} setShowLogin={this.setShowLogin.bind(this)}/>
                }
            </div>
        );
    }
}

export default ComboProwess;