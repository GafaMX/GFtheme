'use strict';

import React from "react";
import MembershipItem from "./MembershipItem";
import LoginRegister from "../menu/LoginRegister";
import GafaFitSDKWrapper from "../utils/GafaFitSDKWrapper";
import GafaThemeSDK from "../GafaThemeSDK";

import Slider from "react-slick";
import 'slick-carousel/slick/slick.css';
import 'slick-carousel/slick/slick-theme.css';
import IconLeftArrow from "../utils/Icons/IconLeftArrow";
import IconRightArrow from "../utils/Icons/IconRightArrow";

//Estilos
import '../../styles/newlook/components/GFSDK-c-PackagesMemberships.scss';
import '../../styles/newlook/elements/GFSDK-e-product.scss';
import GlobalStorage from "../store/GlobalStorage";

class MembershipList extends React.Component {
    constructor(props) {
        super(props);

        this.state = {
            showLogin: false,
            list: this.props.list,
            weAreHome: false,
            slidesToShow: parseInt(this.props.slidesToShow, 10),
        };

        GlobalStorage.addSegmentedListener(['currentLocation'], this.updateMembershipList.bind(this));
    }

    componentDidMount(){
        let comp = this;
        let origin = window.location.origin + '/';
        let href = window.location.href;

        if(origin === href){
            comp.setState({
                weAreHome : true
            });
        }
    }

    updateMembershipList(){
        let component = this;
        let currentLocation = GlobalStorage.get('currentLocation');

        GafaFitSDKWrapper.getMembershipListWithoutBrand(currentLocation.brand.slug,
            {
                per_page: 10,
                only_actives: true,
                propagate: true,
            }, function (result) {
                let functionReturns = GafaThemeSDK.propsForPagedListComponent(result);
                component.setState({
                    list: functionReturns.list
                });
        });
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
        let membershipClass = preC + '-membershipList';
        let paginationClass = preE + '-pagination';
        let buttonClass = preE + '-buttons';

        let sliderCentered = this.state.list.length > this.state.slidesToShow ? true : false ;
        let slidesToShow = this.state.slidesToShow > 1 ? this.state.slidesToShow : 3 ;

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
            infinite: false,
            speed: 500,
            slidesToScroll: 5,
            slidesToShow: 5,
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
                    breakpoint: 1025,
                    settings: {
                        slidesToShow: 4,
                        slidesToScroll: 4,
                    }
                },
            ],
        };

        const listItems = this.state.list.map((membership) =>{
            if(membership.hide_in_front){
                if(membership.hide_in_front === false || membership.hide_in_front === 0){
                    if(
                        this.state.weAreHome === false && membership.status === 'active' ||
                        this.state.weAreHome === true && membership.status === 'active' && membership.hide_in_home != true
                    ){
                        return <MembershipItem key={membership.id} membership={membership} setShowLogin={this.setShowLogin.bind(this)}/>
                    }
                }
            } else {
                if(membership.hide_in_home === false){
                    if(
                        this.state.weAreHome === false && membership.status === 'active' ||
                        this.state.weAreHome === true && membership.status === 'active'
                    ){
                        return <MembershipItem key={membership.id} membership={membership} setShowLogin={this.setShowLogin.bind(this)}/>
                    }
                }
            }
        });

        return (
            <div className={membershipClass}>
                <Slider {...settings} className={(membershipClass + '__container ')}>
                    {listItems}
                </Slider>

                {
                    this.state.showLogin &&
                    <LoginRegister setShowLogin={this.setShowLogin.bind(this)}/>
                }
            </div>
        );
    }
}

export default MembershipList;

