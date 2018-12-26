'use strict';

import React from "react";

class ServiceItem extends React.Component {
    constructor(props) {
        super(props);
    }

    render() {
        return (
            <div className={["service-item", "col-md-4"].join(" ")}>
                <div className="service-current">
                    <img className="service-item-pic" src={this.props.service.pic}/>
                    <p className="service-item-name">{this.props.service.name}</p>
                    <p className="service-item-category">{this.props.service.category}</p>
                    <p className="service-item-description">{this.props.service.description}</p>
                </div>
                {this.props.service.parent_service !== null &&
                <div className="service-parent">
                    <img className="parent-service-item-pic" src={this.props.service.parent_service.pic}/>
                    <p className="parent-service-item-name">{this.props.service.parent_service.name}</p>
                    <p className="parent-service-item-category">{this.props.service.parent_service.category}</p>
                    <p className="parent-service-item-description">{this.props.service.parent_service.description}</p>
                </div>
                }
            </div>
        );
    }
}

export default ServiceItem;