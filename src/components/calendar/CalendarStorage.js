const CalendarStorage = {
    listeners: [],
    segmentedListeners: [],

    locations: [],
    services: [],

    staff: [],

    show_login: null,
    show_register: null,


    rooms: [],
    meetings: [],
    currentLocation: null,
    filter_location: null,
    filter_room: null,
    filter_service: null,
    filter_staff: null,
    start_date: null,
    filter_time_of_day: null,
    calendarHeight: null,
    calendarWidth: null,
    show_description: false,
    visualization: false,
    show_parent: false,

    // Cuenta cuantas peticiones de reuniones siguen pendientes (una por cada
    // tramo de fechas x ubicacion/sala que dispara GafaThemeSDK.renderMeetingsCalendar).
    // Sirve para mostrar un indicador chico de "cargando mas dias..." mientras
    // la primera semana ya se ve real pero el resto sigue en camino.
    pendingMeetingRequests: 0,

    /**
     *
     * @param property
     * @returns {*}
     */
    get(property) {
        return this[property];
    },
    resetValues() {
        this.locations = [];
        this.services = [];
        this.staff = [];
        this.show_login = null;
        this.show_register = null;
        this.rooms = [];
        this.meetings = [];
        this.currentLocation = null;
        this.filter_location = null;
        this.filter_room = null;
        this.filter_service = null;
        this.filter_staff = null;
        this.start_date = null;
        this.filter_time_of_day = null;
        this.calendarHeight = null;
        this.calendarWidth = null;
        this.show_description = false;
        this.visualization = false;
        this.show_parent = false;
        this.pendingMeetingRequests = 0;
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
        if (property === 'start_date') {
            const currentDate = new Date(); // Fecha actual
            currentDate.setHours(0, 0, 0, 0); // Ignorar hora, minuto, etc.
    
            const newDate = new Date(value); // Fecha a configurar
            newDate.setHours(0, 0, 0, 0); // comparar solo fechas
    
            if (newDate < currentDate) {
                console.warn(`Ignorando cambio de fecha start_date: ${newDate} es anterior a (${currentDate}).`);
                return; // No permitimos el cambio
            }
        }
    
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
    removeSegmentedListener(segment, callback) {
        if (segment && callback) {
            if (segment.length) {
                segment.forEach(function (singleSegment) {
                    CalendarStorage.unsubscribeFromSegment(singleSegment, callback)
                })
            } else {
                CalendarStorage.unsubscribeFromSegment(segment, callback)
            }
        }
    },
    unsubscribeFromSegment(segment, callback) {
        if (this.segmentedListeners.hasOwnProperty(segment)) {
            const index = this.segmentedListeners[segment].indexOf(callback);
            if (index > -1) {
                this.segmentedListeners[segment].splice(index, 1);
            }
        }
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