'use strict';

import React from "react";
import ServiceItem from "./ServiceItem";
import Strings from "../utils/Strings/Strings_ES";
import PaginationList from "../utils/PaginationList";
import GafaFitSDKWrapper from "../utils/GafaFitSDKWrapper";
import GafaThemeSDK from "../GafaThemeSDK";

class ServiceList extends React.Component {
    constructor(props) {
        super(props);
        this.state={
            list:this.props.list
        }
    }


    updateList(list)
    {
        this.setState({
            list:list
        });
    }
    render() {
        const listItems = this.state.list.map((service) =>
            <ServiceItem key={service.id} service={service}/>,

        );
        return (
            <div>
                <h1 className={["display-4", "container", "text-center"].join(" ")}>{Strings.SERVICE_LIST}</h1>
                <div className={["service-list", "container"].join(" ")}>
                    <div className={["row", "mt-5", "justify-content-center", "text-center"].join(" ")}>
                        {listItems}
                    </div>
                </div>
                <PaginationList  page={this.props.currentPage} perpage={this.props.perPage}
                                 allpages={this.props.lastPage} itemsList={this.props.total}
                                 updateList={this.updateList.bind(this)}
                                 getListData={GafaFitSDKWrapper.getServiceList}/>
            </div>
        );
    }
}

export default ServiceList;

