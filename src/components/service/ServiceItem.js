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
        let staffClass = preC + '-staffList';

        return (
            <div className={staffClass + 'item ' + structureClass}>
                <div className={structureClass + '__head'}>
                    <div className={["this-image"]}>
                        <img className={(this.props.service.pic ? 'show' : 'hidden')} src={this.props.service.pic}/>
                        <div className={["text-center image-missing " + (this.props.service.pic ? 'hidden' : 'show')]}>Image Missing</div>
                    </div>
                </div>
                <div className={structureClass + '__body'}>
                    <h2 className={'this-name'}>{this.props.service.name}</h2>
                    <p className={'this-job'}>{this.props.service.category}</p>
                </div>
                <div className={structureClass + '__footer'}>
                    <p className={'this-description'}>{this.props.service.description}</p>
                </div>
            </div>
        );
    }
}

export default ServiceItem;