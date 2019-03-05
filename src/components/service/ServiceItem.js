'use strict';

import React from "react";

class ServiceItem extends React.Component {
    constructor(props) {
        super(props);
    }

    render() {
        return (
            <div className={["service-item", "col-md-4", "service_" + this.props.service.id].join(" ")}>
                <div className={["service-item__container", "mb-4", "card", "shadow-sm"].join(" ")}>
                    {this.props.service.parent_service !== null &&
                    <div className="service-parent">
                        <div className={'service-item__pic' + (this.props.service.parent_service.pic ? ' show' : ' hidden') }>
                            <img src={this.props.service.parent_service.pic}/>
                        </div>
                        <h3 className={["parent-service-item__name"].join(" ")}>
                            {this.props.service.parent_service.name}</h3>
                        <h5 className={["parent-service-item__category"].join(" ")}>
                            {this.props.service.parent_service.category}</h5>
                        <p className="parent-service-item__description">
                            {this.props.service.parent_service.description}</p>
                    </div>
                    }
                    <div className="service-current">
                        <div className={'service-item__pic' + (this.props.service.pic ? ' show' : ' hidden') }>
                            <img src={this.props.service.pic}/>
                        </div>
                        <h3 className={["service-item__name"].join(" ")}>
                            {this.props.service.name}</h3>
                        <h5 className={["service-item__category"].join(" ")}>
                            {this.props.service.category}</h5>
                        <p className="service-item__description">{this.props.service.description}</p>
                    </div>
                </div>
            </div>
        );
    }
}

export default ServiceItem;