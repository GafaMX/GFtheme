'use strict';

import React from "react";

class ServiceItem extends React.Component {
    constructor(props) {
        super(props);
    }

    render() {
        const sectionStyle = {
            backgroundImage: "url(" + this.props.service.pic + ")",
        };

        let preC = 'GFSDK-c';
        let preE = 'GFSDK-e';
        let serviceItemClass = preE + '-service';
        let serviceClass = preC + '-serviceList';

        return (
            <div className={serviceClass + '__item is-active ' + serviceItemClass}
                 data-service-id={this.props.service.id}>
                <div className={serviceItemClass + '__container'}>
                    <div className={serviceItemClass + '__head'}>
                        <h3 className="this-name">{this.props.service.name}</h3>
                    </div>
                    {/* <div className={serviceItemClass + '__footer'}>
                        <p className={'this-description'}>{this.props.service.description}</p>
                    </div> */}
                </div>
            </div>
        );
    }
}

export default ServiceItem;