'use strict';

import GafaFitSDKWrapper from "../utils/GafaFitSDKWrapper";

const CHECKOUT_EVENTS = {
    opening: 'buq:checkout:opening',
    opened: 'buq:checkout:opened',
    closed: 'buq:checkout:closed',
    error: 'buq:checkout:error',
};

const DEFAULT_TIMEOUT = 15000;
const FANCY_SELECTOR = '[data-gf-theme="fancy"]';
const CLOSE_BUTTON_ID = 'CreateReservationFancyTemplate--Close';
const SPINNER_HTML = '<div class="spinner"><div class="bounce1"></div><div class="bounce2"></div><div class="bounce3"></div></div>';

function dispatchSDKEvent(name, detail) {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
        return;
    }

    let event;
    if (typeof window.CustomEvent === 'function') {
        event = new window.CustomEvent(name, {detail});
    } else {
        event = document.createEvent('CustomEvent');
        event.initCustomEvent(name, false, false, detail);
    }

    window.dispatchEvent(event);
}

function createCheckoutError(code, message, cause) {
    return {
        code: code,
        message: message,
        cause: cause || null,
    };
}

function requireField(params, fieldName) {
    if (!params || params[fieldName] === undefined || params[fieldName] === null || params[fieldName] === '') {
        throw createCheckoutError('invalid_request', `Missing required checkout field: ${fieldName}`);
    }
}

class CheckoutController {
    static get events() {
        return CHECKOUT_EVENTS;
    }

    static emit(name, detail) {
        dispatchSDKEvent(name, detail);
    }

    static openReservationCheckout(params) {
        return CheckoutController.openCheckout('reservation', params);
    }

    static openComboCheckout(params) {
        return CheckoutController.openCheckout('combo', params);
    }

    static openMembershipCheckout(params) {
        return CheckoutController.openCheckout('membership', params);
    }

    static openProductCheckout(params) {
        return CheckoutController.openCheckout('product', params);
    }

    static openStoreCheckout(params) {
        return CheckoutController.openCheckout('store', params);
    }

    static openCheckout(type, params) {
        params = params || {};
        const timeout = params.timeout || DEFAULT_TIMEOUT;
        const context = CheckoutController.contextFor(type, params);

        return new Promise(function (resolve, reject) {
            let fancy;

            try {
                CheckoutController.validateCheckoutRequest(type, params);
                fancy = CheckoutController.prepareFancyContainer();
                CheckoutController.emit(CHECKOUT_EVENTS.opening, context);
            } catch (error) {
                const checkoutError = CheckoutController.normalizeError(error);
                CheckoutController.emit(CHECKOUT_EVENTS.error, {
                    context: context,
                    error: checkoutError,
                });
                reject(checkoutError);
                return;
            }

            CheckoutController.ensureAuthenticated().then(function () {
                CheckoutController.requestCheckout(type, params);
                return CheckoutController.waitForFancyContent(fancy, timeout);
            }).then(function () {
                const handle = CheckoutController.createHandle(fancy, context);
                CheckoutController.wireCloseButton(handle);
                CheckoutController.emit(CHECKOUT_EVENTS.opened, {
                    context: context,
                    handle: handle.publicHandle,
                });
                resolve(handle.publicHandle);
            }).catch(function (error) {
                const checkoutError = CheckoutController.normalizeError(error);
                CheckoutController.resetFancy(fancy);
                CheckoutController.emit(CHECKOUT_EVENTS.error, {
                    context: context,
                    error: checkoutError,
                });
                reject(checkoutError);
            });
        });
    }

    static contextFor(type, params) {
        return {
            type: type,
            brandSlug: params.brandSlug || null,
            locationSlug: params.locationSlug || null,
            meetingId: params.meetingId || null,
            comboId: params.comboId || null,
            membershipId: params.membershipId || null,
            productId: params.productId || null,
            reservationId: params.reservationId || null,
            defaultStoreTab: params.defaultStoreTab || null,
        };
    }

    static ensureAuthenticated() {
        return new Promise(function (resolve, reject) {
            GafaFitSDKWrapper.getMe(function (me) {
                if (me) {
                    resolve(me);
                    return;
                }

                reject(createCheckoutError('unauthenticated', 'A user session is required to open checkout'));
            });
        });
    }

