'use strict';

import React from "react";
import CalendarStorage from './CalendarStorage';
import GlobalStorage from '../store/GlobalStorage';
import CalendarBody from "./CalendarBody";
import LoginRegister from "../menu/LoginRegister";

import IconSelectDownArrow from "../utils/Icons/IconSelectDownArrow";

import Loading from '../common/Loading';
// Estilos
import '../../styles/newlook/components/GFSDK-c-Calendar.scss';
import '../../styles/newlook/components/GFSDK-c-Filter.scss';
import '../../styles/newlook/elements/GFSDK-e-meeting.scss';
import '../../styles/newlook/elements/GFSDK-e-navigation.scss';
import StringStore from "../utils/Strings/StringStore";

class Calendar extends React.Component {
    constructor(props) {
        super(props);

        this.state = {
            showLogin: false,
            showRegister: false,
            meetings: [],
            filter_staff: "Todos",
            staff: [],
            filter_service: "Todos",
            services: [],
            filter_brand: "Todos",
            brands: [],
            filter_room: "Todos",
            rooms: [],
            filter_location: "Todos",
            locations: [],
            is_mounted: false,
        };

        this.selectFilter = this.selectFilter.bind(this);
        CalendarStorage.set('visualization', props.visualization);
        CalendarStorage.set('show_login', this.setShowLogin.bind(this));
        CalendarStorage.set('show_register', this.setShowRegister.bind(this));
        CalendarStorage.set('show_description', props.show_description);
        GlobalStorage.set('block_after_login', props.block_after_login);
        CalendarStorage.addSegmentedListener(['meetings'], this.setInitialValues.bind(this));
    }


    setInitialValues() {
        let comp = this;
        let meetings = CalendarStorage.get('meetings');
        let rooms = GlobalStorage.get('rooms');
        let {
            filter_service,
            filter_service_default,
            filter_staff,
            filter_staff_default,
            filter_location,
            filter_location_default,
            filter_brand,
            filter_brand_default,
            filter_room,
            filter_room_default
        } = this.props;
        let meetingsWithRoom = [];
        let meetingsLocations = [];
        let meetingsBrands = [];
        let meetingsServices = [];
        let meetingsStaff = [];
        let meetingsRooms = [];

        let preFilterStaff = 'Todos';
        let preFilterLocation = 'Todos';
        let preFilterBrand = 'Todos';
        let preFilterService = 'Todos';
        let preFilterRoom = 'Todos';

        let params = (new URL(document.location)).searchParams;
        let staffParam = window.GFtheme.StaffName.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
        let memberParams = params.get(staffParam);

        meetings = meetings.filter(function (meeting) {
            return meeting.passed === false
        });

        meetings.forEach(function (meeting) {
            let room = rooms.find(function (room) {
                return meeting.rooms_id === room.id
            });
            meeting.room = room
            meetingsWithRoom.push(meeting);
        });

        if (filter_brand) {
            meetingsWithRoom.forEach(function (meeting) {
                if (meeting.location != null && !meetingsBrands.includes(meeting.location.brand.name)) {
                    meetingsBrands.push(meeting.location.brand.name);

                    if (filter_brand_default) {
                        if (filter_brand_default === meeting.location.brand.name) {
                            preFilterBrand = meeting.location.brand.name;
                        }
                    }
                }
            });
        }

        if (filter_location) {
            meetingsWithRoom.forEach(function (meeting) {
                if (meeting.location != null && !meetingsLocations.includes(meeting.location.name)) {
                    meetingsLocations.push(meeting.location.name);

                    if (filter_location_default) {
                        if (filter_location_default === meeting.location.name) {
                            preFilterLocation = meeting.location.name;
                        }
                    }
                }
            });
        }

        if (filter_room) {
            meetingsWithRoom.forEach(function (meeting) {
                if (meeting.room != null && !meetingsRooms.includes(meeting.room.name)) {
                    meetingsRooms.push(meeting.room.name);

                    if (filter_room_default) {
                        if (filter_room_default === meeting.room.name) {
                            preFilterRoom = meeting.room.name;
                        }
                    }
                }
            });
        }

        if (filter_staff) {
            meetingsWithRoom.forEach(function (meeting) {
                if (meeting.staff != null && !meetingsStaff.includes(meeting.staff.name)) {
                    meetingsStaff.push(meeting.staff.name);

                    if (memberParams) {
                        if (memberParams === meeting.staff.slug) {
                            preFilterStaff = meeting.staff.name;
                        }
                    } else if ((meeting.staff.name + ' ' + meeting.staff.lastname) === filter_staff_default) {
                        preFilterStaff = meeting.staff.name;
                    }
                }
            });
        }

        if (filter_service) {
            meetingsWithRoom.forEach(function (meeting) {
                if (meeting.service != null && !meetingsServices.includes(meeting.service.name)) {
                    meetingsServices.push(meeting.service.name);

                    if (filter_service_default) {
                        if (filter_service_default === meeting.service.name) {
                            preFilterService = meeting.service.name;
                        }
                    }
                }
            });
        }


        setTimeout(function () {
            comp.setState({
                locations: meetingsLocations,
                brands: meetingsBrands,
                rooms: meetingsRooms,
                services: meetingsServices,
                filter_staff: preFilterStaff,
                filter_location: preFilterLocation,
                filter_brand: preFilterBrand,
                filter_service: preFilterService,
                filter_room: preFilterRoom,
                staff: meetingsStaff,
                meetings: meetings,
                is_mounted: true,
            }, comp.initExternalButtons);
        }, 3000);
    }

