'use strict';

import React from "react";
import StringStore from "../../utils/Strings/StringStore";
import WaitlistItem from "./WaitlistItem";
import GlobalStorage from "../../store/GlobalStorage";
import ClassItem from "./ClassItem";

export default class FutureWaitlist extends React.Component {
    constructor(props) {
        super(props);

        this.state = {
            list: []
        };

        this.updateFutureWaitlists = this.updateFutureWaitlists.bind(this);
        GlobalStorage.addSegmentedListener(['future_classes', 'filter_location', 'filter_brand'], this.updateFutureWaitlists);
    }
    componentWillUnmount() {
        GlobalStorage.removeSegmentedListener(['future_classes', 'filter_location', 'filter_brand'], this.updateFutureWaitlists);
    }

    updateFutureWaitlists() {
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
        let list=this.state.list;

        let wailistItems = list.length > 0
            ? list.flatMap(item =>
                item.waitlists.map(reservation => {
                        return (<WaitlistItem key={`future-waitlist-list--${reservation.id}`} waitlist={reservation}/>)
                })
            )
            : [];


        return (
            <div className={profileClass + '__section is-futureClass'}>

                {wailistItems.length > 0
                    ? <div className={ordersClass + '__section'}>
                        {wailistItems}
                    </div>
                    : <div className="is-empty">
                        <div className="is-notification">
                            <h3>{StringStore.get('PROFILE_NO_UPCOMING_CLASSES', [window.GFtheme.ClassName])}</h3>
                        </div>
                    </div>
                }
            </div>
        );
    }
}
