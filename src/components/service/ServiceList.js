'use strict';

import React from "react";
import ServiceItem from "./ServiceItem";
import Strings from "../utils/Strings/Strings_ES";
import PaginationList from "../utils/PaginationList";
import GafaFitSDKWrapper from "../utils/GafaFitSDKWrapper";

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
                if (this.state.currentCategory === 'Todos' || service.category != null && service.category.toUpperCase() === this.state.currentCategory)
                    listItems.push(<ServiceItem key={service.id} service={service}/>)
            }
        );

        this.state.list.map((service) => {
                if (service.category != null && !this.state.categoryList.includes(service.category.toUpperCase())) {
                    this.state.categoryList.push(service.category.toUpperCase());
                }
            }
        );

        return (
            <div>
                <h1 className={["display-4", "container", "text-center"].join(" ")}>{Strings.SERVICE_LIST}</h1>
                <div className={'categorySelector'}>
                    <select className={'col-md-5 form-control'} onChange={this.change} value={this.state.value}>
                        <option>Todos</option>
                        {this.state.categoryList.map(category => {
                            return <option key={category} value={category}>{category}</option>
                        })}
                    </select>
                </div>
                <div className={["service-list", "container"].join(" ")}>
                    <div className={["row", "mt-5", "justify-content-center", "text-center"].join(" ")}>
                        {listItems}
                    </div>
                </div>
                <PaginationList page={this.state.currentPage} perpage={this.props.perPage}
                                allpages={this.props.lastPage} itemsList={this.props.total}
                                updatePaginationData={this.updatePaginationData.bind(this)}
                                getListData={GafaFitSDKWrapper.getServiceList}/>
            </div>
        );
    }
}

export default ServiceList;

