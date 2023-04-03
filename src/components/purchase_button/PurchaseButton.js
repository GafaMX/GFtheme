'use strict';

import React from "react";
import GafaFitSDKWrapper from "../utils/GafaFitSDKWrapper";
import GlobalStorage from "../store/GlobalStorage";

class PurchaseButton extends React.Component {
    constructor(props) {
        super(props);

        if (props.container) {
            props.container.addEventListener('click', this.handleClick.bind(this));
        }
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
        });
    }

    getLocationAndBrand() {
        let {brand_id, location_id} = this.props;

        let locations = GlobalStorage.get('locations');
        locations = locations.filter(function (location) {
            return location.brand.slug === comp.props.combo.brand.slug
        });

        window.GFtheme.combo_id = this.props.combo.id;
        window.GFtheme.brand_slug = this.props.combo.brand.slug;
        window.GFtheme.location_slug = locations[0].slug;
    }

    showBuyFancyForLoggedUsers() {
        let comp = this;
        let {combo_id} = this.props;
        let {currentBrand, currentLocation} = this.getLocationAndBrand();

        // comp.setState({
        //     openFancy: true,
        // });

        const fancy = document.querySelector('[data-gf-theme="fancy"]');
        fancy.classList.add('active');

        setTimeout(function () {
            fancy.classList.add('show');
        }, 400);

        GafaFitSDKWrapper.getFancyForBuyCombo(
            currentBrand.slug,
            currentLocation.slug,
            combo.id,
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

    render() {
        return null;
    }
}

export default PurchaseButton;