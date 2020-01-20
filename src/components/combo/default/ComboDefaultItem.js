'use strict';

import React from "react";
import Strings from "../../utils/Strings/Strings_ES";
import GafaFitSDKWrapper from "../../utils/GafaFitSDKWrapper";
import {formatMoney} from "../../utils/FormatUtils";

class ComboDefaultItem extends React.Component {
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
        const services = this.getServicesAndParentsForCombo();

        return (
            <div className={["combo-item", "col-md-4"].join(" ")}>
                <div className={["combo-item__container", "mb-4"].join(" ")}
                     onClick={this.handleClick.bind(this)}>
                    <div className="card-body">
                        <h3 className="combo-item__name">{this.props.combo.name}</h3>
                        <hr></hr>
                        {this.props.combo.has_discount &&
                        <div className="combo-item__price">
                            <div className={["combo-item__price-no-discount", "text-muted"].join(" ")}>
                                <p>
                                    $
                                </p>
                                <p>
                                    {formatMoney(this.props.combo.price, 0)}
                                </p>
                                <p>
                                    <span>00</span>
                                    <span>MXN</span>
                                </p>
                            </div>
                        </div>
                        }
                        <div className="combo-item__price">
                            <div className={["combo-item__price-no"].join(" ")}>
                                <p>
                                    $
                                </p>
                                <p>
                                    {formatMoney(this.props.combo.price_final, 0)}
                                </p>
                                <p>
                                    <span>00</span>
                                    <span>/ MXN</span>
                                </p>
                            </div>
                        </div>
                        <div className="combo-item__content">
                            {this.props.combo.short_description &&
                            <p className="combo-item__short-description d-none">{this.props.combo.short_description}</p>}
                            <p className="combo-item__description">
                                {this.props.combo.description || 'Este producto no cuenta con descripción. Lorem ipsum dolor sit amet consectetur adipisicing elit. Perspiciatis quas vitae quis iure ab rerum veniam.'}
                            </p>
                            <p className="combo-item__services">{services['services']}</p>
                            <p className="combo-item__parent-services">{services['parents']}</p>
                        </div>
                        <p className="combo-item__expiration">
                            <span>{Strings.EXPIRE_IN}:</span> <span>{this.props.combo.expiration_days} {Strings.DAYS}</span>
                        </p>
                    </div>
                </div>
            </div>
        );
    }
}

export default ComboDefaultItem;