'use strict';

import React from 'react';
import GlobalStorage from '../store/GlobalStorage';
import GafaFitSDKWrapper from "../utils/GafaFitSDKWrapper";
import CalendarStorage from '../calendar/CalendarStorage';
import PastClassItem from "./PastClassItem";
import Slider from "react-slick";
import 'slick-carousel/slick/slick.css';
import 'slick-carousel/slick/slick-theme.css';

class PastClasses extends React.Component {
    constructor(props) {
      super(props);
      this.state = {
         list: [],
      }

      this.getPastClasses = this.getPastClasses.bind(this);
      CalendarStorage.addSegmentedListener(['filter_location'], this.updatePastClasses.bind(this));
   }

   componentDidMount() {
      this.getPastClasses();
   }

   getPastClasses(){
      const currentComponent = this;
      GafaFitSDKWrapper.getUserPastReservationsInBrand({
         reducePopulation: true,
      }, function (result) {
         GlobalStorage.set('past_classes', result.data);
         currentComponent.setState({list: result.data});
      });
   }

   updatePastClasses(){
      let location = CalendarStorage.get('filter_location');
      let classes = GlobalStorage.get('past_classes');

      if(location){
         classes = classes.filter(function (item) {return item.locations_id === location.id; });
      }

      this.setState({list: classes});
   }


    render() {
        let preC = 'GFSDK-c';
        let profileClass = preC + '-profile';
        let ordersClass = preC + '-orders';

        const listItems = this.state.list.map((pastreservation) =>
            <PastClassItem key={pastreservation.id} reservation={pastreservation} id={pastreservation.id}/>
        );

        return (
            <div className={profileClass + '__section is-pastClass'}>
                {this.state.list.length > 0
                    ?   <div className={ ordersClass + '__section'}>{listItems}</div>
                    :   <div className="is-empty">
                            <div className="is-notification">
                                <h3>No cuentas con historial de {window.GFtheme.ClassName}</h3>
                            </div>
                        </div>
                }
            </div>
        );
    }
}

export default PastClasses;