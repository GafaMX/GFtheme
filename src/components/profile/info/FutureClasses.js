'use strict';

import React from 'react';
import GlobalStorage from '../../store/GlobalStorage';
import ClassItem from "./ClassItem";
import WaitlistItem from './WaitlistItem';
import GafaFitSDKWrapper from "../../utils/GafaFitSDKWrapper";
import 'slick-carousel/slick/slick.css';
import 'slick-carousel/slick/slick-theme.css';
import StringStore from "../../utils/Strings/StringStore";

class FutureClasses extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            list: [],
            counterBuyItems: '',
        }

        this.getFutureClasses = this.getFutureClasses.bind(this);
        GlobalStorage.addSegmentedListener(['future_classes', 'filter_location', 'filter_brand'], this.updateFutureClasses.bind(this));
    }

    componentDidMount() {
        // this.getFutureClasses();
    }

    static defaultProps() {
        return {
            combineWaitlist: false,
        }
    }

    getFutureClasses() {
        const currentComponent = this;
        let brands = GlobalStorage.get('brands');
        let futureClassesList = [];

        brands.forEach(function (brand) {
            GafaFitSDKWrapper.getUserFutureReservationsInBrand(
                brand.slug,
                {reducePopulation: true,},
                function (result) {
                    futureClassesList = futureClassesList.concat(result);
                    GlobalStorage.set('future_classes', futureClassesList);
                    currentComponent.setState({list: futureClassesList});
                });
        })
    }

    updateFutureClasses() {
        let classes = GlobalStorage.get('future_classes');
        let location = GlobalStorage.get('filter_location');
        let brand = GlobalStorage.get('filter_brand');

        if (location) {
            classes = classes.filter(function (item) {
                return item.locations_id === location.id;
            });
        }

        if (brand) {
            classes = classes.filter(function (item) {
                return item.brands_id === brand.id;
            });
        }

        this.setState({list: classes});
    }

    render() {
        let preC = 'GFSDK-c';
        let preE = 'GFSDK-e';
        let profileClass = preC + '-profile';
        let ordersClass = preC + '-orders';
        let formClass = preE + '-form';

        let {combineWaitlist} = this.props;
        let {list} = this.state;

        let flat_mapped_list = list.length > 0 ? list.flatMap((item) => {
            let mapped_array = [];
            if (item.reservations.length > 0) {
                mapped_array = mapped_array.concat(item.reservations.map(reservation => {
                    reservation.is_waitlist = false;
                    return reservation;
                }));
            }
            if (item.waitlists.length > 0) {
                mapped_array = mapped_array.concat(item.waitlists.map(waitlist => {
                    waitlist.is_waitlist = true;
                    return waitlist;
                }));
            }

            return mapped_array;
        }) : [];


        flat_mapped_list.sort((a, b) => {
            return a.meeting_start < b.meeting_start ? -1 : (a.meeting_start > b.meeting_start ? 1 : 0);
        });

        let listItems = flat_mapped_list.length > 0
            ? flat_mapped_list.map(reservation => {
                if (reservation.is_waitlist) {
                    if (combineWaitlist) {
                        return (
                            <WaitlistItem key={`future-waitlist-list--${reservation.id}`} waitlist={reservation}/>)
                    }
                } else {
                    let key = reservation.is_overbooking === 1 ? `future-reservation-overbooking-list--${reservation.id}` : `future-reservation-list--${reservation.id}`

                    return (<ClassItem key={key} reservation={reservation} id={reservation.id}/>)
                }
            })
            : [];

        // let listItems = reservationsList;

        // if (combineWaitlist) {
        //     let wailistItems = list.length > 0
        //         ? list.flatMap(item =>
        //             item.waitlists.map(reservation => {
        //                 return (<WaitlistItem key={`future-waitlist-list--${reservation.id}`} waitlist={reservation}/>)
        //             })
        //         )
        //         : [];
        //
        //     listItems = listItems.concat(wailistItems);
        // }


        // const wailistItems = this.state.list.length > 0
        //     ? this.state.list.flatMap(item =>
        //         (item.waitlists && Array.isArray(item.waitlists))
        //             ? item.waitlists.map(waitlist =>
        //                 <WaitlistItem key={waitlist.id} waitlist={waitlist}/>
        //             )
        //             : []
        //     )
        //     : [];


        return (
            <div className={profileClass + '__section is-futureClass'}>

                {listItems.length > 0
                    ? <div className={ordersClass + '__section'}>{listItems}{/*wailistItems*/}</div>
                    : <div className="is-empty">
                        <div className="is-notification">
                            <h3>{StringStore.get('PROFILE_NO_UPCOMING_CLASSES', [window.GFtheme.ClassName])}</h3>
                            {/* <p>Lorem ipsum dolor sit amet</p> */}
                        </div>
                    </div>
                }
            </div>
        );
    }
}

export default FutureClasses;
