'use strict';

import React from "react";
import Strings from "../utils/Strings/Strings_ES";
import GafaFitSDKWrapper from "../utils/GafaFitSDKWrapper";

class ComboItem extends React.Component {
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
        GafaFitSDKWrapper.getFancyForBuyCombo(this.props.combo.id, function (result) {

        });
    }

    showLoginForNotLoggedUsers() {
        window.GFtheme.combo_id = this.props.combo.id;
        this.props.setShowLogin(true);
    }

    getServicesAndParentsForCombo() {
        let servicesAndParentsForCombo = [];
        servicesAndParentsForCombo['services'] = "";
        servicesAndParentsForCombo['parents'] = "";

        this.props.combo.credit.services.forEach(function (service) {
                if (service.category != null && !servicesAndParentsForCombo['services'].includes(service.category)) {
                    servicesAndParentsForCombo['services'] === "" ? servicesAndParentsForCombo['services'] += service.category :
                        servicesAndParentsForCombo['services'] += ", " + service.category;
                }

                if (service.service_parent != null && !servicesAndParentsForCombo['parents'].includes(service.service_parent)) {
                    servicesAndParentsForCombo['parents'] === "" ? servicesAndParentsForCombo['parents'] += service.service_parent :
                        servicesAndParentsForCombo['parents'] += ", " + service.service_parent;
                }

            }
        );
        return servicesAndParentsForCombo;
    }

    render() {
        const services = this.getServicesAndParentsForCombo();
        return (
            <div className={["combo-item", "mb-4", "mr-2", "ml-2", "card", "shadow-sm"].join(" ")}
                 onClick={this.handleClick.bind(this)}>
                <div className="card-header">
                    <h4 className="combo-item-name">{this.props.combo.name}</h4>
                </div>
                <div className="card-body">
                    {this.props.combo.short_description &&
                    <p className="combo-item-short-description">{this.props.combo.short_description}</p>}
                    {this.props.combo.description &&
                    <p className="combo-item-description">{this.props.combo.description}</p>}
                    {this.props.combo.has_discount &&
                    <h2 className={["combo-item-discount", "text-muted", "font-weight-normal"].join(" ")}>
                        $ {this.props.combo.price}</h2>
                    }
                    <h2 className={["pricing-card-title", "combo-item-price", "font-weight-normal"].join(" ")}>
                        $ {this.props.combo.price_final}</h2>
                    <p className="combo-item-services">{services['services']}</p>
                    <p className="combo-item-parent-services">{services['parents']}</p>
                    <p className="combo-item-expiration">{Strings.EXPIRE_IN} {this.props.combo.expiration_days} {Strings.DAYS} </p>
                </div>
            </div>
        );
    }
}

export default ComboItem;