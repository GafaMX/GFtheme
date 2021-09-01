'use strict';

import React from "react";
import Strings from "../utils/Strings/Strings_ES";
import GlobalStorage from "../store/GlobalStorage";
import GafaFitSDKWrapper from "../utils/GafaFitSDKWrapper";

import {formatMoney} from "../utils/FormatUtils";

class MembershipItem extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            currentBrand: null,
            currentLocation: null,
            openFancy: false,
        }
    }

    componentDidMount() {
        let {membership} = this.props;
        let locations = GlobalStorage.get('locations');

        if (locations) {
            locations = locations.filter(function (location) {
                return membership.brands_id === location.brand.id
            })
        }

        this.setState({
            currentBrand: locations[0].brand,
            currentLocation: locations[0],
        })
    }

    handleClick(event) {
        event.preventDefault();
        let currentElement = this;
        GafaFitSDKWrapper.isAuthenticated(function (auth) {
            if (auth) {
                currentElement.showBuyFancyForLoggedUsers();
            } else {
                currentElement.showLoginForNotLoggedUsers();
            }
        })
    };

    showBuyFancyForLoggedUsers() {
        let comp = this;
        let {membership} = this.props;
        let {currentBrand, currentLocation} = this.state

        const fancy = document.querySelector('[data-gf-theme="fancy"]');
        fancy.classList.add('active');

        comp.setState({
            openFancy: true,
        });

        setTimeout(function () {
            fancy.classList.add('show');
        }, 400);


        GafaFitSDKWrapper.getFancyForBuyMembership(
            currentBrand.slug,
            currentLocation.slug,
            membership.id,
            function (result) {
                getFancy();

                function getFancy() {
                    if (document.querySelector('[data-gf-theme="fancy"]').firstChild) {
                        const closeFancy = document.getElementById('CreateReservationFancyTemplate--Close');

                        closeFancy.addEventListener('click', function (e) {
                            fancy.removeChild(document.querySelector('[data-gf-theme="fancy"]').firstChild);

                            fancy.classList.remove('show');

                            setTimeout(function () {
                                fancy.classList.remove('active');
                                fancy.innerHTML = '<div class="spinner"><div class="bounce1"></div><div class="bounce2"></div><div class="bounce3"></div></div>';
                            }, 400);

                            comp.setState({
                                openFancy: false,
                            })
                        })
                    } else {
                        setTimeout(getFancy, 1000);
                    }
                }
            }
        );
    }

    showLoginForNotLoggedUsers() {
        let comp = this;
        let locations = GlobalStorage.get('locations');
        let brands = GlobalStorage.get('brands');

        let brand = brands.find(function (brand) {
            return brand.id === comp.props.membership.brands_id
        });
        locations = locations.filter(function (location) {
            return location.brand.id === comp.props.membership.brands_id
        });

        window.GFtheme.membership_id = this.props.membership.id;
        window.GFtheme.brand_slug = brand.slug;
        window.GFtheme.location_slug = locations[0].slug;

        this.props.setShowRegister(true);
    }

    //  getServicesAndParentsForMembership() {
    //    let servicesForMembership = [];
    //    servicesForMembership['services'] = "";
    //    servicesForMembership['parents'] = "";

    //    this.props.membership.credits.forEach(function (credit) {
    //       credit.services.forEach(function (service) {
    //                if (service.category != null && !servicesForMembership['services'].includes(service.category)) {
    //                   servicesForMembership['services'] === "" ? servicesForMembership['services'] += service.category :
    //                         servicesForMembership['services'] += ", " + service.category;
    //                }

    //                if (service.service_parent != null && !servicesForMembership['parents'].includes(service.service_parent)) {
    //                   servicesForMembership['parents'] === "" ? servicesForMembership['parents'] += service.service_parent :
    //                         servicesForMembership['parents'] += ", " + service.service_parent;
    //                }
    //             }
    //       )
    //    });

    //    return servicesForMembership;
    //  }

    render() {
        let preC = 'GFSDK-c';
        let preE = 'GFSDK-e';
        let productClass = preE + '-product';
        let membershipClass = preC + '-membershipList';
        let {membership} = this.props;
        let {openFancy} = this.state;
        // const services = this.getServicesAndParentsForMembership();
        let currency = GlobalStorage.getBrandCurrency(membership.brand);

        return (
            <div className={membershipClass + '__item ' + productClass}>
                <div className={productClass + '__head'}>
                    <h3 className={'this-name'}>{this.props.membership.name}</h3>
                </div>
                <div className={productClass + '__body'}>
                    {this.props.membership.has_discount &&
                    <div>
                        <div className={'this-price has-discount'}>
                            <p>
                                {currency.prefijo}{formatMoney(this.props.membership.price, 0)} {currency.sufijo}
                            </p>
                        </div>
                    </div>
                    }
                    <div className="this-price has-total">
                        <p>
                            {currency.prefijo}{formatMoney(this.props.membership.price_final, 0)} {currency.sufijo}
                        </p>
                    </div>

                    <button style={{pointerEvents: openFancy ? 'none' : 'auto'}} className="buq-accentColor"
                            onClick={openFancy ? null : this.handleClick.bind(this)}> Comprar
                    </button>

                </div>
                <div className={productClass + '__footer'}>
                    {membership.expiration_days
                        ? <p className={'this-expiration'}><span>{Strings.EXPIRE_IN}</span>
                            <strong>{membership.expiration_days} {Strings.DAYS}</strong></p>
                        : null
                    }
                </div>
            </div>
        );
    }
}

export default MembershipItem;