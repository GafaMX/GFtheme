'use strict';

import React from "react";
import MembershipItem from "./MembershipItem";
import Strings from "../utils/Strings/Strings_ES";
import PaginationList from "../utils/PaginationList";
import LoginRegister from "../menu/LoginRegister";
import GafaFitSDKWrapper from "../utils/GafaFitSDKWrapper";
import Slider from "react-slick";
import 'slick-carousel/slick/slick.css';
import 'slick-carousel/slick/slick-theme.css';

//Estilos
import '../../styles/newlook/components/GFSDK-c-PackagesMemberships.scss';
import '../../styles/newlook/elements/GFSDK-e-product.scss';

class MembershipList extends React.Component {
    constructor(props) {
        super(props);

        this.state = {
            showLogin: false,
            list: this.props.list,
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
        let membershipClass = preC + '-membershipList';

        let settings = {
            dots: true,
            infinite: false,
            speed: 500,
            // slidesToShow: 3,
            slidesToShow: this.props.slidesToShow,
        };

        const listItems = this.state.list.map((membership) =>
            <MembershipItem key={membership.id} membership={membership} setShowLogin={this.setShowLogin.bind(this)}/>
        );

        return (
            <div className={membershipClass}>
                <Slider {...settings} className={membershipClass + '__container'}>
                    {listItems}
                </Slider>

                {/* <PaginationList page={this.state.currentPage} perpage={this.props.perPage}
                                allpages={this.props.lastPage} itemsList={this.props.total}
                                updatePaginationData={this.updatePaginationData.bind(this)}
                                getListData={GafaFitSDKWrapper.getMembershipList}
                                extraOptions={this.state.extraPaginationOptions}/> */}
                {
                    this.state.showLogin &&
                    <LoginRegister setShowLogin={this.setShowLogin.bind(this)}/>
                }
            </div>
        );
    }
}

export default MembershipList;

