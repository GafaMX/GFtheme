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

        const listItems = this.state.list.length > 0
            ? this.state.list.flatMap(item =>
                item.reservations.map(reservation => {
                    if (reservation.is_waitlist) {
                        // return (<WaitlistItem key={`future-waitlist-list--${reservation.id}`} waitlist={reservation}/>)
                    } else {
                        let key = reservation.is_overbooking === 1 ? `future-reservation-overbooking-list--${reservation.id}` : `future-reservation-list--${reservation.id}`

                        return (<ClassItem key={key} reservation={reservation} id={reservation.id}/>)
                    }
                })
            )
            : [];


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

                {this.state.list.length > 0
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
