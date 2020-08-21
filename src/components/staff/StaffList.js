'use strict';

import React from "react";
import StaffItem from "./StaffItem";
// import Strings from "../utils/Strings/Strings_ES";
// import PaginationList from "../utils/PaginationList";
import GafaFitSDKWrapper from "../utils/GafaFitSDKWrapper";
import GlobalStorage from "../store/GlobalStorage";

import Slider from "react-slick";
import 'slick-carousel/slick/slick.css';
import 'slick-carousel/slick/slick-theme.css';

import IconSelectDownArrow from "../utils/Icons/IconSelectDownArrow";

// Estilos
import '../../styles/newlook/components/GFSDK-c-Filter.scss';
import '../../styles/newlook/components/GFSDK-c-StaffServices.scss';

import '../../styles/newlook/elements/GFSDK-e-structure.scss';
import '../../styles/newlook/elements/GFSDK-e-form.scss';


class StaffList extends React.Component {
   constructor(props) {
      super(props);
      this.state = {
         brands: [],
         filter_brand: 'TODOS',
         jobs: [],
         filter_job: 'TODOS',
         list: [],
         is_mounted: false,
      };


      this.change = this.change.bind(this);

      GlobalStorage.addSegmentedListener(['staff'], this.setInitialValues.bind(this));
   }

   setInitialValues(){
      let comp = this;
      let origin = window.location.origin + '/';
      let href = window.location.href;
      let staff = GlobalStorage.get('staff');
      let brands = GlobalStorage.get('brands');
      let staffJobs = [];
      let staffBrands = [];

      let weAreHome = false;

      staff = staff.filter(function(person){return person.status === 'active'});

      if(origin === href){
         weAreHome = true;
      }

      if(weAreHome === true){
         staff = staff.filter(function(person){ return person.hide_in_home === false });
      }

      staff.forEach(function(person){
         if(person.job != null && !staffJobs.includes(person.job.toUpperCase())){
            staffJobs.push(person.job.toUpperCase());
         }
      })

      staff.forEach(function(person){
         if(person.brand != null && !staffBrands.includes(person.brand.name.toUpperCase())){
            staffBrands.push(person.brand.name.toUpperCase());
         }
      })

      if(staff){
         comp.setState({
            is_mounted: true,
            list : staff,
            jobs : staffJobs,
            brands : staffBrands,
         });
      }
   }

   // updateRows() {
   //    let comp = this;
   //    let classes = comp.state.list.length;
   //    if (classes < 10 ){
   //       comp.setState({ 
   //          sliderRows : 1,
   //       });
   //    } else if (classes >= 10 ){
   //       comp.setState({ 
   //          sliderRows : 2,
   //       });
   //    }
   // }

   change(e) {
      let name = e.target.getAttribute('data-name');
      let value = e.target.value;
      let {filter_job, filter_brand, list, is_mounted} = this.state;

      this.setState({
         [name]: value
      });
   }

   render() {
      let {list, filter_job, jobs, filter_brand, brands, is_mounted} = this.state;
      let listItems = [];

      if(filter_job && filter_job != 'TODOS'){
         list = list.filter(function(person){ return person.job.toUpperCase() === filter_job});
      }

      if(filter_brand && filter_brand != 'TODOS'){
         list = list.filter(function(person){ return person.brand.name.toUpperCase() === filter_brand});
      }

      if(list){
         listItems = list.map(function(person){
            return <StaffItem key={person.id} staff={person}/>
         });
      }

      let preC = 'GFSDK-c';
      let preE = 'GFSDK-e';
      let staffClass = preC + '-staffList';
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
                     rows: 1,
                     slidesToShow: 1,
                     slidesToScroll: 1,
                  }
               },
               {
                  breakpoint: 769,
                  settings: {
                     rows: 1,
                     slidesToShow: 2,
                     slidesToScroll: 2,
                  }
               },
               {
                  breakpoint: 1025,
                  settings: {
                     rows: 1,
                     slidesToShow: 3,
                     slidesToScroll: 3,
                  }
               },
         ],
      };

      return (
         <div className={staffClass}>
            <div className={staffClass + '__header'}>
               <div className={filterClass}>
                  {jobs.length > 1
                     ? <div className={filterClass + '__item is-job-filter'}>
                        <select className={formClass + '__select' + ' is-service-filter'} onChange={this.change} value={filter_job} data-name={"filter_job"}>
                           <option value={'TODOS'}>Todos</option>
                           {jobs.map(job => {
                              return <option key={job} value={job} > {job} </option>
                           })}
                        </select>
                        <div className={filterClass + '__item-icon'}>
                           <IconSelectDownArrow />
                        </div>
                     </div>
                     : null
                  }

                  {brands.length > 1
                     ?  <div className={filterClass + '__item is-brand-filter'}>
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
               <div className={staffClass + '__body'}>
                  <Slider {...settings}>
                     {listItems}
                  </Slider>
               </div>

               : 
               <div>
                  <p>Cargando...</p>
               </div>
            }  
         </div>
      );
   }
}

export default StaffList;