    /**
     * Initialize external filter buttons
     */
    initExternalButtons() {
        var buttons = document.querySelectorAll('[data-gf-theme="calendar-filter-button"]');
        var component = this;
        buttons.forEach(function (button) {
            button.addEventListener('click', component.externalFilter.bind(component, button), false);
        });
    }

    selectFilter(e) {
        let name = e.target.getAttribute('data-name');
        let value = e.target.value;

        this.setState({
            [name]: value,
        });
    }

    setShowLogin(showLogin) {
        this.setState({
            showLogin: showLogin
        });
    }

    setShowRegister(showRegister) {
        this.setState({
            showRegister: showRegister
        });
    }

    /**
     *
     * @param button
     * @param event
     */
    externalFilter(button, event) {
        var type = button.getAttribute('data-bq-calendar-filter-type');
        var type_id = button.getAttribute('data-bq-calendar-filter-id');

        if (typeof type !== "undefined" && type !== null && type !== '' &&
            typeof type_id !== "undefined" && type_id !== null && type_id !== '') {
            var data_type = type.replace(/s+$/, "");
            var prop_filter_name = `filter_${data_type}`;
            if (this.props[prop_filter_name]) {
                var elements = GlobalStorage[type];
                if (Array.isArray(elements) && elements.length) {
                    var element = elements.find(function (item) {
                        return parseInt(item.id) === parseInt(type_id);
                    });
                    if (element) {
                        var name = element.name;
                        this.setState({
                            [prop_filter_name]: name
                        }, function () {
                            var no_scroll = button.hasAttribute('data-bq-no-scroll');
                            if (!no_scroll)
                                this.refs['this-calendar'].scrollIntoView({'behavior': 'smooth'});
                        });
                    }
                }
            }
        }
    }