    static validateCheckoutRequest(type, params) {
        requireField(params, 'brandSlug');
        requireField(params, 'locationSlug');

        switch (type) {
            case 'reservation':
                requireField(params, 'meetingId');
                break;
            case 'combo':
                requireField(params, 'comboId');
                break;
            case 'membership':
                requireField(params, 'membershipId');
                break;
            case 'product':
                requireField(params, 'productId');
                break;
            case 'store':
                break;
            default:
                throw createCheckoutError('invalid_checkout_type', `Unsupported checkout type: ${type}`);
        }
    }

    static requestCheckout(type, params) {
        switch (type) {
            case 'reservation':
                GafaFitSDKWrapper.getFancyForMeetingReservation(
                    params.brandSlug,
                    params.locationSlug,
                    params.meetingId,
                    function () {}
                );
                break;
            case 'combo':
                GafaFitSDKWrapper.getFancyForBuyCombo(
                    params.brandSlug,
                    params.locationSlug,
                    params.comboId,
                    function () {}
                );
                break;
            case 'membership':
                GafaFitSDKWrapper.getFancyForBuyMembership(
                    params.brandSlug,
                    params.locationSlug,
                    params.membershipId,
                    function () {}
                );
                break;
            case 'product':
                GafaFitSDKWrapper.getFancyForBuyProduct(
                    params.brandSlug,
                    params.locationSlug,
                    params.productId,
                    params.reservationId || null,
                    function () {}
                );
                break;
            case 'store':
                GafaFitSDKWrapper.getFancyForBuyStore(
                    params.brandSlug,
                    params.locationSlug,
                    params.defaultStoreTab || null,
                    function () {}
                );
                break;
            default:
                throw createCheckoutError('invalid_checkout_type', `Unsupported checkout type: ${type}`);
        }
    }

    static prepareFancyContainer() {
        if (typeof document === 'undefined') {
            throw createCheckoutError('browser_required', 'Checkout can only be opened in a browser runtime');
        }

        const fancy = document.querySelector(FANCY_SELECTOR);
        if (!fancy) {
            throw createCheckoutError('missing_fancy_container', `Missing checkout container ${FANCY_SELECTOR}`);
        }

        fancy.innerHTML = '';
        fancy.classList.add('active');

        setTimeout(function () {
            fancy.classList.add('show');
        }, 400);

        return fancy;
    }

    static waitForFancyContent(fancy, timeout) {
        const startedAt = Date.now();

        return new Promise(function (resolve, reject) {
            function check() {
                if (fancy.firstChild) {
                    resolve(fancy.firstChild);
                    return;
                }

                if (Date.now() - startedAt > timeout) {
                    reject(createCheckoutError('checkout_open_timeout', 'Checkout did not render before the timeout'));
                    return;
                }

                setTimeout(check, 100);
            }

            check();
        });
    }

    static createHandle(fancy, context) {
        const internalHandle = {
            context: context,
            fancy: fancy,
            close: function () {
                CheckoutController.closeFancy(fancy, context);
            },
        };

        internalHandle.publicHandle = {
            type: context.type,
            context: context,
            close: internalHandle.close,
        };

        return internalHandle;
    }

    static wireCloseButton(handle) {
        const closeFancy = document.getElementById(CLOSE_BUTTON_ID);

        if (!closeFancy) {
            return;
        }

        closeFancy.addEventListener('click', function () {
            handle.close();
        });
    }

    static closeFancy(fancy, context) {
        CheckoutController.emit('buq__reservation_fancy_before_closed', context);

        while (fancy.firstChild) {
            fancy.removeChild(fancy.firstChild);
        }

        fancy.classList.remove('show');

        setTimeout(function () {
            fancy.classList.remove('active');
            fancy.innerHTML = SPINNER_HTML;
            CheckoutController.emit(CHECKOUT_EVENTS.closed, context);
        }, 400);
    }

    static resetFancy(fancy) {
        if (!fancy) {
            return;
        }

        while (fancy.firstChild) {
            fancy.removeChild(fancy.firstChild);
        }

        fancy.classList.remove('show');

        setTimeout(function () {
            fancy.classList.remove('active');
            fancy.innerHTML = SPINNER_HTML;
        }, 400);
    }

    static normalizeError(error) {
        if (error && error.code && error.message) {
            return error;
        }

        return createCheckoutError('checkout_error', error && error.message ? error.message : 'Unexpected checkout error', error);
    }
}

export default CheckoutController;
