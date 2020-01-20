'use strict';

import React from "react";
import Strings from "../../utils/Strings/Strings_ES";
import GafaFitSDKWrapper from "../../utils/GafaFitSDKWrapper";
import {formatMoney} from "../../utils/FormatUtils";

class MembershipDefaultItem extends React.Component {
    // constructor(props) {
    //     super(props);
    // }

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
        GafaFitSDKWrapper.getFancyForBuyMembership(this.props.membership.id, function (result) {});
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
            <div className={["membership-item", "col-md-4"].join(" ")}>
                <div className={["membership-item__container", "mb-4"].join(" ")}
                     onClick={this.handleClick.bind(this)}>
                    <div className="card-body">
                        <h3 className="membership-item__name">{this.props.membership.name}</h3>
                        <hr></hr>
                        {this.props.membership.has_discount &&
                        <div className="membership-item__price">
                            <div className={["membership-item__price-no-discount", "text-muted"].join(" ")}>
                                <p>
                                    $
                                </p>
                                <p>
                                    {formatMoney(this.props.membership.price, 0)}
                                </p>
                                <p>
                                    <span>00</span>
                                    <span>MXN</span>
                                </p>
                            </div>
                        </div>
                        }
                        <div className="membership-item__price">
                            <div className={["membership-item__price-no"].join(" ")}>
                                <p>
                                    $
                                </p>
                                <p>
                                    {formatMoney(this.props.membership.price_final, 0)}
                                </p>
                                <p>
                                    <span>00</span>
                                    <span>/ MXN</span>
                                </p>
                            </div>
                        </div>
                        <div className="membership-item__content">
                            {this.props.membership.short_description &&
                            <p className="membership-item__short-description d-none">{this.props.membership.short_description}</p>}
                            <p className="membership-item__description">
                                {this.props.membership.description || 'Este producto no cuenta con descripción. Lorem ipsum dolor sit amet consectetur adipisicing elit. Perspiciatis quas vitae quis iure ab rerum veniam.'}
                            </p>
                            <p className="membership-item__services">{services['services']}</p>
                            <p className="membership-item__parent-services">{services['parents']}</p>
                        </div>
                        <p className="membership-item__expiration">
                            <span>{Strings.EXPIRE_IN}:</span> <span>{this.props.membership.expiration_days} {Strings.DAYS}</span>
                        </p>
                    </div>
                </div>
            </div>
        );
    }
}

export default MembershipDefaultItem;