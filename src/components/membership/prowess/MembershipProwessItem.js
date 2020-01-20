'use strict';

import React from "react";
import GafaFitSDKWrapper from "../../utils/GafaFitSDKWrapper";
import {formatMoney} from "../../utils/FormatUtils";
// import './style/MembershipProwess.scss';

export default class MembershipProwessItem extends React.Component {
    constructor(props) {
        super(props);

        this.state = {
            currentBrand: this.props.currentBrand,
            currentLocation: window.GFtheme.location,

        }
    }

    componentDidMount(){
        let comp = this
        let {currentBrand} = comp.state;

        GafaFitSDKWrapper.getBrandLocationsWithBrand(
            currentBrand.slug, {} , function (result) {
                comp.setState({currentLocation : result.data[0].slug})
            }
        );
    }

    handleClick(event) {
        event.preventDefault();
        let currentElement = this;

        GafaFitSDKWrapper.isAuthenticated(function(auth){
            if (auth) {
                currentElement.showBuyFancyForLoggedUsers();
            } else {
                currentElement.showLoginForNotLoggedUsers();
            }
        });
    };

    showBuyFancyForLoggedUsers() {
        let {currentBrand, currentLocation} = this.state;
        GafaFitSDKWrapper.getFancyForBuyMembershipWithBrand(currentBrand.slug, currentLocation, this.props.membership.id, function (result) {});
    }

    showLoginForNotLoggedUsers() {
        window.GFtheme.membership_id = this.props.membership.id;
        this.props.setShowLogin(true);
    }

    getServicesAndParentsForMembership() {
        let servicesForMembership = [];
        servicesForMembership['services'] = "";
        servicesForMembership['parents'] = "";

        this.props.membership.credits.forEach(function (credit) {
            credit.services.forEach(function (service) {
                    if (service.category != null && !servicesForMembership['services'].includes(service.category)) {
                        servicesForMembership['services'] === "" ? servicesForMembership['services'] += service.category :
                            servicesForMembership['services'] += ", " + service.category;
                    }

                    if (service.service_parent != null && !servicesForMembership['parents'].includes(service.service_parent)) {
                        servicesForMembership['parents'] === "" ? servicesForMembership['parents'] += service.service_parent :
                            servicesForMembership['parents'] += ", " + service.service_parent;
                    }
                }
            )
        });

        return servicesForMembership;
    }

    render() {
        let {membership} = this.props;

        return (
            <div className={"qodef-price-table qodef-item-space"}>
                <div className={"qodef-pt-inner"}>
                    <ul>
                        <li className={"qodef-pt-prices"}>
                            { !membership.has_discount
                                ?   <div>
                                        <sup className={"qodef-pt-value"}>$</sup>
                                        <span className={"qodef-pt-price"}>{formatMoney(this.props.membership.price, 0)}</span>
                                    </div>
                                :   <div>
                                        <div>
                                            <sup className={"qodef-pt-value"}>$</sup>
                                            <span className={"qodef-pt-price "}>{formatMoney(this.props.membership.price_final, 0)}</span> 
                                        </div>
                                        <div>
                                            <span className={"qodef-pt-price is-discount"}>{formatMoney(this.props.membership.price, 0)}</span>
                                        </div>
                                    </div>
                            }
                            <h6 className={"qodef-pt-mark"}>{this.props.membership.name}</h6>
                        </li>
                        <li className={"qodef-pt-title-holder"}>
                            <span className={"qodef-pt-title"}>{this.props.membership.short_description}</span>
                        </li>
                        <li className={"qodef-pt-content"}>
                            <ul>
                                <li>{this.props.membership.description || 'Este producto no cuenta con descripción.'}</li>
                            </ul>
                        </li>
                        <li className={"qodef-pt-button"}>
                            <a onClick={this.handleClick.bind(this)} className={"qodef-btn qodef-btn-small qodef-btn-solid undercover"}>
                                Comprar
                            </a>
                        </li>
                    </ul>
                </div>
            </div>
        );
    }
}