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

// Estilos
import '../../styles/newlook/components/GFSDK-c-StaffServices.scss';
import '../../styles/newlook/components/GFSDK-c-Filter.scss';
import '../../styles/newlook/elements/GFSDK-e-structure.scss';
import '../../styles/newlook/elements/GFSDK-e-form.scss';

class ServiceList extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            list: this.props.list,
            currentPage: this.props.currentPage,
            categoryList: [],
            currentCategory: 'Todos',
            nameList: [],
            sliderRows: 1,
            currentService: '',
        };
        this.change = this.change.bind(this);

        GlobalStorage.addSegmentedListener(['currentLocation'], this.updateServiceList.bind(this));
    }

    updatePaginationData(result) {
        this.setState({
            list: result.data,
            currentPage: result.current_page
        })
    }

    updateServiceList(){
        let component = this;
        let currentLocation = GlobalStorage.get('currentLocation');

        GafaFitSDKWrapper.getServiceListWithoutBrand(
            currentLocation.brand.slug,
            {
                per_page: 10,
            }, function (result) {
                component.setState({
                    list: result.data
                });
        });
    }

    updateRows() {
        let comp = this;
        let classes = comp.state.list.length;
        if (classes <= 10 ){
            comp.setState({ 
                sliderRows : 1,
            });
        } else if (classes > 10 ){
            comp.setState({ 
                sliderRows : 2,
            });
        }
    }

    change(event) {
        this.setState({
            currentCategory: event.target.value
        })
    }

    changeService(event) {
        this.setState({
            currentCategory: event.target.value
        })
    }

    render() {
        let listItems = [];
        this.state.list.forEach((service) => {
                if ((this.state.currentCategory === 'Todos' || service.category != null && service.category.toUpperCase() === this.state.currentCategory) 
                    && (service.status != "inactive")
                    && (service.hide_in_home != true)
                )
                    listItems.push(<ServiceItem key={service.id} service={service}/>)
            }
        );

        this.state.list.map((service) => {
                if (service.category != null && !this.state.categoryList.includes(service.category.toUpperCase())) {
                    this.state.categoryList.push(service.category.toUpperCase());
                }
            }
        );

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
            rows: this.state.sliderRows,
            slidesToScroll: 5,
            slidesToShow: 5,
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
            <div className={serviceClass}>
                <div className={serviceClass + '__header'}>
                    <div className={filterClass}>
                        <div className={filterClass + '__item ' + formClass + '__section ' + (this.state.categoryList.length <= 1 ? 'is-empty' : '' )}>
                           <select className={formClass + '__select' + ' is-service-filter'} onChange={this.change} value={this.state.value}>
                              <option>Todos</option>
                              {this.state.categoryList.map(category => {
                                 return <option key={category} value={category}>{category}</option>
                              })}
                           </select>
                        </div>
                    </div>
                </div>
                <div className={serviceClass + '__body'}>
                    <Slider {...settings} className={serviceClass + '__container'}>
                        {listItems}
                    </Slider>
                </div>
            </div>
        );
    }
}

export default ServiceList;

