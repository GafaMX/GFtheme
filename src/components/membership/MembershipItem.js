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
        const services = this.getServicesAndParentsForMembership();
        return (
            <div className={["membership-item-container", "col-md-4"].join(" ")}>
                <div className={["membership-item", "mb-4", "card", "shadow-sm"].join(" ")}
                     onClick={this.handleClick.bind(this)}>
                    <div className="card-header">
                        <h4 className={["membership-item-name", "my-0", "font-weight-normal"].join(" ")}>{this.props.membership.name}</h4>
                    </div>
                    <div className="card-body">
                        {this.props.membership.short_description &&
                        <p className="membership-item-short-description">{this.props.membership.short_description}</p>}
                        {this.props.membership.description &&
                        <p className="membership-item-description">{this.props.membership.description}</p>}
                        {this.props.membership.has_discount &&
                        <h2 className={["membership-item-discount", "text-muted", "font-weight-normal"].join(" ")}>
                            $ {formatMoney(this.props.membership.price, 0)}</h2>
                        }
                        <h2 className={["pricing-card-title", "membership-item-price", "font-weight-normal"].join(" ")}>
                            $ {formatMoney(this.props.membership.price_final, 0)}</h2>
                        <p className="membership-item-services">{services['services']}</p>
                        <p className="membership-item-parent-services">{services['parents']}</p>
                        <p className="membership-item-expiration">{Strings.EXPIRE_IN} {this.props.membership.expiration_days} {Strings.DAYS} </p>
                    </div>
                </div>
            </div>
        );
    }
}

export default MembershipItem;