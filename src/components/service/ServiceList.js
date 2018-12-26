'use strict';

import React from "react";
import ServiceItem from "./ServiceItem";

class ServiceList extends React.Component {
    constructor(props) {
        super(props);
    }

    render() {
        const listItems = this.props.list.map((service) =>
            <ServiceItem key={service.id} service={service}/>
        );
        return (
            <div className={["service-list", "container"].join(" ")}>
                <div className={["row"].join(" ")}>
                    {listItems}
                </div>
            </div>
        );
    }
}

export default ServiceList;

