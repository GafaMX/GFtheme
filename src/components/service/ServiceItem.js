'use strict';

import React from "react";

class ServiceItem extends React.Component {
    constructor(props) {
        super(props);
    }
    render() {
        const sectionStyle = {
            backgroundImage: "url(" +this.props.service.pic+ ")",
        };

        let preC = 'GFSDK-c';
        let preE = 'GFSDK-e';
        let structureClass = preE + '-structure';
        let serviceClass = preC + '-serviceList';

        return (
            <div className={serviceClass + '__item is-active ' + structureClass}>
                <div className={structureClass + '__background'}>
                    <img className={(this.props.service.pic ? 'show' : 'hidden')} src={this.props.service.pic}/>
                </div>
                <div className={structureClass + '__container'}>
                    <div className={structureClass + '__head'}>
                        <div className={["this-image"]}>
                            <div>
                                <img className={(this.props.service.pic ? 'show' : 'hidden')} src={this.props.service.pic}/>
                                <div className={["text-center image-missing " + (this.props.service.pic ? 'hidden' : 'show')]}>Image Missing</div>
                            </div>
                        </div>
                        <div className={'this-name'}>
                            <h2>{this.props.service.name}</h2>
                        </div>
                    </div>
                    <div className={structureClass + '__footer'}>
                        <p className={'this-description'}>{this.props.service.description}</p>
                    </div>
                </div>
            </div>
        );
    }
}

export default ServiceItem;