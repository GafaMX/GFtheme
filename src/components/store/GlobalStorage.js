const GlobalStorage = {
    listeners: [],
    segmentedListeners: [],
    me: null,

    get(property) {
        return this[property];
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