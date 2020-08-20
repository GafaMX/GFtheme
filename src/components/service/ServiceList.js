'use strict';

import React from "react";
import ServiceItem from "./ServiceItem";
import Strings from "../utils/Strings/Strings_ES";
import PaginationList from "../utils/PaginationList";
import GafaFitSDKWrapper from "../utils/GafaFitSDKWrapper";
import GlobalStorage from "../store/GlobalStorage";

import Slider from "react-slick";
import 'slick-carousel/slick/slick.css';
import 'slick-carousel/slick/slick-theme.css';

import IconSelectDownArrow from "../utils/Icons/IconSelectDownArrow";

// Estilos
import '../../styles/newlook/components/GFSDK-c-StaffServices.scss';
import '../../styles/newlook/components/GFSDK-c-Filter.scss';
import '../../styles/newlook/elements/GFSDK-e-service.scss';
import '../../styles/newlook/elements/GFSDK-e-form.scss';

class ServiceList extends React.Component {
   constructor(props) {
      super(props);
      this.state = {
         brands: [],
         filter_brand: 'TODOS',
         categories: [],
         filter_category: 'TODOS',
         list: [],
         is_mounted: false,
      };

      // this.change = this.change.bind(this);
      GlobalStorage.addSegmentedListener(['services'], this.setInitialValues.bind(this));
   }

   setInitialValues(){
      let comp = this;
      let origin = window.location.origin + '/';
      let href = window.location.href;
      let services = GlobalStorage.get('services');
      let brands = GlobalStorage.get('brands');
      let servicesCategories = [];
      let servicesBrands = [];

      let weAreHome = false;

      services = services.filter(function(service){return service.status === 'active'});

      if(origin === href){
         weAreHome = true;
      }

      if(weAreHome === true){
         services = services.filter(function(service){ return service.hide_in_home === false });
      }

      services.forEach(function(service){
         if(service.category != null && !servicesCategories.includes(service.category.toUpperCase())){
            servicesCategories.push(service.category.toUpperCase());
         }
      })

      services.forEach(function(service){
         if(service.brand != null && !servicesBrands.includes(service.brand.name.toUpperCase())){
            servicesBrands.push(service.brand.name.toUpperCase());
         }
      })

      if(services){
         comp.setState({
            is_mounted: true,
            list : services,
            categories : servicesCategories,
            brands : servicesBrands,
         });
      }
   }

   change(e) {
      let name = e.target.getAttribute('data-name');
      let value = e.target.value;
      let {filter_job, filter_brand, list, is_mounted} = this.state;

      this.setState({
         [name]: value
      });
   }

    render() {
      let {list, filter_category, categories, filter_brand, brands, is_mounted} = this.state;
      let listItems = [];
      
      if(filter_category && filter_category != 'TODOS'){
         list = list.filter(function(service){ return service.category.toUpperCase() === filter_category});
      }

      if(filter_brand && filter_brand != 'TODOS'){
         list = list.filter(function(service){ return service.brand.name.toUpperCase() === filter_brand});
      }

      if(list){
         listItems = list.map(function(service){
            return <ServiceItem key={service.id} service={service}/>
         });
      }

      let preC = 'GFSDK-c';
      let preE = 'GFSDK-e';
      let serviceClass = preC + '-serviceList';
      let filterClass = preC + '-filter';
      let formClass = preE + '-form';

      let settings = {
         arrows: false,
         dots: true,
         infinite: false,
         speed: 500,
         rows: 1,
         slidesToScroll: 4,
         slidesToShow: 4,
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
               breakpoint: 1025,
               settings: {
                  slidesToShow: 3,
                  slidesToScroll: 3,
               }
            },
         ],
      };

      return (
         <div className={serviceClass}>
               <div className={serviceClass + '__header'}>
                  <div className={filterClass}>
                  {!categories.length <= 1
                  ? <div className={filterClass + '__item is-job-filter'}>
                     <select className={formClass + '__select' + ' is-category-filter'} onChange={this.change} value={filter_category} data-name={"filter_category"}>
                        <option value={'TODOS'}>Todos</option>
                        {categories.map(category => {
                           return <option key={category} value={category} > {category} </option>
                        })}
                     </select>
                     <div className={filterClass + '__item-icon'}>
                        <IconSelectDownArrow />
                     </div>
                  </div>
                  : null
               }
               {!brands.length <= 1
                  ?  <div className={filterClass + '__item is-brand-filter' + (brands.length <= 1 ? 'is-empty' : '' )}>
                        <select className={formClass + '__select' + ' is-brand-filter'} onChange={this.change} value={filter_brand} data-name={"filter_brand"}>
                           <option value={'TODOS'}>Todos</option>
                           {brands.map(brand => {
                              return <option key={brand} value={brand}> {brand} </option>
                           })}
                        </select>
                        <div className={filterClass + '__item-icon'}>
                           <IconSelectDownArrow />
                        </div>
                     </div>
                  : null
               }
                  </div>
               </div>
            {is_mounted 
               ?
               <div className={serviceClass + '__body'}>
                  <Slider {...settings} className={serviceClass + '__container'}>
                        {listItems}
                  </Slider>
               </div>
               : null
            }
         </div>
      );
   }
}

export default ServiceList;

