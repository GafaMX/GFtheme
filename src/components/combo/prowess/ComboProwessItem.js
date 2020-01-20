'use strict';

import React from "react";
import GafaFitSDKWrapper from "../../utils/GafaFitSDKWrapper";
import {formatMoney} from "../../utils/FormatUtils";
// import './style/ComboProwess.scss'

class ComboProwessItem extends React.Component {

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
        GafaFitSDKWrapper.getFancyForBuyComboWithBrand(currentBrand.slug, currentLocation, this.props.combo.id, function (result) {});
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
        // const services = this.getServicesAndParentsForCombo();
        let {combo} = this.props;
        var innerStyle = {
            // 'height' : '100%',
        }

        return (
            <div className={"qodef-price-table qodef-item-space"}>
                <div className={"qodef-pt-inner"} style={innerStyle}>
                    <ul>
                        <li className={"qodef-pt-prices"}>
                        { !combo.has_discount
                                ?   <div>
                                        <sup className={"qodef-pt-value"}>$</sup>
                                        <span className={"qodef-pt-price"}>{formatMoney(combo.price, 0)}</span>
                                    </div>
                                :   <div>
                                        <div>
                                            <sup className={"qodef-pt-value"}>$</sup>
                                            <span className={"qodef-pt-price "}>{formatMoney(combo.price_final, 0)}</span> 
                                        </div>
                                        <div>
                                            <span className={"qodef-pt-price is-discount"}>{formatMoney(combo.price, 0)}</span>
                                        </div>
                                    </div>
                            }
                            <h6 className={"qodef-pt-mark"}>{this.props.combo.name}</h6>
                        </li>
                        <li className={"qodef-pt-title-holder"}>
                            <span className={"qodef-pt-title"}>{this.props.combo.short_description}</span>
                        </li>
                        <li className={"qodef-pt-content"}>
                            <ul>
                                <li>{this.props.combo.description || 'Este producto no cuenta con descripción.'}</li>
                            </ul>
                        </li>
                        <li className={"qodef-pt-button"}>

                            <a onClick={this.handleClick.bind(this)} className={"qodef-btn qodef-btn-small qodef-btn-solid undercover"}>
                                Comprar
                            </a>
                            {/* <a onClick={this.handleClick.bind(this)} className={"qodef-btn qodef-btn-small qodef-btn-solid qodef-btn-icon"}>
                                <span className={"qodef-btn-text"}>
                                    <span className={"qodef-btn-text-inner"}>Comprar</span>
                                </span>
                                <span className={"qodef-btn-text-inner qodef-btn-text-inner-icon"}>
                                    <i className={"qodef-icon-ion-icon ion-arrow-right-c "}></i>
                                    <i className={"qodef-icon-ion-icon ion-arrow-right-c "}></i>
                                </span>
                            </a> */}
                        </li>
                    </ul>
                </div>
            </div>
            /* <div className={["combo-item", "col-md-4"].join(" ")}>
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
            </div> */
        );
    }
}

export default ComboProwessItem;