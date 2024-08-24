'use strict';

import React from "react";
import GafaFitSDKWrapper from "../utils/GafaFitSDKWrapper";
import GlobalStorage from "../store/GlobalStorage";
import Loading from "../common/Loading";
import {renderToString} from "react-dom/server";
import '../../styles/newlook/components/GFSDK-c-PurchaseButton.scss'
import LoginRegister from "../menu/LoginRegister";

class PurchaseButton extends React.Component {
    constructor(props) {
        super(props);

        this.state = {
            brand: null,
            location: null,
            loaded: false,
            showRegister: false,
        }

        this.setShowRegister = this.setShowRegister.bind(this);

        this.handleClick = this.handleClick.bind(this);

        if (props.container) {
            if (props.container.style.position === '') {
                props.container.style.position = 'relative';
            }
            // if (props.container.tagName === 'A') {
            props.container.addEventListener('click', this.handleClick);
            // } else {
            //     let container_button = props.container.querySelector('a');
            //     if (container_button !== null) {
            //         let comp = this;
            //         // setTimeout(function () {
            //         container_button.addEventListener('click', comp.handleClick);
            //         // }, 400)
            //     }
            // }
        }
    }

    componentDidMount() {
        let {location_id} = this.props;

        let locations = GlobalStorage.get('locations');
        let first_location = locations.find(function (location) {
            return parseInt(location.id) === parseInt(location_id);
        });

        if (first_location === null || typeof first_location === "undefined") {
            first_location = locations[0];
        }

        let brand = first_location.brand;

        this.setState({
            brand: brand,
            location: first_location,
            loaded: true
        });

        // window.GFtheme.combo_id = this.props.combo.id;
        // window.GFtheme.brand_slug = brand.slug;
        // window.GFtheme.location_slug = first_location.slug;
    }

    /**
     *
     * @param event
     */
    handleClick(event) {
        event.preventDefault();
        this.attemptPurchase();
    }

    clear() {
        this.setState({
            loaded: true
        })
    }

    attemptPurchase(no_open = false) {
        if (this.state.loaded) {
            let currentElement = this;
            let me = GlobalStorage.get('me');

            if (!(no_open && me === null)) {
                currentElement.setState({
                    loaded: false
                }, function () {
                    GafaFitSDKWrapper.isAuthenticated(function (auth) {
                        if (auth) {
                            currentElement.makePurchase();
                        } else {
                            if (!no_open) {
                                currentElement.showLoginForNotLoggedUsers();
                            } else {
                                currentElement.clear();
                            }
                        }
                    });
                });
            }
        }
    }

    makePurchase() {
        let comp = this;
        let {combo_id, membership_id, product_id, reservation_id, default_store_tab} = this.props;
        let {brand, location} = this.state;

        const fancy = document.querySelector('[data-gf-theme="fancy"]');
        fancy.innerHTML = '';
        fancy.classList.add('active');

        setTimeout(function () {
            fancy.classList.add('show');
        }, 400);

        if (typeof combo_id !== "undefined" && combo_id !== null) {
            GafaFitSDKWrapper.getFancyForBuyCombo(
                brand.slug,
                location.slug,
                combo_id,
                comp.purchaseCallback.bind(comp, fancy)
            );
        } else if (typeof membership_id !== "undefined" && membership_id !== null) {
            GafaFitSDKWrapper.getFancyForBuyMembership(
                brand.slug,
                location.slug,
                membership_id,
                comp.purchaseCallback.bind(comp, fancy)
            );
        } else if (typeof product_id !== "undefined" && product_id !== null) {
            GafaFitSDKWrapper.getFancyForBuyProduct(
                brand.slug,
                location.slug,
                product_id,
                reservation_id,
                comp.purchaseCallback.bind(comp, fancy)
            );
        } else {
            GafaFitSDKWrapper.getFancyForBuyStore(
                brand.slug,
                location.slug,
                default_store_tab,
                comp.purchaseCallback.bind(comp, fancy)
            );
        }
    }

    purchaseCallback(fancy, result) {
        let comp = this;
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
                        loaded: true
                    });
                })
            } else {
                setTimeout(getFancy, 1000);
            }
        }
    }

    showLoginForNotLoggedUsers() {
        window.GFtheme.combo_id = this.props.combo_id;
        window.GFtheme.membership_id = this.props.membership_id;
        window.GFtheme.brand_slug = this.state.brand.slug;
        window.GFtheme.location_slug = this.state.location.slug;

        this.setShowRegister(true);

        this.setState({
            loaded: true
        });
    }

    showLoading() {
        let {container} = this.props;
        let {loaded} = this.state;

        if (loaded) {
            if (container.querySelector('.GFSDK-com-loading'))
                container.querySelector('.GFSDK-com-loading').remove();
        } else {
            if (container.querySelector('.GFSDK-com-loading') === null) {
                if (container.tagName === 'A')
                    container.innerHTML += renderToString((<Loading/>));
                else
                    container.querySelector('a').innerHTML += renderToString((<Loading/>));
            }
        }
    }

    setShowRegister(showRegister) {
        let comp = this;
        this.setState({
            showRegister: showRegister
        }, function () {
            if (!showRegister) {
                setTimeout(function () {
                    // comp.makePurchase();
                    comp.attemptPurchase(true);
                }, 500);
            }
        });
    }

    render() {
        let {showRegister, location, brand, loaded} = this.state;
        if (!this.props.no_loading)
            this.showLoading();

        if (showRegister) {
            return (<LoginRegister setShowRegister={this.setShowRegister.bind(this)} preventLoginStateChange={true}/>)
        }

        return null;
    }
}

export default PurchaseButton;