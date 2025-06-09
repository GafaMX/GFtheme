'use strict';

import React from 'react';
import GlobalStorage from '../store/GlobalStorage';
import GafaFitSDKWrapper from "../utils/GafaFitSDKWrapper";
import PastClassItem from "./PastClassItem";
import 'slick-carousel/slick/slick.css';
import 'slick-carousel/slick/slick-theme.css';
import StringStore from "../utils/Strings/StringStore";

class PastClasses extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            list: [],
        }

        this.getPastClasses = this.getPastClasses.bind(this);
        GlobalStorage.addSegmentedListener(['past_classes', 'filter_location', 'filter_brand'], this.updatePastClasses.bind(this));
    }

    componentDidMount() {
        this.getPastClasses();
    }

    getPastClasses() {
        const currentComponent = this;
        let brands = GlobalStorage.get('brands');
        let pastClassesList = [];

        brands.forEach(function (brand) {
            GafaFitSDKWrapper.getUserPastReservationsInBrand(
                brand.slug,
                {reducePopulation: true,},
                function (result) {
                    pastClassesList = pastClassesList.concat(result.data);
                    GlobalStorage.set('past_classes', pastClassesList);
                    currentComponent.setState({list: pastClassesList});
                });
        });
    }

    updatePastClasses() {
        let classes = GlobalStorage.get('past_classes');
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
        let profileClass = preC + '-profile';
        let ordersClass = preC + '-orders';

        const listItems = this.state.list.map((pastreservation) => {
                let key = pastreservation.is_overbooking === 1 ? `past-reservation-overbooking--${pastreservation.id}` : `past-reservation--${pastreservation.id}`;
                return (<PastClassItem key={key} reservation={pastreservation} id={pastreservation.id}/>)
            }
        );

        return (
            <div className={profileClass + '__section is-pastClass'}>
                {this.state.list.length > 0
                    ? <div className={ordersClass + '__section'}>{listItems}</div>
                    : <div className="is-empty">
                        <div className="is-notification">
                            <h3>{StringStore.get('PROFILE_NO_CLASS_HISTORY', [window.GFtheme.ClassName])}</h3>
                        </div>
                    </div>
                }
            </div>
        );
    }
}

export default PastClasses;
