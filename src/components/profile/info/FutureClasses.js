'use strict';

import React from 'react';
import GlobalStorage from '../../store/GlobalStorage';
import Strings from "../../utils/Strings/Strings_ES";
import CalendarStorage from '../../calendar/CalendarStorage';
import ClassItem from "./ClassItem";
import GafaFitSDKWrapper from "../../utils/GafaFitSDKWrapper";
import Slider from "react-slick";
import 'slick-carousel/slick/slick.css';
import 'slick-carousel/slick/slick-theme.css';
import IconLeftArrow from "../../utils/Icons/IconLeftArrow";
import IconRightArrow from "../../utils/Icons/IconRightArrow";

class FutureClasses extends React.Component {
   constructor(props) {
      super(props);
      this.state = {
         list: [],
         counterBuyItems: '',
      }

      this.getFutureClasses = this.getFutureClasses.bind(this);
      CalendarStorage.addSegmentedListener(['filter_location'], this.updateFutureClasses.bind(this));
   }

   componentDidMount() {
      this.getFutureClasses();
   }

   getFutureClasses(){
      const currentComponent = this;
      let brands = GlobalStorage.get(brands);
      let futureClassesList = [];

      // brands.forEach(function(brand){
         // GafaFitSDKWrapper.getUserFutureReservationsInBrand(
         //    brand.slug,
         //    {reducePopulation: true,},
         //    function (result) {

         //    // TODO: futureClassesList = 

         //    GlobalStorage.set('future_classes', result);
         //    currentComponent.setState({list: result});
         // });
      // })
   }

   updateFutureClasses(){
      let location = CalendarStorage.get('filter_location');
      let classes = GlobalStorage.get('future_classes');

      if(location){
         classes = classes.filter(function (item) {return item.locations_id === location.id; });
      }

      this.setState({list: classes});
   }

   // updateList(list) {
   //    this.setState({
   //       list: list
   //    });
   // }

    render() {
      let preC = 'GFSDK-c';
      let preE = 'GFSDK-e';
      let profileClass = preC + '-profile';
      let ordersClass = preC + '-orders';
      let formClass = preE + '-form';

      const listItems = this.state.list.map((reservation) =>
         <ClassItem key={reservation.id} reservation={reservation} id={reservation.id}/>
      );

      return (
         <div className={profileClass + '__section is-futureClass'}>
            
            {this.state.list.length > 0
               ?  <div className={ ordersClass + '__section'}>{listItems}</div>
               :  <div className="is-empty">
                     <div className="is-notification">
                        <h3>No cuentas con próximas {window.GFtheme.ClassName}</h3>
                        {/* <p>Lorem ipsum dolor sit amet</p> */}
                     </div>
                  </div>
            }
         </div>
      )
   }
}

export default FutureClasses;