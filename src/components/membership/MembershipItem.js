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
        GafaFitSDKWrapper.getMe(function () {
            if (window.GFtheme.me != null) {
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
        return (
            <div className={membershipClass + 'item ' + productClass} onClick={this.handleClick.bind(this)}>
                <div className={productClass + '__head'}>
                    <h3 className={'this-name'}>{this.props.membership.name}</h3>
                </div>
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
                            ${formatMoney(this.props.membership.price, 0)} MXN
                        </p>
                    </div>
                </div>
                <div className={productClass + '__footer'}>
                    <p className={'this-shortDescription'}>{this.props.membership.short_description || 'Este producto no cuenta con descripción corta.'}</p>
                    <p className={'this-expiration'}><span>{Strings.EXPIRE_IN}</span> <strong>{this.props.membership.expiration_days} {Strings.DAYS}</strong></p>
                </div>
            </div>
        );
    }
}

export default MembershipItem;