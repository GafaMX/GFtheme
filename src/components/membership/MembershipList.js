'use strict';

import React from "react";
import MembershipItem from "./MembershipItem";
import LoginRegister from "../menu/LoginRegister";

import Slider from "react-slick";
import 'slick-carousel/slick/slick.css';
import 'slick-carousel/slick/slick-theme.css';
import IconLeftArrow from "../utils/Icons/IconLeftArrow";
import IconRightArrow from "../utils/Icons/IconRightArrow";

import Loading from '../common/Loading';
//Estilos
import '../../styles/newlook/components/GFSDK-c-PackagesMemberships.scss';
import '../../styles/newlook/elements/GFSDK-e-product.scss';
import GlobalStorage from "../store/GlobalStorage";

class MembershipList extends React.Component {
    constructor(props) {
        super(props);

        this.state = {
            showLogin: false,
            showRegister: false,
            list: this.props.list,
            is_mounted: false,
        };

        GlobalStorage.set('block_after_login', props.block_after_login);
        GlobalStorage.addSegmentedListener(['memberships'], this.setInitialValues.bind(this));
        this.setShowRegister = this.setShowRegister.bind(this);
    }

    setInitialValues() {
        let comp = this;
        let origin = window.location.origin + '/';
        let href = window.location.href;
        let {filterByName, filterByBrand} = this.props;
        let memberships = GlobalStorage.get('memberships');

        let weAreHome = false;

        if (origin === href) {
            weAreHome = true;
        }

        memberships = memberships.filter(function (membership) {
            return membership.status === 'active' && (membership.hide_in_front === false || membership.hide_in_front === 0);
        });

        if (weAreHome === true) {
            memberships = memberships.filter(function (membership) {
                return (membership.hide_in_home === false || membership.hide_in_home === 0);
            });
        }

        if (filterByName) {
            memberships = memberships.filter(function (membership) {
                return membership.name.toUpperCase().includes(filterByName.toUpperCase());
            });
        }

        if (filterByBrand) {
            memberships = memberships.filter(function (membership) {
                return membership.brand.name.toUpperCase().includes(filterByBrand.toUpperCase());
            });
        }

        if (memberships) {
            comp.setState({
                list: memberships,
                is_mounted: true,
            });
        }
    }

    setShowLogin(showLogin) {
        this.setState({
            showLogin: showLogin
        });
    }

    setShowRegister(showRegister) {
        this.setState({
            showRegister: showRegister
        });
    }

    //  updatePaginationData(result) {
    //      this.setState({
    //          list: result.data,
    //          currentPage: result.current_page
    //      })
    //  }

    render() {
        let preC = 'GFSDK-c';
        let preE = 'GFSDK-e';
        let {list, showLogin, showRegister, is_mounted} = this.state;
        let membershipClass = preC + '-membershipList';
        let paginationClass = preE + '-pagination';
        let buttonClass = preE + '-buttons';
        let listItems = [];

        function NextArrow(props) {
            const {className, onClick} = props;
            return (
                <div className={className + ' ' + paginationClass + '__controls is-next'}>
                    <button className={buttonClass + ' ' + buttonClass + '--icon'} onClick={onClick}>
                        <IconRightArrow/>
                    </button>
                </div>
            );
        };

        function PrevArrow(props) {
            const {className, onClick} = props;
            return (
                <div className={className + ' ' + paginationClass + '__controls is-prev'}>
                    <button className={buttonClass + ' ' + buttonClass + '--icon'} onClick={onClick}>
                        <IconLeftArrow/>
                    </button>
                </div>
            );
        };

        let settings = {
            dots: false,
            speed: 500,
            infinite: false,
            slidesToShow: 4,
            slidesToScroll: 1,
            prevArrow: <PrevArrow/>,
            nextArrow: <NextArrow/>,
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
                        slidesToScroll: 1,
                    }
                },
            ],
        };

        if (list) {
            let comp = this;
            listItems = list.map(function (membership) {
                return <MembershipItem key={membership.id} membership={membership}
                                       setShowRegister={comp.setShowRegister}/>
            });
        }

        return (
            <div className={membershipClass}>
                {is_mounted
                    ?
                    <Slider {...settings} className={(membershipClass + '__container ')}>
                        {listItems.length > 0
                            ? listItems
                            : null
                        }
                    </Slider>
                    : <Loading/>
                }

                {
                    this.state.showRegister &&
                    <LoginRegister setShowRegister={this.setShowRegister.bind(this)}/>
                }
            </div>
        );
    }
}

export default MembershipList;

