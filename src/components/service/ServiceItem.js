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
        return (
            <div className={["service-item", "col-md-4", "service_" + this.props.service.id].join(" ")}>
                <div className={["service-item__container"].join(" ")}>
                    {/* {this.props.service.parent_service !== null && */}
                    {/* <div className="service-parent">
                        <div className={'service-parent__pic' + (this.props.service.parent_service.pic ? ' show' : ' hidden') }>
                            <img src={this.props.service.parent_service.pic}/>
                        </div>
                        <h3 className={["service-parent__name"].join(" ")}>
                            {this.props.service.parent_service.name}</h3>
                        <h5 className={["service-parent__category"].join(" ")}>
                            {this.props.service.parent_service.category}</h5>
                        <p className="service-parent__description">
                            {this.props.service.parent_service.description}</p>
                    </div> */}
                    {/* } */}
                    <div className="service-current">
                        <div className="service-current__content">
                            <h3 className={["service-current__name"].join(" ")}>
                                {this.props.service.name}</h3>
                            <h4 className={["service-current__category"].join(" ")}>
                                {this.props.service.category}</h4>
                            <p className="service-current__description">{this.props.service.description}</p>
                        </div>
                        <div style={ sectionStyle } className='service-current__pic' >
                        <div className={["text-center image-missing " + (this.props.service.pic ? 'hidden' : 'show')]}>Image Missing</div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }
}

export default ServiceItem;