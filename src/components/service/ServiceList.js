'use strict';

import React from "react";
import ServiceItem from "./ServiceItem";
import Strings from "../utils/Strings/Strings_ES";
import PaginationList from "../utils/PaginationList";
import GafaFitSDKWrapper from "../utils/GafaFitSDKWrapper";

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
            currentService: '',
        };
        this.change = this.change.bind(this);
    }


    updatePaginationData(result) {
        this.setState({
            list: result.data,
            currentPage: result.current_page
        })
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
                if ((this.state.currentCategory === 'Todos' || service.category != null && service.category.toUpperCase() === this.state.currentCategory) && (service.status != "inactive"))
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
            rows: 1,
            slidesToScroll: 5,
            slidesToShow: 5,
            responsive: [
                {
                    breakpoint: 768,
                    settings: {
                        rows: 1,
                        slidesToShow: 1,
                        slidesToScroll: 1,
                    }
                },
            ],
        };

        return (
            <div className={serviceClass}>
                <div className={filterClass}>
                    <select className={filterClass + '__item ' + formClass + '__select'} onChange={this.change} value={this.state.value}>
                        <option>Todos</option>
                        {this.state.categoryList.map(category => {
                            return <option key={category} value={category}>{category}</option>
                        })}
                    </select>
                </div>
                <Slider {...settings} className={serviceClass + '__container'}>
                    {listItems}
                </Slider>
            </div>
        );
    }
}

export default ServiceList;

