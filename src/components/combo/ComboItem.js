'use strict';

import React from "react";
import Strings from "../utils/Strings/Strings_ES";
import GafaFitSDKWrapper from "../utils/GafaFitSDKWrapper";
import {formatMoney} from "../utils/FormatUtils";

class ComboItem extends React.Component {
    constructor(props) {
        super(props);
    }

    handleClick(event) {
        event.preventDefault();
        let currentElement = this;
        if (GafaFitSDKWrapper.isAuthenticated()) {
            currentElement.showBuyFancyForLoggedUsers();
        } else {
            currentElement.showLoginForNotLoggedUsers();
        }
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
            <div className={["combo-item-container", "col-md-4"].join(" ")}>
                <div className={["combo-item", "mb-4"].join(" ")}
                     onClick={this.handleClick.bind(this)}>
                    <div className="card-body">
                        <h4 className="combo-item__name">{this.props.combo.name}</h4>
                        {this.props.combo.short_description &&
                        <p className="combo-item__short-description">{this.props.combo.short_description}</p>}
                        {this.props.combo.description &&
                        <p className="combo-item__description d-none">{this.props.combo.description}</p>}
                        {this.props.combo.has_discount &&
                        <h2 className={["combo-item__discount", "text-muted"].join(" ")}>
                            $ {formatMoney(this.props.combo.price, 0)}</h2>
                        }
                        <h2 className={["pricing-card-title", "combo-item__price"].join(" ")}>
                            $ {formatMoney(this.props.combo.price_final, 0)}</h2>
                        <p className="combo-item__services">{services['services']}</p>
                        <p className="combo-item__parent-services">{services['parents']}</p>
                        <p className="combo-item__expiration">{Strings.EXPIRE_IN} {this.props.combo.expiration_days} {Strings.DAYS} </p>
                    </div>
                </div>
            </div>
        );
    }
}

export default ComboItem;