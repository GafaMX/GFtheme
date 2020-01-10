const CalendarStorage = {
    listeners: [],
    segmentedListeners: [],
    locations: [],
    services: [],
    rooms: [],
    meetings: [],
    filter_location: null,
    filter_room: null,
    filter_service: null,
    start_date: null,
    show_login: null,
    filter_time_of_day: null,
    calendarHeight: null,
    calendarWidth: null,
    /**
     *
     * @param property
     * @returns {*}
     */
    get(property) {
        return this[property];
    },
    find(property, id) {
        if (Array.isArray(this[property])) {
            return this[property].find(o => o.id === parseInt(id));
        }
    },
    /**
     *
     * @param property
     * @param value
     * @param cb
     */
    set(property, value, cb) {
        this[property] = value ? value : null;
        this.TriggerChange(cb, property);
    },
    /**
     *
     * @param property
     * @param value
     * @param cb
     */
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
    /**
     *
     * @param callback
     */
    addListener(callback) {
        this.listeners.push(callback);
    },
    /**
     *
     * @param segment
     * @param callback
     */
    addSegmentedListener(segment, callback) {
        if (segment && callback) {
            if (segment.length) {
                //array
                segment.forEach(function (singleSegment) {
                    CalendarStorage.subscribeToSegment(singleSegment, callback)
                })
            } else {
                //no array
                CalendarStorage.subscribeToSegment(segment, callback)
            }
        }
    },
    /**
     *
     * @param segment
     * @param callback
     */
    subscribeToSegment(segment, callback) {
        if (!this.segmentedListeners.hasOwnProperty(segment)) {
            this.segmentedListeners[segment] = [];
        }
        this.segmentedListeners[segment].push(callback);
    },
    /**
     *
     * @param cb
     * @param segment
     * @constructor
     */
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

export default CalendarStorage;