    render() {
        let {
            is_mounted,
            meetings,
            locations,
            filter_location,
            rooms,
            filter_room,
            services,
            filter_service,
            staff,
            filter_staff,
            brands,
            filter_brand
        } = this.state;
        let preC = 'GFSDK-c';
        let preE = 'GFSDK-e';
        let formClass = preE + '-form';
        let filterClass = preC + '-filter';
        let calendarClass = preC + '-Calendar';
        let widthDimension = CalendarStorage.get('calendarWidth');
        let heightDimension = CalendarStorage.get('calendarHeight');
        let visualization = CalendarStorage.get('visualization');

        const mystyles = {
            width: widthDimension + 'px',
        };

        if (filter_location && filter_location != 'Todos') {
            meetings = meetings.filter(function (meeting) {
                return meeting.location.name === filter_location
            });
        }

        if (filter_room && filter_room != 'Todos') {
            meetings = meetings.filter(function (meeting) {
                return meeting.room.name === filter_room
            });
        }

        if (filter_service && filter_service != 'Todos') {
            meetings = meetings.filter(function (meeting) {
                return meeting.service.name === filter_service
            });
        }

        if (filter_brand && filter_brand != 'Todos') {
            meetings = meetings.filter(function (meeting) {
                return meeting.location.brand.name === filter_brand
            });
        }

        if (filter_staff && filter_staff != 'Todos') {
            meetings = meetings.filter(function (meeting) {
                return meeting.staff.name === filter_staff
            });
        }

        let head_class = '__head-' + (visualization === 'vertical' ? visualization : 'horizontal');

        return (
            <div className={calendarClass}>
                <div className={calendarClass + '__container'} style={mystyles} ref={'this-calendar'}>
                    {is_mounted
                        ?
                        <div className={calendarClass + head_class}>
                            {brands.length <= 1 && locations.length <= 1 &&
                            rooms.length <= 1 && staff.length <= 1 &&
                            services.length <= 1
                                ?
                                null
                                :
                                <p className={formClass + '__label'}>{StringStore.get('FILTER_LABEL')}:</p>
                            }
                            <div className={calendarClass + '__filter ' + filterClass}>
                                <div
                                    className={filterClass + '__item is-brand-filter' + (brands.length <= 1 ? ' is-empty' : '')}>
                                    <select className={formClass + '__select'}
                                            data-name="filter_brand"
                                            value={filter_brand}
                                            onChange={this.selectFilter}
                                    >
                                        <option value={'Todos'}>{StringStore.get('FILTER_ALL_BRANDS')}</option>
                                        {brands.map(brand => {
                                            return <option value={brand} key={brand}>{brand}</option>
                                        })}
                                    </select>
                                    <div className={filterClass + '__item-icon'}>
                                        <IconSelectDownArrow/>
                                    </div>
                                </div>

                                <div
                                    className={filterClass + '__item is-location-filter' + (locations.length <= 1 ? ' is-empty' : '')}>
                                    <select className={formClass + '__select'} data-name="filter_location"
                                            data-origin="locations"
                                            value={filter_location}
                                            onChange={this.selectFilter}
                                    >
                                        <option value={'Todos'}>{StringStore.get('FILTER_ALL_LOCATIONS')}</option>
                                        {locations.map(location => {
                                            return <option value={location}
                                                           key={location}>{location}</option>
                                        })}
                                    </select>
                                    <div className={filterClass + '__item-icon'}>
                                        <IconSelectDownArrow/>
                                    </div>
                                </div>

                                <div
                                    className={filterClass + '__item is-room-filter' + (rooms.length <= 1 ? ' is-empty' : '')}>
                                    <select className={formClass + '__select'}
                                            data-name="filter_room"
                                            value={filter_room}
                                            onChange={this.selectFilter}
                                    >
                                        <option value={'Todos'}>{StringStore.get('FILTER_ALL_ROOMS')}</option>
                                        {rooms.map(room => {
                                            return <option value={room} key={room}>{room}</option>
                                        })}
                                    </select>
                                    <div className={filterClass + '__item-icon'}>
                                        <IconSelectDownArrow/>
                                    </div>
                                </div>

                                <div
                                    className={filterClass + '__item is-staff-filter' + (staff.length <= 1 ? ' is-empty' : '')}>
                                    <select className={formClass + '__select'}
                                            data-name="filter_staff"
                                            value={filter_staff}
                                            onChange={this.selectFilter}
                                    >
                                        <option value={'Todos'}>{window.GFtheme.StaffName}</option>
                                        {staff.map(person => {
                                            return <option value={person} key={person}>{person.toLowerCase()}</option>
                                        })}
                                    </select>
                                    <div className={filterClass + '__item-icon'}>
                                        <IconSelectDownArrow/>
                                    </div>
                                </div>

                                <div
                                    className={filterClass + '__item is-service-filter' + (services.length <= 1 ? ' is-empty' : '')}>
                                    <select className={formClass + '__select'}
                                            data-name="filter_service"
                                            value={filter_service}
                                            onChange={this.selectFilter}
                                    >
                                        <option value={'Todos'}>{StringStore.get('FILTER_ALL_SERVICES')}</option>
                                        {services.map(service => {
                                            return <option value={service}
                                                           key={service}>{service}</option>
                                        })}
                                    </select>
                                    <div className={filterClass + '__item-icon'}>
                                        <IconSelectDownArrow/>
                                    </div>
                                </div>
                            </div>
                        </div>
                        : null
                    }
                    {is_mounted
                        ?
                        <CalendarBody
                            meetings={meetings}
                            limit={this.props.limit}
                            openFancy={this.openFancy}
                            closedFancy={this.closedFancy}
                            login_initial={this.props.login_initial}
                        />
                        :
                        <Loading/>
                    }
                </div>

                {this.state.showRegister &&
                    <LoginRegister setShowRegister={this.setShowRegister.bind(this)}/>
                }

                {this.state.showLogin &&
                    <LoginRegister setShowLogin={this.setShowLogin.bind(this)}/>
                }
            </div>
        );
    }
}

export default Calendar;
