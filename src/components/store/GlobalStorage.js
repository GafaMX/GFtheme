import GafaFitSDKWrapper from "../utils/GafaFitSDKWrapper";

const GlobalStorage = {
    listeners: [],
    segmentedListeners: [],
    me: null,
    wallet: null,

    //Brands Controller
    brands: [],
    currentBrand: null,

    //Location Controller
    locations: [],

    //Combos
    combos: [],

    //Memberships
    memberships: [],

    //Staff
    staff: [],

    //Staff
    services: [],

    //Rooms
    rooms: [],

    //PaymentMethod Controller
    ConektaPaymentInfo: null,
    ConektaPaymentNotification: null,
    ConektaPaymentError: null,


    //Profile Filter
    filter_location: '',
    filter_brand: '',


    //Future Class
    future_classes: null,
    past_classes: null,
    purchase: null,

    get(property) {
        return this[property];
    },
    /**
     *
     * @param brand
     * @returns {*|{sufijo, prefijo}}
     */
    getBrandCurrency(brand){
        let currencyId = !!brand && brand.hasOwnProperty('currencies_id') ? brand.currencies_id : 1;
        return GlobalStorage.getCurrency(currencyId);
    },
    getCurrency(currency_id){
        switch (currency_id) {
            case 2:
                return {
                    sufijo: 'USD',
                    prefijo: '$',
                };
                break;
            case 3:
                return {
                    sufijo: 'EUR',
                    prefijo: '€',
                };
                break;
            default:
                return {
                    sufijo: 'MXN',
                    prefijo: '$',
                };
                break
        }
    },
    find(property, id) {
        if (Array.isArray(this[property])) {
            return this[property].find(o => o.id === parseInt(id));
        }
    },

    set(property, value, cb) {
        this[property] = value ? value : null;
        this.TriggerChange(cb, property);
    },

    push(property, value, cb) {
        if (Array.isArray(this[property])) {
            if (Array.isArray(value)) {
                this[property] = this[property].concat(value);
            } else {
                this[property].push(value);
            }
            this.TriggerChange(cb, property);
        }
    },

    addListener(callback) {
        this.listeners.push(callback);
    },

    initialValues(brands, cb){
        let curStore = this;
        let currentBrand = brands[0];
        let locations = [];
        let rooms = [];
        let brandList = !window.GFtheme.BrandID ? brands : brands.filter(brand => brand.id === window.GFtheme.BrandID);

        let loop = 0;

        console.log(brandList);

        if (brandList) {
            this.brands = brandList;
            this.currentBrand = currentBrand;
        }

        brandList.forEach(function (brand) {
            GafaFitSDKWrapper.getBrandLocationsWithoutBrand(brand.slug, {}, function (result) {
                locations = locations.concat(result.data);

                GafaFitSDKWrapper.getBrandRooms(brand.slug, {per_page: 1000}, function (result) {
                    rooms = rooms.concat(result.data);
                    loop++;

                    if (loop === brandList.length) {
                        GlobalStorage.locations = locations;
                        GlobalStorage.rooms = rooms;
                        if (cb) {
                            cb();
                        }
                    }
                });
            });
        });
    },

    addSegmentedListener(segment, callback) {
        if (segment && callback) {
            if (segment.length) {
                //array
                segment.forEach(function (singleSegment) {
                    GlobalStorage.subscribeToSegment(singleSegment, callback)
                })
            } else {
                //no array
                GlobalStorage.subscribeToSegment(segment, callback)
            }
        }
    },

    subscribeToSegment(segment, callback) {
        if (!this.segmentedListeners.hasOwnProperty(segment)) {
            this.segmentedListeners[segment] = [];
        }
        this.segmentedListeners[segment].push(callback);
    },

    TriggerChange(cb, segment) {
        //Listeners
        let listeners = this.listeners;
        if (listeners.length) {
            listeners.forEach(function (callback) {
                callback()
            })
        }
        //SegmentedListeners
        let segmentedListeners = this.segmentedListeners;

        if (segmentedListeners) {
            if (segmentedListeners.hasOwnProperty(segment)) {
                segmentedListeners[segment].forEach(function (callback) {
                    callback()
                })
            }
        }
        //Callback
        if (cb) {
            cb();
        }
    },
    dc(first, second) {
        return first.getDay
    }
};

export default GlobalStorage;