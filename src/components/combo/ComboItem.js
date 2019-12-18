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

        GafaFitSDKWrapper.isAuthenticated(function(auth){
            if (auth) {
                currentElement.showBuyFancyForLoggedUsers();
            } else {
                currentElement.showLoginForNotLoggedUsers();
            }
        });
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
        let preC = 'GFSDK-c';
        let preE = 'GFSDK-e';
        let productClass = preE + '-product';
        let comboClass = preC + '-membershipList';
        const services = this.getServicesAndParentsForCombo();

        return (
            <div className={comboClass + 'item ' + productClass} onClick={this.handleClick.bind(this)}>
                <div className={productClass + '__head'}>
                    <h3 className="this-name">{this.props.combo.name}</h3>
                </div>
                <div className={productClass + '__body'}>
                    {this.props.combo.has_discount &&
                        <div>
                            <div className="this-price has-discount">
                                <p>
                                    ${formatMoney(this.props.combo.price, 0)} MXN
                                </p>
                            </div>
                        </div>
                    }
                    <div className="this-price has-total">
                        <p>
                            ${formatMoney(this.props.combo.price_final, 0)} MXN
                        </p>
                    </div>
                </div>
                <div className={productClass + '__footer'}>
                    <p className={'this-shortDescription'}>{this.props.combo.short_description || 'Este producto no cuenta con descripción corta.'}</p>
                    <p className={'this-expiration'}><span>{Strings.EXPIRE_IN}</span> <strong>{this.props.combo.expiration_days} {Strings.DAYS}</strong></p>
                </div>
            </div>
        );
    }
}

export default ComboItem;