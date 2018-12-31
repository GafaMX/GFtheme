'use strict';

import React from "react";

class ServiceItem extends React.Component {
    constructor(props) {
        super(props);
    }

    render() {
        return (
            <div className={["service-item-container", "col-md-4"].join(" ")}>
                <div className={["service-item", "mb-4", "card", "shadow-sm"].join(" ")}>
                    <div className="service-current">
                        <img className={["service-item-pic", "mb-4"].join(" ")} src={this.props.service.pic}/>
                        <h3 className={["font-weight-normal", "service-item-name"].join(" ")}>
                            {this.props.service.name}</h3>
                        <h5 className={["font-weight-normal", "service-item-category"].join(" ")}>
                            {this.props.service.category}</h5>
                        <p className="service-item-description">{this.props.service.description}</p>
                    </div>
                    {this.props.service.parent_service !== null &&
                    <div className="service-parent">
                        <img className={["parent-service-item-pic", "mb-4"].join(" ")}
                             src={this.props.service.parent_service.pic}/>
                        <h3 className={["font-weight-normal", "parent-service-item-name"].join(" ")}>
                            {this.props.service.parent_service.name}</h3>
                        <h5 className={["font-weight-normal", "parent-service-item-category"].join(" ")}>
                            {this.props.service.parent_service.category}</h5>
                        <p className="parent-service-item-description">
                            {this.props.service.parent_service.description}</p>
                    </div>
                    }
                </div>
            </div>
        );
    }
}

export default ServiceItem;