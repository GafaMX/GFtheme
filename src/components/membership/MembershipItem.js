'use strict';

import React from "react";
import Strings from "../utils/Strings/Strings_ES";
import GafaFitSDKWrapper from "../utils/GafaFitSDKWrapper";
import {formatMoney} from "../utils/FormatUtils";

class MembershipItem extends React.Component {
    constructor(props) {
        super(props);
    }

    handleClick(event) {
        event.preventDefault();
        let currentElement = this;
        GafaFitSDKWrapper.isAuthenticated(function(auth) {
            if (auth) {
                currentElement.showBuyFancyForLoggedUsers();
            } else {
                currentElement.showLoginForNotLoggedUsers();
            }
        })
    };

    showBuyFancyForLoggedUsers() {
        GafaFitSDKWrapper.getFancyForBuyMembership(this.props.membership.id, function (result) {

        });
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
        let preC = 'GFSDK-c';
        let preE = 'GFSDK-e';
        let productClass = preE + '-product';
        let membershipClass = preC + '-membershipList';
        const services = this.getServicesAndParentsForMembership();
        let {membership} = this.props;
        return (
            <div className={membershipClass + '__item ' + productClass} >
                <div className={productClass + '__head'}>
                    <h3 className={'this-name'}>{this.props.membership.name}</h3>
                </div>
                {/* <hr className={productClass + '__divider'}></hr> */}
                <div className={productClass + '__body'}>
                    {this.props.membership.has_discount &&
                    <div>
                        <div className={'this-price has-discount'}>
                            <p>
                                ${formatMoney(this.props.membership.price, 0)} MXN
                            </p>
                        </div>
                    </div>
                    }
                     <div className="this-price has-total">
                        <p>
                           ${formatMoney(this.props.membership.price_final, 0)} MXN
                        </p>
                     </div>
                    
                     {/* {membership.short_description
                        ?   <p className={'this-shortDescription'}>{membership.short_description}</p>
                        :   null
                     } */}

                     <button className="buq-accentColor" onClick={this.handleClick.bind(this)}> Comprar </button>

                </div>
                <div className={productClass + '__footer'}>
                    {membership.expiration_days
                        ?   <p className={'this-expiration'}><span>{Strings.EXPIRE_IN}</span> <strong>{membership.expiration_days} {Strings.DAYS}</strong></p>
                        :   null
                    }
                </div>
            </div>
        );
    }
}

export default MembershipItem;