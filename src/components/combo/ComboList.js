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
         list: this.props.list,
         weAreHome: false,
         per_slide: this.props.per_slide,
      };

      GlobalStorage.addSegmentedListener(['currentLocation'], this.updateComboList.bind(this));
   }

   componentDidMount(){
      let comp = this;
      let origin = window.location.origin + '/';
      let href = window.location.href;

      if(origin === href){
         comp.setState({
               weAreHome : true
         });
      }
   }

   updateComboList(){
      let component = this;
      let currentLocation = GlobalStorage.get('currentLocation');
      GafaFitSDKWrapper.getComboListWithoutBrand(currentLocation.brand.slug,
         {
               per_page: 1000,
               only_actives: true,
               propagate: true,
         }, function (result) {
               component.setState({
                  list: result.data
               });
      });
   }

   setShowLogin(showLogin) {
      this.setState({
         showLogin: showLogin
      });
   }

   updatePaginationData(result) {
      this.setState({
         list: result.data,
         currentPage: result.current_page
      })
   }

   render() {
      let preC = 'GFSDK-c';
      let preE = 'GFSDK-e';
      let comboClass = preC + '-comboList';
      let paginationClass = preE + '-pagination';
      let buttonClass = preE + '-buttons';

      function NextArrow(props){
         const {className, onClick} = props;
         return (
            <div className={className + ' ' + paginationClass + '__controls is-next'}>
               <button className={buttonClass + ' ' + buttonClass + '--icon is-primary is-small'} onClick={onClick}>
                  <IconRightArrow />
               </button>
            </div>
         );
      };
   
      function PrevArrow(props){
         const {className, onClick} = props;
         return (
            <div className={className + ' ' + paginationClass + '__controls is-prev'}>
               <button className={buttonClass + ' ' + buttonClass + '--icon is-primary is-small'} onClick={onClick}>
                  <IconLeftArrow />
               </button>
            </div>
         );
      };

      let settings = {
         dots: true,
         speed: 500,
         infinite: false,
         slidesToShow: this.state.per_slide,
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

      const listItems = this.state.list.map((combo) => {
            if(combo.hide_in_front){
               if(combo.hide_in_front === false || combo.hide_in_front === 0){
                  if(
                     this.state.weAreHome === false && combo.status === 'active' ||
                     this.state.weAreHome === true && combo.status === 'active' && combo.hide_in_home === true
                  ){
                     if(this.props.filterByName){
                        if(combo.name.includes(this.props.filterByName)){
                           return <ComboItem key={combo.id} combo={combo} has_button={this.props.has_button} setShowLogin={this.setShowLogin.bind(this)}/>
                        } 
                     } else {
                        return <ComboItem key={combo.id} combo={combo} has_button={this.props.has_button} setShowLogin={this.setShowLogin.bind(this)}/>
                     }
                  }
               }
            } else {
               if(combo.hide_in_home === false){
                  if(this.state.weAreHome === false && combo.status === 'active' || this.state.weAreHome === true && combo.status === 'active'){
                     if(this.props.filterByName){
                        if(combo.name.includes(this.props.filterByName)){
                           return <ComboItem key={combo.id} combo={combo} has_button={this.props.has_button} setShowLogin={this.setShowLogin.bind(this)}/>
                        } 
                     } else {
                        return <ComboItem key={combo.id} combo={combo} has_button={this.props.has_button} setShowLogin={this.setShowLogin.bind(this)}/>
                     }
                  }
               }
            }
         }
      );
      return (
         <div className={comboClass}>
            <Slider {...settings} className={(comboClass + '__container ')}>
               {listItems}
            </Slider>

            {this.state.showLogin &&
               <LoginRegister setShowLogin={this.setShowLogin.bind(this)}/>
            }
         </div>
      );
   }
}

export default ComboList;

