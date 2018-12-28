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

    getParentServicesListForCombo() {
        const parentServicesListForCombo = this.props.combo.credit.services.map(function (service) {
                return service.service_parent;
            }
        ).filter(function (el) {
            return el != null;
        }).join(", ");
        return parentServicesListForCombo;
    }

    getServicesListForCombo() {
        const servicesListForCombo = this.props.combo.credit.services.map(function (service) {
                return service.category;
            }
        ).filter(function (el) {
            return el != null;
        }).join(", ");
        return servicesListForCombo;
    }

    render() {
        const servicesListForCombo = this.getServicesListForCombo();
        const parentServicesListForCombo = this.getParentServicesListForCombo();
        return (
            <div className={["combo-item", "col-md-4"].join(" ")} onClick={this.handleClick.bind(this)}>
                <p className="combo-item-name">{this.props.combo.name}</p>
                {this.props.combo.short_description &&
                <p className="combo-item-short-description">{this.props.combo.short_description}</p>}
                {this.props.combo.description &&
                <p className="combo-item-description">{this.props.combo.description}</p>}
                {this.props.combo.has_discount &&
                <p className="combo-item-discount">$ {this.props.combo.price}</p>
                }
                <p className="combo-item-price">$ {this.props.combo.price_final}</p>
                <p className="combo-item-services">{servicesListForCombo}</p>
                <p className="combo-item-parent-services">{parentServicesListForCombo}</p>
                <p className="combo-item-expiration">{Strings.EXPIRE_IN} {this.props.combo.expiration_days} {Strings.DAYS} </p>
            </div>
        );
    }
}

export default ComboItem;