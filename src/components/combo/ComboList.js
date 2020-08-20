'use strict';

import React from "react";
import ComboItem from "./ComboItem";
// import Strings from "../utils/Strings/Strings_ES";
import PaginationList from "../utils/PaginationList";
import GafaFitSDKWrapper from "../utils/GafaFitSDKWrapper";
import GafaThemeSDK from "../GafaThemeSDK";
import LoginRegister from "../menu/LoginRegister";
import Slider from "react-slick";
import 'slick-carousel/slick/slick.css';
import 'slick-carousel/slick/slick-theme.css';
import IconLeftArrow from "../utils/Icons/IconLeftArrow";
import IconRightArrow from "../utils/Icons/IconRightArrow";

//Estilos
import '../../styles/newlook/components/GFSDK-c-PackagesMemberships.scss';
import '../../styles/newlook/elements/GFSDK-e-product.scss';
import GlobalStorage from "../store/GlobalStorage";

class ComboList extends React.Component {
   constructor(props) {
      super(props);

      this.state = {
         showLogin: false,
         showRegister: false,
         list: [],
         is_mounted: false,
      };

      this.setShowRegister = this.setShowRegister.bind(this);
      GlobalStorage.addSegmentedListener(['combos'], this.setInitialValues.bind(this));
   }

   setInitialValues(){
      let comp = this;
      let origin = window.location.origin + '/';
      let href = window.location.href;
      let {filterByName, filterByBrand} = this.props;
      let combos = GlobalStorage.get('combos');

      let weAreHome = false;

      if(origin === href){
         weAreHome = true;
      }

      combos = combos.filter(function(combo){ return combo.status === 'active' && combo.hide_in_front === false});
      
      if(weAreHome === true){
         combos = combos.filter(function(combo){ 
            return combo.hide_in_home === false
         });
      }

      if(filterByName){
         combos = combos.filter(function(combo){
            return combo.name.toUpperCase().includes(filterByName.toUpperCase());
         });
      }

      if(filterByBrand){
         combos = combos.filter(function(combo){
            return combo.brand.name.toUpperCase().includes(filterByBrand.toUpperCase());
         });
      }

      if(combos){
         comp.setState({
            list : combos,
            is_mounted: true,
         });
      }
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

   // updatePaginationData(result) {
   //    this.setState({
   //       list: result.data,
   //       currentPage: result.current_page
   //    })
   // }

   render() {
      let preC = 'GFSDK-c';
      let preE = 'GFSDK-e';
      let {list, showLogin, showRegister, is_mounted} = this.state;
      let comboClass = preC + '-comboList';
      let paginationClass = preE + '-pagination';
      let buttonClass = preE + '-buttons';
      let listItems = [];

      function NextArrow(props){
         const {className, onClick} = props;
         return (
            <div className={className + ' ' + paginationClass + '__controls is-next'}>
               <button className={buttonClass + ' ' + buttonClass + '--icon'} onClick={onClick}>
                  <IconRightArrow />
               </button>
            </div>
         );
      };
   
      function PrevArrow(props){
         const {className, onClick} = props;
         return (
            <div className={className + ' ' + paginationClass + '__controls is-prev'}>
               <button className={buttonClass + ' ' + buttonClass + '--icon'} onClick={onClick}>
                  <IconLeftArrow />
               </button>
            </div>
         );
      };

      let settings = {
         dots: false,
         speed: 500,
         infinite: false,
         slidesToShow: 4,
         slidesToScroll: 1,
         prevArrow: <PrevArrow />,
         nextArrow: <NextArrow />,
         responsive: [
            {
               breakpoint: 481,
               settings: {
                  slidesToShow: 1,
                  slidesToScroll: 1,
               }
            },
            {
               breakpoint: 769,
               settings: {
                  slidesToShow: 2,
                  slidesToScroll: 2,
               }
            },
            {
               breakpoint: 992,
               settings: {
                  slidesToShow: 3,
                  slidesToScroll: 3,
               }
            },
            {
               breakpoint: 1200,
               settings: {
                  slidesToShow: 4,
                  slidesToScroll: 1,
               }
            },
         ],
      };

      if(list){
         let comp = this;

         listItems = list.map(function(combo){
            return <ComboItem key={combo.id} combo={combo} setShowRegister={comp.setShowRegister}/>
         });
      }
      
      return (
         <div className={comboClass}>
            {is_mounted 
               ?
                  <Slider {...settings} className={(comboClass + '__container ')}>
                     {listItems.length > 0
                        ?  listItems
                        :  null
                     }
                  </Slider>
               : <p>Cargando...</p>
            }

            {showRegister &&
               <LoginRegister setShowRegister={this.setShowRegister.bind(this)}/>
            }
         </div>
      );
   }
}

export default ComboList;

